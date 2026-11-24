// Facturació: invoice totals and the «Factures» list, as the Facturació page
// shows and prints it and as the Descàrregues page files it.

import { formatDataCa, formatEur } from "@/lib/format";
import type { Factura } from "@/types/db";
import type { PdfDoc } from "./doc";

export const DEFAULT_IVA = 21;

export function n(v: string | number | null | undefined): number {
  const x = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return Number.isFinite(x) ? (x as number) : 0;
}

export function totals(preu: number, suplits: number, ivaPct: number = DEFAULT_IVA) {
  const iva = preu * (ivaPct / 100);
  const total = preu + iva;
  return { iva, total, totalFinal: total + suplits };
}

export function ivaPctOf(f: Pick<Factura, "iva_pct">): number {
  const v = n(f.iva_pct);
  return Number.isFinite(v) && v >= 0 && f.iva_pct != null ? v : DEFAULT_IVA;
}

export interface GroupSum {
  base: number;
  iva: number;
  total: number;
  sup: number;
  totalFinal: number;
}

export type SuplitsPerFactura = ReadonlyMap<number, readonly { import: string }[]>;

export function rowSup(f: Pick<Factura, "id">, suplitsByFactura: SuplitsPerFactura): number {
  return (suplitsByFactura.get(f.id) ?? []).reduce((s, x) => s + n(x.import), 0);
}

export type FacturaLlistaRow = Pick<Factura, "id" | "num" | "estat" | "data" | "client_nom" | "nif" | "expedient_num" | "preu" | "iva_pct" | "pagada">;

export function sumGroup(rows: FacturaLlistaRow[], suplitsByFactura: SuplitsPerFactura): GroupSum {
  return rows.reduce<GroupSum>(
    (acc, f) => {
      const sup = rowSup(f, suplitsByFactura);
      const t = totals(n(f.preu), sup, ivaPctOf(f));
      acc.base += n(f.preu);
      acc.iva += t.iva;
      acc.total += t.total;
      acc.sup += sup;
      acc.totalFinal += t.totalFinal;
      return acc;
    },
    { base: 0, iva: 0, total: 0, sup: 0, totalFinal: 0 },
  );
}

export function facturaYear(f: Pick<Factura, "data">): string {
  return f.data ? f.data.slice(0, 4) : "";
}

// Newest number first, as the list sorts them by default.
export function byNumDesc(a: Pick<Factura, "num">, b: Pick<Factura, "num">): number {
  return (b.num ?? "").localeCompare(a.num ?? "");
}

const eur = (v: number) => formatEur(v);

// `rows` in the order to print (the list's).
export function facturesListDoc(rows: FacturaLlistaRow[], suplitsByFactura: SuplitsPerFactura, subtitle: string, empty = "Cap factura amb aquests filtres."): PdfDoc {
  const sum = sumGroup(rows, suplitsByFactura);
  return {
    title: "Factures",
    subtitle,
    landscape: true,
    marginCm: 1.2,
    gothic: true,
    blocks: [
      {
        kind: "table",
        table: {
          columns: [
            { label: "Núm.", mono: true },
            { label: "Data" },
            { label: "Client" },
            { label: "NIF/CIF", mono: true },
            { label: "Expedient" },
            { label: "Base", align: "right", bold: true },
            { label: "IVA", align: "right", muted: true },
            { label: "Total", align: "right" },
            { label: "Suplits", align: "right" },
            { label: "Total final", align: "right", bold: true },
            { label: "Estat", align: "center" },
          ],
          rows: rows.map((f) => {
            const sup = rowSup(f, suplitsByFactura);
            const t = totals(n(f.preu), sup, ivaPctOf(f));
            return [
              f.num ?? "—",
              f.data ? formatDataCa(f.data) : "—",
              f.client_nom ?? "—",
              f.nif ?? "—",
              f.expedient_num || "—",
              eur(n(f.preu)),
              eur(t.iva),
              eur(t.total),
              sup ? eur(sup) : "—",
              eur(t.totalFinal),
              f.estat === "propera" ? "Propera" : f.pagada ? "Pagada" : "Pendent",
            ];
          }),
          total: rows.length
            ? [
                { text: `Total (${rows.length} ${rows.length === 1 ? "factura" : "factures"})`, span: 5 },
                eur(sum.base),
                eur(sum.iva),
                eur(sum.total),
                sum.sup ? eur(sum.sup) : "—",
                eur(sum.totalFinal),
                "",
              ]
            : undefined,
          empty,
        },
      },
    ],
  };
}

// ── Estadística de facturació (Descàrregues: the current year's invoices) ────
// The same totals as the list (sumGroup: base, IVA, suplits, total final), by
// quarter (the IVA periods), month and client, and the invoices still unpaid.

const MESOS = ["Gener", "Febrer", "Març", "Abril", "Maig", "Juny", "Juliol", "Agost", "Setembre", "Octubre", "Novembre", "Desembre"];

export interface FacturacioStats {
  factures: number;
  sum: GroupSum;
  cobrat: { factures: number; totalFinal: number };
  pendent: { factures: number; totalFinal: number };
  perTrimestre: { label: string; factures: number; sum: GroupSum }[];
  perMes: { label: string; factures: number; sum: GroupSum }[];
  perClient: { label: string; factures: number; base: number }[]; // by base, highest first
  pendents: { num: string | null; data: string | null; client: string | null; base: number; totalFinal: number }[]; // lowest number first
}

export function facturacioStats(rows: FacturaLlistaRow[], suplitsByFactura: SuplitsPerFactura): FacturacioStats {
  const mes = (f: FacturaLlistaRow) => Number((f.data ?? "").slice(5, 7)) - 1; // 0–11 (NaN without a date)
  const group = (r: FacturaLlistaRow[]) => ({ factures: r.length, sum: sumGroup(r, suplitsByFactura) });
  const pagades = rows.filter((f) => f.pagada);
  const pendents = rows.filter((f) => !f.pagada);
  const clients = new Map<string, { factures: number; base: number }>();
  for (const f of rows) {
    const label = f.client_nom || "Sense client";
    const c = clients.get(label) ?? { factures: 0, base: 0 };
    c.factures += 1;
    c.base += n(f.preu);
    clients.set(label, c);
  }
  return {
    factures: rows.length,
    sum: sumGroup(rows, suplitsByFactura),
    cobrat: { factures: pagades.length, totalFinal: sumGroup(pagades, suplitsByFactura).totalFinal },
    pendent: { factures: pendents.length, totalFinal: sumGroup(pendents, suplitsByFactura).totalFinal },
    perTrimestre: [0, 1, 2, 3].map((t) => ({
      label: `${t + 1}r trimestre (${MESOS[t * 3].toLowerCase()}–${MESOS[t * 3 + 2].toLowerCase()})`,
      ...group(rows.filter((f) => Math.floor(mes(f) / 3) === t)),
    })),
    perMes: MESOS.map((label, i) => ({ label, ...group(rows.filter((f) => mes(f) === i)) })),
    perClient: [...clients].map(([label, c]) => ({ label, ...c })).sort((a, b) => b.base - a.base || a.label.localeCompare(b.label, "ca")),
    pendents: [...pendents]
      .sort((a, b) => (a.num ?? "").localeCompare(b.num ?? "", "ca", { numeric: true }))
      .map((f) => ({ num: f.num, data: f.data, client: f.client_nom ?? null, base: n(f.preu), totalFinal: totals(n(f.preu), rowSup(f, suplitsByFactura), ivaPctOf(f)).totalFinal })),
  };
}

export function facturacioStatsDoc(s: FacturacioStats, subtitle: string): PdfDoc {
  const factures = (k: number) => `${k} ${k === 1 ? "factura" : "factures"}`;
  const pct = (v: number) => (s.sum.base ? `${new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 1 }).format((v / s.sum.base) * 100)} %` : "—");
  const diners = (v: number, k: number) => (k ? eur(v) : "—");
  return {
    title: "Facturació — Estadístiques",
    subtitle,
    landscape: true,
    marginCm: 1.2,
    blocks: [
      {
        kind: "kpis",
        items: [
          { label: "Factures", value: String(s.factures) },
          { label: "Base imposable", value: eur(s.sum.base) },
          { label: "IVA", value: eur(s.sum.iva) },
          { label: "Total facturat", value: eur(s.sum.totalFinal), hint: s.sum.sup ? `amb IVA i ${eur(s.sum.sup)} de suplits` : "amb IVA" },
          { label: "Cobrat", value: eur(s.cobrat.totalFinal), hint: factures(s.cobrat.factures) },
          { label: "Pendent de cobrament", value: eur(s.pendent.totalFinal), hint: factures(s.pendent.factures) },
          { label: "Factura mitjana", value: s.factures ? eur(s.sum.base / s.factures) : "—", hint: "base imposable" },
        ],
      },
      {
        kind: "table",
        table: {
          title: "Per trimestre",
          columns: [{ label: "Trimestre" }, { label: "Factures", align: "right" }, { label: "Base", align: "right", bold: true }, { label: "IVA", align: "right", muted: true }, { label: "Total final", align: "right" }],
          rows: s.perTrimestre.map((t) => [t.label, String(t.factures), diners(t.sum.base, t.factures), diners(t.sum.iva, t.factures), diners(t.sum.totalFinal, t.factures)]),
          total: ["Total", String(s.factures), eur(s.sum.base), eur(s.sum.iva), eur(s.sum.totalFinal)],
        },
      },
      {
        kind: "table",
        table: {
          title: "Per mes",
          columns: [{ label: "Mes" }, { label: "Factures", align: "right" }, { label: "Base", align: "right", bold: true }, { label: "Total final", align: "right" }],
          rows: s.perMes.map((m) => [m.label, String(m.factures), diners(m.sum.base, m.factures), diners(m.sum.totalFinal, m.factures)]),
          total: ["Total", String(s.factures), eur(s.sum.base), eur(s.sum.totalFinal)],
        },
      },
      {
        kind: "table",
        table: {
          title: "Per client",
          columns: [{ label: "Client" }, { label: "Factures", align: "right" }, { label: "Base", align: "right", bold: true }, { label: "% de la base", align: "right", muted: true }],
          rows: s.perClient.map((c) => [c.label, String(c.factures), eur(c.base), pct(c.base)]),
          total: s.perClient.length ? ["Total", String(s.factures), eur(s.sum.base), s.sum.base ? "100 %" : "—"] : undefined,
          empty: "Cap factura aquest any.",
        },
      },
      {
        kind: "table",
        table: {
          title: `Pendents de cobrament (${factures(s.pendents.length)})`,
          columns: [{ label: "Núm.", mono: true }, { label: "Data" }, { label: "Client" }, { label: "Base", align: "right" }, { label: "Total final", align: "right", bold: true }],
          rows: s.pendents.map((f) => [f.num ?? "—", f.data ? formatDataCa(f.data) : "—", f.client ?? "—", eur(f.base), eur(f.totalFinal)]),
          total: s.pendents.length ? [{ text: "Total pendent", span: 3 }, eur(s.pendents.reduce((v, f) => v + f.base, 0)), eur(s.pendent.totalFinal)] : undefined,
          empty: "Cap factura pendent de cobrament.",
        },
      },
    ],
  };
}
