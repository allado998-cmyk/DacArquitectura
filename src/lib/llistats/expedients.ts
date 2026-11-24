// Expedients: the list and the «Estadístiques → Resum» sheet, as the
// Expedients page shows and prints them and as the Descàrregues page files them.

import { CATEGORIES, CATEGORY_BY_CODE, ESTAT, TIPUS } from "@/lib/expedients";
import { formatEur } from "@/lib/format";
import type { Expedient } from "@/types/db";
import { dataCa, fmtHores, type PdfBlock, type PdfDoc } from "./doc";

// The year of an expedient is the one in its number: "26-0153" → "2026" ("—" if none).
export function anyExpedient(num: string): string {
  const m = /^(\d{2})-/.exec(num);
  return m ? `20${m[1]}` : "—";
}

const press = (r: { pressupost: string }) => parseFloat(r.pressupost) || 0;
// The views' euros: NaN (never expected) prints as 0, not "—".
const eur = (v: number) => formatEur(v || 0);

// ============================================================================
// Llista
// ============================================================================

export type ExpedientLlistaRow = Pick<
  Expedient,
  "num_expedient" | "projecte" | "client_nom" | "ciutat" | "categoria" | "tipologia_nom" | "tipus" | "web" | "pressupost" | "estat" | "data_tancament"
>;

export function expedientsListDoc(rows: ExpedientLlistaRow[], subtitle: string, empty = "Cap expedient amb aquests filtres."): PdfDoc {
  const sum = rows.reduce((s, r) => s + press(r), 0);
  return {
    title: "Expedients",
    subtitle,
    landscape: true,
    marginCm: 1.2,
    blocks: [
      {
        kind: "table",
        table: {
          columns: [
            { label: "Núm.", mono: true },
            { label: "Projecte" },
            { label: "Client" },
            { label: "Ciutat" },
            { label: "Categoria" },
            { label: "Tipologia" },
            { label: "Tipus" },
            { label: "Web", align: "center" },
            { label: "Pressupost", align: "right" },
            { label: "Estat" },
            { label: "Tancat el" },
          ],
          rows: rows.map((r) => [
            r.num_expedient,
            r.projecte ?? "—",
            r.client_nom ?? "—",
            r.ciutat ?? "—",
            (r.categoria && CATEGORY_BY_CODE[r.categoria]?.label) || "—",
            r.tipologia_nom ?? "—",
            TIPUS[r.tipus].label,
            r.web ? "Sí" : "—",
            eur(press(r)),
            ESTAT[r.estat].label,
            dataCa(r.data_tancament) || "—",
          ]),
          total: rows.length
            ? [{ text: `Total (${rows.length} ${rows.length === 1 ? "expedient" : "expedients"})`, span: 8 }, eur(sum), { text: "", span: 2 }]
            : undefined,
          empty,
        },
      },
    ],
  };
}

// ============================================================================
// Estadístiques (Resum)
// ============================================================================

export type ExpedientStatsRow = Pick<
  Expedient,
  "id" | "num_expedient" | "projecte" | "client_nom" | "ciutat" | "estat" | "categoria" | "tipologia_nom" | "tipus" | "pressupost" | "planned_hores"
>;

export interface ExpedientsGroup {
  key: string;
  count: number;
  money: number;
}

export interface RankedProjecte {
  r: ExpedientStatsRow;
  pressupost: number;
  planned: number; // hores pressupostades (del càlcul vinculat)
  fetes: number; // suma de dedicacions
  rate: number; // pressupost / hores fetes
  pct: number; // fetes / pressupostades
  diff: number; // pressupostades − fetes (positiu = bé)
  benefici: number; // pressupost × (diff / pressupostades) — negatiu si s'ha excedit
  score: number; // 1–100
  rank: number; // posició global al rànquing
}

export interface ExpedientsStats {
  total: number;
  oberts: number;
  tancats: number;
  publics: number;
  privats: number;
  pressupostTotal: number;
  pressupostPublic: number;
  pressupostPrivat: number;
  pressupostObert: number;
  pressupostMitja: number;
  byCiutat: ExpedientsGroup[];
  byTipologia: ExpedientsGroup[];
  // Pressupost per categoria (the donut): only the ones with money, «Sense categoria» last.
  catPressupost: { label: string; color: string; count: number; value: number }[];
  ranking: { items: RankedProjecte[]; refRate: number; refDiff: number; refBenefici: number; refPlanned: number };
  millors: RankedProjecte[];
  pitjors: RankedProjecte[];
  // Over every ranked expedient, not only the 25 shown.
  rankN: number;
  rankTotalPlanned: number;
  rankTotalFetes: number;
  rankTotalDiff: number;
  rankTotalBenefici: number;
  rankAvgScore: number;
  rankAvgDiff: number;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function groupBySum<T extends { pressupost: string }>(rows: T[], keyFn: (r: T) => string): ExpedientsGroup[] {
  const map = new Map<string, ExpedientsGroup>();
  for (const r of rows) {
    const key = keyFn(r);
    const g = map.get(key) ?? { key, count: 0, money: 0 };
    g.count += 1;
    g.money += press(r);
    map.set(key, g);
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

// Rànquing de projectes per puntuació: només expedients tancats amb pressupost,
// hores pressupostades i hores fetes (the panel explains the score).
function rankingOf(rows: ExpedientStatsRow[], dedicByExp: ReadonlyMap<number, readonly { hores: string }[]>) {
  const items: RankedProjecte[] = [];
  for (const r of rows) {
    if (r.estat !== "tancat") continue;
    const pressupost = press(r);
    const planned = parseFloat(r.planned_hores ?? "") || 0;
    const fetes = (dedicByExp.get(r.id) ?? []).reduce((s, d) => s + (parseFloat(d.hores) || 0), 0);
    if (pressupost <= 0 || planned <= 0 || fetes <= 0) continue;
    const diff = planned - fetes;
    items.push({
      r,
      pressupost,
      planned,
      fetes,
      rate: pressupost / fetes,
      pct: Math.round((fetes / planned) * 100),
      diff,
      benefici: pressupost * (diff / planned),
      score: 0,
      rank: 0,
    });
  }
  const refRate = medianOf(items.map((i) => i.rate));
  const refPlanned = medianOf(items.map((i) => i.planned));
  const refDiff = items.reduce((m, i) => Math.max(m, Math.abs(i.diff)), 0);
  const refBenefici = items.reduce((m, i) => Math.max(m, Math.abs(i.benefici)), 0);
  for (const it of items) {
    // Pes del projecte: els ajustos percentuals compten poc en projectes petits
    // (errar 1 h en un projecte d'1 h és un 100% però no és greu).
    const wPes = refPlanned > 0 ? clamp(it.planned / refPlanned, 0, 1) : 1;
    const fDesviacio = clamp((it.planned - it.fetes) / it.planned, -1, 1);
    const fEstalvi = refDiff > 0 ? clamp(it.diff / refDiff, -1, 1) : 0;
    const fBenefici = refBenefici > 0 ? clamp(it.benefici / refBenefici, -1, 1) : 0;
    const fPreu = refRate > 0 ? clamp((it.rate - refRate) / refRate, -1, 1) : 0;
    it.score = Math.round(clamp(50 + 10 * wPes * fDesviacio + 15 * fEstalvi + 15 * fBenefici + 10 * wPes * fPreu, 1, 100));
  }
  items.sort((a, b) => b.score - a.score || b.rate - a.rate);
  items.forEach((it, i) => {
    it.rank = i + 1;
  });
  return { items, refRate, refDiff, refBenefici, refPlanned };
}

// `rows` are the expedients already filtered; `dedicByExp` the hours logged per
// expedient (any year).
export function expedientsStats(rows: ExpedientStatsRow[], dedicByExp: ReadonlyMap<number, readonly { hores: string }[]>): ExpedientsStats {
  const total = rows.length;
  const oberts = rows.filter((r) => r.estat === "obert").length;
  const publics = rows.filter((r) => r.tipus === "public").length;
  const pressupostTotal = rows.reduce((s, r) => s + press(r), 0);
  const pressupostPublic = rows.filter((r) => r.tipus === "public").reduce((s, r) => s + press(r), 0);
  const pressupostObert = rows.filter((r) => r.estat === "obert").reduce((s, r) => s + press(r), 0);

  const catPressupost = CATEGORIES.map((c) => {
    const grp = rows.filter((r) => r.categoria === c.code);
    return { label: c.label, color: c.color, count: grp.length, value: grp.reduce((s, r) => s + press(r), 0) };
  }).filter((g) => g.value > 0);
  const senseCat = rows.filter((r) => !r.categoria);
  const senseCatPress = senseCat.reduce((s, r) => s + press(r), 0);
  if (senseCatPress > 0) catPressupost.push({ label: "Sense categoria", color: "#9ca3af", count: senseCat.length, value: senseCatPress });

  const ranking = rankingOf(rows, dedicByExp);
  const millors = ranking.items.slice(0, 25);
  const pitjors = ranking.items.length > 25 ? ranking.items.slice(Math.max(25, ranking.items.length - 25)).reverse() : [];

  const rankN = ranking.items.length;
  const rankTotalPlanned = ranking.items.reduce((s, i) => s + i.planned, 0);
  const rankTotalFetes = ranking.items.reduce((s, i) => s + i.fetes, 0);
  const rankTotalDiff = rankTotalPlanned - rankTotalFetes;

  return {
    total,
    oberts,
    tancats: total - oberts,
    publics,
    privats: total - publics,
    pressupostTotal,
    pressupostPublic,
    pressupostPrivat: pressupostTotal - pressupostPublic,
    pressupostObert,
    pressupostMitja: total ? pressupostTotal / total : 0,
    byCiutat: groupBySum(rows, (r) => (r.ciutat ?? "").trim() || "(Sense ciutat)"),
    byTipologia: groupBySum(rows, (r) => r.tipologia_nom ?? "(Sense tipologia)"),
    catPressupost,
    ranking,
    millors,
    pitjors,
    rankN,
    rankTotalPlanned,
    rankTotalFetes,
    rankTotalDiff,
    rankTotalBenefici: ranking.items.reduce((s, i) => s + i.benefici, 0),
    rankAvgScore: rankN ? ranking.items.reduce((s, i) => s + i.score, 0) / rankN : 0,
    rankAvgDiff: rankN ? rankTotalDiff / rankN : 0,
  };
}

const posNeg = (v: number) => (v > 0 ? "#15803d" : v < 0 ? "#b91c1c" : "#666");
const sign = (v: number) => (v > 0 ? "+" : "");

function breakdown(title: string, rows: { label: string; count: number; money: number }[], total: number): PdfBlock[] {
  if (rows.length === 0) return [];
  return [
    {
      kind: "table",
      table: {
        title,
        columns: [{ label: "Concepte" }, { label: "Expedients", align: "right" }, { label: "% pressupost", align: "right" }, { label: "Pressupost", align: "right" }],
        rows: rows.map((g) => [g.label, String(g.count), `${total ? Math.round((g.money / total) * 100) : 0}%`, eur(g.money)]),
      },
    },
  ];
}

function rankingTable(title: string, items: RankedProjecte[]): PdfBlock[] {
  if (items.length === 0) return [];
  return [
    {
      kind: "table",
      table: {
        title,
        columns: [
          { label: "#", align: "right" },
          { label: "Núm.", mono: true },
          { label: "Any" },
          { label: "Projecte" },
          { label: "Client" },
          { label: "Hores press.", align: "right" },
          { label: "Hores fetes", align: "right" },
          { label: "%", align: "right" },
          { label: "Preu", align: "right" },
          { label: "Diferència", align: "right" },
          { label: "Benefici", align: "right" },
          { label: "Puntuació", align: "right" },
        ],
        rows: items.map((it) => [
          String(it.rank),
          it.r.num_expedient,
          anyExpedient(it.r.num_expedient),
          it.r.projecte ?? "—",
          it.r.client_nom ?? "—",
          fmtHores(it.planned),
          fmtHores(it.fetes),
          `${it.pct}%`,
          eur(it.pressupost),
          { text: `${sign(it.diff)}${fmtHores(it.diff)}`, color: posNeg(it.diff), weight: 600 },
          { text: `${sign(it.benefici)}${eur(it.benefici)}`, color: posNeg(it.benefici), weight: 600 },
          { text: String(it.score), weight: 700 },
        ]),
      },
    },
  ];
}

export function expedientsStatsDoc(s: ExpedientsStats, subtitle: string): PdfDoc {
  const rankSection: PdfBlock[] = s.millors.length
    ? [
        { kind: "heading", text: "Millors projectes" },
        {
          kind: "kpis",
          items: [
            { label: "Puntuació mitjana", value: String(Math.round(s.rankAvgScore)), hint: `sobre 100 · ${s.rankN} expedients tancats` },
            { label: "Diferència mitjana d'hores", value: `${sign(s.rankAvgDiff)}${fmtHores(s.rankAvgDiff)}`, color: posNeg(s.rankAvgDiff), hint: "pressupostades − fetes, per expedient" },
            { label: "Hores estalviades", value: `${sign(s.rankTotalDiff)}${fmtHores(s.rankTotalDiff)}`, color: posNeg(s.rankTotalDiff), hint: `${fmtHores(s.rankTotalPlanned)} press. · ${fmtHores(s.rankTotalFetes)} fetes` },
            { label: "Benefici total", value: `${sign(s.rankTotalBenefici)}${eur(s.rankTotalBenefici)}`, color: posNeg(s.rankTotalBenefici), hint: "pressupost × % d'hores estalviades" },
          ],
        },
        {
          kind: "note",
          text: `Puntuació 1–100: base 50 punts; ±10 segons la desviació relativa d'hores (menys hores de les pressupostades suma); ±15 segons les hores estalviades en valor absolut, comparades amb el màxim estalvi o excés del conjunt (${fmtHores(s.ranking.refDiff)}); ±15 segons el benefici (pressupost × % d'hores estalviades), comparat amb el màxim del conjunt (${eur(s.ranking.refBenefici)}); i ±10 segons el preu per hora feta comparat amb la mediana dels expedients inclosos (${eur(s.ranking.refRate)}/h). Els ajustos percentuals (desviació i preu/hora) es ponderen per la mida del projecte (hores pressupostades respecte de la mediana, ${fmtHores(s.ranking.refPlanned)}), de manera que desviar-se molt en un projecte petit gairebé no penalitza. Només s'hi inclouen expedients tancats amb pressupost, hores pressupostades i hores fetes.`,
        },
        ...rankingTable(`Millors ${s.millors.length}`, s.millors),
        ...rankingTable(`Pitjors ${s.pitjors.length}`, s.pitjors),
      ]
    : [];
  return {
    title: "Expedients — Estadístiques",
    subtitle,
    landscape: true,
    marginCm: 1.2,
    blocks: [
      {
        kind: "kpis",
        items: [
          { label: "Expedients", value: String(s.total) },
          { label: "Oberts / Tancats", value: `${s.oberts} / ${s.tancats}` },
          { label: "Privats / Públics", value: `${s.privats} / ${s.publics}` },
          { label: "Pressupost total", value: eur(s.pressupostTotal) },
          { label: "Pressupost en obert", value: eur(s.pressupostObert) },
          { label: "Pressupost mitjà", value: eur(s.pressupostMitja) },
        ],
      },
      ...breakdown(
        "Pressupost per tipus",
        [
          { label: "Privat", count: s.privats, money: s.pressupostPrivat },
          { label: "Públic", count: s.publics, money: s.pressupostPublic },
        ].filter((x) => x.money > 0 || x.count > 0),
        s.pressupostTotal,
      ),
      ...breakdown("Pressupost per categoria", s.catPressupost.map((g) => ({ label: g.label, count: g.count, money: g.value })), s.pressupostTotal),
      ...breakdown("Per tipologia", s.byTipologia.map((g) => ({ label: g.key, count: g.count, money: g.money })), s.pressupostTotal),
      ...breakdown("Per ciutat", s.byCiutat.map((g) => ({ label: g.key, count: g.count, money: g.money })), s.pressupostTotal),
      ...rankSection,
    ],
  };
}
