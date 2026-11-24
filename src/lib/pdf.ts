// Print-to-PDF from the browser: lists and statistics with the DAC logo. Opens
// a print window and the user saves it as PDF; backgrounds survive through
// print-color-adjust. What goes in each document is built in src/lib/llistats
// (shared with the PDF files the Descàrregues page generates on the server).

import { cellSpan, cellText, type Align, type PdfCell, type PdfCol, type PdfDoc, type PdfKpi, type PdfTable } from "@/lib/llistats/doc";

export type { PdfCol, PdfDoc };

const GOTHIC = "'Century Gothic', CenturyGothic, AppleGothic, 'URW Gothic', 'Avant Garde', 'Trebuchet MS', sans-serif";

function esc(s: string | null | undefined) {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function classAttr(names: (string | false | undefined)[]) {
  const list = names.filter(Boolean);
  return list.length ? ` class="${list.join(" ")}"` : "";
}
const alignName = (a?: Align) => (a === "right" ? "r" : a === "center" ? "c" : undefined);

function rowCells(cells: PdfCell[], columns: PdfCol[]) {
  let ci = 0;
  return cells
    .map((c) => {
      const span = cellSpan(c);
      const col = span === 1 ? columns[ci] : undefined;
      ci += span;
      const o = typeof c === "string" ? undefined : c;
      const style = `${o?.color ? `color:${o.color};` : ""}${o?.weight ? `font-weight:${o.weight};` : ""}`;
      return `<td${classAttr([alignName(col?.align), col?.mono && "mono", col?.bold && "b", col?.muted && "muted"])}${span > 1 ? ` colspan="${span}"` : ""}${style ? ` style="${style}"` : ""}>${esc(cellText(c))}</td>`;
    })
    .join("");
}

export function tableHtml(t: PdfTable) {
  const head = `<tr>${t.columns.map((c) => `<th${classAttr([alignName(c.align)])}>${esc(c.label)}</th>`).join("")}</tr>`;
  const body = t.rows.length
    ? t.rows.map((r) => `<tr>${rowCells(r, t.columns)}</tr>`).join("")
    : `<tr><td colspan="${t.columns.length}" style="padding:14px;color:#888;">${esc(t.empty ?? "Cap resultat.")}</td></tr>`;
  const tot = t.total ? `<tr class="tot">${rowCells(t.total, t.columns)}</tr>` : "";
  const title = t.title ? `<h2>${esc(t.title)}</h2>` : "";
  return `${title}<table${classAttr([t.narrow && "narrow", t.plain && "plain"])}><thead>${head}</thead><tbody>${body}${tot}</tbody></table>`;
}

function kpisHtml(items: PdfKpi[]) {
  if (!items.length) return "";
  const kpi = (k: PdfKpi) =>
    `<div class="kpi"><div class="l">${esc(k.label)}</div><div class="v"${k.color ? ` style="color:${k.color};"` : ""}>${esc(k.value)}</div>${k.hint ? `<div class="l">${esc(k.hint)}</div>` : ""}</div>`;
  return `<div class="kpis">${items.map(kpi).join("")}</div>`;
}

// The whole page. `origin` is where /logo.jpg is served from.
export function docHtml(doc: PdfDoc, origin = typeof window !== "undefined" ? window.location.origin : "") {
  const inner = doc.blocks
    .map((b) =>
      b.kind === "kpis" ? kpisHtml(b.items)
      : b.kind === "heading" ? `<h2>${esc(b.text)}</h2>`
      : b.kind === "note" ? `<p class="note">${esc(b.text)}</p>`
      : tableHtml(b.table),
    )
    .join("");
  return `<!DOCTYPE html><html lang="ca"><head><meta charset="utf-8"><title>${esc(doc.title)}</title>
    <style>
      @page { size: A4 ${doc.landscape ? "landscape" : "portrait"}; margin: ${doc.marginCm ?? 1.3}cm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: ${doc.gothic ? GOTHIC : "Arial, Helvetica, sans-serif"}; }
      body { margin: 0; color: #1a1a1a; }
      .head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; gap: 16px; }
      .head h1 { font-size: 20px; margin: 0 0 2px; font-weight: 700; }
      .head .sub { font-size: 12px; color: #666; }
      .head img { width: 150px; height: auto; }
      h2 { font-size: 13px; margin: 16px 0 6px; }
      .kpis { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 4px; }
      .kpi { border: 1px solid #e2e2dd; border-radius: 10px; padding: 8px 12px; min-width: 140px; }
      .kpi .l { font-size: 10px; text-transform: uppercase; letter-spacing: .03em; color: #777; }
      .kpi .v { font-size: 16px; font-weight: 700; }
      .note { font-size: 10px; color: #666; margin: 6px 0 0; }
      table { border-collapse: collapse; width: 100%; font-size: 11px; margin-bottom: 4px; }
      table.narrow { max-width: 520px; }
      thead th { background: #1f4d3f; color: #fff; font-weight: 600; text-align: left; padding: 7px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; }
      tbody td { padding: 6px 8px; border-bottom: 1px solid #e7e7e3; }
      tbody tr:nth-child(even) td { background: #f7f7f5; }
      table.plain tbody tr:nth-child(even) td { background: none; }
      td.r, th.r { text-align: right; white-space: nowrap; }
      td.c, th.c { text-align: center; }
      td.b { font-weight: 700; }
      td.mono { font-family: "Courier New", monospace; }
      td.muted { color: #777; }
      tr.tot td { border-top: 2px solid #1f4d3f; border-bottom: none; font-weight: 700; background: #eef2f0 !important; padding-top: 8px; }
      .foot { margin-top: 16px; font-size: 10px; color: #999; }
    </style></head><body>
      <div class="head"><div><h1>${esc(doc.title)}</h1><div class="sub">${esc(doc.subtitle)}</div></div><img src="${origin}/logo.jpg" alt="DAC arquitectura" /></div>
      ${inner}
      <div class="foot">Generat el ${new Date().toLocaleDateString("ca-ES")} · DACARQUITECTURA</div>
    </body></html>`;
}

function print(html: string, landscape: boolean, win?: Window | null) {
  const w = win ?? window.open("", "_blank", landscape ? "width=1100,height=800" : "width=900,height=1000");
  if (!w || w.closed) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

// For a PDF that needs data fetched first: open its window during the click
// (browsers block pop-ups opened after an await) and pass it to openPdfDoc.
export function openPdfWindow(landscape = false): Window | null {
  const w = window.open("", "_blank", landscape ? "width=1100,height=800" : "width=900,height=1000");
  w?.document.write('<p style="font:14px sans-serif;color:#6b6b66;padding:24px">Preparant el PDF…</p>');
  return w;
}

export function openPdfDoc(doc: PdfDoc, win?: Window | null) {
  print(docHtml(doc), doc.landscape, win);
}

export function openListPdf(opts: {
  title: string;
  subtitle: string;
  columns: PdfCol[];
  rows: string[][];
  totalRow?: string[];
  landscape?: boolean;
}) {
  openPdfDoc({
    title: opts.title,
    subtitle: opts.subtitle,
    landscape: opts.landscape ?? true,
    blocks: [{ kind: "table", table: { columns: opts.columns, rows: opts.rows, total: opts.totalRow } }],
  });
}

export function openStatsPdf(opts: {
  title: string;
  subtitle: string;
  kpis: { label: string; value: string }[];
  tables: { title: string; columns: PdfCol[]; rows: string[][] }[];
  landscape?: boolean;
}) {
  openPdfDoc({
    title: opts.title,
    subtitle: opts.subtitle,
    landscape: opts.landscape ?? false,
    blocks: [
      { kind: "kpis", items: opts.kpis },
      ...opts.tables.filter((t) => t.rows.length).map((t) => ({ kind: "table" as const, table: t })),
    ],
  });
}
