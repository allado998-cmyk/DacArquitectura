// Dedicació: the «Estadístiques» sheet, as the Dedicació page shows and prints
// it and as the Descàrregues page files it.

import { CATEGORIES } from "@/lib/expedients";
import { fmtHores, type PdfBlock, type PdfDoc } from "./doc";

export const MONTHS_CA = [
  "Gener", "Febrer", "Març", "Abril", "Maig", "Juny",
  "Juliol", "Agost", "Setembre", "Octubre", "Novembre", "Desembre",
];
export const WEEKDAY_NAMES = ["Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte", "Diumenge"];

export type Agrupacio = "dia" | "setmana" | "mes";

const pad = (n: number) => String(n).padStart(2, "0");

// Monday of the week of `iso` (YYYY-MM-DD).
export function weekStart(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - day);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

// "2026-03" → "Mar 26"
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_CA[m - 1].slice(0, 3)} ${String(y).slice(2)}`;
}

// A point of «Evolució»: "Mar 26" by month, "24/11" by day or week.
export function periodLabel(key: string, agrupacio: Agrupacio): string {
  if (agrupacio === "mes") return monthLabel(key);
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

export const agrupacioMeta = (a: Agrupacio) => (a === "dia" ? "per dia" : a === "setmana" ? "per setmana" : "per mes");

export interface DedicacioStatsRow {
  data: string; // YYYY-MM-DD
  hores: string;
  expedient_id: number | null;
  categoria?: string | null;
  client_nom?: string | null;
}

export interface DedicacioStats {
  totalHores: number;
  dies: number;
  nExpedients: number;
  catRows: { label: string; color: string; hores: number }[];
  clientRows: { label: string; hores: number }[];
  agrupacio: Agrupacio;
  periodRows: { key: string; hores: number }[];
  weekdayRows: { label: string; total: number; avg: number }[];
  monthAvgRows: { key: string; avg: number }[];
}

const h = (d: { hores: string }) => parseFloat(d.hores) || 0;

// `rows` are the entries already filtered; dStart / dEnd the date filter, which
// with the dates found decides whether «Evolució» goes by day, week or month.
export function dedicacioStats(rows: DedicacioStatsRow[], dStart = "", dEnd = ""): DedicacioStats {
  const totalHores = rows.reduce((s, d) => s + h(d), 0);
  const dies = new Set(rows.map((d) => d.data)).size;
  const nExpedients = new Set(rows.map((d) => d.expedient_id).filter(Boolean)).size;

  // Per categoria
  const catRows = CATEGORIES.map((c) => ({
    label: c.label,
    color: c.color,
    hores: rows.filter((d) => d.categoria === c.code).reduce((s, d) => s + h(d), 0),
  })).filter((r) => r.hores > 0);
  const senseCat = rows.filter((d) => !d.categoria).reduce((s, d) => s + h(d), 0);
  if (senseCat > 0) catRows.push({ label: "Sense categoria", color: "#9ca3af", hores: senseCat });
  catRows.sort((a, b) => b.hores - a.hores);

  // Per client
  const clientMap = new Map<string, number>();
  for (const d of rows) {
    const k = d.client_nom ?? "(Sense client)";
    clientMap.set(k, (clientMap.get(k) ?? 0) + h(d));
  }
  const clientRows = Array.from(clientMap, ([label, hores]) => ({ label, hores })).sort((a, b) => b.hores - a.hores);

  // Evolució — granularity from the span of dates.
  const spanDays = (() => {
    const dates = rows.map((d) => d.data).sort();
    const from = dStart || dates[0];
    const to = dEnd || dates[dates.length - 1];
    if (!from || !to) return 0;
    return Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  })();
  const agrupacio: Agrupacio = spanDays <= 31 ? "dia" : spanDays <= 140 ? "setmana" : "mes";
  const periodMap = new Map<string, number>();
  for (const d of rows) {
    const key = agrupacio === "dia" ? d.data : agrupacio === "setmana" ? weekStart(d.data) : d.data.slice(0, 7);
    periodMap.set(key, (periodMap.get(key) ?? 0) + h(d));
  }
  const periodRows = Array.from(periodMap, ([key, hores]) => ({ key, hores })).sort((a, b) => a.key.localeCompare(b.key));

  // Per dia de la setmana — totals i mitjanes
  const weekdayAgg = WEEKDAY_NAMES.map((label) => ({ label, total: 0, dates: new Set<string>() }));
  for (const d of rows) {
    const [y, m, da] = d.data.split("-").map(Number);
    const wd = (new Date(y, m - 1, da).getDay() + 6) % 7;
    weekdayAgg[wd].total += h(d);
    weekdayAgg[wd].dates.add(d.data);
  }
  const weekdayRows = weekdayAgg.map((w) => ({ label: w.label, total: w.total, avg: w.dates.size ? w.total / w.dates.size : 0 }));

  // Mitjana d'hores per dia treballat, mes a mes.
  const monthAggMap = new Map<string, { hores: number; dies: Set<string> }>();
  for (const d of rows) {
    const k = d.data.slice(0, 7);
    const g = monthAggMap.get(k) ?? { hores: 0, dies: new Set<string>() };
    g.hores += h(d);
    g.dies.add(d.data);
    monthAggMap.set(k, g);
  }
  const monthAvgRows = Array.from(monthAggMap, ([key, g]) => ({ key, avg: g.dies.size ? g.hores / g.dies.size : 0 })).sort((a, b) => a.key.localeCompare(b.key));

  return { totalHores, dies, nExpedients, catRows, clientRows, agrupacio, periodRows, weekdayRows, monthAvgRows };
}

function twoCol(title: string, rows: { label: string; v: string }[], head = ["Concepte", "Hores"]): PdfBlock[] {
  if (rows.length === 0) return [];
  return [
    {
      kind: "table",
      table: {
        title,
        narrow: true,
        plain: true,
        columns: [{ label: head[0] }, { label: head[1], align: "right" }],
        rows: rows.map((r) => [r.label, r.v]),
      },
    },
  ];
}

export function dedicacioStatsDoc(s: DedicacioStats, subtitle: string): PdfDoc {
  return {
    title: "Dedicació — Estadístiques",
    subtitle,
    landscape: false,
    marginCm: 1.4,
    blocks: [
      {
        kind: "kpis",
        items: [
          { label: "Hores totals", value: fmtHores(s.totalHores) },
          { label: "Dies treballats", value: String(s.dies) },
          { label: "Expedients", value: String(s.nExpedients) },
          { label: "Mitjana / dia", value: fmtHores(s.dies ? s.totalHores / s.dies : 0) },
        ],
      },
      ...twoCol("Hores per categoria", s.catRows.map((r) => ({ label: r.label, v: fmtHores(r.hores) }))),
      ...twoCol("Hores per client", s.clientRows.map((r) => ({ label: r.label, v: fmtHores(r.hores) }))),
      ...twoCol("Mitjana d'hores per dia treballat (mes a mes)", s.monthAvgRows.map((r) => ({ label: monthLabel(r.key), v: fmtHores(r.avg) })), ["Mes", "Mitjana/dia"]),
      ...twoCol(`Evolució (${agrupacioMeta(s.agrupacio)})`, s.periodRows.map((p) => ({ label: periodLabel(p.key, s.agrupacio), v: fmtHores(p.hores) })), ["Període", "Hores"]),
      ...(s.weekdayRows.some((w) => w.total > 0)
        ? [
            {
              kind: "table" as const,
              table: {
                title: "Per dia de la setmana",
                narrow: true,
                plain: true,
                columns: [{ label: "Dia" }, { label: "Mitjana", align: "right" as const }, { label: "Total", align: "right" as const }],
                rows: s.weekdayRows.map((w) => [w.label, fmtHores(w.avg), fmtHores(w.total)]),
              },
            },
          ]
        : []),
    ],
  };
}
