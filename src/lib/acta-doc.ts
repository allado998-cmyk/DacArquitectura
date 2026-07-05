// Acta d'Obra / de Reunió — HTML document builder used for the print/PDF output
// and the Word (.doc) export. Mirrors the FE75 "Acta de Projecte" model.

import type { Acta, ActaSignatura, ActaTema } from "@/types/db";

const DOC_FONT = "'Century Gothic', CenturyGothic, AppleGothic, 'URW Gothic', 'Avant Garde', 'Trebuchet MS', sans-serif";

const MESOS = ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"];

function esc(s: string | null | undefined) {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// Preserve manual line breaks entered in a textarea.
function escMultiline(s: string | null | undefined) {
  return esc(s).replace(/\r?\n/g, "<br>");
}
function longDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = parseInt(m[3], 10), mo = parseInt(m[2], 10) - 1, y = m[1];
  return `${d} de ${MESOS[mo] ?? ""} de ${y}`;
}
function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

const FOOTER = "A Gran Via Carles III, 46-48, esc. 'O', local 08028 Barcelona · T 34 933 017 940 · M info@dacarquitectura.com · NIF B-64205545";

// Extensible list of acta reasons. `value` is stored in acta.tipus.
export const ACTA_REASONS: { value: string; label: string; docTitle: string }[] = [
  { value: "visita", label: "Visita d'obra", docTitle: "[Acta d'Obra]" },
  { value: "reunio", label: "Reunió", docTitle: "[Acta de Reunió]" },
  { value: "replanteig", label: "Replanteig", docTitle: "[Acta de Replanteig]" },
  { value: "inici", label: "Inici d'obra", docTitle: "[Acta d'Inici d'Obra]" },
  { value: "final", label: "Final d'obra", docTitle: "[Acta de Final d'Obra]" },
  { value: "seguiment", label: "Seguiment d'obra", docTitle: "[Acta de Seguiment]" },
  { value: "coordinacio", label: "Coordinació de seguretat", docTitle: "[Acta de Coordinació]" },
  { value: "aprovacio", label: "Aprovació", docTitle: "[Acta d'Aprovació]" },
  { value: "altres", label: "Altres", docTitle: "[Acta]" },
];

export function actaReasonLabel(tipus: string): string {
  return ACTA_REASONS.find((r) => r.value === tipus)?.label ?? tipus;
}

export function actaTitle(tipus: string): string {
  return ACTA_REASONS.find((r) => r.value === tipus)?.docTitle ?? "[Acta]";
}

// Temes categories.
export const TEMA_CATS: { key: string; label: string }[] = [
  { key: "pendent", label: "Pendent" },
  { key: "executat", label: "Executat" },
  { key: "tractat", label: "Tractat" },
];
export function temaCat(t: ActaTema): string {
  const e = t.estat ?? "pendent";
  if (e === "fet") return "executat"; // legacy
  return e === "executat" || e === "tractat" ? e : "pendent";
}
function temaHasContent(t: ActaTema): boolean {
  return !!((t.titol && t.titol.trim()) || (t.text && t.text.trim()) || (t.responsable && t.responsable.trim()));
}
// Signatures fall back to the legacy columns if the jsonb list is empty.
function actaSignatures(a: Acta): ActaSignatura[] {
  if (a.signatures && a.signatures.length) return a.signatures;
  const out: ActaSignatura[] = [];
  if (a.sig_do != null) out.push({ titol: "Director d'obra", persona: a.sig_do ?? "" });
  if (a.sig_de != null) out.push({ titol: "Director d'execució de l'obra", persona: a.sig_de ?? "" });
  if (a.sig_adj_empresa || a.sig_adj_persona) out.push({ titol: `Representant de l'empresa adjudicatària${a.sig_adj_empresa ? `, ${a.sig_adj_empresa}` : ""}`, persona: a.sig_adj_persona ?? "" });
  if (a.sig_prom_empresa || a.sig_prom_persona) out.push({ titol: `Representant de l'ens promotor${a.sig_prom_empresa ? `, ${a.sig_prom_empresa}` : ""}`, persona: a.sig_prom_persona ?? "" });
  return out;
}

export function buildActaHtml(a: Acta, logoUrl = "/logo.jpg"): string {
  const grey = "#7a7a72";
  const bd = "1px solid #c9c9c9";
  // Table-based so it renders correctly in Word too (Word ignores flexbox).
  const barCell = "padding:4px 8px;font-size:10px;letter-spacing:.05em;color:#666;text-transform:uppercase;border-bottom:1px solid #bdbdbd;-webkit-print-color-adjust:exact;print-color-adjust:exact;";
  const bar = (title: string, right?: string) =>
    `<table style="width:100%;border-collapse:collapse;margin:14px 0 0;"><tr>
      <td bgcolor="#e6e6e6" style="${barCell}background:#e6e6e6;">${esc(title)}</td>
      ${right ? `<td bgcolor="#e6e6e6" style="${barCell}background:#e6e6e6;text-align:right;">${esc(right)}</td>` : ""}
    </tr></table>`;
  // A labelled cell: tiny italic grey label above the value.
  const cell = (label: string, value: string, opts: { span?: number; bold?: boolean; width?: string } = {}) =>
    `<td${opts.span ? ` colspan="${opts.span}"` : ""} style="border:${bd};padding:3px 7px;vertical-align:top;${opts.width ? `width:${opts.width};` : ""}">
      ${label ? `<div style="font-style:italic;color:${grey};font-size:8px;">${esc(label)}</div>` : ""}
      <div style="font-size:11px;${opts.bold ? "font-weight:bold;" : ""}">${value || "&nbsp;"}</div>
    </td>`;

  // Dades generals (4-column grid).
  const dadesGenerals = `
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <tr>
        ${cell("Projecte", esc(a.projecte ?? ""), { span: 3, bold: true })}
        ${cell("Referència", esc(a.referencia ?? ""), { bold: true, width: "90px" })}
      </tr>
      <tr>${cell("Ubicació", esc(a.ubicacio ?? ""), { span: 4 })}</tr>
      <tr>${cell("Client", esc(a.client ?? ""), { span: 4 })}</tr>
      <tr>
        ${cell("Acta nº", esc(a.acta_num ?? ""), { width: "25%" })}
        ${cell("Lloc", esc(a.lloc ?? ""), { width: "25%" })}
        ${cell("Data", shortDate(a.data), { width: "25%" })}
        ${cell("Hora", esc(a.hora ?? ""), { width: "25%" })}
      </tr>
    </table>`;

  // Assistents.
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

  // Temes tractats — one table per category (Pendent / Executat / Tractat).
  const barTemes = (label: string) =>
    `<table style="width:100%;border-collapse:collapse;margin:14px 0 0;"><tr>
      <td bgcolor="#e6e6e6" style="${barCell}background:#e6e6e6;">TEMES TRACTATS - ${esc(label)}</td>
      <td bgcolor="#e6e6e6" width="130" style="${barCell}background:#e6e6e6;text-align:right;">RESPONSABLE</td>
    </tr></table>`;
  const temesSections = TEMA_CATS.map((cat) => {
    const rows = (a.temes ?? [])
      .filter((t) => temaCat(t) === cat.key && temaHasContent(t))
      .map(
        (t) => `<tr>
          <td style="border:${bd};padding:4px 8px;font-size:11px;vertical-align:top;">
            ${t.titol && t.titol.trim() ? `<div style="font-weight:bold;">${esc(t.titol)}</div>` : ""}
            ${t.text && t.text.trim() ? `<div>${escMultiline(t.text)}</div>` : ""}
          </td>
          <td style="border:${bd};padding:4px 8px;font-size:11px;vertical-align:top;width:130px;">${esc(t.responsable)}</td>
        </tr>`,
      )
      .join("");
    if (!rows) return "";
    return barTemes(cat.label) + `<table style="width:100%;border-collapse:collapse;table-layout:fixed;">${rows}</table>`;
  }).join("");

  // Propera visita — date · time · note.
  const properaBits = [a.propera_data ? shortDate(a.propera_data) : "", a.propera_hora ?? ""].filter(Boolean).join(" · ");
  const properaBody = [properaBits, a.propera_visita ?? ""].filter((x) => x && x.trim()).join(" — ");
  const propera = `<table style="width:100%;border-collapse:collapse;"><tr><td style="border:${bd};padding:4px 8px;font-size:11px;">${esc(properaBody) || "&nbsp;"}</td></tr></table>`;

  // Signatures — editable titles, blank space to sign, 2 per row.
  const sigs = actaSignatures(a);
  const sigBlock = (s: ActaSignatura) =>
    `<td style="border:${bd};padding:6px 8px;vertical-align:top;width:50%;">
      <div style="font-size:11px;white-space:pre-line;">${escMultiline(s.titol)}</div>
      <div style="height:80px;"></div>
      <div style="font-size:11px;border-top:1px solid #999;padding-top:3px;">${esc(s.persona)}</div>
    </td>`;
  let sigRows = "";
  for (let i = 0; i < sigs.length; i += 2) {
    sigRows += `<tr>${sigBlock(sigs[i])}${sigs[i + 1] ? sigBlock(sigs[i + 1]) : `<td style="border:${bd};width:50%;">&nbsp;</td>`}</tr>`;
  }
  const signatures = sigs.length ? `<table style="width:100%;border-collapse:collapse;margin-top:6px;">${sigRows}</table>` : "";

  const closing = `<p style="font-size:11px;margin:14px 0 4px;">I per que consti, tots signen per triplicat la present acta a Barcelona el ${esc(longDate(a.data))}.<br>Assabentats,</p>`;

  return `
  <div style="font-family:${DOC_FONT};font-size:11px;color:#111;max-width:820px;margin:0 auto;">
    <div style="text-align:right;margin-bottom:2px;">
      <img src="${logoUrl}" alt="DAC arquitectura" width="150" height="59" style="width:150px;height:auto;display:inline-block;" />
      <div style="font-weight:bold;font-size:15px;margin-top:2px;">${esc(actaTitle(a.tipus))}</div>
    </div>

    ${bar("DADES GENERALS")}
    ${dadesGenerals}

    ${bar("ASSISTENTS")}
    ${assistents}

    ${temesSections}

    ${bar("PROPERA VISITA")}
    ${propera}

    ${closing}
    ${signatures}

    <div style="margin-top:22px;font-size:8px;color:#999;text-align:center;">${esc(FOOTER)}</div>
  </div>`;
}

// ---- client-side output helpers ----

export function openActaPdf(a: Acta) {
  const logo = `${typeof window !== "undefined" ? window.location.origin : ""}/logo.jpg`;
  const html = `<!DOCTYPE html><html lang="ca"><head><meta charset="utf-8"><title>${esc(a.num ?? "Acta")}</title>
    <style>@page { size: A4 portrait; margin: 1.3cm; } *{-webkit-print-color-adjust:exact;print-color-adjust:exact;} body{margin:0;}</style>
    </head><body>${buildActaHtml(a, logo)}</body></html>`;
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

// Word doesn't reliably fetch remote images, so embed the DAC logo as a
// base64 data URI. Falls back to the URL if the fetch fails.
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

export async function downloadActaWord(a: Acta) {
  const logo = await logoDataUri();
  const head = `<style>body,table,td,th,tr,div,span,p,strong,em{font-family:${DOC_FONT};}*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}</style>`;
  const html = `<!DOCTYPE html><html lang="ca"><head><meta charset="utf-8"><title>${esc(a.num ?? "Acta")}</title>${head}</head><body>${buildActaHtml(a, logo)}</body></html>`;
  const blob = new Blob(["﻿", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${a.num ?? "acta"}.doc`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
