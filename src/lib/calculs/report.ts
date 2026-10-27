// Justification report of a structural calculation, as HTML for the
// print/PDF window and the Word (.doc) download — same approach as the actes
// (acta-doc.ts). Laid out like David's spreadsheet printout: inputs on a
// yellow background, OK! / NO! next to each check, unit conversions on the
// right, then a summary of every check and the reference tables as an annex.

import type { CalculEstructural } from "@/types/db";
import { type CalcResult, type LoadsTable, type Row, type Section, type WeldCombo, allChecks, fmt, verdict, verdictText, weldResultText, FABRICA_FK, FABRICA_GM, FABRICA_K } from "./common";
import { calcType } from "./index";
import { SOLDADURA } from "./perfils";

const DOC_FONT = "'Century Gothic', CenturyGothic, AppleGothic, 'URW Gothic', 'Avant Garde', 'Trebuchet MS', sans-serif";
const BD = "1px solid #c9c9c9";
const INPUT_BG = "#fff6c9";
const ALT = "#3f7cc0";
const OK_BG = "#2e7d4f";
const NO_BG = "#c62828";

function esc(s: string | null | undefined) {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function shortDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso ?? "";
}

function rowValue(r: Row): string {
  if (typeof r.value === "string") return esc(r.value);
  return fmt(r.value, r.decimals ?? 2);
}

function badge(ok: boolean): string {
  return `<span style="display:inline-block;min-width:30px;padding:1px 5px;font-weight:bold;font-size:9px;color:#fff;background:${ok ? OK_BG : NO_BG};text-align:center;">${ok ? "OK!" : "NO!"}</span>`;
}

const bar = (title: string) =>
  `<table style="width:100%;border-collapse:collapse;margin:14px 0 0;page-break-after:avoid;"><tr>
    <td bgcolor="#d9d9d9" style="padding:4px 8px;font-size:10px;font-weight:bold;letter-spacing:.03em;text-transform:uppercase;background:#d9d9d9;">${esc(title)}</td>
  </tr></table>`;

const subhead = (title: string, cols: number) =>
  `<tr><td colspan="${cols}" bgcolor="#eef2f7" style="border:${BD};padding:3px 7px;font-size:9px;font-weight:bold;color:#2f5d8f;text-transform:uppercase;background:#eef2f7;">${esc(title)}</td></tr>`;

function rowsTable(blocks: Section["blocks"]): string {
  const td = (inner: string, extra = "") => `<td style="border:${BD};padding:3px 6px;vertical-align:middle;font-size:10px;${extra}">${inner}</td>`;
  const body = blocks
    .map((b) => {
      const head = b.title ? subhead(b.title, 5) : "";
      const rows = b.rows
        .map((r) => {
          const label = `${esc(r.label)}${r.formula ? `<div style="font-size:8.5px;color:#666;font-style:italic;margin-top:1px;">${esc(r.formula)}</div>` : ""}`;
          const isInput = !!r.input;
          const value = `<b>${rowValue(r)}</b>${r.unit ? ` <span style="font-size:9px;">${esc(r.unit)}</span>` : ""}`;
          const chk = r.check
            ? `${badge(r.check.ok)} <span style="font-size:9px;">${r.check.op} ${fmt(r.check.limit, r.check.decimals ?? 2)}${r.check.unit ? ` ${esc(r.check.unit)}` : ""}</span>`
            : "";
          const alt = r.alt ? `<span style="color:${ALT};font-size:9px;">= ${fmt(r.alt.value, r.alt.decimals ?? 2)} ${esc(r.alt.unit)}</span>` : "";
          return `<tr>
            ${td(label)}
            ${td(esc(r.sym ?? ""), "text-align:center;font-size:9px;white-space:nowrap;")}
            <td${isInput ? ` bgcolor="${INPUT_BG}"` : ""} style="border:${BD};padding:3px 6px;text-align:right;white-space:nowrap;font-size:10px;${isInput ? `background:${INPUT_BG};color:#9a1b1b;` : ""}">${value}</td>
            ${td(chk, "white-space:nowrap;")}
            ${td(alt, "text-align:right;white-space:nowrap;")}
          </tr>`;
        })
        .join("");
      return head + rows;
    })
    .join("");
  return `<table style="width:100%;border-collapse:collapse;table-layout:fixed;">
    <colgroup><col style="width:43%"><col style="width:9%"><col style="width:18%"><col style="width:16%"><col style="width:14%"></colgroup>
    ${body}
  </table>`;
}

function loadsTable(t: LoadsTable): string {
  const th = (s: string, align = "right") => `<td bgcolor="#f3f3f3" style="border:${BD};padding:3px 6px;font-size:8.5px;font-weight:bold;text-transform:uppercase;text-align:${align};background:#f3f3f3;">${s}</td>`;
  const td = (inner: string, opts: { input?: boolean; bold?: boolean; align?: string } = {}) =>
    `<td${opts.input ? ` bgcolor="${INPUT_BG}"` : ""} style="border:${BD};padding:3px 6px;font-size:9.5px;text-align:${opts.align ?? "right"};white-space:nowrap;${opts.input ? `background:${INPUT_BG};color:#9a1b1b;` : ""}${opts.bold ? "font-weight:bold;" : ""}">${inner}</td>`;
  let rows = `<tr>${th("Concepte", "left")}${th("Càrrega")}${th("Amplària")}${th("Càrrega s/majorar")}${th("Coef.")}${th("Càrrega majorada")}${th("Conversió")}</tr>`;
  for (const g of t.groups) {
    rows += `<tr><td colspan="7" bgcolor="#eef2f7" style="border:${BD};padding:3px 7px;font-size:9px;font-weight:bold;color:#2f5d8f;text-transform:uppercase;background:#eef2f7;">${esc(g.title)}${g.count != null ? ` <span style="color:#444;">· nombre ${fmt(g.count, Number.isInteger(g.count) ? 0 : 2)} ut</span>` : ""}</td></tr>`;
    for (const l of g.lines) {
      if (l.heading) {
        rows += `<tr><td colspan="7" style="border:${BD};padding:2px 7px;font-size:8.5px;font-style:italic;color:#555;">${esc(l.heading)}</td></tr>`;
        continue;
      }
      if (l.param) {
        rows += `<tr>${td(esc(l.param.label), { align: "left" })}${td(`${fmt(l.param.value)} ${esc(l.param.unit)}`, { input: true })}<td colspan="5" style="border:${BD};"></td></tr>`;
        continue;
      }
      const ln = l.line!;
      rows += `<tr>
        ${td(esc(ln.label), { align: "left" })}
        ${td(`${fmt(ln.q)} ${esc(ln.qUnit)}`, { input: true })}
        ${td(ln.width == null ? "" : `${fmt(ln.width)} ${esc(ln.widthUnit ?? "m")}`, { input: !!ln.widthKey })}
        ${td(`${fmt(ln.unf)} kN/ml`)}
        ${td(fmt(ln.gamma), { input: !!ln.gammaKey })}
        ${td(`${fmt(ln.fac)} kN/ml`)}
        ${td(`<span style="color:${ALT};">${fmt(ln.fac == null ? null : (ln.fac * 1000) / 9.81)} kg/ml</span>`)}
      </tr>`;
    }
    if (g.total) {
      rows += `<tr>
        ${td(esc(g.total.label), { align: "left", bold: true })}
        ${td(`${fmt(g.total.q)} kN/m²`, { bold: true })}
        ${td("")}
        ${td(`${fmt(g.total.unf)} kN/ml`, { bold: true })}
        ${td("")}
        ${td(`${fmt(g.total.fac)} kN/ml`, { bold: true })}
        ${td(`<span style="color:${ALT};">${fmt((g.total.fac * 1000) / 9.81)} kg/ml</span>`, { bold: true })}
      </tr>`;
    }
  }
  rows += `<tr>
    <td bgcolor="#d9d9d9" style="border:${BD};padding:4px 6px;font-size:9.5px;font-weight:bold;background:#d9d9d9;">TOTAL ESTAT DE CÀRREGUES SOBRE EL PERFIL</td>
    <td bgcolor="#d9d9d9" style="border:${BD};background:#d9d9d9;"></td><td bgcolor="#d9d9d9" style="border:${BD};background:#d9d9d9;"></td>
    <td bgcolor="#d9d9d9" style="border:${BD};padding:4px 6px;font-size:9.5px;font-weight:bold;text-align:right;white-space:nowrap;background:#d9d9d9;">${fmt(t.totalUnf)} kN/ml</td>
    <td bgcolor="#d9d9d9" style="border:${BD};background:#d9d9d9;"></td>
    <td bgcolor="#d9d9d9" style="border:${BD};padding:4px 6px;font-size:9.5px;font-weight:bold;text-align:right;white-space:nowrap;background:#d9d9d9;">${fmt(t.totalFac)} kN/ml</td>
    <td bgcolor="#d9d9d9" style="border:${BD};padding:4px 6px;font-size:9.5px;font-weight:bold;text-align:right;white-space:nowrap;color:${ALT};background:#d9d9d9;">${fmt((t.totalFac * 1000) / 9.81)} kg/ml</td>
  </tr>`;
  return `<table style="width:100%;border-collapse:collapse;">${rows}</table>
    <p style="font-size:8.5px;color:#555;margin:3px 0 0;">Q ELS = ${fmt(t.totalUnf)} kN/ml (càrregues sense majorar) · Q ELU = ${fmt(t.totalFac)} kN/ml (càrregues majorades).</p>`;
}

// Soldadura: each pair of parts as two rows (thickness, max, min) and the
// resulting throat. As in David's sheet, the max of the thinner part and the
// min of the thicker one are shaded.
function weldsTable(welds: WeldCombo[]): string {
  const th = (s: string, align = "right") => `<td bgcolor="#f3f3f3" style="border:${BD};padding:3px 6px;font-size:8.5px;font-weight:bold;text-transform:uppercase;text-align:${align};background:#f3f3f3;">${s}</td>`;
  const shade = (on: boolean) => (on ? ` bgcolor="#d9d9d9"` : "");
  const val = (v: number | null, on: boolean) =>
    `<td${shade(on)} style="border:${BD};padding:3px 6px;font-size:9.5px;text-align:right;white-space:nowrap;${on ? "background:#d9d9d9;font-weight:bold;" : ""}">${fmt(v, 1)}</td>`;
  let rows = `<tr>${th("Peça", "left")}${th("Gruix")}${th("Gola màxima")}${th("Gola mínima")}</tr>`;
  for (const w of welds) {
    for (const key of ["a", "b"] as const) {
      const p = w[key];
      const isThin = w.thin === key;
      const isThick = w.thin != null && !isThin;
      rows += `<tr>
        <td style="border:${BD};padding:3px 6px;font-size:9.5px;">${esc(p.label)}</td>
        <td style="border:${BD};padding:3px 6px;font-size:9.5px;text-align:right;white-space:nowrap;">${fmt(p.t, 2)} mm</td>
        ${val(p.aMax, isThin)}
        ${val(p.aMin, isThick)}
      </tr>`;
    }
    rows += `<tr><td colspan="4" style="border:${BD};border-bottom:2px solid #999;padding:3px 6px;font-size:9.5px;">${badge(w.ok)} <b>${esc(weldResultText(w))}</b></td></tr>`;
  }
  return `<table style="width:100%;border-collapse:collapse;table-layout:fixed;"><colgroup><col style="width:46%"><col style="width:18%"><col style="width:18%"><col style="width:18%"></colgroup>${rows}</table>
    <p style="font-size:8.5px;color:#555;margin:3px 0 0;">La gola màxima de la peça més prima ha d'estar dins del marge de la més gruixuda, i la gola mínima de la més gruixuda dins del marge de la més prima.</p>`;
}

function summary(r: CalcResult): string {
  const checks = allChecks(r);
  const v = verdict(r);
  const rows = checks
    .map(
      (c) => `<tr>
        <td style="border:${BD};padding:3px 6px;font-size:9px;color:#555;">${esc(c.section)}</td>
        <td style="border:${BD};padding:3px 6px;font-size:9.5px;">${esc(c.label)}</td>
        <td style="border:${BD};padding:3px 6px;text-align:center;">${badge(c.ok)}</td>
      </tr>`,
    )
    .join("");
  const head = `<p style="font-size:11px;font-weight:bold;margin:6px 0;color:${v.ok ? OK_BG : v.total ? NO_BG : "#555"};">${esc(verdictText(v))}</p>`;
  return head + `<table style="width:100%;border-collapse:collapse;table-layout:fixed;"><colgroup><col style="width:38%"><col style="width:50%"><col style="width:12%"></colgroup>${rows}</table>`;
}

function annexFabrica(): string {
  const th = (s: string) => `<td bgcolor="#f3f3f3" style="border:${BD};padding:3px 6px;font-size:8.5px;font-weight:bold;text-align:center;background:#f3f3f3;">${s}</td>`;
  const td = (s: string, align = "center") => `<td style="border:${BD};padding:3px 6px;font-size:9px;text-align:${align};">${s}</td>`;
  const k = `<p style="font-size:9.5px;font-weight:bold;margin:8px 0 3px;">CTE DB SE-F, annex C · Resistència característica a compressió</p>
    <p style="font-size:9px;margin:0 0 4px;">fk = K · fb<sup>0,65</sup> · fm<sup>0,25</sup>, amb fm no superior a 20 N/mm² ni a 2·fb. fd = fk / γM.</p>
    <table style="border-collapse:collapse;"><tr>${th("Tipus de fàbrica")}${th("K")}</tr>${FABRICA_K.map((x) => `<tr>${td(esc(x.label), "left")}${td(fmt(x.k))}</tr>`).join("")}</table>`;
  const fk = `<p style="font-size:9.5px;font-weight:bold;margin:10px 0 3px;">CTE DB SE-F, taula 4.4 · Resistència característica a la compressió de fàbriques usuals fk (N/mm²)</p>
    <table style="border-collapse:collapse;">
      <tr>${th("fb (N/mm²)")}${FABRICA_FK.cols.map((c) => th(fmt(c.fb, 0))).join("")}</tr>
      <tr>${th("fm (N/mm²)")}${FABRICA_FK.cols.map((c) => th(fmt(c.fm, c.fm % 1 ? 1 : 0))).join("")}</tr>
      ${FABRICA_FK.rows.map((r) => `<tr>${td(esc(r.label), "left")}${r.fk.map((v) => td(fmt(v, 0))).join("")}</tr>`).join("")}
    </table>`;
  const gm = `<p style="font-size:9.5px;font-weight:bold;margin:10px 0 3px;">CTE DB SE-F, taula 4.8 · Coeficients parcials de seguretat γM (situacions persistents i transitòries)</p>
    <table style="border-collapse:collapse;">
      <tr>${th("Categoria de l'execució")}${FABRICA_GM.head.map((h) => th(h)).join("")}</tr>
      ${FABRICA_GM.rows.map((r) => `<tr>${td(esc(r.label), "left")}${r.v.map((v) => td(v == null ? "" : fmt(v))).join("")}</tr>`).join("")}
    </table>
    <p style="font-size:8.5px;color:#555;margin:3px 0 0;">${esc(FABRICA_GM.note)}</p>`;
  return k + fk + gm;
}

function annexSoldadura(): string {
  const th = (s: string) => `<td bgcolor="#f3f3f3" style="border:${BD};padding:2px 6px;font-size:8.5px;font-weight:bold;text-align:center;background:#f3f3f3;">${s}</td>`;
  const td = (s: string) => `<td style="border:${BD};padding:1px 6px;font-size:8.5px;text-align:center;">${s}</td>`;
  return `<p style="font-size:9.5px;font-weight:bold;margin:8px 0 3px;">Valors límit de la gola d'una soldadura en angle</p>
    <table style="border-collapse:collapse;">
      <tr>${th("Gruix de la peça (mm)")}${th("Gola màxima (mm)")}${th("Gola mínima (mm)")}</tr>
      ${SOLDADURA.map((s) => `<tr>${td(`${fmt(s.tMin, 1)} – ${fmt(s.tMax, 1)}`)}${td(fmt(s.aMax, 1))}${td(fmt(s.aMin, 1))}</tr>`).join("")}
    </table>`;
}

export interface ReportAssets {
  logo: string;
  pilar60: string;
}

export function buildCalculHtml(c: CalculEstructural, result: CalcResult, assets: ReportAssets): string {
  const t = calcType(c.tipus);
  const general = [
    ["Referència DAC", c.referencia, true],
    ["Projecte", c.projecte, false],
    ["Adreça", c.adreca, false],
    ["Ciutat", c.ciutat, false],
    ["Client", c.client, true],
    ["Arquitecte", c.arquitecte, false],
    [t.situacioLabel, c.situacio, true],
    ["Referència element", c.element, false],
    ["Data", shortDate(c.data), false],
    ["Versió càlcul", c.versio, true],
  ] as const;
  const dades = `<table style="width:100%;border-collapse:collapse;table-layout:fixed;">
    <colgroup><col style="width:28%"><col style="width:72%"></colgroup>
    ${general
      .map(
        ([label, value, bold]) => `<tr>
        <td style="border:${BD};padding:3px 7px;font-size:9px;text-transform:uppercase;color:#555;">${esc(label)}</td>
        <td style="border:${BD};padding:3px 7px;font-size:10px;${bold ? "font-weight:bold;" : ""}">${esc(value ?? "") || "&nbsp;"}</td>
      </tr>`,
      )
      .join("")}
  </table>`;

  const sections = result.sections
    .filter((s) => s.enabled)
    .map((s) => bar(s.title) + (s.loads ? loadsTable(s.loads) : "") + (s.blocks.length ? rowsTable(s.blocks) : "") + (s.welds ? weldsTable(s.welds) : ""))
    .join("");

  const refs = new Set(result.sections.filter((s) => s.enabled).flatMap((s) => s.reference ?? []));
  const pageBreak = `<div style="page-break-before:always;break-before:page;mso-break-type:page-break;height:0;line-height:0;font-size:1px;">&nbsp;</div>`;
  const annex = refs.size
    ? `${pageBreak}${bar("Annex · Valors de referència")}
      ${refs.has("pilar60") ? `<p style="font-size:9.5px;font-weight:bold;margin:8px 0 3px;">Repartiment de la càrrega a 60° (alçat)</p><img src="${assets.pilar60}" width="305" height="216" style="width:305px;height:auto;" />` : ""}
      ${refs.has("fabrica") ? annexFabrica() : ""}
      ${refs.has("soldadura") ? annexSoldadura() : ""}`
    : "";

  return `
  <div style="font-family:${DOC_FONT};font-size:10px;color:#111;max-width:820px;margin:0 auto;">
    <table style="width:100%;border-collapse:collapse;"><tr>
      <td style="vertical-align:bottom;font-size:9px;color:#555;">${esc(c.num ?? "")}</td>
      <td style="text-align:right;"><img src="${assets.logo}" alt="DAC arquitectura" width="150" height="59" style="width:150px;height:auto;display:inline-block;" /></td>
    </tr></table>
    <table style="width:100%;border-collapse:collapse;margin-top:6px;"><tr>
      <td bgcolor="#bfbfbf" style="padding:6px 8px;font-size:12px;font-weight:bold;text-transform:uppercase;background:#bfbfbf;">${esc(t.reportTitle)}</td>
    </tr></table>
    ${bar("Dades generals")}
    ${dades}
    ${sections}
    ${bar("Resum de les comprovacions")}
    ${summary(result)}
    ${annex}
  </div>`;
}

// ---- client-side output ----

async function toDataUri(path: string): Promise<string> {
  const url = `${window.location.origin}${path}`;
  try {
    const blob = await (await fetch(url)).blob();
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

export function openCalculPdf(c: CalculEstructural, result: CalcResult, fileName: string) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  const origin = window.location.origin;
  const footer = `${calcType(c.tipus).reportTitle} · ${c.num ?? ""}`.replace(/"/g, "'");
  const html = `<!DOCTYPE html><html lang="ca"><head><meta charset="utf-8"><title>${esc(fileName)}</title>
    <style>
      @page { size: A4 portrait; margin: 1.2cm 1.2cm 1.5cm;
        @bottom-left { content: "${esc(footer)}"; font-size: 7pt; color: #777; font-family: Arial, sans-serif; }
        @bottom-right { content: counter(page) " / " counter(pages); font-size: 7pt; color: #777; font-family: Arial, sans-serif; } }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { margin: 0; }
      tr { page-break-inside: avoid; }
    </style></head><body>${buildCalculHtml(c, result, { logo: `${origin}/logo.jpg`, pilar60: `${origin}/calculs/repartiment-60.png` })}</body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
}

export async function downloadCalculWord(c: CalculEstructural, result: CalcResult, fileName: string) {
  const [logo, pilar60] = await Promise.all([toDataUri("/logo.jpg"), toDataUri("/calculs/repartiment-60.png")]);
  // Word reads the @page rule for paper size and margins from a named section.
  const head = `<style>
    @page WordSection1 { size: 21cm 29.7cm; margin: 1.5cm 1.5cm 1.5cm 1.5cm; }
    div.WordSection1 { page: WordSection1; }
    body,table,td,th,tr,div,span,p,b{font-family:${DOC_FONT};}
  </style>`;
  const html = `<!DOCTYPE html><html lang="ca"><head><meta charset="utf-8"><title>${esc(fileName)}</title>${head}</head><body><div class="WordSection1">${buildCalculHtml(c, result, { logo, pilar60 })}</div></body></html>`;
  const blob = new Blob(["﻿", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.doc`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
