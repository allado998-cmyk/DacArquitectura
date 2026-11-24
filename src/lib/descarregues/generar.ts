// Generates every document of the Descàrregues page for the account in use —
// the studio, or the demo with its own fake data and its own area of the store
// (the caller picks it with runAsActingUser) — and replaces the previous ones.
// Run by the cron (Monday, Wednesday and Friday at dawn); takes seconds.
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { zipSync, type Zippable } from "fflate";
import { fitxersArea } from "@/lib/fitxers";
import type { PdfDoc } from "@/lib/llistats/doc";
import { dedicacioStats, dedicacioStatsDoc } from "@/lib/llistats/dedicacio";
import { anyExpedient, expedientsListDoc, expedientsStats, expedientsStatsDoc } from "@/lib/llistats/expedients";
import { facturaYear, facturacioStats, facturacioStatsDoc, facturesListDoc } from "@/lib/llistats/facturacio";
import { actesListDoc, byNom, clientsListDoc, contactesListDoc, honorarisListDoc, iteListDoc, propostesListDoc } from "@/lib/llistats/llistes";
import { runAsActingUser } from "@/lib/acting-user";
import type { AppUser } from "@/lib/auth";
import { DES_DE, LLISTES, VERSIO, ZIP, anyBcn, dataHoraBcn, nomDescarrega, nomFitxer, potRegenerar, type Llista, type Manifest } from "./cataleg";
import { carregarDades, type Dades } from "./dades";
import { agafarBloqueig, deixarBloqueig, llegirManifest, publicar } from "./magatzem";
import { jpegSize, renderPdf, type Logo } from "./pdf";

export interface Document {
  llista: Llista;
  any: number | null; // the year, or the first one of a «de tots els anys» file
  finsA?: number | null; // the last year of a «de tots els anys» file
  doc: PdfDoc | PdfDoc[]; // several: one per year, each from a new page
  files: number; // rows listed
}

const plural = (n: number, u: string, p: string) => `${n} ${n === 1 ? u : p}`;

// Every list from its lowest number to its highest, as the studio asked:
// numbers compare as numbers («05-99» before «05-100»); each key breaks the
// previous one's ties, and a row without the key goes after those with it.
type Clau<T> = (r: T) => string | number | null | undefined;
function perNumero<T>(rows: T[], ...claus: Clau<T>[]): T[] {
  return [...rows].sort((a, b) => {
    for (const clau of claus) {
      const x = clau(a);
      const y = clau(b);
      const buitX = x == null || x === "";
      const buitY = y == null || y === "";
      if (buitX || buitY) {
        if (buitX !== buitY) return buitX ? 1 : -1;
        continue;
      }
      const c = String(x).localeCompare(String(y), "ca", { numeric: true });
      if (c) return c;
    }
    return 0;
  });
}

// The two files of a list kept by year: the current year's (even when empty)
// and one with every earlier year from 2000, oldest first, each year from a
// new page (none when there is no earlier year). Years after the current one
// (a number typed ahead, say) are in neither.
function perAnys<T>(rows: T[], anyOf: (r: T) => string, anyActual: number, make: (rows: T[], any: number) => { doc: PdfDoc; files: number }, llista: Llista): Document[] {
  const anteriors = new Set<number>();
  for (const r of rows) {
    const a = Number(anyOf(r));
    if (Number.isInteger(a) && a > 1900 && a < anyActual) anteriors.add(a);
  }
  const actual = make(rows.filter((r) => anyOf(r) === String(anyActual)), anyActual);
  const out: Document[] = [{ llista, any: anyActual, doc: actual.doc, files: actual.files }];
  if (anteriors.size) {
    const anys = [...anteriors].sort((a, b) => a - b);
    const seccions = anys.map((any) => make(rows.filter((r) => anyOf(r) === String(any)), any));
    out.push({ llista, any: Math.min(DES_DE, anys[0]), finsA: anyActual - 1, doc: seccions.map((s) => s.doc), files: seccions.reduce((n, s) => n + s.files, 0) });
  }
  return out;
}

// What the page offers, from the data: the lists of the current year and of
// every earlier one, the current year's statistics, and the clients and contacts.
export function documents(d: Dades, anyActual: number): Document[] {
  const Y = String(anyActual);
  const dedicByExp = new Map<number, { hores: string }[]>();
  for (const x of d.dedicacions) {
    if (x.expedient_id == null) continue;
    const list = dedicByExp.get(x.expedient_id);
    if (list) list.push(x);
    else dedicByExp.set(x.expedient_id, [x]);
  }
  const suplits = new Map<number, { import: string }[]>();
  for (const s of d.suplits) {
    const list = suplits.get(s.factura_id);
    if (list) list.push(s);
    else suplits.set(s.factura_id, [s]);
  }
  const contactesPerClient = new Map<number, number>();
  for (const k of d.contactes) if (k.client_id != null) contactesPerClient.set(k.client_id, (contactesPerClient.get(k.client_id) ?? 0) + 1);
  const stats = new Map(d.clientStats.map((s) => [s.client_id, s]));
  // The lists from the lowest number up (an ITE report has none of its own:
  // its expedient's, then the inspection date).
  const expedients = perNumero(d.expedients, (r) => r.num_expedient);
  const actes = perNumero(d.actes, (a) => a.num, (a) => a.data);
  const ites = perNumero(d.ites, (i) => i.expedient_num, (i) => i.data_inspeccio);
  const honoraris = perNumero(d.honoraris, (r) => r.num_proposta, (r) => r.data);
  const propostes = perNumero(d.propostes, (r) => r.num, (r) => r.data);
  const factures = perNumero(d.factures, (f) => f.num, (f) => f.data);
  const expedientsAny = expedients.filter((r) => anyExpedient(r.num_expedient) === Y);

  return [
    ...perAnys(expedients, (r) => anyExpedient(r.num_expedient), anyActual, (rows, any) => ({ doc: expedientsListDoc(rows, `Any ${any}`, "Cap expedient aquest any."), files: rows.length }), "expedients"),
    { llista: "expedients-estadistica", any: anyActual, doc: expedientsStatsDoc(expedientsStats(expedientsAny, dedicByExp), `Any ${Y}`), files: expedientsAny.length },
    (() => {
      const rows = d.dedicacions.filter((x) => x.data.slice(0, 4) === Y);
      return { llista: "dedicacio-estadistica" as const, any: anyActual, doc: dedicacioStatsDoc(dedicacioStats(rows), `Any ${Y}`), files: rows.length };
    })(),
    ...perAnys(actes, (a) => (a.data ?? "").slice(0, 4), anyActual, (rows, any) => ({ doc: actesListDoc(rows, `Any ${any} · ${plural(rows.length, "acta", "actes")}`), files: rows.length }), "actes"),
    ...perAnys(ites, (i) => i.any, anyActual, (rows, any) => ({ doc: iteListDoc(rows, `Any ${any} · ${plural(rows.length, "informe", "informes")}`, "Cap informe aquest any."), files: rows.length }), "ite"),
    ...perAnys(honoraris, (r) => r.data.slice(0, 4), anyActual, (rows, any) => ({ doc: honorarisListDoc(rows, `Any ${any}`), files: rows.length }), "honoraris"),
    ...perAnys(propostes, (r) => (r.data ?? "").slice(0, 4), anyActual, (rows, any) => ({ doc: propostesListDoc(rows, `Any ${any}`), files: rows.length }), "propostes"),
    ...perAnys(factures, facturaYear, anyActual, (rows, any) => ({ doc: facturesListDoc(rows, suplits, `Any ${any}`, "Cap factura aquest any."), files: rows.length }), "facturacio"),
    (() => {
      const rows = factures.filter((f) => facturaYear(f) === Y);
      return { llista: "facturacio-estadistica" as const, any: anyActual, doc: facturacioStatsDoc(facturacioStats(rows, suplits), `Any ${Y}`), files: rows.length };
    })(),
    {
      llista: "clients",
      any: null,
      doc: clientsListDoc(
        [...d.clients].sort(byNom),
        (id) => ({ contactes: contactesPerClient.get(id) ?? 0, oberts: stats.get(id)?.oberts ?? 0, expedients: stats.get(id)?.n ?? 0 }),
        plural(d.clients.length, "client", "clients"),
      ),
      files: d.clients.length,
    },
    { llista: "contactes", any: null, doc: contactesListDoc([...d.contactes].sort(byNom), plural(d.contactes.length, "contacte", "contactes")), files: d.contactes.length },
  ];
}

// The logo of the print: public/logo.jpg, from the deployment's files or else
// over HTTP from the app itself (a PDF without it beats no PDF).
async function carregarLogo(origin?: string): Promise<Logo | null> {
  let data: Uint8Array | null = null;
  try {
    data = new Uint8Array(await readFile(join(process.cwd(), "public", "logo.jpg")));
  } catch {
    if (origin) {
      try {
        const r = await fetch(new URL("/logo.jpg", origin));
        if (r.ok) data = new Uint8Array(await r.arrayBuffer());
      } catch {
        data = null;
      }
    }
  }
  const size = data && jpegSize(data);
  return data && size ? { data, ...size } : null;
}

// "20261124-050012-k3x9": when the run started (UTC), so a newer run sorts after.
function novaCarpeta(ara: Date): string {
  const t = ara.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const rand = [...randomBytes(4)].map((b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
  return `${t}-${rand}`;
}

export interface Resultat {
  area: "dac" | "demo";
  carpeta: string;
  publicat: boolean;
  pdfs: number;
  bytes: number;
  zipBytes: number;
  esborrats: number; // files of earlier runs removed
  ms: number;
}

export async function generarDescarregues(opts: { ara?: Date; origin?: string } = {}): Promise<Resultat> {
  const t0 = Date.now();
  const ara = opts.ara ?? new Date();
  const area = await fitxersArea();
  const anyActual = anyBcn(ara);
  const [dades, logo] = await Promise.all([carregarDades(), carregarLogo(opts.origin)]);
  const generat = dataHoraBcn(ara).replace(" ", " a les ");
  const pdfs = documents(dades, anyActual).map((d) => ({
    ...d,
    nom: nomFitxer(d.llista, d.any, d.finsA),
    data: renderPdf(d.doc, { logo, generat, title: d.finsA ? `${LLISTES[d.llista].nom} ${d.any}-${d.finsA}` : undefined }),
  }));

  const entrades: Zippable = {};
  for (const p of pdfs) entrades[`${LLISTES[p.llista].carpeta}/${nomDescarrega(p.llista, p.any, p.finsA)}`] = [p.data, { level: 0, mtime: ara }];
  const zip = zipSync(entrades);

  const manifest: Manifest = {
    versio: VERSIO,
    generat: ara.toISOString(),
    anyActual,
    carpeta: novaCarpeta(ara),
    fitxers: pdfs.map((p) => ({ nom: p.nom, bytes: p.data.byteLength, files: p.files })),
    zip: { nom: ZIP, bytes: zip.byteLength },
    ms: 0,
  };
  manifest.ms = Date.now() - t0; // reading and drawing; the upload follows
  const { publicat, esborrats } = await publicar(area, manifest, [
    ...pdfs.map((p) => ({ nom: p.nom, data: p.data, tipus: "application/pdf" })),
    { nom: ZIP, data: zip, tipus: "application/zip" },
  ]);
  return {
    area,
    carpeta: manifest.carpeta,
    publicat,
    pdfs: pdfs.length,
    bytes: pdfs.reduce((s, p) => s + p.data.byteLength, 0),
    zipBytes: zip.byteLength,
    esborrats,
    ms: Date.now() - t0,
  };
}

// The page's background run after a deploy that changes the files' format
// (cataleg.ts → potRegenerar): one at a time per area, and none if another
// visit already made them.
export async function regenerarSiCal(user: AppUser, origin?: string): Promise<void> {
  const area = user === "demo" ? "demo" : "dac";
  if (!potRegenerar() || !(await agafarBloqueig(area))) return;
  try {
    if ((await llegirManifest(area))?.versio === VERSIO) return; // another visit got there first
    const r = await runAsActingUser(user, () => generarDescarregues({ origin }));
    console.log("descarregues: format nou", JSON.stringify(r));
  } catch (e) {
    console.error(`descarregues (${user}): regenerar ha fallat`, e);
  } finally {
    await deixarBloqueig(area);
  }
}
