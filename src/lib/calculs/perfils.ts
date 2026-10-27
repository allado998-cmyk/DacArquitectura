// Steel profile catalogue (Perfils i soldadures): the tables David consults,
// transcribed from his catalogue sheets (perfils-data.ts + ./perfils/*.json).
// The checks read IPE / IPN / HEB / HEA / HEM / UPN from here; every other
// family is for consultation only.

import { FAMILIES, SOLDADURA } from "./perfils-data";

export interface PerfilColumn {
  key: string;
  label: string;
  unit: string;
  group: string;
}
export interface PerfilRow {
  name: string;
  v: (number | null)[];
  avail: string | null; // P / C letter printed in the catalogue
  extra?: boolean; // not in the catalogue sheet (see family note)
}
export interface PerfilFamily {
  key: string;
  title: string;
  image: string | null; // original catalogue sheet under /public
  legend: { sym: string; desc: string }[];
  columns: PerfilColumn[];
  rows: PerfilRow[];
  note?: string;
  errata?: Record<string, string>; // "row|col" (col "name" for the designation) → note
}
export interface SoldaduraRow {
  tMin: number;
  tMax: number;
  aMax: number;
  aMin: number;
}

export { FAMILIES, SOLDADURA };

// Families that can be picked as beams / esnelles / brancals / welded pieces.
export const CALC_FAMILIES = ["ipe", "ipn", "heb", "hea", "hem", "upn"];

// Profile-picker value for a plate whose thickness is typed in (soldadura).
export const PLATE = "Xapa";

export interface PerfilProps {
  name: string;
  family: string;
  h: number | null; // mm
  b: number | null; // mm
  tw: number | null; // web thickness (e), mm
  tf: number | null; // flange thickness (e1), mm
  h1: number | null; // straight part of the web, mm
  A: number | null; // cm²
  Ix: number | null; // cm⁴
  Wx: number | null; // cm³
  p: number | null; // kg/m
}

function col(f: PerfilFamily, key: string): number {
  return f.columns.findIndex((c) => c.key === key);
}

const PROPS = new Map<string, PerfilProps>();
for (const f of FAMILIES) {
  if (!CALC_FAMILIES.includes(f.key)) continue;
  const at = (r: PerfilRow, key: string) => {
    const i = col(f, key);
    return i < 0 ? null : r.v[i] ?? null;
  };
  for (const r of f.rows) {
    PROPS.set(r.name, {
      name: r.name,
      family: f.key,
      h: at(r, "h"),
      b: at(r, "b"),
      tw: at(r, "tw"),
      tf: at(r, "tf"),
      h1: at(r, "h1"),
      A: at(r, "A"),
      Ix: at(r, "Ix"),
      Wx: at(r, "Wx"),
      p: at(r, "p"),
    });
  }
}

export function perfilProps(name: string | null | undefined): PerfilProps | null {
  if (!name) return null;
  return PROPS.get(name) ?? null;
}

// Options for the profile pickers, grouped by family.
export function perfilOptions(families: string[] = CALC_FAMILIES): { family: string; title: string; names: string[] }[] {
  return FAMILIES.filter((f) => families.includes(f.key)).map((f) => ({ family: f.key, title: f.title, names: f.rows.map((r) => r.name) }));
}

// Fillet weld throat limits for a given piece thickness (mm).
export function soldaduraPer(t: number): SoldaduraRow | null {
  if (!Number.isFinite(t)) return null;
  // Rows are 0,1 mm ranges ("4,0–4,2"): round to one decimal before matching.
  const tt = Math.round(t * 10) / 10;
  return SOLDADURA.find((s) => tt >= s.tMin && tt <= s.tMax) ?? null;
}
