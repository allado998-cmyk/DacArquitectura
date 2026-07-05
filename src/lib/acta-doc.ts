// Acta d'Obra / de Reunió — HTML document builder used for the print/PDF output
// and the Word (.doc) export. Mirrors the FE75 "Acta de Projecte" model.
// Bilingual: labels/titles are translated (ca/es); user content is kept as-is.

import type { Acta, ActaSignatura, ActaTema } from "@/types/db";

export type ActaLang = "ca" | "es";

const DOC_FONT = "'Century Gothic', CenturyGothic, AppleGothic, 'URW Gothic', 'Avant Garde', 'Trebuchet MS', sans-serif";

const MESOS: Record<ActaLang, string[]> = {
  ca: ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"],
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
};

interface Txt {
  dadesGenerals: string;
  projecte: string;
  referencia: string;
  ubicacio: string;
  client: string;
  actaNum: string;
  lloc: string;
  data: string;
  hora: string;
  assistents: string;
  temes: string;
  responsable: string;
  proximaVisita: string;
  fotografies: string;
  documents: string;
  assabentats: string;
  closing: (d: string) => string;
}
const TXT: Record<ActaLang, Txt> = {
  ca: {
    dadesGenerals: "DADES GENERALS",
    projecte: "Projecte", referencia: "Referència", ubicacio: "Ubicació", client: "Client",
    actaNum: "Acta nº", lloc: "Lloc", data: "Data", hora: "Hora",
    assistents: "ASSISTENTS", temes: "TEMES", responsable: "RESPONSABLE",
    proximaVisita: "PROPERA VISITA", fotografies: "FOTOGRAFIES", documents: "DOCUMENTS ADJUNTS",
    assabentats: "Assabentats,",
    closing: (d) => `I per que consti, tots signen per triplicat la present acta a Barcelona el ${d}.`,
  },
  es: {
    dadesGenerals: "DATOS GENERALES",
    projecte: "Proyecto", referencia: "Referencia", ubicacio: "Ubicación", client: "Cliente",
    actaNum: "Acta nº", lloc: "Lugar", data: "Fecha", hora: "Hora",
    assistents: "ASISTENTES", temes: "TEMAS", responsable: "RESPONSABLE",
    proximaVisita: "PRÓXIMA VISITA", fotografies: "FOTOGRAFÍAS", documents: "DOCUMENTOS ADJUNTOS",
    assabentats: "Enterados,",
    closing: (d) => `Y para que conste, todos firman por triplicado la presente acta en Barcelona el ${d}.`,
  },
};

function esc(s: string | null | undefined) {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escMultiline(s: string | null | undefined) {
  return esc(s).replace(/\r?\n/g, "<br>");
}
function longDate(iso: string | null | undefined, lang: ActaLang): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = parseInt(m[3], 10), mo = parseInt(m[2], 10) - 1, y = m[1];
  return `${d} de ${MESOS[lang][mo] ?? ""} de ${y}`;
}
function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

// Extensible list of acta reasons. `value` is stored in acta.tipus.
export const ACTA_REASONS: { value: string; label: string; labelEs: string; docTitle: string; docTitleEs: string }[] = [
  { value: "visita", label: "Visita d'obra", labelEs: "Visita de obra", docTitle: "[Acta d'Obra]", docTitleEs: "[Acta de Obra]" },
  { value: "reunio", label: "Reunió", labelEs: "Reunión", docTitle: "[Acta de Reunió]", docTitleEs: "[Acta de Reunión]" },
  { value: "coordinacio", label: "Coordinació de seguretat", labelEs: "Coordinación de seguridad", docTitle: "[Acta de Coordinació]", docTitleEs: "[Acta de Coordinación]" },
  { value: "altres", label: "Altres", labelEs: "Otros", docTitle: "[Acta]", docTitleEs: "[Acta]" },
];

export function actaReasonLabel(tipus: string, lang: ActaLang = "ca"): string {
  const r = ACTA_REASONS.find((x) => x.value === tipus);
  if (!r) return tipus;
  return lang === "es" ? r.labelEs : r.label;
}
export function actaTitle(tipus: string, lang: ActaLang = "ca"): string {
  const r = ACTA_REASONS.find((x) => x.value === tipus);
  if (!r) return "[Acta]";
  return lang === "es" ? r.docTitleEs : r.docTitle;
}

// Temes categories.
export const TEMA_CATS: { key: string; label: string; labelEs: string }[] = [
  { key: "pendent", label: "Pendent", labelEs: "Pendiente" },
  { key: "executat", label: "Executat", labelEs: "Ejecutado" },
  { key: "tractat", label: "Tractats", labelEs: "Tratados" },
];
export function temaCat(t: ActaTema): string {
  const e = t.estat ?? "pendent";
  if (e === "fet") return "executat"; // legacy
  return e === "executat" || e === "tractat" ? e : "pendent";
}
function temaCatLabel(key: string, lang: ActaLang): string {
  const c = TEMA_CATS.find((x) => x.key === key);
  if (!c) return key;
  return lang === "es" ? c.labelEs : c.label;
}
function temaHasContent(t: ActaTema): boolean {
  return !!((t.titol && t.titol.trim()) || (t.text && t.text.trim()) || (t.responsable && t.responsable.trim()));
}
function actaSignatures(a: Acta): ActaSignatura[] {
  if (a.signatures && a.signatures.length) return a.signatures;
  const out: ActaSignatura[] = [];
  if (a.sig_do != null) out.push({ titol: "Director d'obra", persona: a.sig_do ?? "" });
  if (a.sig_de != null) out.push({ titol: "Director d'execució de l'obra", persona: a.sig_de ?? "" });
  if (a.sig_adj_empresa || a.sig_adj_persona) out.push({ titol: `Representant de l'empresa adjudicatària${a.sig_adj_empresa ? `, ${a.sig_adj_empresa}` : ""}`, persona: a.sig_adj_persona ?? "" });
  if (a.sig_prom_empresa || a.sig_prom_persona) out.push({ titol: `Representant de l'ens promotor${a.sig_prom_empresa ? `, ${a.sig_prom_empresa}` : ""}`, persona: a.sig_prom_persona ?? "" });
  return out;
}

export interface RenderedDoc { name: string; pages: string[] }

export function buildActaHtml(a: Acta, lang: ActaLang = "ca", logoUrl = "/logo.jpg", renderedDocs?: RenderedDoc[]): string {
  const t = TXT[lang];
  const grey = "#7a7a72";
  const bd = "1px solid #c9c9c9";
  const barCell = "padding:4px 8px;font-size:10px;letter-spacing:.05em;color:#666;text-transform:uppercase;border-bottom:1px solid #bdbdbd;-webkit-print-color-adjust:exact;print-color-adjust:exact;";
  const bar = (title: string, right?: string) =>
    `<table style="width:100%;border-collapse:collapse;margin:14px 0 0;"><tr>
      <td bgcolor="#e6e6e6" style="${barCell}background:#e6e6e6;">${esc(title)}</td>
      ${right ? `<td bgcolor="#e6e6e6" style="${barCell}background:#e6e6e6;text-align:right;">${esc(right)}</td>` : ""}
    </tr></table>`;
  const cell = (label: string, value: string, opts: { span?: number; bold?: boolean; width?: string } = {}) =>
    `<td${opts.span ? ` colspan="${opts.span}"` : ""} style="border:${bd};padding:3px 7px;vertical-align:top;${opts.width ? `width:${opts.width};` : ""}">
      ${label ? `<div style="font-style:italic;color:${grey};font-size:8px;">${esc(label)}</div>` : ""}
      <div style="font-size:11px;${opts.bold ? "font-weight:bold;" : ""}">${value || "&nbsp;"}</div>
    </td>`;

  const dadesGenerals = `
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <tr>
        ${cell(t.projecte, esc(a.projecte ?? ""), { span: 3, bold: true })}
        ${cell(t.referencia, esc(a.referencia ?? ""), { bold: true, width: "90px" })}
      </tr>
      <tr>${cell(t.ubicacio, esc(a.ubicacio ?? ""), { span: 4 })}</tr>
      <tr>${cell(t.client, esc(a.client ?? ""), { span: 4 })}</tr>
      <tr>
        ${cell(t.actaNum, esc(a.acta_num ?? ""), { width: "25%" })}
        ${cell(t.lloc, esc(a.lloc ?? ""), { width: "25%" })}
        ${cell(t.data, shortDate(a.data), { width: "25%" })}
        ${cell(t.hora, esc(a.hora ?? ""), { width: "25%" })}
      </tr>
    </table>`;

  const assistentsRows = (a.assistents ?? [])
    .map(
      (as) => `<tr>
        <td style="border:${bd};padding:3px 7px;text-align:center;width:30px;font-weight:bold;">${as.present ? "X" : "&nbsp;"}</td>
        <td style="border:${bd};padding:3px 7px;font-size:11px;">${esc(as.nom)}</td>
        <td style="border:${bd};padding:3px 7px;font-size:11px;width:130px;">${esc(as.empresa)}</td>
      </tr>`,
    )
    .join("");
  const assistents = `<table style="width:100%;border-collapse:collapse;">${assistentsRows}</table>`;

  // Temes tractats — one table per category.
  const barTemes = (label: string) =>
    `<table style="width:100%;border-collapse:collapse;margin:14px 0 0;"><tr>
      <td bgcolor="#e6e6e6" style="${barCell}background:#e6e6e6;">${esc(t.temes)} - ${esc(label)}</td>
      <td bgcolor="#e6e6e6" width="130" style="${barCell}background:#e6e6e6;text-align:right;">${esc(t.responsable)}</td>
    </tr></table>`;
  const temesSections = TEMA_CATS.map((cat) => {
    const rows = (a.temes ?? [])
      .filter((tm) => temaCat(tm) === cat.key && temaHasContent(tm))
      .map(
        (tm) => `<tr>
          <td style="border:${bd};padding:4px 8px;font-size:11px;vertical-align:top;">
            ${tm.titol && tm.titol.trim() ? `<div style="font-weight:bold;">${esc(tm.titol)}</div>` : ""}
            ${tm.text && tm.text.trim() ? `<div>${escMultiline(tm.text)}</div>` : ""}
          </td>
          <td style="border:${bd};padding:4px 8px;font-size:11px;vertical-align:top;width:130px;">${esc(tm.responsables && tm.responsables.length ? tm.responsables.join(" & ") : tm.responsable)}</td>
        </tr>`,
      )
      .join("");
    if (!rows) return "";
    return barTemes(temaCatLabel(cat.key, lang)) + `<table style="width:100%;border-collapse:collapse;table-layout:fixed;">${rows}</table>`;
  }).join("");

  const properaBits = [a.propera_data ? shortDate(a.propera_data) : "", a.propera_hora ?? ""].filter(Boolean).join(" · ");
  const properaBody = [properaBits, a.propera_visita ?? ""].filter((x) => x && x.trim()).join(" — ");
  const propera = `<table style="width:100%;border-collapse:collapse;"><tr><td style="border:${bd};padding:4px 8px;font-size:11px;">${esc(properaBody) || "&nbsp;"}</td></tr></table>`;

  const sigs = actaSignatures(a);
  // The blank signing space uses real content (nbsp + line breaks) so Word
  // doesn't collapse it (Word ignores empty divs with only a CSS height).
  const sigBlock = (s: ActaSignatura) =>
    `<td style="border:${bd};padding:6px 8px;vertical-align:top;width:50%;">
      <div style="font-size:11px;white-space:pre-line;">${escMultiline(s.titol)}</div>
      <div style="height:80px;line-height:20px;font-size:11px;">&nbsp;<br>&nbsp;<br>&nbsp;<br>&nbsp;</div>
      <div style="font-size:11px;border-top:1px solid #999;padding-top:3px;">${esc(s.persona)}</div>
    </td>`;
  let sigRows = "";
  for (let i = 0; i < sigs.length; i += 2) {
    sigRows += `<tr>${sigBlock(sigs[i])}${sigs[i + 1] ? sigBlock(sigs[i + 1]) : `<td style="border:${bd};width:50%;">&nbsp;</td>`}</tr>`;
  }
  const signatures = sigs.length ? `<table style="width:100%;border-collapse:collapse;margin-top:6px;">${sigRows}</table>` : "";

  // Fotografies — start on a new page; each image one by one, full width.
  const pageBreak = "page-break-before:always;-webkit-column-break-before:always;break-before:page;";
  const fotos = a.fotografies ?? [];
  const fotosSection = fotos.length
    ? `<div style="${pageBreak}">${bar(t.fotografies)}${fotos.map((src) => `<div style="margin-top:10px;page-break-inside:avoid;text-align:center;"><img src="${src}" width="640" style="max-width:100%;height:auto;" /></div>`).join("")}</div>`
    : "";

  // Documents adjunts — start on a new page. If the PDFs have been rasterised,
  // embed their pages so they appear in the generated PDF/Word; otherwise list
  // the file names.
  const docs = a.documents ?? [];
  let docsSection = "";
  if (renderedDocs && renderedDocs.length) {
    docsSection = `<div style="${pageBreak}">${bar(t.documents)}${renderedDocs
      .map((d) => `<div style="font-weight:bold;font-size:11px;margin:10px 0 4px;">${esc(d.name)}</div>${d.pages
        .map((p, pi) => `<div style="text-align:center;margin-bottom:6px;${pi > 0 ? pageBreak : ""}"><img src="${p}" width="720" style="max-width:100%;height:auto;border:1px solid #ddd;" /></div>`)
        .join("")}`)
      .join("")}</div>`;
  } else if (docs.length) {
    docsSection = `<div style="${pageBreak}">${bar(t.documents)}<table style="width:100%;border-collapse:collapse;">${docs.map((d, i) => `<tr><td style="border:${bd};padding:4px 8px;font-size:11px;">${i + 1}. ${esc(d.name)}</td></tr>`).join("")}</table></div>`;
  }

  const closing = `<p style="font-size:11px;margin:14px 0 4px;">${esc(t.closing(longDate(a.data, lang)))}<br>${esc(t.assabentats)}</p>`;

  return `
  <div style="font-family:${DOC_FONT};font-size:11px;color:#111;max-width:820px;margin:0 auto;">
    <div style="text-align:right;margin-bottom:2px;">
      <img src="${logoUrl}" alt="DAC arquitectura" width="150" height="59" style="width:150px;height:auto;display:inline-block;" />
      <div style="font-weight:bold;font-size:15px;margin-top:2px;">${esc(actaTitle(a.tipus, lang))}</div>
    </div>

    ${bar(t.dadesGenerals)}
    ${dadesGenerals}

    ${bar(t.assistents)}
    ${assistents}

    ${temesSections}

    ${bar(t.proximaVisita)}
    ${propera}

    ${closing}
    ${signatures}

    ${fotosSection}
    ${docsSection}
  </div>`;
}

// ---- client-side output helpers ----

function dataUrlToUint8(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Rasterise a PDF (data URI) to one JPEG data-URI per page, so the attached
// document's pages can be embedded into the generated PDF / Word.
async function rasterizePdf(dataUrl: string, scale = 1.6): Promise<string[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfjs: any = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const doc = await pdfjs.getDocument({ data: dataUrlToUint8(dataUrl) }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport }).promise;
      pages.push(canvas.toDataURL("image/jpeg", 0.8));
    }
    return pages;
  } catch {
    return [];
  }
}

async function renderActaDocs(a: Acta): Promise<RenderedDoc[]> {
  const out: RenderedDoc[] = [];
  for (const d of a.documents ?? []) {
    out.push({ name: d.name, pages: await rasterizePdf(d.dataUrl) });
  }
  return out;
}

export async function openActaPdf(a: Acta, lang: ActaLang = "ca") {
  // Open the window synchronously (within the click) to dodge popup blockers.
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.write("<!DOCTYPE html><html><body style='font-family:sans-serif;padding:24px;color:#555;'>Generant document…</body></html>");
  const logo = `${typeof window !== "undefined" ? window.location.origin : ""}/logo.jpg`;
  const renderedDocs = await renderActaDocs(a);
  const html = `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(a.num ?? "Acta")}</title>
    <style>@page { size: A4 portrait; margin: 1.3cm; } *{-webkit-print-color-adjust:exact;print-color-adjust:exact;} body{margin:0;}</style>
    </head><body>${buildActaHtml(a, lang, logo, renderedDocs)}</body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
}

async function logoDataUri(): Promise<string> {
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/logo.jpg`;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

export async function downloadActaWord(a: Acta, lang: ActaLang = "ca") {
  const logo = await logoDataUri();
  const renderedDocs = await renderActaDocs(a);
  const head = `<style>body,table,td,th,tr,div,span,p,strong,em{font-family:${DOC_FONT};}*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}</style>`;
  const html = `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(a.num ?? "Acta")}</title>${head}</head><body>${buildActaHtml(a, lang, logo, renderedDocs)}</body></html>`;
  const blob = new Blob(["﻿", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${a.num ?? "acta"}.doc`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
