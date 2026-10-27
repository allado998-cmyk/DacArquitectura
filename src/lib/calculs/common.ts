// Shared pieces of the structural calculations (Càlculs): the model a
// calculation returns, number formatting, unit constants and the masonry
// strength formula. Each calculation (paret.ts, biga.ts, pilar.ts,
// soldadura.ts) turns its inputs into Sections; the editor renders them with input fields and live
// checks, and report.ts prints the same Sections as the justification report.

export type CalcTipus = "paret" | "biga" | "pilar" | "soldadura";

// The spreadsheets convert kg ↔ N with 9,81 (and kg/cm² ↔ N/mm² with 100/9,81).
export const G = 9.81;
export const NMM2_TO_KGCM2 = 100 / G;

export interface Check {
  ok: boolean;
  op: "<" | ">";
  limit: number | null;
  unit?: string;
  decimals?: number;
}

export type InputSpec =
  | { type: "num"; key: string; decimals?: number; auto?: number | null; integer?: boolean }
  | { type: "profile"; key: string; allowPlate?: boolean } // allowPlate: also offer "Xapa" (thickness typed in)
  | { type: "select"; key: string; options: { value: string; label: string }[] };

export interface Row {
  label: string;
  formula?: string;
  sym?: string;
  value: number | string | null; // null → "—"
  unit?: string;
  decimals?: number;
  input?: InputSpec; // editable in the editor, highlighted in the report
  alt?: { value: number | null; unit: string; decimals?: number }; // unit conversion column
  check?: Check;
  hint?: string; // short help under the label (editor only)
}

export interface Block {
  title?: string;
  rows: Row[];
}

export interface Section {
  key: string;
  title: string;
  toggle?: string; // dades key of a boolean that includes/excludes the section
  enabled: boolean;
  blocks: Block[];
  loads?: LoadsTable; // paret: "Estat de càrregues ponderat"
  welds?: WeldCombo[]; // soldadura: one entry per pair of welded parts
  reference?: ("fabrica" | "pilar60" | "soldadura")[]; // reference tables printed in the annex
}

// Soldadura: a part of a piece (ala / ànima of a profile, or a plate) with
// the throat limits of the fillet-weld table for its thickness.
export interface WeldPart {
  label: string; // "UPN 140 · ala"
  t: number | null; // mm
  aMax: number | null; // mm, null when t is outside the table
  aMin: number | null;
}
export interface WeldCombo {
  label: string;
  a: WeldPart;
  b: WeldPart;
  thin: "a" | "b" | null; // the thinner part (its max bounds the throat)
  range: [number, number] | null; // usable throat: [min of the thicker, max of the thinner]
  ok: boolean;
  note?: string; // why it is not compatible
}

export function weldResultText(w: WeldCombo): string {
  if (!w.ok || !w.range) return w.note ?? "No compatible";
  const [lo, hi] = w.range;
  return lo === hi ? `Gola compatible: a = ${fmt(lo, 1)} mm` : `Gola compatible: a = ${fmt(lo, 1)} – ${fmt(hi, 1)} mm`;
}

// "Estat de càrregues ponderat" (paret).
export interface LoadLine {
  label: string;
  q: number | null; // kN/m², kN/ml or kN/m³ (see qUnit)
  qUnit: string;
  qAuto?: number | null; // value used while the input is left empty (null)
  width: number | null; // m or m² (see widthUnit)
  widthUnit?: string;
  unf: number | null; // kN/ml
  gamma: number | null;
  fac: number | null; // kN/ml
  // input keys, for the editor
  qKey?: string;
  widthKey?: string;
  gammaKey?: string;
}
export interface LoadGroup {
  title: string;
  count?: number; // "NOMBRE" of identical floors
  lines: { heading?: string; line?: LoadLine; param?: { label: string; value: number; unit: string; key: string } }[];
  total?: { label: string; q: number; unf: number; fac: number };
  sostreIndex?: number; // index into dades.sostres
}
export interface LoadsTable {
  groups: LoadGroup[];
  totalUnf: number;
  totalFac: number;
}

export interface CalcResult {
  sections: Section[];
}

export function allChecks(r: CalcResult): { section: string; label: string; ok: boolean }[] {
  const out: { section: string; label: string; ok: boolean }[] = [];
  for (const s of r.sections) {
    if (!s.enabled) continue;
    for (const b of s.blocks) for (const row of b.rows) if (row.check) out.push({ section: s.title, label: row.label, ok: row.check.ok });
    for (const w of s.welds ?? []) out.push({ section: s.title, label: w.label, ok: w.ok });
  }
  return out;
}

export function verdict(r: CalcResult): { ok: boolean; total: number; failed: number } {
  const checks = allChecks(r);
  const failed = checks.filter((c) => !c.ok).length;
  return { ok: checks.length > 0 && failed === 0, total: checks.length, failed };
}

export function verdictText(v: { ok: boolean; total: number; failed: number }): string {
  if (v.total === 0) return "Cap comprovació activa.";
  return v.ok ? `Compleixen totes les comprovacions (${v.total}).` : `No compleixen ${v.failed} de ${v.total} comprovacions.`;
}

// ---- numbers ----

const fmtCache = new Map<number, Intl.NumberFormat>();
export function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  let f = fmtCache.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat("ca-ES", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: "always" } as Intl.NumberFormatOptions);
    fmtCache.set(decimals, f);
  }
  return f.format(n);
}

// Number from the stored inputs (missing / empty → fallback).
export function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

// Divide, or null when the divisor is zero / not a number (shown as "—").
export function div(a: number | null, b: number | null): number | null {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return a / b;
}

export function check(value: number | null, op: "<" | ">", limit: number | null, unit?: string, decimals?: number): Check {
  const ok = value != null && limit != null && Number.isFinite(value) && Number.isFinite(limit) && (op === "<" ? value < limit : value > limit);
  return { ok, op, limit, unit, decimals };
}

// ---- masonry (CTE DB SE-F) ----

// Design compressive strength of the supporting masonry:
//   fd = K · fb^0,65 · fm^0,25 / γM   (N/mm²; CTE DB SE-F annex C, eq. C.1)
export function fabricaFd(k: number, fb: number, fm: number, gM: number): number | null {
  return div(k * Math.pow(fb, 0.65) * Math.pow(fm, 0.25), gM);
}

// The masonry block shared by the three calculations.
export interface FabricaInputs {
  k: number;
  fb: number;
  fm: number;
  gM: number;
}
export const FABRICA_DEFAULT: FabricaInputs = { k: 0.6, fb: 10, fm: 5, gM: 2.5 };

export function fabricaRows(d: Record<string, unknown>, fd: number | null, opts: { fdLabel?: string } = {}): Row[] {
  return [
    { label: "Constant de la fàbrica", sym: "K", value: num(d.k), decimals: 2, input: { type: "num", key: "k", decimals: 2 }, hint: "CTE DB SE-F annex C: 0,60 massissa · 0,55 perforada · 0,50 alleugerida · 0,40 buida (1 full)" },
    { label: "Resistència normalitzada de les peces", sym: "fb", value: num(d.fb), unit: "N/mm²", decimals: 2, input: { type: "num", key: "fb", decimals: 2 } },
    { label: "Resistència del morter", sym: "fm", value: num(d.fm), unit: "N/mm²", decimals: 2, input: { type: "num", key: "fm", decimals: 2 } },
    { label: "Coeficient parcial de seguretat del material", sym: "γM", value: num(d.gM), decimals: 2, input: { type: "num", key: "gM", decimals: 2 }, hint: "CTE DB SE-F taula 4.8" },
    {
      label: opts.fdLabel ?? "Resistència de càlcul a compressió",
      formula: "fd = K · fb^0,65 · fm^0,25 / γM",
      sym: "fd",
      value: fd,
      unit: "N/mm²",
      decimals: 2,
      alt: { value: fd == null ? null : fd * NMM2_TO_KGCM2, unit: "kg/cm²" },
    },
  ];
}

// ---- reference tables printed with the report and shown in the editor ----

// CTE DB SE-F annex C: K constant.
export const FABRICA_K: { label: string; k: number }[] = [
  { label: "1 full · peça massissa", k: 0.6 },
  { label: "1 full · peça perforada", k: 0.55 },
  { label: "1 full · peça alleugerida", k: 0.5 },
  { label: "1 full · peça buida", k: 0.4 },
  { label: "2 fulls · peces massisses", k: 0.5 },
  { label: "2 fulls · peces perforades", k: 0.45 },
  { label: "2 fulls · peces alleugerides", k: 0.4 },
];

// CTE DB SE-F taula 4.4: characteristic compressive strength fk (N/mm²).
export const FABRICA_FK = {
  cols: [
    { fb: 10, fm: 5 },
    { fb: 10, fm: 7.5 },
    { fb: 15, fm: 7.5 },
    { fb: 15, fm: 10 },
    { fb: 20, fm: 10 },
    { fb: 20, fm: 15 },
    { fb: 25, fm: 15 },
  ],
  rows: [
    { label: "Maó massís amb junta prima", fk: [5, 5, 7, 7, 9, 10, 11] },
    { label: "Maó massís", fk: [4, 4, 6, 6, 8, 8, 10] },
    { label: "Maó perforat", fk: [4, 4, 5, 6, 7, 8, 9] },
    { label: "Blocs alleugerits", fk: [3, 4, 5, 5, 6, 7, 8] },
    { label: "Blocs buits", fk: [2, 3, 4, 4, 5, 6, 6] },
  ],
};

// CTE DB SE-F taula 4.8: partial safety factors γM.
export const FABRICA_GM = {
  head: ["A", "B", "C"],
  rows: [
    { label: "Resistència de la fàbrica · control de fabricació I", v: [1.7, 2.2, 2.7] },
    { label: "Resistència de la fàbrica · control de fabricació II", v: [2.0, 2.5, 3.0] },
    { label: "Resistència de claus i amarratges", v: [2.5, 2.5, 2.5] },
    { label: "Ancoratge de l'acer d'armar", v: [1.7, 2.2, null] },
    { label: "Acer (armadura activa i passiva)", v: [1.15, 1.15, null] },
  ] as { label: string; v: (number | null)[] }[],
  note: "Per a situacions extraordinàries, fàbriques: 1,2 · 1,5 · 1,8 per a les categories A, B i C.",
};

// CTE DB SE-A taula 4.1: steel grades (fy by nominal thickness t, fu).
export const ACER_GRADES: { nom: string; fy16: number; fy40: number; fy63: number; fu: number }[] = [
  { nom: "S235", fy16: 235, fy40: 225, fy63: 215, fu: 360 },
  { nom: "S275", fy16: 275, fy40: 265, fy63: 255, fu: 410 },
  { nom: "S355", fy16: 355, fy40: 345, fy63: 335, fu: 470 },
  { nom: "S450", fy16: 450, fy40: 430, fy63: 410, fu: 550 },
];
export const ACER_PROPS = { E: 210000, G: 81000, nu: 0.3, alpha: "1,2·10⁻⁵ (°C)⁻¹", rho: 7850 };
