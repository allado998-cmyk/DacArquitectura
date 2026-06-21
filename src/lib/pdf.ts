// Shared print-to-PDF helpers (list tables + stats), with the DAC logo.
// Opens a print window; the user saves as PDF. Backgrounds survive via
// print-color-adjust.

type Align = "left" | "right" | "center";
export interface PdfCol {
  label: string;
  align?: Align;
}

function esc(s: string | null | undefined) {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
const alignClass = (a?: Align) => (a === "right" ? " class=\"r\"" : a === "center" ? " class=\"c\"" : "");

function shell(title: string, subtitle: string, inner: string, landscape: boolean) {
  const logo = `${typeof window !== "undefined" ? window.location.origin : ""}/logo.jpg`;
  return `<!DOCTYPE html><html lang="ca"><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      @page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 1.3cm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: Arial, Helvetica, sans-serif; }
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
      table { border-collapse: collapse; width: 100%; font-size: 11px; margin-bottom: 4px; }
      thead th { background: #1f4d3f; color: #fff; font-weight: 600; text-align: left; padding: 7px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; }
      tbody td { padding: 6px 8px; border-bottom: 1px solid #e7e7e3; }
      tbody tr:nth-child(even) td { background: #f7f7f5; }
      td.r, th.r { text-align: right; white-space: nowrap; }
      td.c, th.c { text-align: center; }
      tr.tot td { border-top: 2px solid #1f4d3f; border-bottom: none; font-weight: 700; background: #eef2f0 !important; padding-top: 8px; }
      .foot { margin-top: 16px; font-size: 10px; color: #999; }
    </style></head><body>
      <div class="head"><div><h1>${esc(title)}</h1><div class="sub">${esc(subtitle)}</div></div><img src="${logo}" alt="DAC arquitectura" /></div>
      ${inner}
      <div class="foot">Generat el ${new Date().toLocaleDateString("ca-ES")} · DACARQUITECTURA</div>
    </body></html>`;
}

function print(html: string, landscape: boolean) {
  const w = window.open("", "_blank", landscape ? "width=1100,height=800" : "width=900,height=1000");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

export function tableHtml(columns: PdfCol[], rows: string[][], totalRow?: string[]) {
  const head = `<tr>${columns.map((c) => `<th${alignClass(c.align)}>${esc(c.label)}</th>`).join("")}</tr>`;
  const body = rows.length
    ? rows.map((r) => `<tr>${r.map((cell, i) => `<td${alignClass(columns[i]?.align)}>${esc(cell)}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${columns.length}" style="padding:14px;color:#888;">Cap resultat.</td></tr>`;
  const tot = totalRow ? `<tr class="tot">${totalRow.map((cell, i) => `<td${alignClass(columns[i]?.align)}>${esc(cell)}</td>`).join("")}</tr>` : "";
  return `<table><thead>${head}</thead><tbody>${body}${tot}</tbody></table>`;
}

export function openListPdf(opts: {
  title: string;
  subtitle: string;
  columns: PdfCol[];
  rows: string[][];
  totalRow?: string[];
  landscape?: boolean;
}) {
  const landscape = opts.landscape ?? true;
  print(shell(opts.title, opts.subtitle, tableHtml(opts.columns, opts.rows, opts.totalRow), landscape), landscape);
}

export function openStatsPdf(opts: {
  title: string;
  subtitle: string;
  kpis: { label: string; value: string }[];
  tables: { title: string; columns: PdfCol[]; rows: string[][] }[];
  landscape?: boolean;
}) {
  const landscape = opts.landscape ?? false;
  const kpis = opts.kpis.length
    ? `<div class="kpis">${opts.kpis.map((k) => `<div class="kpi"><div class="l">${esc(k.label)}</div><div class="v">${esc(k.value)}</div></div>`).join("")}</div>`
    : "";
  const tables = opts.tables
    .filter((t) => t.rows.length)
    .map((t) => `<h2>${esc(t.title)}</h2>${tableHtml(t.columns, t.rows)}`)
    .join("");
  print(shell(opts.title, opts.subtitle, kpis + tables, landscape), landscape);
}
