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
import { byNumDesc, facturaYear, facturesListDoc } from "@/lib/llistats/facturacio";
import { actesListDoc, byNom, clientsListDoc, contactesListDoc, honorarisListDoc, iteListDoc, propostesListDoc } from "@/lib/llistats/llistes";
import { LLISTES, ZIP, anyBcn, dataHoraBcn, nomDescarrega, nomFitxer, type Llista, type Manifest } from "./cataleg";
import { carregarDades, type Dades } from "./dades";
import { publicar } from "./magatzem";
import { jpegSize, renderPdf, type Logo } from "./pdf";

export interface Document {
  llista: Llista;
  any: number | null;
  doc: PdfDoc;
  files: number; // rows listed
}

const plural = (n: number, u: string, p: string) => `${n} ${n === 1 ? u : p}`;

// One document per year present in the data, plus the current year's even when empty.
function perAny<T>(rows: T[], anyOf: (r: T) => string, anyActual: number, make: (rows: T[], any: number) => { doc: PdfDoc; files: number }, llista: Llista): Document[] {
  const anys = new Set<number>([anyActual]);
  for (const r of rows) {
    const a = Number(anyOf(r));
    if (Number.isInteger(a) && a > 1900) anys.add(a);
  }
  return [...anys]
    .sort((a, b) => b - a)
    .map((any) => ({ llista, any, ...make(rows.filter((r) => anyOf(r) === String(any)), any) }));
}

// What the page offers, from the data: the lists of every year, the current
// year's statistics, and the clients and contacts.
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
  const expedientsAny = d.expedients.filter((r) => anyExpedient(r.num_expedient) === Y);

  return [
    ...perAny(d.expedients, (r) => anyExpedient(r.num_expedient), anyActual, (rows, any) => ({ doc: expedientsListDoc(rows, `Any ${any}`, "Cap expedient aquest any."), files: rows.length }), "expedients"),
    { llista: "expedients-estadistica", any: anyActual, doc: expedientsStatsDoc(expedientsStats(expedientsAny, dedicByExp), `Any ${Y}`), files: expedientsAny.length },
    (() => {
      const rows = d.dedicacions.filter((x) => x.data.slice(0, 4) === Y);
      return { llista: "dedicacio-estadistica" as const, any: anyActual, doc: dedicacioStatsDoc(dedicacioStats(rows), `Any ${Y}`), files: rows.length };
    })(),
    ...perAny(d.actes, (a) => (a.data ?? "").slice(0, 4), anyActual, (rows, any) => ({ doc: actesListDoc(rows, `Any ${any} · ${plural(rows.length, "acta", "actes")}`), files: rows.length }), "actes"),
    ...perAny(d.ites, (i) => i.any, anyActual, (rows, any) => ({ doc: iteListDoc(rows, `Any ${any} · ${plural(rows.length, "informe", "informes")}`, "Cap informe aquest any."), files: rows.length }), "ite"),
    ...perAny(d.honoraris, (r) => r.data.slice(0, 4), anyActual, (rows, any) => ({ doc: honorarisListDoc(rows, `Any ${any}`), files: rows.length }), "honoraris"),
    ...perAny(d.propostes, (r) => (r.data ?? "").slice(0, 4), anyActual, (rows, any) => ({ doc: propostesListDoc(rows, `Any ${any}`), files: rows.length }), "propostes"),
    ...perAny(d.factures, facturaYear, anyActual, (rows, any) => ({ doc: facturesListDoc([...rows].sort(byNumDesc), suplits, `Any ${any}`, "Cap factura aquest any."), files: rows.length }), "facturacio"),
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
  const pdfs = documents(dades, anyActual).map((d) => ({ ...d, nom: nomFitxer(d.llista, d.any), data: renderPdf(d.doc, { logo, generat }) }));

  const entrades: Zippable = {};
  for (const p of pdfs) entrades[`${LLISTES[p.llista].carpeta}/${nomDescarrega(p.llista, p.any)}`] = [p.data, { level: 0, mtime: ara }];
  const zip = zipSync(entrades);

  const manifest: Manifest = {
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
