// A sheet as text, to share it by e-mail, WhatsApp or any other app (tickets #41
// and #42). It is the same document its «PDF» button prints (src/lib/llistats),
// so the text and the PDF always carry the same information. With `whatsapp`, the
// title, the headings and each row's name go *bold*, as WhatsApp shows them.

import { cellText, type PdfDoc, type PdfTable } from "@/lib/llistats/doc";

const empty = (s: string) => !s.trim() || s.trim() === "—";

// A table: «label: value» lines when it has two columns (a sheet's «Dades»);
// otherwise one paragraph per row, its first cell and then «- Column: value»
// for every other cell with something in it (e.g. a client's contacts).
function tableText(t: PdfTable, bold: (s: string) => string): string {
  const head = t.title ? [bold(t.title)] : [];
  if (!t.rows.length) return [...head, t.empty ?? "Cap resultat."].join("\n");
  const labels = t.columns.map((c) => c.label);
  const paras =
    labels.length === 2
      ? [t.rows.map((r) => `${cellText(r[0] ?? "")}: ${cellText(r[1] ?? "")}`).join("\n")]
      : t.rows.map((r) => {
          const cells = r.map(cellText);
          const rest = cells.slice(1).flatMap((v, i) => (empty(v) ? [] : [`- ${labels[i + 1]}: ${v}`]));
          return [bold(cells[0] || "—"), ...rest].join("\n");
        });
  const total = t.total ? [t.total.map(cellText).filter((v) => !empty(v)).join(": ")] : [];
  return [[...head, paras[0]].join("\n"), ...paras.slice(1), ...total].join("\n\n");
}

export function docText(doc: PdfDoc, opts: { whatsapp?: boolean } = {}): string {
  const bold = (s: string) => (opts.whatsapp && s.trim() ? `*${s.trim()}*` : s);
  const parts = [`${bold(doc.title)}\n${doc.subtitle}`];
  for (const b of doc.blocks) {
    if (b.kind === "kpis") {
      if (b.items.length) parts.push(b.items.map((k) => `${k.label}: ${k.value}${k.hint ? ` (${k.hint})` : ""}`).join("\n"));
    } else if (b.kind === "heading") parts.push(bold(b.text));
    else if (b.kind === "note") parts.push(b.text);
    else parts.push(tableText(b.table, bold));
  }
  return parts.join("\n\n");
}
