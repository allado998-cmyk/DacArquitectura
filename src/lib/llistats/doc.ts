// What a printed list or statistics sheet contains (title, KPIs, tables), apart
// from how it is drawn. The same document is printed from the browser by the
// «PDF» buttons (src/lib/pdf.ts) and written as a PDF file on the server for
// the Descàrregues page (src/lib/descarregues/pdf.ts), so the builders in this
// folder decide the columns, rows and totals once for both.
//
// Pure functions only: this folder is imported by client components and by
// the cron job alike.

export type Align = "left" | "right" | "center";

export interface PdfCol {
  label: string;
  align?: Align;
  mono?: boolean; // Courier: expedient and invoice numbers, NIFs
  bold?: boolean;
  muted?: boolean; // grey text
}

// A cell: plain text, or text with its own colour or weight, or one that spans
// several columns (a total's label). A spanning cell takes no column style.
export type PdfCell = string | { text: string; color?: string; weight?: 600 | 700; span?: number };

export interface PdfTable {
  title?: string;
  columns: PdfCol[];
  rows: PdfCell[][];
  total?: PdfCell[]; // last row, bold over a green rule
  empty?: string; // the row shown when there are none («Cap resultat.» by default)
  narrow?: boolean; // at most 520 px wide (short two-column tables)
  plain?: boolean; // no zebra stripes
}

export interface PdfKpi {
  label: string;
  value: string;
  hint?: string; // small line under the value
  color?: string; // of the value
}

export type PdfBlock =
  | { kind: "kpis"; items: PdfKpi[] }
  | { kind: "heading"; text: string }
  | { kind: "note"; text: string }
  | { kind: "table"; table: PdfTable };

export interface PdfDoc {
  title: string;
  subtitle: string;
  landscape: boolean;
  marginCm?: number; // page margin, 1.3 cm when not set
  gothic?: boolean; // Century Gothic like the invoices (the browser has it; the server uses Helvetica)
  blocks: PdfBlock[];
}

export function cellText(c: PdfCell): string {
  return typeof c === "string" ? c : c.text;
}

export function cellSpan(c: PdfCell): number {
  return typeof c === "string" ? 1 : Math.max(1, c.span ?? 1);
}

// "1.234,5 h"
export function fmtHores(h: number): string {
  return new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 2 }).format(Math.round(h * 100) / 100) + " h";
}

// "2026-11-24" (or a timestamp starting so) → "24/11/2026"; "" when there is none.
export function dataCa(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
