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
