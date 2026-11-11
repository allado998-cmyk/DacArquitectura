// The report's photos and PDF named by their place in the portal, for
// uploading them there. The portal only imports files it signed itself
// (docs/ite.md), so photos go in through its own form; these names make that
// mechanical, by hand or with Claude's computer use: D03-2.jpg is deficiency
// 3, photo 2; E01-1.jpg the first photo of the first envelope element.
import { catLabel, type Cataleg } from "./cataleg";
import { adrecaEdifici, getAt, LIST_PATHS, listOf, SINGLE_MEDIA } from "./model";
import { isObj, type IteObj, type IteVal } from "./xml";

const str = (v: IteVal | undefined): string => (typeof v === "string" ? v : "");
const pad2 = (n: number) => String(n).padStart(2, "0");

export const codiDeficiencia = (i: number) => `D${pad2(i + 1)}`;
export const codiEnvolupant = (i: number) => `E${pad2(i + 1)}`;

const CROQUIS = "edifici.edificiDescripcio.croquis";
const COMPTADORS = "edifici.edificiInstalacions.aaFotoComptadors";
const QCP = "edifici.edificiInstalacions.ieQcpFoto";
const RECOMANACIONS = "recomanacionsPdf";

// Short names for the single slots (the portal's own prefixes say little).
const SINGLE_NAMES: Record<string, string> = {
  [CROQUIS]: "CROQUIS",
  [COMPTADORS]: "COMPTADORS-AIGUA",
  [QCP]: "QUADRE-ELECTRIC",
  [RECOMANACIONS]: "RECOMANACIONS",
};

export interface FotoFitxer {
  slotPath: string; // where the media object is in the doc
  codi: string; // D01, E02, CROQUIS, COMPTADORS-AIGUA, QUADRE-ELECTRIC, RECOMANACIONS
  carpeta: string; // DEFICIENCIES, ENVOLUPANTS, CROQUIS, INSTALACIONS, or "" (zip root)
  fitxer: string; // D01-2.jpg
  zipPath: string; // DEFICIENCIES/D01-2.jpg
  peu: string; // caption to type at the portal ("" if none)
  src: string; // our /fitxers ref, to read the bytes from
}

export interface FotoPaquet {
  nom: string; // zip and folder name, e.g. Carrer-Llatzeret-27-fotos
  fitxers: FotoFitxer[]; // in the portal's menu order
  falten: string[]; // slots with no stored file (left out of the zip)
  index: string; // index.txt
}

function slug(s: string, max = 48): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

function extOf(m: IteObj, pdf: boolean): string {
  const mime = str(m.mimeType).toLowerCase();
  if (pdf || mime === "application/pdf") return "pdf";
  const byMime: Record<string, string> = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic" };
  if (byMime[mime]) return byMime[mime];
  const fromName = /\.(jpe?g|png|webp|gif|heic|pdf)(?:\?|$)/i.exec(str(m.path));
  return fromName ? fromName[1].toLowerCase().replace("jpeg", "jpg") : "jpg";
}

function truncate(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

export function fotoPaquet(doc: IteObj, cataleg: Cataleg): FotoPaquet {
  const fitxers: FotoFitxer[] = [];
  const falten: string[] = [];

  const add = (slotPath: string, codi: string, carpeta: string, base: string, pdf: boolean, peu: string) => {
    const m = getAt(doc, slotPath);
    if (!isObj(m)) return;
    const src = str(m.path);
    const where = carpeta ? `${carpeta}/${base}` : base;
    if (!src.startsWith("/fitxers/")) {
      falten.push(where);
      return;
    }
    const fitxer = `${base}.${extOf(m, pdf)}`;
    fitxers.push({ slotPath, codi, carpeta, fitxer, zipPath: carpeta ? `${carpeta}/${fitxer}` : fitxer, peu, src });
  };
  const single = (path: string) => {
    const s = SINGLE_MEDIA.find((x) => x.path === path);
    const m = getAt(doc, path);
    if (!s || !isObj(m)) return;
    const name = SINGLE_NAMES[path] ?? s.slot.prefix.replace(/_+$/, "");
    // The slot's default text is not a caption.
    const peu = str(m.descripcio) === s.descripcio ? "" : str(m.descripcio);
    add(path, name, s.slot.folder, name, !!s.slot.pdf, peu);
  };

  // The portal's menu order: description (sketch), envelope, systems, deficiencies, annex.
  single(CROQUIS);
  listOf(doc, LIST_PATHS.envolupants).forEach((e, i) => {
    listOf(e, "fotos").forEach((f, j) => add(`${LIST_PATHS.envolupants}.${i}.fotos.${j}`, codiEnvolupant(i), "ENVOLUPANTS", `${codiEnvolupant(i)}-${j + 1}`, false, str(f.descripcio)));
  });
  single(COMPTADORS);
  single(QCP);
  listOf(doc, LIST_PATHS.deficiencies).forEach((d, i) => {
    listOf(d, "fotos").forEach((f, j) => add(`${LIST_PATHS.deficiencies}.${i}.fotos.${j}`, codiDeficiencia(i), "DEFICIENCIES", `${codiDeficiencia(i)}-${j + 1}`, false, str(f.descripcio)));
  });
  single(RECOMANACIONS);

  const adreca = adrecaEdifici(doc, cataleg).split(" · ")[0];
  const nom = `${slug(adreca) || slug(str(doc.nom)) || "ite"}-fotos`;
  return { nom, fitxers, falten, index: buildIndex(doc, cataleg, fitxers, falten) };
}

function buildIndex(doc: IteObj, cataleg: Cataleg, fitxers: FotoFitxer[], falten: string[]): string {
  const L: string[] = ["FOTOS PER AL PORTAL ITE", str(doc.nom)];
  const adreca = adrecaEdifici(doc, cataleg);
  if (adreca) L.push(adreca);
  L.push(
    "",
    "Una carpeta per apartat del portal; el nom del fitxer diu on va:",
    "D03-2.jpg = deficiència 3, foto 2 · E01-1.jpg = element 1 de l'envolupant, foto 1.",
    "Entre parèntesis, el peu de foto per escriure al portal.",
    "",
  );
  const of = (carpeta: string, codi: string) => fitxers.filter((f) => f.carpeta === carpeta && f.codi === codi);
  const line = (f: FotoFitxer) => `       ${f.fitxer}${f.peu ? ` (${f.peu})` : ""}`;
  const single = (path: string) => {
    const f = fitxers.find((x) => x.slotPath === path);
    const label = SINGLE_MEDIA.find((s) => s.path === path)?.label ?? "";
    return f ? `  ${f.fitxer}  ${label}${f.peu ? ` (${f.peu})` : ""}` : "";
  };

  const croquis = single(CROQUIS);
  if (croquis) L.push("CROQUIS (Descripció de l'edifici)", croquis, "");

  const envs = listOf(doc, LIST_PATHS.envolupants);
  if (envs.length) {
    L.push("ENVOLUPANTS");
    envs.forEach((e, i) => {
      const codi = codiEnvolupant(i);
      const titol = [isObj(e.envolupantTipus) ? catLabel(e.envolupantTipus) : "", truncate(str(e.envolupantDescripcio), 80)].filter(Boolean).join(" · ");
      L.push(`  ${codi}  ${titol}`);
      const fs = of("ENVOLUPANTS", codi);
      L.push(...(fs.length ? fs.map(line) : ["       (sense fotos)"]));
    });
    L.push("");
  }

  const inst = [single(COMPTADORS), single(QCP)].filter(Boolean);
  if (inst.length) L.push("INSTALACIONS (Sistemes i instal·lacions)", ...inst, "");

  const defs = listOf(doc, LIST_PATHS.deficiencies);
  if (defs.length) {
    L.push("DEFICIENCIES");
    defs.forEach((d, i) => {
      const codi = codiDeficiencia(i);
      const titol = [isObj(d.gravetat) ? catLabel(d.gravetat) : "", isObj(d.tipusDeficiencia) ? catLabel(d.tipusDeficiencia) : "", truncate(str(d.deficienciaDescripcio), 90)]
        .filter(Boolean)
        .join(" · ");
      L.push(`  ${codi}  ${titol}`);
      const fs = of("DEFICIENCIES", codi);
      L.push(...(fs.length ? fs.map(line) : ["       (sense fotos)"]));
    });
    L.push("");
  }

  const rec = single(RECOMANACIONS);
  if (rec) L.push(rec, "");

  if (falten.length) L.push(`Sense fitxer a l'app (no són al zip): ${falten.join(", ")}`, "");
  return L.join("\n");
}
