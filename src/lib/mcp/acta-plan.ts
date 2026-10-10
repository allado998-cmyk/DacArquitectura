// Pure rules for filling in an acta from the chat: list edits by index,
// matching responsables to attendees, and the values a new acta starts with.
// No database or Next.js imports, so tests load it as is.
import type { ActaAssistent, ActaSignatura, ActaTema } from "@/types/db";
import { ACTA_REASONS, TEMA_CATS, temaCat } from "@/lib/acta-doc";

export const MOTIUS = ACTA_REASONS.map((r) => r.value) as [string, ...string[]];
export const CATEGORIES = TEMA_CATS.map((c) => c.key) as [string, ...string[]];

export function motiuLabel(tipus: string): string {
  return ACTA_REASONS.find((r) => r.value === tipus)?.label ?? tipus;
}

export function categoriaLabel(key: string): string {
  return TEMA_CATS.find((c) => c.key === key)?.label ?? key;
}

// Mirrors insertActa() in src/app/actes/actions.ts (a "use server" module can
// only export async functions, so the constants cannot be imported). Used for
// the preview of a new acta; the commit always reads the row it created.
export const DEFAULT_ASSISTENTS: ActaAssistent[] = [
  { present: true, nom: "David Lladó (DL)", empresa: "DO" },
  { present: true, nom: "Joan March (JM)", empresa: "DE i CSiS" },
];
export const DEFAULT_SIGNATURES: ActaSignatura[] = [
  { titol: "Director d'obra", persona: "David Lladó Porta, Arquitecte" },
  { titol: "Director d'execució de l'obra", persona: "Joan March Raurell, Arquitecte Tècnic" },
];
export const DEFAULT_TEMES: ActaTema[] = [{ titol: "", text: "", responsable: "", estat: "pendent" }];
export function defaultLloc(tipus: string): string {
  return tipus === "visita" ? "Obra" : "Oficina";
}

// People ----------------------------------------------------------------------

export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Same rule as the document: "(XX)" in the name wins, else first letters.
export function initialsOf(name: string): string {
  const paren = /\(([^)]+)\)/.exec(name);
  if (paren) return paren[1].trim().toUpperCase();
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export type PersonMatch =
  | { match: "exact" | "initials" | "partial"; value: string }
  | { match: "none"; value: string }
  | { match: "ambiguous"; value: string; candidates: string[] };

// Resolves "DL", "David" or "david llado (dl)" to the attendee's exact name.
export function resolvePerson(input: string, people: string[]): PersonMatch {
  const raw = input.trim();
  const q = fold(raw);
  const uniq = Array.from(new Set(people.map((p) => p.trim()).filter(Boolean)));
  if (!q) return { match: "none", value: raw };

  const exact = uniq.filter((p) => fold(p) === q);
  if (exact.length === 1) return { match: "exact", value: exact[0] };

  if (/^[\p{L}]{1,4}$/u.test(raw)) {
    const byInitials = uniq.filter((p) => initialsOf(p) === raw.toUpperCase());
    if (byInitials.length === 1) return { match: "initials", value: byInitials[0] };
    if (byInitials.length > 1) return { match: "ambiguous", value: raw, candidates: byInitials };
  }

  if (q.length >= 3) {
    const partial = uniq.filter((p) => fold(p).includes(q));
    if (partial.length === 1) return { match: "partial", value: partial[0] };
    if (partial.length > 1) return { match: "ambiguous", value: raw, candidates: partial };
  }
  return { match: "none", value: raw };
}

// Temes -------------------------------------------------------------------------

export interface TemaInput {
  titol?: string;
  text?: string;
  responsables?: string[];
  categoria?: string;
}

export function temaResponsables(t: ActaTema): string[] {
  if (t.responsables) return t.responsables;
  return t.responsable ? t.responsable.split(" & ").map((s) => s.trim()).filter(Boolean) : [];
}

export function temaHasContent(t: ActaTema): boolean {
  return !!(t.titol?.trim() || t.text?.trim() || temaResponsables(t).length);
}

export interface Notes {
  errors: string[];
  warnings: string[];
}

function resolveResponsables(list: string[], people: string[], where: string, notes: Notes): string[] {
  const out: string[] = [];
  for (const r of list) {
    const m = resolvePerson(r, people);
    if (m.match === "ambiguous") {
      notes.errors.push(`${where}: «${r}» pot ser ${m.candidates.join(" o ")}. Indica el nom complet.`);
      continue;
    }
    if (m.match === "none") {
      notes.warnings.push(`${where}: «${r}» no és cap assistent de l'acta; es desarà tal qual.`);
    }
    if (!out.includes(m.value)) out.push(m.value);
  }
  return out;
}

export function buildTema(base: ActaTema | null, patch: TemaInput, people: string[], where: string, notes: Notes): ActaTema {
  const titol = patch.titol ?? base?.titol ?? "";
  const text = patch.text ?? base?.text ?? "";
  const responsables = patch.responsables
    ? resolveResponsables(patch.responsables, people, where, notes)
    : base
      ? temaResponsables(base)
      : [];
  const estat = patch.categoria ?? (base ? temaCat(base) : "pendent");
  return { titol, text, responsables, responsable: responsables.join(" & "), estat };
}

// List edits ---------------------------------------------------------------------

export interface ListOps<T, P> {
  replace?: T[];
  add?: T[];
  modify?: (P & { index: number })[];
  remove?: number[];
}

// Order: modify by original index, remove by original index, then append.
// `replace` stands alone.
export function applyListOps<T, P>(
  current: T[],
  ops: ListOps<T, P>,
  apply: (cur: T, patch: P, index: number) => T,
  what: string,
  notes: Notes,
): { list: T[]; touched: boolean } {
  const touched = !!(ops.replace || ops.add?.length || ops.modify?.length || ops.remove?.length);
  if (!touched) return { list: current, touched: false };
  if (ops.replace) {
    if (ops.add?.length || ops.modify?.length || ops.remove?.length) {
      notes.errors.push(`${what}: si passes la llista sencera no pots afegir, modificar ni treure a la mateixa crida.`);
    }
    return { list: ops.replace, touched: true };
  }
  let list = current.slice();
  const seen = new Set<number>();
  for (const m of ops.modify ?? []) {
    if (m.index < 0 || m.index >= current.length) {
      notes.errors.push(`${what}: no hi ha cap element amb índex ${m.index} (n'hi ha ${current.length}, de 0 a ${current.length - 1}).`);
      continue;
    }
    if (seen.has(m.index)) notes.errors.push(`${what}: l'índex ${m.index} es modifica dues vegades.`);
    seen.add(m.index);
    list[m.index] = apply(list[m.index], m, m.index);
  }
  const removeSet = new Set<number>();
  for (const i of ops.remove ?? []) {
    if (i < 0 || i >= current.length) notes.errors.push(`${what}: no es pot treure l'índex ${i} (n'hi ha ${current.length}).`);
    else removeSet.add(i);
  }
  for (const i of removeSet) if (seen.has(i)) notes.errors.push(`${what}: l'índex ${i} es modifica i es treu alhora.`);
  list = list.filter((_, i) => !removeSet.has(i));
  if (ops.add?.length) list = [...list, ...ops.add];
  return { list, touched: true };
}
