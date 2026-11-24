// Draws a list or statistics document (src/lib/llistats/doc.ts) as a PDF file
// on the server, with the look of the browser's print (src/lib/pdf.ts): title
// and subtitle, the logo on the right, KPI boxes, green-headed tables with
// zebra rows and a total row. Pure JavaScript (jsPDF), no browser: a page of a
// list takes milliseconds.
//
// Fonts: the PDF's built-in Helvetica (Arial's metrics) and Courier, so no
// font is embedded; they cover Catalan, € and the usual punctuation
// (Windows-1252). Anything else is swapped for its nearest equivalent.

import { jsPDF } from "jspdf";
import { autoTable, type CellDef, type Styles } from "jspdf-autotable";
import { cellSpan, cellText, type PdfCell, type PdfCol, type PdfDoc, type PdfKpi, type PdfTable } from "@/lib/llistats/doc";

type RGB = [number, number, number];

const PX = 25.4 / 96; // 1 CSS px in mm
const PT = 0.75; // 1 CSS px in pt
const GREEN: RGB = [31, 77, 63];
const INK: RGB = [26, 26, 26];
const LOGO_W = 150 * PX;

export interface Logo {
  data: Uint8Array; // JPEG
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Text the standard fonts can print (Windows-1252)
// ---------------------------------------------------------------------------

const CP1252_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
const SWAP: Record<string, string> = {
  "−": "-", // minus sign
  "‐": "-",
  "‑": "-",
  "→": "->",
  "←": "<-",
  "≤": "<=",
  "≥": ">=",
  "ŀ": "l·", // ŀ (ela geminada in one character)
  "Ŀ": "L·",
  " ": " ",
  " ": " ",
  " ": " ",
  "​": "",
};

export function winAnsi(s: string): string {
  let out = "";
  for (const ch of s.normalize("NFC")) {
    const c = ch.codePointAt(0)!;
    if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || CP1252_EXTRA.has(ch) || ch === "\n") out += ch;
    else if (ch in SWAP) out += SWAP[ch];
    else if (ch === "\t" || ch === "\r") out += " ";
    else {
      const base = ch.normalize("NFD").replace(/\p{M}/gu, "");
      out += base && [...base].every((b) => b.codePointAt(0)! < 0x7f) ? base : "?";
    }
  }
  return out;
}

const hex = (h: string): RGB => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(h.trim());
  if (!m) return INK;
  const v = m[1].length === 3 ? m[1].split("").map((x) => x + x).join("") : m[1];
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

interface Ctx {
  pdf: jsPDF;
  m: number; // margin, mm
  W: number;
  H: number;
  y: number;
}

const FOOT = 6; // mm kept free above the bottom margin edge for the footer line

function bottom(c: Ctx) {
  return c.H - c.m;
}

function ensure(c: Ctx, need: number) {
  if (c.y + need > bottom(c)) {
    c.pdf.addPage();
    c.y = c.m;
  }
}

function setText(pdf: jsPDF, size: number, style: "normal" | "bold", color: RGB, font = "helvetica") {
  pdf.setFont(font, style);
  pdf.setFontSize(size);
  pdf.setTextColor(...color);
}

function header(c: Ctx, doc: PdfDoc, logo: Logo | null) {
  const { pdf, m, W } = c;
  let logoH = 0;
  if (logo) {
    logoH = (LOGO_W * logo.height) / logo.width;
    pdf.addImage(logo.data, "JPEG", W - m - LOGO_W, m, LOGO_W, logoH, "logo", "FAST");
  }
  const textW = W - 2 * m - (logo ? LOGO_W + 16 * PX : 0);
  setText(pdf, 20 * PT, "bold", INK);
  const title = pdf.splitTextToSize(winAnsi(doc.title), textW) as string[];
  pdf.text(title, m, m, { baseline: "top", lineHeightFactor: 1.15 });
  let y = m + title.length * 20 * PT * 1.15 * (25.4 / 72) + 2 * PX;
  if (doc.subtitle) {
    setText(pdf, 12 * PT, "normal", [102, 102, 102]);
    const sub = pdf.splitTextToSize(winAnsi(doc.subtitle), textW) as string[];
    pdf.text(sub, m, y, { baseline: "top", lineHeightFactor: 1.2 });
    y += sub.length * 12 * PT * 1.2 * (25.4 / 72);
  }
  c.y = Math.max(y, m + logoH) + 14 * PX;
}

const ptToMm = (pt: number) => pt * (25.4 / 72);

function kpis(c: Ctx, items: PdfKpi[]) {
  if (!items.length) return;
  const { pdf, m, W } = c;
  const padX = 12 * PX;
  const padY = 8 * PX;
  const gap = 10 * PX;
  const labelPt = 10 * PT;
  const valuePt = 16 * PT;
  const lineL = ptToMm(labelPt) * 1.25;
  const lineV = ptToMm(valuePt) * 1.3;
  const width = (k: PdfKpi) => {
    setText(pdf, labelPt, "normal", INK);
    const l = Math.max(pdf.getTextWidth(winAnsi(k.label.toLocaleUpperCase("ca-ES"))), k.hint ? pdf.getTextWidth(winAnsi(k.hint.toLocaleUpperCase("ca-ES"))) : 0);
    setText(pdf, valuePt, "bold", INK);
    const v = pdf.getTextWidth(winAnsi(k.value));
    return Math.min(W - 2 * m, Math.max(140 * PX, Math.max(l, v) + 2 * padX + 0.5));
  };
  // Lay the boxes out in rows (flex-wrap), each row as tall as its tallest box.
  const rows: { k: PdfKpi; w: number }[][] = [[]];
  let x = m;
  for (const k of items) {
    const w = width(k);
    if (x + w > W - m + 0.01 && rows[rows.length - 1].length) {
      rows.push([]);
      x = m;
    }
    rows[rows.length - 1].push({ k, w });
    x += w + gap;
  }
  for (const row of rows) {
    const h = 2 * padY + lineL + lineV + (row.some((r) => r.k.hint) ? lineL : 0);
    ensure(c, h);
    let bx = m;
    for (const { k, w } of row) {
      pdf.setDrawColor(226, 226, 221);
      pdf.setLineWidth(1 * PX);
      pdf.roundedRect(bx, c.y, w, h, 10 * PX, 10 * PX, "S");
      setText(pdf, labelPt, "normal", [119, 119, 119]);
      pdf.text(winAnsi(k.label.toLocaleUpperCase("ca-ES")), bx + padX, c.y + padY, { baseline: "top" });
      setText(pdf, valuePt, "bold", k.color ? hex(k.color) : INK);
      pdf.text(winAnsi(k.value), bx + padX, c.y + padY + lineL, { baseline: "top" });
      if (k.hint) {
        setText(pdf, labelPt, "normal", [119, 119, 119]);
        pdf.text(winAnsi(k.hint.toLocaleUpperCase("ca-ES")), bx + padX, c.y + padY + lineL + lineV, { baseline: "top" });
      }
      bx += w + gap;
    }
    c.y += h + gap;
  }
  c.y += 4 * PX - gap;
}

function heading(c: Ctx, text: string, keepWithNext = 22) {
  c.y += 16 * PX;
  ensure(c, ptToMm(13 * PT) + 6 * PX + keepWithNext);
  setText(c.pdf, 13 * PT, "bold", INK);
  c.pdf.text(winAnsi(text), c.m, c.y, { baseline: "top" });
  c.y += ptToMm(13 * PT) * 1.2 + 6 * PX;
}

function note(c: Ctx, text: string) {
  c.y += 6 * PX;
  setText(c.pdf, 10 * PT, "normal", [102, 102, 102]);
  const lines = c.pdf.splitTextToSize(winAnsi(text), c.W - 2 * c.m) as string[];
  const lh = ptToMm(10 * PT) * 1.3;
  for (const line of lines) {
    ensure(c, lh);
    c.pdf.text(line, c.m, c.y, { baseline: "top" });
    c.y += lh;
  }
}

// What a column gives its cells. autoTable applies columnStyles to the body
// only, so the total row gets them cell by cell.
function colStyles(col: PdfCol): Partial<Styles> {
  const s: Partial<Styles> = {};
  if (col.align) s.halign = col.align;
  if (col.mono) s.font = "courier";
  if (col.bold) s.fontStyle = "bold";
  if (col.muted) s.textColor = [119, 119, 119];
  return s;
}

function cellDef(cell: PdfCell, col: PdfCol | undefined, withCol: boolean): CellDef {
  const span = cellSpan(cell);
  const o = typeof cell === "string" ? undefined : cell;
  const styles: Partial<Styles> = withCol && col ? colStyles(col) : {};
  if (span > 1) {
    // A spanning cell (a total's label) takes no column style.
    styles.halign = "left";
    styles.font = "helvetica";
    styles.textColor = INK;
  }
  if (o?.color) styles.textColor = hex(o.color);
  if (o?.weight) styles.fontStyle = "bold";
  return { content: winAnsi(cellText(cell)), colSpan: span > 1 ? span : undefined, styles };
}

function rowDefs(cells: PdfCell[], columns: PdfCol[], withCol = false): CellDef[] {
  let ci = 0;
  return cells.map((cell) => {
    const col = cellSpan(cell) === 1 ? columns[ci] : undefined;
    ci += cellSpan(cell);
    return cellDef(cell, col, withCol);
  });
}

function table(c: Ctx, t: PdfTable) {
  const { pdf, m, W } = c;
  if (t.title) heading(c, t.title);
  else ensure(c, 20);
  const columnStyles: Record<number, Partial<Styles>> = {};
  t.columns.forEach((col, i) => {
    columnStyles[i] = { ...colStyles(col), ...(col.align === "right" ? { cellWidth: "wrap" as const } : {}) }; // numbers never wrap
  });
  const body: CellDef[][] = t.rows.length
    ? t.rows.map((r) => rowDefs(r, t.columns))
    : [[{ content: winAnsi(t.empty ?? "Cap resultat."), colSpan: t.columns.length, styles: { textColor: [136, 136, 136], cellPadding: 14 * PX, halign: "left", font: "helvetica" } }]];
  const pad = { top: 6 * PX, bottom: 6 * PX, left: 8 * PX, right: 8 * PX };
  autoTable(pdf, {
    startY: c.y,
    margin: { top: m, bottom: m + 1, left: m, right: m },
    tableWidth: t.narrow ? Math.min(520 * PX, W - 2 * m) : "auto",
    theme: "plain",
    rowPageBreak: "avoid",
    showHead: "everyPage",
    showFoot: "lastPage",
    head: [t.columns.map((col) => ({ content: winAnsi(col.label.toLocaleUpperCase("ca-ES")), styles: { halign: col.align ?? "left" } }))],
    body,
    foot: t.total ? [rowDefs(t.total, t.columns, true)] : undefined,
    styles: { font: "helvetica", fontSize: 11 * PT, textColor: INK, cellPadding: pad, overflow: "linebreak", valign: "middle", lineColor: [231, 231, 227], lineWidth: { bottom: 1 * PX, top: 0, left: 0, right: 0 } },
    // The green border hides the hairline seams some viewers show between header cells.
    headStyles: { fillColor: GREEN, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 10 * PT, cellPadding: { ...pad, top: 7 * PX, bottom: 7 * PX }, lineColor: GREEN, lineWidth: 0.25 },
    footStyles: { fillColor: [238, 242, 240], textColor: INK, fontStyle: "bold", fontSize: 11 * PT, cellPadding: { ...pad, top: 8 * PX }, lineColor: GREEN, lineWidth: { top: 2 * PX, bottom: 0, left: 0, right: 0 } },
    columnStyles,
    didParseCell: (data) => {
      // Zebra on the 2nd, 4th… rows, as the CSS (autoTable's own starts on the 1st).
      if (data.section === "body" && !t.plain && data.row.index % 2 === 1) data.cell.styles.fillColor = [247, 247, 245];
      // The total row is bold all along.
      if (data.section === "foot") data.cell.styles.fontStyle = "bold";
    },
  });
  c.y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4 * PX;
}

function footers(c: Ctx, generat: string) {
  const { pdf, m, W, H } = c;
  const n = pdf.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    pdf.setPage(i);
    setText(pdf, 10 * PT, "normal", [153, 153, 153]);
    const y = H - m + (m - FOOT) / 2 + 1;
    pdf.text(winAnsi(`Generat el ${generat} · DACARQUITECTURA`), m, y, { baseline: "top" });
    if (n > 1) pdf.text(`Pàgina ${i} de ${n}`, W - m, y, { baseline: "top", align: "right" });
  }
}

// `generat`: "24/11/2026 a les 06:00", printed at the foot of every page.
// Several documents (the years of a «de tots els anys» file) go one after the
// other in the same file, each from a new page with its own header; the pages
// are numbered through the whole file. They share the first one's orientation.
export function renderPdf(docs: PdfDoc | PdfDoc[], opts: { logo: Logo | null; generat: string; title?: string }): Uint8Array {
  const list = Array.isArray(docs) ? docs : [docs];
  const first = list[0];
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: first.landscape ? "landscape" : "portrait", compress: true });
  pdf.setProperties({ title: winAnsi(opts.title ?? first.title), subject: winAnsi(list.length > 1 ? opts.title ?? first.title : first.subtitle), author: "DACARQUITECTURA", creator: "DacArquitectura" });
  const m = (first.marginCm ?? 1.3) * 10;
  const c: Ctx = { pdf, m, W: pdf.internal.pageSize.getWidth(), H: pdf.internal.pageSize.getHeight(), y: m };
  list.forEach((doc, i) => {
    if (i > 0) {
      pdf.addPage();
      c.y = m;
    }
    header(c, doc, opts.logo);
    for (const b of doc.blocks) {
      if (b.kind === "kpis") kpis(c, b.items);
      else if (b.kind === "heading") heading(c, b.text, 30);
      else if (b.kind === "note") note(c, b.text);
      else table(c, b.table);
    }
  });
  footers(c, opts.generat);
  return new Uint8Array(pdf.output("arraybuffer"));
}

// Size of a JPEG, from its SOF segment (for the logo's aspect ratio).
export function jpegSize(data: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < data.length) {
    if (data[i] !== 0xff) return null;
    const marker = data[i + 1];
    const len = (data[i + 2] << 8) | data[i + 3];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: (data[i + 5] << 8) | data[i + 6], width: (data[i + 7] << 8) | data[i + 8] };
    }
    i += 2 + len;
  }
  return null;
}
