// Changes to an ITE report described as data (what the plugin sends): fields
// by path, and add / modify / remove on the lists. Pure: returns the new
// report, a readable list of changes, and errors that block saving.
import { catId, catLabel, matchCat, type Cataleg } from "./cataleg";
import { FIELD_BY_PATH, SECTIONS, type FieldDef } from "./schema";
import {
  fieldText,
  fieldValue,
  getAt,
  gravetatValor,
  inspeccionsOf,
  LIST_PATHS,
  listOf,
  mediaSlots,
  newDeficiencia,
  newEnvolupant,
  newMesura,
  newPlanta,
  setAt,
  syncInspeccions,
  withField,
} from "./model";
import { isObj, type IteObj } from "./xml";

export type CampValue = string | number | boolean | null;

export interface ListOps<T> {
  afegir?: T[];
  modificar?: (Partial<T> & { index: number })[];
  treure?: number[];
}

export interface DefInput { tipus?: string; gravetat?: string; descripcio?: string; observacions?: string }
export interface EnvInput { tipus?: string; descripcio?: string }
export interface PlantaInput { descripcio?: string; habitatges?: number; locals?: number; parquing?: boolean; visitades?: number[] | boolean }
export interface MesuraInput { descripcio?: string }

export interface IteEdit {
  camps?: Record<string, CampValue>;
  deficiencies?: ListOps<DefInput>;
  envolupants?: ListOps<EnvInput>;
  plantes?: ListOps<PlantaInput>;
  mesures?: ListOps<MesuraInput>;
}

export interface EditResult {
  doc: IteObj;
  changes: string[];
  errors: string[];
  warnings: string[];
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function short(s: string, n = 60): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

// A value from the chat → the string the form would hold.
function formValue(f: FieldDef, v: CampValue, cataleg: Cataleg): { value?: string; error?: string } {
  if (v === null || v === "") return { value: "" };
  const s = String(v).trim();
  switch (f.kind) {
    case "bool": {
      if (v === true || ["true", "si", "sí", "1", "x"].includes(fold(s))) return { value: "true" };
      if (v === false || ["false", "no", "0"].includes(fold(s))) return { value: "false" };
      return { error: `«${f.label}»: cal true o false.` };
    }
    case "tri": {
      const t = fold(s);
      if (v === true || ["1", "si", "true"].includes(t)) return { value: "1" };
      if (v === false || ["0", "no", "false"].includes(t)) return { value: "0" };
      if (["2", "es desconeix", "desconegut", "no se sap"].includes(t)) return { value: "2" };
      return { error: `«${f.label}»: cal "si", "no" o "es_desconeix".` };
    }
    case "int":
    case "double": {
      const n = typeof v === "number" ? v : Number(s.replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(n)) return { error: `«${f.label}»: «${s}» no és un número.` };
      return { value: String(f.kind === "int" ? Math.round(n) : n) };
    }
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(s) ? { value: s } : { error: `«${f.label}»: la data ha de ser YYYY-MM-DD.` };
    case "radio": {
      const o = f.options?.find((x) => x.value === s) ?? f.options?.find((x) => fold(x.label) === fold(s)) ?? f.options?.filter((x) => fold(x.label).includes(fold(s)))[0];
      return o ? { value: o.value } : { error: `«${f.label}»: opcions ${f.options?.map((x) => `"${x.value}" (${x.label})`).join(", ")}.` };
    }
    case "cat": {
      const m = matchCat(cataleg, f.cat ?? "", s);
      if (m.obj) return { value: catId(m.obj) };
      const opts = (m.ambiguous ?? cataleg[f.cat ?? ""] ?? []).slice(0, 15).map((o) => `${String(o.codi ?? catId(o))} (${catLabel(o)})`);
      return { error: `«${f.label}»: «${s}» ${m.ambiguous ? "és ambigu" : "no és a la llista"}. Opcions: ${opts.join(", ") || "cap de coneguda"}.` };
    }
    default:
      return { value: s };
  }
}

export function applyCamps(doc: IteObj, camps: Record<string, CampValue>, cataleg: Cataleg, out: EditResult): IteObj {
  let d = doc;
  for (const [path, v] of Object.entries(camps)) {
    const f = FIELD_BY_PATH.get(path);
    if (!f) {
      out.errors.push(`Camp desconegut: «${path}». Fes servir ite_camps per veure'n la llista.`);
      continue;
    }
    const r = formValue(f, v, cataleg);
    if (r.error || r.value === undefined) { out.errors.push(r.error ?? `«${f.label}»: valor invàlid.`); continue; }
    const before = fieldText(d, f, cataleg);
    d = withField(d, f, r.value, cataleg);
    const after = fieldText(d, f, cataleg);
    if (before !== after) out.changes.push(`${f.label}: ${before ? `«${short(before)}»` : "(buit)"} → ${after ? `«${short(after)}»` : "(buit)"}`);
  }
  return d;
}

function catObj(cataleg: Cataleg, cat: string, q: string, label: string, out: EditResult): IteObj | undefined {
  const m = matchCat(cataleg, cat, q);
  if (m.obj) return structuredClone(m.obj);
  const opts = (m.ambiguous ?? cataleg[cat] ?? []).slice(0, 20).map((o) => `${String(o.codi ?? catId(o))} (${catLabel(o)})`);
  out.errors.push(`${label}: «${q}» ${m.ambiguous ? "és ambigu" : "no és a la llista coneguda"}. Opcions: ${opts.join("; ") || "cap"}.`);
  return undefined;
}

const GRAVETATS: Record<string, string> = { mg: "MG", "molt greu": "MG", g: "G", greu: "G", i: "I", important: "I", ll: "LL", lleu: "LL" };

function gravetatObj(cataleg: Cataleg, q: string, label: string, out: EditResult): IteObj | undefined {
  const valor = GRAVETATS[fold(q)];
  const found = valor ? (cataleg.gravetat ?? []).find((g) => g.valor === valor) : undefined;
  if (found) return structuredClone(found);
  if (valor) {
    out.errors.push(`${label}: la gravetat «${q}» encara no és a les llistes conegudes (només ${(cataleg.gravetat ?? []).map(catLabel).join(", ")}). Importa un informe del portal que en tingui una.`);
    return undefined;
  }
  return catObj(cataleg, "gravetat", q, label, out);
}

function applyList<T>(
  doc: IteObj,
  path: string,
  ops: ListOps<T> | undefined,
  what: string,
  build: (cur: IteObj | null, input: Partial<T>, label: string) => IteObj,
  out: EditResult,
): IteObj {
  if (!ops) return doc;
  let list = listOf(doc, path).slice();
  const n = list.length;
  for (const m of ops.modificar ?? []) {
    if (!Number.isInteger(m.index) || m.index < 0 || m.index >= n) { out.errors.push(`${what}: no hi ha l'índex ${m.index} (n'hi ha ${n}, de 0 a ${n - 1}).`); continue; }
    list[m.index] = build(list[m.index], m, `${what} ${m.index}`);
    out.changes.push(`${what} ${m.index}: modificat.`);
  }
  const remove = new Set<number>();
  for (const i of ops.treure ?? []) {
    if (!Number.isInteger(i) || i < 0 || i >= n) { out.errors.push(`${what}: no hi ha l'índex ${i} per treure.`); continue; }
    remove.add(i);
    const fotos = listOf(list[i], "fotos").length;
    out.changes.push(`${what} ${i}: eliminat.`);
    if (fotos) out.warnings.push(`${what} ${i} té ${fotos} fotos, que també s'esborraran.`);
  }
  list = list.filter((_, i) => !remove.has(i));
  for (const [k, a] of (ops.afegir ?? []).entries()) {
    list.push(build(null, a, `${what} nou ${k + 1}`));
    out.changes.push(`${what}: afegit${(a as { descripcio?: string }).descripcio ? ` «${short(String((a as { descripcio?: string }).descripcio))}»` : ""}.`);
  }
  return setAt(doc, path, list);
}

export function applyIteEdit(doc: IteObj, edit: IteEdit, cataleg: Cataleg): EditResult {
  const out: EditResult = { doc, changes: [], errors: [], warnings: [] };
  let d = doc;
  if (edit.camps) d = applyCamps(d, edit.camps, cataleg, out);

  d = applyList<DefInput>(d, LIST_PATHS.deficiencies, edit.deficiencies, "Deficiència", (cur, a, label) => {
    let x: IteObj = cur ? { ...cur } : newDeficiencia();
    if (a.tipus !== undefined) { const t = catObj(cataleg, "tipus_deficiencia", a.tipus, label, out); if (t) x.tipusDeficiencia = t; }
    if (a.gravetat !== undefined) { const g = gravetatObj(cataleg, a.gravetat, label, out); if (g) x.gravetat = g; }
    if (a.descripcio !== undefined) x = setAt(x, "deficienciaDescripcio", a.descripcio.trim() || undefined);
    if (a.observacions !== undefined) x = setAt(x, "deficienciaObservacions", a.observacions.trim() || undefined);
    if (!cur && !x.tipusDeficiencia) out.errors.push(`${label}: falta el tipus.`);
    if (!cur && !x.gravetat) out.errors.push(`${label}: falta la gravetat (MG, G, I o LL).`);
    return x;
  }, out);

  d = applyList<EnvInput>(d, LIST_PATHS.envolupants, edit.envolupants, "Envolupant", (cur, a, label) => {
    let x: IteObj = cur ? { ...cur } : newEnvolupant();
    if (a.tipus !== undefined) { const t = catObj(cataleg, "tipus_envolupant", a.tipus, label, out); if (t) x.envolupantTipus = t; }
    if (a.descripcio !== undefined) x = setAt(x, "envolupantDescripcio", a.descripcio.trim() || undefined);
    if (!cur && !x.envolupantTipus) out.errors.push(`${label}: falta el tipus (façanes, cobertes, patis…).`);
    return x;
  }, out);

  d = applyList<PlantaInput>(d, LIST_PATHS.plantes, edit.plantes, "Planta", (cur, a) => {
    let x: IteObj = cur ? { ...cur } : newPlanta(a.descripcio ?? "", a.habitatges ?? 0, a.locals ?? 0, !!a.parquing);
    if (a.descripcio !== undefined) x.plantaDescripcio = a.descripcio.trim();
    if (a.habitatges !== undefined) x.numHabitatges = String(Math.max(0, Math.round(a.habitatges)));
    if (a.locals !== undefined) x.numLocals = String(Math.max(0, Math.round(a.locals)));
    if (a.parquing !== undefined) x.teParquing = a.parquing ? "true" : "false";
    x = syncInspeccions(x);
    if (a.visitades !== undefined) {
      const ins = inspeccionsOf(x).map((it, k) => {
        const on = a.visitades === true || (Array.isArray(a.visitades) && a.visitades.includes(k + 1));
        const next = { ...it };
        if (on) next.revisat = "true";
        else delete next.revisat;
        return next;
      });
      if (ins.length) x = { ...x, inspeccions: ins };
    }
    return x;
  }, out);

  d = applyList<MesuraInput>(d, LIST_PATHS.mesures, edit.mesures, "Mesura", (cur, a) => {
    if (!cur) return newMesura(a.descripcio ?? "");
    return setAt({ ...cur }, "descripcioMesura", a.descripcio?.trim() || undefined);
  }, out);

  out.doc = d;
  if (!out.changes.length && !out.errors.length) out.errors.push("No s'ha indicat cap canvi.");
  return out;
}

// Files a change leaves unused (to delete from the store after saving).
export function removedMedia(before: IteObj, after: IteObj): string[] {
  const refs = (doc: IteObj) => new Set(mediaSlots(doc).map((s) => getAt(doc, s.path)).filter(isObj).map((m) => String(m.path ?? "")));
  const now = refs(after);
  return [...refs(before)].filter((r) => r.startsWith("/fitxers/") && !now.has(r));
}

// The report as text for the chat: filled fields per section, lists with
// their index (used by modificar/treure).
export function iteAsText(doc: IteObj, cataleg: Cataleg, seccio?: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of SECTIONS) {
    if (seccio && s.key !== seccio) continue;
    const sec: Record<string, unknown> = {};
    for (const g of s.groups) {
      if (g.layout === "checks") {
        const on = g.fields.filter((f) => fieldValue(doc, f) === "true").map((f) => f.label);
        if (on.length) sec[g.title] = on;
        continue;
      }
      const vals: Record<string, string> = {};
      for (const f of g.fields) {
        const t = fieldText(doc, f, cataleg);
        if (t && !(f.kind === "bool" && t === "No")) vals[f.label] = t;
      }
      if (Object.keys(vals).length) sec[g.title] = vals;
    }
    if (s.key === "descripcio") {
      sec.plantes = listOf(doc, LIST_PATHS.plantes).map((p, index) => ({
        index,
        descripcio: p.plantaDescripcio ?? "",
        habitatges: Number(p.numHabitatges ?? 0),
        locals: Number(p.numLocals ?? 0),
        parquing: p.teParquing === "true",
        visitades: inspeccionsOf(p).map((it, k) => (it.revisat === "true" ? k + 1 : 0)).filter(Boolean),
      }));
      sec.croquis = isObj(getAt(doc, "edifici.edificiDescripcio.croquis"));
    }
    if (s.key === "envolupant") {
      sec.elements = listOf(doc, LIST_PATHS.envolupants).map((e, index) => ({
        index,
        tipus: isObj(e.envolupantTipus) ? catLabel(e.envolupantTipus) : null,
        descripcio: e.envolupantDescripcio ?? "",
        fotos: listOf(e, "fotos").map((f) => f.descripcio ?? ""),
      }));
    }
    if (s.key === "deficiencies") {
      sec.deficiencies = listOf(doc, LIST_PATHS.deficiencies).map((x, index) => ({
        index,
        tipus: isObj(x.tipusDeficiencia) ? catLabel(x.tipusDeficiencia) : null,
        gravetat: gravetatValor(x) || null,
        descripcio: x.deficienciaDescripcio ?? "",
        observacions: x.deficienciaObservacions ?? "",
        fotos: listOf(x, "fotos").map((f) => f.descripcio ?? ""),
      }));
    }
    if (s.key === "sostenibilitat") {
      sec.mesures = listOf(doc, LIST_PATHS.mesures).map((m, index) => ({ index, descripcio: m.descripcioMesura ?? "" }));
    }
    if (Object.keys(sec).length) out[s.title] = sec;
  }
  return out;
}

// The fields the chat can fill, with their options.
export function iteCamps(cataleg: Cataleg, seccio?: string): unknown[] {
  return SECTIONS.filter((s) => !seccio || s.key === seccio).map((s) => ({
    seccio: s.key,
    titol: s.title,
    camps: s.groups.flatMap((g) =>
      g.fields.map((f) => {
        const c: Record<string, unknown> = { camp: f.path, etiqueta: f.label, grup: g.title, tipus: f.kind };
        if (f.unit) c.unitat = f.unit;
        if (f.kind === "tri") c.valors = ["si", "no", "es_desconeix"];
        if (f.kind === "radio") c.valors = f.options?.map((o) => ({ valor: o.value, text: o.label }));
        if (f.kind === "cat") c.valors = (cataleg[f.cat ?? ""] ?? []).map((o) => ({ valor: String(o.codi ?? catId(o)), text: catLabel(o) }));
        return c;
      }),
    ),
    pendents: s.pendents ?? [],
  }));
}
