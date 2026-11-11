// The ITE report as the app keeps it: the portal's own tree (xml.ts), with
// photo paths pointing at our file store (/fitxers/...). Pure functions shared
// by the form, the server actions, the plugin and the scripts.
import { catId, catLabel, categoriaDeTipus, findCat, type Cataleg } from "./cataleg";
import { FIELD_BY_PATH, SECTIONS, type FieldDef } from "./schema";
import { isObj, javaDate, javaDouble, isoOfJavaDate, portalFileBase, serializeIteXml, type IteObj, type IteVal } from "./xml";

export const NULL_ID = "null";

const str = (v: IteVal | undefined): string => (typeof v === "string" ? v : "");

// Paths ------------------------------------------------------------------------

function parts(path: string): string[] {
  return path.split(".").filter(Boolean);
}

export function getAt(doc: IteVal | undefined, path: string): IteVal | undefined {
  let cur: IteVal | undefined = doc;
  for (const p of parts(path)) {
    if (Array.isArray(cur)) cur = /^\d+$/.test(p) ? cur[Number(p)] : undefined;
    else if (isObj(cur)) cur = cur[p];
    else return undefined;
  }
  return cur;
}

// A copy of `doc` with `value` at `path` (undefined or "" removes it). Missing
// objects on the way are created as entities (id null, as the portal writes them).
export function setAt(doc: IteObj, path: string, value: IteVal | undefined): IteObj {
  const ps = parts(path);
  const put = (node: IteVal | undefined, i: number): IteVal | undefined => {
    const key = ps[i];
    const last = i === ps.length - 1;
    if (/^\d+$/.test(key)) {
      const arr = Array.isArray(node) ? node.slice() : [];
      const idx = Number(key);
      const next = last ? value : put(arr[idx], i + 1);
      if (next === undefined || next === "") arr.splice(idx, 1);
      else arr[idx] = next;
      return arr;
    }
    const obj: IteObj = isObj(node) ? { ...node } : { id: NULL_ID };
    const next = last ? value : put(obj[key], i + 1);
    if (next === undefined || next === "") delete obj[key];
    else obj[key] = next;
    return obj;
  };
  return put(doc, 0) as IteObj;
}

// Form values --------------------------------------------------------------------

// What the form shows for a field (always a string; "" = empty).
export function fieldValue(doc: IteObj, f: FieldDef): string {
  const v = getAt(doc, f.path);
  if (f.kind === "cat") {
    if (isObj(v)) return catId(v);
    return typeof v === "string" ? v : ""; // referenciaCadastral.tipusVia holds the id itself
  }
  const s = str(v);
  if (f.kind === "date") return isoOfJavaDate(s);
  if (f.kind === "double") return s ? s.replace(/\.0$/, "").replace(".", ",") : "";
  return s;
}

export function parseNumber(s: string): number | null {
  const t = s.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// Stores a form value the way the portal writes it.
export function withField(doc: IteObj, f: FieldDef, value: string, cataleg: Cataleg): IteObj {
  const v = value.trim() === "" && f.kind !== "textarea" ? "" : value;
  switch (f.kind) {
    case "int": {
      const n = parseNumber(v);
      return setAt(doc, f.path, n === null ? undefined : String(Math.round(n)));
    }
    case "double": {
      const n = parseNumber(v);
      return setAt(doc, f.path, n === null ? undefined : javaDouble(n));
    }
    case "date":
      return setAt(doc, f.path, /^\d{4}-\d{2}-\d{2}$/.test(v) ? javaDate(v) : undefined);
    case "bool":
      return setAt(doc, f.path, v === "true" ? "true" : "false");
    case "cat": {
      if (!v) return setAt(doc, f.path, undefined);
      const obj = findCat(cataleg, f.cat ?? "", v);
      if (!obj) return doc;
      // The cadastre address keeps only the street type's id.
      if (f.path.endsWith("referenciaCadastral.tipusVia")) return setAt(doc, f.path, catId(obj));
      return setAt(doc, f.path, structuredClone(obj));
    }
    case "textarea":
      return setAt(doc, f.path, v.replace(/\r\n?/g, "\n").trim() ? v.replace(/\r\n?/g, "\n") : undefined);
    default:
      return setAt(doc, f.path, v.trim() ? v.trim() : undefined);
  }
}

// Text a person reads for a field's current value (lists, plugin, PDF).
export function fieldText(doc: IteObj, f: FieldDef, cataleg: Cataleg): string {
  const raw = fieldValue(doc, f);
  if (!raw) return "";
  if (f.kind === "bool") return raw === "true" ? "Sí" : "No";
  if (f.kind === "tri") return raw === "1" ? "Sí" : raw === "0" ? "No" : raw === "2" ? "Es desconeix" : raw;
  if (f.kind === "radio") return f.options?.find((o) => o.value === raw)?.label ?? raw;
  if (f.kind === "cat") {
    const v = getAt(doc, f.path);
    if (isObj(v)) return catLabel(v);
    const obj = findCat(cataleg, f.cat ?? "", raw);
    return obj ? catLabel(obj) : raw;
  }
  return raw;
}

// List items -------------------------------------------------------------------

export function newMedia(descripcio: string, mimeType: string, path: string): IteObj {
  const m: IteObj = { id: NULL_ID, mimeType, path };
  if (descripcio.trim()) m.descripcio = descripcio.trim();
  return m;
}

export function newDeficiencia(): IteObj {
  return { id: NULL_ID, fotos: [] };
}

export function newEnvolupant(): IteObj {
  return { id: NULL_ID, fotos: [] };
}

export function newMesura(text = ""): IteObj {
  const m: IteObj = { id: NULL_ID };
  if (text.trim()) m.descripcioMesura = text.trim();
  return m;
}

export function newPlanta(descripcio: string, habitatges = 0, locals = 0, parquing = false): IteObj {
  return syncInspeccions({
    id: NULL_ID,
    plantaDescripcio: descripcio,
    numHabitatges: String(habitatges),
    numLocals: String(locals),
    teParquing: parquing ? "true" : "false",
  });
}

// tipusInspeccio: 1 = habitatge, 2 = local. One row per door; "revisat" is
// whether it was visited.
export const TIPUS_HABITATGE = "1";
export const TIPUS_LOCAL = "2";

export function inspeccionsOf(planta: IteObj): IteObj[] {
  return Array.isArray(planta.inspeccions) ? (planta.inspeccions.filter(isObj) as IteObj[]) : [];
}

// Rebuilds a floor's door rows from its counts, keeping what was ticked.
export function syncInspeccions(planta: IteObj): IteObj {
  const old = inspeccionsOf(planta);
  const keep = new Map(old.map((i) => [`${str(i.tipusInspeccio)}|${str(i.porta)}`, i]));
  const out: IteObj[] = [];
  const add = (tipus: string, n: number) => {
    for (let k = 1; k <= n; k++) {
      const prev = keep.get(`${tipus}|${k}`);
      out.push(prev ? { ...prev } : { id: NULL_ID, porta: String(k), tipusInspeccio: tipus });
    }
  };
  add(TIPUS_HABITATGE, Math.max(0, Math.min(50, Number(str(planta.numHabitatges)) || 0)));
  add(TIPUS_LOCAL, Math.max(0, Math.min(50, Number(str(planta.numLocals)) || 0)));
  out.forEach((i, k) => (i.ordre = String(k + 1)));
  const next: IteObj = { ...planta };
  if (out.length) next.inspeccions = out;
  else delete next.inspeccions;
  return next;
}

// A report from the portal, as we keep it: without the account block (it
// carries the user's password hash) — the export rebuilds it from the
// technician — and with floors in display order.
export function cleanImported(doc: IteObj): IteObj {
  const out = { ...doc };
  delete out.usuari;
  if (!isObj(out.edifici)) out.edifici = { id: NULL_ID };
  return normalizeImported(out);
}

const byOrdre = (a: IteObj, b: IteObj) => (Number(str(a.ordre)) || 0) - (Number(str(b.ordre)) || 0);

// The portal writes floors (and their doors) in no particular order and keeps
// the display order in `ordre`. The app keeps them in display order and
// renumbers on export.
export function normalizeImported(doc: IteObj): IteObj {
  const plantes = listOf(doc, "edifici.plantes");
  if (!plantes.length) return doc;
  const sorted = plantes
    .slice()
    .sort(byOrdre)
    .map((p) => (Array.isArray(p.inspeccions) ? { ...p, inspeccions: inspeccionsOf(p).slice().sort(byOrdre) } : p));
  return setAt(doc, "edifici.plantes", sorted);
}

export function listOf(doc: IteObj, path: string): IteObj[] {
  const v = getAt(doc, path);
  return Array.isArray(v) ? (v.filter(isObj) as IteObj[]) : [];
}

export const LIST_PATHS = {
  plantes: "edifici.plantes",
  envolupants: "edifici.edificiEnvolupants",
  deficiencies: "deficiencies",
  mesures: "edifici.edificiSostenibilitat.mesures",
} as const;

// Photos ---------------------------------------------------------------------------

export interface MediaSlot {
  path: string; // where the media object is in the doc
  folder: string; // folder in the portal zip ("" = report root)
  prefix: string; // the portal's file naming
  stamp: "date" | "millis";
  pdf?: boolean;
}

export const SINGLE_MEDIA: { path: string; label: string; descripcio: string; slot: Omit<MediaSlot, "path">; accept: string }[] = [
  { path: "edifici.edificiDescripcio.croquis", label: "Emplaçament, croquis de plantes i seccions", descripcio: "Croquis planta", slot: { folder: "CROQUIS", prefix: "CROQUIS_FOTO_", stamp: "date" }, accept: "image/*" },
  { path: "edifici.edificiInstalacions.aaFotoComptadors", label: "Fotografia de la bateria de comptadors d'aigua", descripcio: "AA_COMPTADORS", slot: { folder: "INSTALACIONS", prefix: "AA_COMPTADORS_", stamp: "millis" }, accept: "image/*" },
  { path: "edifici.edificiInstalacions.ieQcpFoto", label: "Fotografia del quadre general de comandament i protecció", descripcio: "IE_QCP", slot: { folder: "INSTALACIONS", prefix: "AA_COMPTADORS_", stamp: "millis" }, accept: "image/*" },
  { path: "recomanacionsPdf", label: "Recomanacions (PDF annex)", descripcio: "RECOMANACIONS", slot: { folder: "", prefix: "RECOMANACIONS_", stamp: "date", pdf: true }, accept: "application/pdf" },
];

// Every photo or PDF in the report, with where it goes in the portal's zip.
export function mediaSlots(doc: IteObj): MediaSlot[] {
  const out: MediaSlot[] = [];
  for (const m of SINGLE_MEDIA) if (isObj(getAt(doc, m.path))) out.push({ path: m.path, ...m.slot });
  listOf(doc, LIST_PATHS.envolupants).forEach((e, i) => {
    listOf(e, "fotos").forEach((_, j) => out.push({ path: `${LIST_PATHS.envolupants}.${i}.fotos.${j}`, folder: "ENVOLUPANTS", prefix: "ENVOLUPANT_FOTO_", stamp: "date" }));
  });
  listOf(doc, LIST_PATHS.deficiencies).forEach((d, i) => {
    listOf(d, "fotos").forEach((_, j) => out.push({ path: `${LIST_PATHS.deficiencies}.${i}.fotos.${j}`, folder: "DEFICIENCIES", prefix: "DEFICIENCIA_FOTO_", stamp: "date" }));
  });
  return out;
}

// Every stored file the report points at (to clean up the store).
export function mediaRefs(doc: IteObj): string[] {
  return mediaSlots(doc)
    .map((s) => str((getAt(doc, s.path) as IteObj | undefined)?.path))
    .filter((p) => p.startsWith("/fitxers/"));
}

export function countFotos(doc: IteObj): number {
  return mediaSlots(doc).length;
}

// New report ---------------------------------------------------------------------

// Booleans the portal writes as "false" when not ticked: every checkbox the
// schema knows, so a new report has the same shape as a real export.
function emptyChecks(doc: IteObj): IteObj {
  let out = doc;
  for (const s of SECTIONS) for (const g of s.groups) for (const f of g.fields) {
    if (f.kind === "bool" && getAt(out, f.path) === undefined) out = setAt(out, f.path, "false");
  }
  return out;
}

export function newIteDoc(init: { nom?: string; tecnic?: IteObj; propietat?: IteObj; adreca?: IteObj; llocFirma?: string; dataInspeccio?: string }): IteObj {
  let doc: IteObj = {
    version: "2.0",
    id: NULL_ID,
    actiu: "true",
    nom: init.nom?.trim() || "Inspecció Tècnica de l'Edifici",
    llocFirma: init.llocFirma ?? "Barcelona",
    mostraRepresentant: "false",
    periodicitat: "12",
    edifici: {
      id: NULL_ID,
      edificiAccessibilitat: { id: NULL_ID },
      edificiDescripcio: { id: NULL_ID, unifamiliar: "false" },
      edificiEstructura: { id: NULL_ID },
      edificiFonamentacio: { id: NULL_ID },
      edificiInstalacions: { id: NULL_ID },
      edificiSostenibilitat: { id: NULL_ID },
      edificiTancaments: { id: NULL_ID },
      edificiTipologia: { id: NULL_ID },
      referenciaCadastral: { id: NULL_ID, ...(init.adreca ?? {}) },
    },
    propietat: { id: NULL_ID, ...(init.propietat ?? {}) },
    tecnics: init.tecnic ? [{ ...init.tecnic }] : [],
  };
  if (init.dataInspeccio) doc.dataInspeccio = javaDate(init.dataInspeccio);
  doc = emptyChecks(doc);
  return doc;
}

// Derived values -------------------------------------------------------------------

const GRAVETAT_ORDER = ["MG", "G", "I", "LL"];

export function gravetatValor(def: IteObj): string {
  const g = def.gravetat;
  return isObj(g) ? str(g.valor) : "";
}

// Per category: the worst severity found, or "" if none (the summary of
// section 11.1 and the portal's teDeficienciesTipus).
export function resumDeficiencies(doc: IteObj, cataleg: Cataleg): { categoria: IteObj; pitjor: string; n: number }[] {
  const cats = cataleg.categoria_deficiencia ?? [];
  const defs = listOf(doc, LIST_PATHS.deficiencies);
  return cats.map((c) => {
    let pitjor = "";
    let n = 0;
    for (const d of defs) {
      const t = d.tipusDeficiencia;
      if (!isObj(t)) continue;
      const cat = categoriaDeTipus(cataleg, t);
      if (!cat || catId(cat) !== catId(c)) continue;
      n++;
      const v = gravetatValor(d);
      if (!pitjor || (GRAVETAT_ORDER.indexOf(v) >= 0 && GRAVETAT_ORDER.indexOf(v) < GRAVETAT_ORDER.indexOf(pitjor))) pitjor = v;
    }
    return { categoria: c, pitjor, n };
  });
}

// 11.4: favourable when there are no deficiencies or all are minor ("lleus").
export function valoracioFavorable(doc: IteObj): boolean {
  return listOf(doc, LIST_PATHS.deficiencies).every((d) => gravetatValor(d) === "LL");
}

export function withDerived(doc: IteObj, cataleg: Cataleg): IteObj {
  let out = doc;
  const resum = resumDeficiencies(doc, cataleg);
  if (resum.length) {
    out = setAt(out, "teDeficienciesTipus", {
      entry: resum.map((r) => ({ key: structuredClone(r.categoria), value: r.n > 0 ? "true" : "false" })),
    });
  }
  out = setAt(out, "valoracio", valoracioFavorable(doc) ? "true" : "false");
  return out;
}

// Summary for the list and the plugin ------------------------------------------------

export interface IteResum {
  nom: string;
  adreca: string;
  data_inspeccio: string | null;
  deficiencies: number;
  fotos: number;
}

export function adrecaEdifici(doc: IteObj, cataleg?: Cataleg): string {
  const rc = getAt(doc, "edifici.referenciaCadastral");
  if (!isObj(rc)) return "";
  const tv = str(rc.tipusVia);
  const tvObj = tv && cataleg ? findCat(cataleg, "tipus_via", tv) : undefined;
  const via = [tvObj ? catLabel(tvObj) : "", str(rc.nomVia)].filter(Boolean).join(" ");
  const num = str(rc.numero);
  const muni = str(rc.municipi);
  return [via && num ? `${via}, ${num}` : via, muni].filter(Boolean).join(" · ");
}

export function iteResum(doc: IteObj, cataleg?: Cataleg): IteResum {
  return {
    nom: str(doc.nom),
    adreca: adrecaEdifici(doc, cataleg),
    data_inspeccio: isoOfJavaDate(str(doc.dataInspeccio)) || null,
    deficiencies: listOf(doc, LIST_PATHS.deficiencies).length,
    fotos: countFotos(doc),
  };
}

// Checks before exporting ----------------------------------------------------------

export interface IteCheck {
  errors: string[]; // the portal will refuse or lose data
  warnings: string[]; // missing data the portal will ask for
}

export function validateIte(doc: IteObj, cataleg: Cataleg): IteCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const s of SECTIONS) for (const g of s.groups) for (const f of g.fields) {
    if (f.required && !fieldValue(doc, f)) warnings.push(`${s.title} · ${g.title}: falta «${f.label}».`);
  }
  for (const [p, label] of [["edifici.cadasFinca", "Finca / Parcel·la"], ["edifici.cadasPlanol", "Full de plànol"]] as const) {
    const v = str(getAt(doc, p));
    if (v && !/^[0-9A-Z]{7}$/.test(v)) errors.push(`Referència cadastral: «${label}» ha de tenir 7 caràcters (lletres majúscules i xifres).`);
  }
  listOf(doc, LIST_PATHS.deficiencies).forEach((d, i) => {
    const n = i + 1;
    if (!isObj(d.tipusDeficiencia)) errors.push(`Deficiència ${n}: falta el tipus.`);
    else if (!categoriaDeTipus(cataleg, d.tipusDeficiencia)) warnings.push(`Deficiència ${n}: el tipus no és de cap categoria coneguda.`);
    if (!isObj(d.gravetat)) errors.push(`Deficiència ${n}: falta la gravetat.`);
    if (!str(d.deficienciaDescripcio).trim()) warnings.push(`Deficiència ${n}: falta la descripció i localització.`);
    // The portal refuses to close a report with a deficiency without a photo.
    if (!listOf(d, "fotos").length) warnings.push(`Deficiència ${n}: sense cap foto (el portal n'exigeix una com a mínim per tancar l'informe).`);
  });
  listOf(doc, LIST_PATHS.envolupants).forEach((e, i) => {
    if (!isObj(e.envolupantTipus)) errors.push(`Envolupant ${i + 1}: falta el tipus (façana, coberta, pati…).`);
    if (!str(e.envolupantDescripcio).trim()) warnings.push(`Envolupant ${i + 1}: falta la descripció.`);
  });
  listOf(doc, LIST_PATHS.plantes).forEach((p, i) => {
    if (!str(p.plantaDescripcio).trim()) warnings.push(`Planta ${i + 1}: falta la descripció.`);
  });
  for (const s of mediaSlots(doc)) {
    const m = getAt(doc, s.path);
    if (isObj(m) && !str(m.path).startsWith("/fitxers/") && !str(m.path).startsWith("data:")) errors.push(`Falta el fitxer d'una foto o PDF (${s.folder || "recomanacions"}).`);
  }
  if (!listOf(doc, "tecnics").length) errors.push("Falta el tècnic redactor.");
  return { errors, warnings };
}

// Export --------------------------------------------------------------------------

export interface ExportFile {
  zipPath: string;
  src: string; // where to read it from: our /fitxers ref (or a local path in scripts)
}

export interface ExportPlan {
  exportId: string;
  fileBase: string;
  xmlPath: string;
  xml: string;
  files: ExportFile[];
}

// The portal's account block, rebuilt from the technician (never a password).
function usuariFromTecnic(t: IteObj | undefined): IteObj | undefined {
  if (!t) return undefined;
  const u: IteObj = {
    id: NULL_ID,
    actiu: "true",
    collaborador: "false",
    enabled: "true",
    locale: "ca_ES",
    rols: "ROLE_USER",
  };
  const copy: [string, string][] = [
    ["codiPostal", "codiPostalTecnic"],
    ["cognom1", "cognom1Tecnic"],
    ["cognom2", "cognom2Tecnic"],
    ["email", "emailTecnic"],
    ["identificador", "identificacioTecnic"],
    ["nom", "nomTecnic"],
    ["nomVia", "nomViaTecnic"],
    ["numColegiat", "numColegiatTecnic"],
    ["telefon1", "telefon1Tecnic"],
    ["telefon2", "telefon2Tecnic"],
  ];
  for (const [to, from] of copy) if (str(t[from])) u[to] = str(t[from]);
  return u;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// "2025.04.06_20.50.8" + epoch millis, like the portal's file names.
function portalStamp(d: Date): string {
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}_${d.getHours()}.${d.getMinutes()}.${d.getSeconds()}${d.getTime()}`;
}

function fileNameOf(src: string): string {
  const clean = src.split("?")[0];
  const last = clean.slice(clean.lastIndexOf("/") + 1);
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

// Builds the portal's import file: the XML (unsigned, as a draft) and the list
// of photos to put next to it. The zip itself is built by the caller.
export function buildExport(doc: IteObj, cataleg: Cataleg, opts: { exportId: string; now?: Date }): ExportPlan {
  const now = opts.now ?? new Date();
  const exportId = opts.exportId;
  let out: IteObj = structuredClone(doc);

  // The portal sets these when a report is closed and signed; ours is a draft.
  delete out.codiFinal;
  delete out.dataExport;
  delete out.dataFirma;
  out.id = exportId;
  out.version = str(out.version) || "2.0";
  out.actiu = str(out.actiu) || "true";
  out.mostraRepresentant = str(out.mostraRepresentant) || "false";
  out.periodicitat = str(out.periodicitat) || "12";

  const tecnics = listOf(out, "tecnics");
  if (tecnics[0] && !str(tecnics[0].tecnicPrincipal)) tecnics[0].tecnicPrincipal = "true";
  const usuari = usuariFromTecnic(tecnics[0]);
  if (usuari) out.usuari = usuari;
  else delete out.usuari;

  // Floor and door order.
  const plantes = listOf(out, LIST_PATHS.plantes);
  plantes.forEach((p, i) => {
    p.ordre = String(i + 1);
    inspeccionsOf(p).forEach((ins, k) => (ins.ordre = String(k + 1)));
  });

  out = withDerived(out, cataleg);

  // Photos and the recommendations PDF.
  const files: ExportFile[] = [];
  const used = new Set<string>();
  const missing: string[] = [];
  let tick = 0;
  for (const slot of mediaSlots(out)) {
    const m = getAt(out, slot.path) as IteObj;
    const src = str(m.path);
    if (!src || src.includes("{IMAGEROOTDIR}")) {
      missing.push(slot.path);
      continue;
    }
    const ext = slot.pdf ? "PDF" : "JPG";
    let name = fileNameOf(src);
    const ok = name.startsWith(slot.prefix) && /^[A-Za-z0-9_.]+$/.test(name) && !used.has(`${slot.folder}/${name}`);
    if (!ok) {
      const t = new Date(now.getTime() + tick++);
      name = `${slot.prefix}${slot.stamp === "millis" ? `${t.getTime()}${t.getTime()}` : portalStamp(t)}.${ext}`;
    }
    used.add(`${slot.folder}/${name}`);
    const rel = slot.folder ? `${slot.folder}/${name}` : name;
    m.path = `{IMAGEROOTDIR}/replaceFitxerId_${exportId}/${rel}`;
    m.id = NULL_ID;
    if (!str(m.mimeType)) m.mimeType = slot.pdf ? "application/pdf" : "image/jpeg";
    files.push({ zipPath: `ITE/informes/imatges/${exportId}/${rel}`, src });
  }
  // Photos without a file are left out (last first, so indices stay valid).
  for (const p of missing.reverse()) out = setAt(out, p, undefined);

  const fileBase = portalFileBase(str(out.nom));
  return {
    exportId,
    fileBase,
    xmlPath: `ITE/informes/dades/${exportId}/${fileBase}.xml`,
    xml: serializeIteXml(out),
    files,
  };
}

// Our reports get ids far above the portal's (≈1 million today), so a file
// can never be mistaken for another report.
export function exportIdFor(iteId: number): string {
  return String(900_000_000 + iteId);
}

export function fieldDef(path: string): FieldDef | undefined {
  return FIELD_BY_PATH.get(path);
}
