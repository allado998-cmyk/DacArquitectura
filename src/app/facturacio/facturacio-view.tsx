"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  addConcepteAction,
  addSuplitAction,
  createFacturaAction,
  deleteConcepteAction,
  deleteFacturaAction,
  deleteSuplitAction,
  setPagadaAction,
  updateConcepteAction,
  updateFacturaAction,
  updateSuplitAction,
  type FacturaPatch,
} from "./actions";
import type { Factura, FacturaSuplit, FacturaConcepte } from "@/types/db";
import { formatEur, formatDataCa } from "@/lib/format";
import { Combobox, type ComboOption } from "@/components/combobox";
import { Modal } from "@/components/modal";
import { ChartCard, GradientDonut, HBarChart, KpiCard, lighten } from "@/components/charts";
import { CATEGORY_BY_CODE, TIPUS } from "@/lib/expedients";
import { openStatsPdf } from "@/lib/pdf";
import { PROFESSIONAL } from "@/lib/proposta-doc";

export interface ClientOpt { id: number; nom: string; nif: string | null; carrer: string | null; ciutat: string | null; codi_postal: string | null }
export interface ExpedientOpt { id: number; num_expedient: string; projecte: string | null; pressupost: string }
export interface Invoiced { expedient_id: number; total: string }

const DEFAULT_IVA = 21;
type Tab = "factures" | "estadistiques";

// Dashboard accent palette (kept consistent with the Estadístiques tab).
const C_TOTAL = "#1f4d3f"; // brand green
const C_BASE = "#0ea5e9"; // sky
const C_IVA = "#f59e0b"; // amber
const C_SUP = "#8b5cf6"; // violet

function n(v: string | number | null | undefined) {
  const x = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return Number.isFinite(x) ? (x as number) : 0;
}
function totals(preu: number, suplits: number, ivaPct: number = DEFAULT_IVA) {
  const iva = preu * (ivaPct / 100);
  const total = preu + iva;
  return { iva, total, totalFinal: total + suplits };
}
function ivaPctOf(f: Factura) {
  const v = n(f.iva_pct);
  return Number.isFinite(v) && v >= 0 && f.iva_pct != null ? v : DEFAULT_IVA;
}

export function FacturacioView({
  factures,
  suplits,
  conceptes,
  clients,
  expedients,
  invoiced,
  suplitSuggestions,
  suggestedNum,
  today,
}: {
  factures: Factura[];
  suplits: FacturaSuplit[];
  conceptes: FacturaConcepte[];
  clients: ClientOpt[];
  expedients: ExpedientOpt[];
  invoiced: Invoiced[];
  suplitSuggestions: string[];
  suggestedNum: string;
  today: string;
}) {
  const [tab, setTab] = useState<Tab>("factures");
  const [editing, setEditing] = useState<Factura | null>(null);
  const [pendingOpenId, setPendingOpenId] = useState<number | null>(null);
  const [listCount, setListCount] = useState(factures.length);
  const [creating, startCreate] = useTransition();

  // After "Nova factura" inserts a row and the list revalidates, open its popup
  // straight away so it can be filled in (rather than landing as a placeholder).
  useEffect(() => {
    if (pendingOpenId == null) return;
    const f = factures.find((x) => x.id === pendingOpenId);
    if (f) {
      setEditing(f);
      setPendingOpenId(null);
    }
  }, [factures, pendingOpenId]);

  function novaFactura() {
    startCreate(async () => {
      const id = await createFacturaAction();
      if (id) setPendingOpenId(id);
    });
  }

  const suplitsByFactura = useMemo(() => {
    const m = new Map<number, FacturaSuplit[]>();
    for (const s of suplits) (m.get(s.factura_id) ?? m.set(s.factura_id, []).get(s.factura_id)!).push(s);
    return m;
  }, [suplits]);
  const conceptesByFactura = useMemo(() => {
    const m = new Map<number, FacturaConcepte[]>();
    for (const c of conceptes) (m.get(c.factura_id) ?? m.set(c.factura_id, []).get(c.factura_id)!).push(c);
    return m;
  }, [conceptes]);
  const invoicedByExp = useMemo(() => {
    const m = new Map<number, number>();
    for (const i of invoiced) m.set(i.expedient_id, n(i.total));
    return m;
  }, [invoiced]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 mb-6 border-b border-[var(--color-line)]">
        <TabBtn current={tab} value="factures" onClick={setTab}>Factures ({listCount})</TabBtn>
        <TabBtn current={tab} value="estadistiques" onClick={setTab}>Estadístiques</TabBtn>
        {tab === "factures" && (
          <button type="button" className="btn-primary ml-auto" onClick={novaFactura} disabled={creating}>
            {creating ? "Creant…" : "+ Nova factura"}
          </button>
        )}
      </div>

      {tab === "factures" ? (
        <FacturesList factures={factures} suplitsByFactura={suplitsByFactura} onEdit={setEditing} today={today} onCount={setListCount} />
      ) : (
        <StatsPanel factures={factures} today={today} />
      )}

      <Modal
        open={editing != null}
        onClose={() => setEditing(null)}
        wide
        title={editing && <h3 className="text-base font-semibold">Factura <span className="font-mono">{editing.num}</span></h3>}
      >
        {editing && (
          <FacturaForm
            key={editing.id}
            factura={editing}
            suplits={suplitsByFactura.get(editing.id) ?? []}
            conceptes={conceptesByFactura.get(editing.id) ?? []}
            clients={clients}
            expedients={expedients}
            invoicedByExp={invoicedByExp}
            suplitSuggestions={suplitSuggestions}
            suggestedNum={suggestedNum}
            today={today}
            onClose={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function TabBtn({ children, value, current, onClick }: { children: React.ReactNode; value: Tab; current: Tab; onClick: (v: Tab) => void }) {
  const active = current === value;
  return (
    <button type="button" onClick={() => onClick(value)} className={`px-4 py-2 text-sm border-b-2 -mb-px ${active ? "border-[var(--color-accent)] text-[var(--color-accent)] font-medium" : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"}`}>{children}</button>
  );
}

function PagadaToggle({ id, pagada }: { id: number; pagada: boolean }) {
  const [, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); startTransition(() => setPagadaAction(id, !pagada)); }}
      className="rounded-full px-2.5 py-1 text-xs font-medium"
      style={pagada ? { backgroundColor: "#dcfce7", color: "#15803d" } : { backgroundColor: "#fee2e2", color: "#b91c1c" }}
    >
      {pagada ? "Pagada" : "Pendent"}
    </button>
  );
}

interface GroupSum { base: number; iva: number; total: number; sup: number; totalFinal: number }

function rowSup(f: Factura, suplitsByFactura: Map<number, FacturaSuplit[]>) {
  return (suplitsByFactura.get(f.id) ?? []).reduce((s, x) => s + n(x.import), 0);
}
function sumGroup(rows: Factura[], suplitsByFactura: Map<number, FacturaSuplit[]>): GroupSum {
  return rows.reduce<GroupSum>((acc, f) => {
    const sup = rowSup(f, suplitsByFactura);
    const t = totals(n(f.preu), sup, ivaPctOf(f));
    acc.base += n(f.preu);
    acc.iva += t.iva;
    acc.total += t.total;
    acc.sup += sup;
    acc.totalFinal += t.totalFinal;
    return acc;
  }, { base: 0, iva: 0, total: 0, sup: 0, totalFinal: 0 });
}

function EyeIcon({ off }: { off?: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );
}

function FacturesSummary({
  sum,
  count,
  nPagades,
  hidePagades,
  onToggle,
  nPendents,
  hidePendents,
  onTogglePendents,
  nProperes,
  hideProperes,
  onToggleProperes,
}: {
  sum: GroupSum;
  count: number;
  nPagades: number;
  hidePagades: boolean;
  onToggle: () => void;
  nPendents: number;
  hidePendents: boolean;
  onTogglePendents: () => void;
  nProperes: number;
  hideProperes: boolean;
  onToggleProperes: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Resum de facturació</h2>
        <div className="flex flex-wrap items-center gap-2">
          {nProperes > 0 && (
            <button
              type="button"
              onClick={onToggleProperes}
              aria-pressed={hideProperes}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm text-[var(--color-muted)] transition-colors hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-ink)]"
            >
              <EyeIcon off={hideProperes} />
              {hideProperes ? `Mostrar properes (${nProperes})` : `Amagar properes (${nProperes})`}
            </button>
          )}
          {nPendents > 0 && (
            <button
              type="button"
              onClick={onTogglePendents}
              aria-pressed={hidePendents}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm text-[var(--color-muted)] transition-colors hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-ink)]"
            >
              <EyeIcon off={hidePendents} />
              {hidePendents ? `Mostrar pendents (${nPendents})` : `Amagar pendents (${nPendents})`}
            </button>
          )}
          {nPagades > 0 && (
            <button
              type="button"
              onClick={onToggle}
              aria-pressed={hidePagades}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm text-[var(--color-muted)] transition-colors hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-ink)]"
            >
              <EyeIcon off={hidePagades} />
              {hidePagades ? `Mostrar pagades (${nPagades})` : `Amagar pagades (${nPagades})`}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${lighten(C_TOTAL, 0.18)}, ${C_TOTAL})` }}>
          <div className="text-xs font-medium uppercase tracking-wide text-white/75">Base imposable</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums">{formatEur(sum.base)}</div>
          <div className="mt-1 text-xs text-white/75">
            {count} {count === 1 ? "factura" : "factures"}{nPagades > 0 ? ` · ${nPagades} pagades` : ""}
          </div>
        </div>
        <KpiCard label="IVA" value={formatEur(sum.iva)} accent={C_IVA} />
        <KpiCard label="Suplits" value={sum.sup ? formatEur(sum.sup) : "—"} accent={C_SUP} />
        <KpiCard label="Total facturat" value={formatEur(sum.totalFinal)} accent={C_BASE} hint="amb IVA i suplits" />
      </div>
    </div>
  );
}

type SortKey = "num" | "base" | "totalFinal" | "data";

function facturaYear(f: Factura) {
  return f.data ? f.data.slice(0, 4) : "";
}
function facturaTrim(f: Factura) {
  if (!f.data) return "";
  const m = parseInt(f.data.slice(5, 7), 10);
  return String(Math.ceil(m / 3)); // "1".."4"
}

function FacturesList({ factures, suplitsByFactura, onEdit, today, onCount }: { factures: Factura[]; suplitsByFactura: Map<number, FacturaSuplit[]>; onEdit: (f: Factura) => void; today: string; onCount: (n: number) => void }) {
  const [hidePagades, setHidePagades] = useState(false);
  const [hidePendents, setHidePendents] = useState(false);
  const [hideProperes, setHideProperes] = useState(false);
  const [query, setQuery] = useState("");
  const [fAny, setFAny] = useState(today.slice(0, 4)); // default: current year
  const [fTrim, setFTrim] = useState("");
  const [fClient, setFClient] = useState("");
  const [fEstat, setFEstat] = useState("");
  const [sort, setSort] = useState<SortKey>("num");

  const anys = useMemo(
    () => Array.from(new Set(factures.map(facturaYear).filter(Boolean))).sort().reverse(),
    [factures],
  );
  const clientsList = useMemo(
    () => Array.from(new Set(factures.map((f) => f.client_nom ?? "").filter(Boolean))).sort((a, b) => a.localeCompare(b, "ca")),
    [factures],
  );

  if (factures.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--color-line)] bg-white px-6 py-14 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></svg>
        </div>
        <p className="text-sm font-medium text-[var(--color-ink)]">Encara no hi ha cap factura</p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Crea&apos;n una de nova per començar.</p>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  function matches(f: Factura) {
    if (fClient && (f.client_nom ?? "") !== fClient) return false;
    if (q) {
      const hay = `${f.num ?? ""} ${f.client_nom ?? ""} ${f.expedient_num ?? ""} ${f.expedient_projecte ?? ""} ${f.concepte ?? ""} ${f.nif ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }
  // Year / trimester only constrain dated (emeses) factures — properes have no date.
  function matchesDate(f: Factura) {
    if (fAny && facturaYear(f) !== fAny) return false;
    if (fTrim && facturaTrim(f) !== fTrim) return false;
    return true;
  }
  function sortRows(rows: Factura[]) {
    const val = (f: Factura) => {
      if (sort === "base") return n(f.preu);
      if (sort === "totalFinal") return totals(n(f.preu), rowSup(f, suplitsByFactura), ivaPctOf(f)).totalFinal;
      if (sort === "data") return f.data ? Date.parse(f.data) : 0;
      return 0;
    };
    if (sort === "num") return [...rows].sort((a, b) => (b.num ?? "").localeCompare(a.num ?? ""));
    return [...rows].sort((a, b) => val(b) - val(a));
  }

  let emeses = factures.filter((f) => f.estat === "emesa" && matches(f) && matchesDate(f));
  let properes = factures.filter((f) => f.estat === "propera" && matches(f));

  // Estat filter: pagada / pendent narrow emeses; propera shows only properes.
  if (fEstat === "pagada") { emeses = emeses.filter((f) => f.pagada); properes = []; }
  else if (fEstat === "pendent") { emeses = emeses.filter((f) => !f.pagada); properes = []; }
  else if (fEstat === "propera") { emeses = []; }

  const nPagades = emeses.filter((f) => f.pagada).length;
  const nPendents = emeses.length - nPagades;
  let shownEmeses = emeses;
  if (hidePagades) shownEmeses = shownEmeses.filter((f) => !f.pagada);
  if (hidePendents) shownEmeses = shownEmeses.filter((f) => f.pagada);
  const visibleEmeses = sortRows(shownEmeses);
  const visibleProperes = hideProperes ? [] : sortRows(properes);

  const emesesSum = sumGroup(visibleEmeses, suplitsByFactura);
  const properesSum = sumGroup(visibleProperes, suplitsByFactura);

  useEffect(() => onCount(visibleEmeses.length + visibleProperes.length), [visibleEmeses.length, visibleProperes.length, onCount]);

  function exportPdf() {
    const logo = `${typeof window !== "undefined" ? window.location.origin : ""}/logo.jpg`;
    // When only properes are on screen (Estat = propera, or emeses all hidden),
    // export those instead of an empty emeses table.
    const onlyProperes = visibleEmeses.length === 0 && visibleProperes.length > 0;
    const pdfRows = onlyProperes ? visibleProperes : visibleEmeses;
    const pdfSum = onlyProperes ? properesSum : emesesSum;
    const filterParts: string[] = [];
    if (fAny) filterParts.push(`Any ${fAny}`);
    if (fTrim) filterParts.push(`Trimestre T${fTrim}`);
    if (fClient) filterParts.push(fClient);
    if (fEstat) filterParts.push(fEstat.charAt(0).toUpperCase() + fEstat.slice(1));
    if (q) filterParts.push(`"${query.trim()}"`);
    const filterLine = filterParts.length ? filterParts.join(" · ") : onlyProperes ? "Propera facturació" : "Totes les factures emeses";

    const body = pdfRows.map((f) => {
      const sup = rowSup(f, suplitsByFactura);
      const t = totals(n(f.preu), sup, ivaPctOf(f));
      return `<tr>
        <td class="mono">${esc(f.num ?? "—")}</td>
        <td>${f.data ? esc(formatDataCa(f.data)) : "—"}</td>
        <td>${esc(f.client_nom ?? "—")}</td>
        <td class="mono">${esc(f.nif ?? "—")}</td>
        <td>${f.expedient_num ? esc(f.expedient_num) : "—"}</td>
        <td class="r b">${eur(n(f.preu))}</td>
        <td class="r muted">${eur(t.iva)}</td>
        <td class="r">${eur(t.total)}</td>
        <td class="r">${sup ? eur(sup) : "—"}</td>
        <td class="r b">${eur(t.totalFinal)}</td>
        <td class="c">${f.estat === "propera" ? "Propera" : f.pagada ? "Pagada" : "Pendent"}</td>
      </tr>`;
    }).join("");

    const totalRow = `<tr class="tot">
      <td colspan="5">Total (${pdfRows.length} ${pdfRows.length === 1 ? "factura" : "factures"})</td>
      <td class="r b">${eur(pdfSum.base)}</td>
      <td class="r muted">${eur(pdfSum.iva)}</td>
      <td class="r">${eur(pdfSum.total)}</td>
      <td class="r">${pdfSum.sup ? eur(pdfSum.sup) : "—"}</td>
      <td class="r b">${eur(pdfSum.totalFinal)}</td>
      <td></td>
    </tr>`;

    const html = `<!DOCTYPE html><html lang="ca"><head><meta charset="utf-8"><title>Factures</title>
      <style>
        @page { size: A4 landscape; margin: 1.2cm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: ${FACTURA_FONT}; }
        body { margin: 0; color: #1a1a1a; }
        .head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
        .head h1 { font-size: 20px; margin: 0 0 2px; font-weight: 700; }
        .head .sub { font-size: 12px; color: #666; }
        .head img { width: 150px; height: auto; }
        table { border-collapse: collapse; width: 100%; font-size: 11px; }
        thead th { background: #1f4d3f; color: #fff; font-weight: 600; text-align: left; padding: 7px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; }
        tbody td { padding: 6px 8px; border-bottom: 1px solid #e7e7e3; }
        tbody tr:nth-child(even) td { background: #f7f7f5; }
        td.r, th.r { text-align: right; white-space: nowrap; }
        td.c, th.c { text-align: center; }
        td.b { font-weight: 700; }
        td.mono { font-family: "Courier New", monospace; }
        td.muted { color: #777; }
        tr.tot td { border-top: 2px solid #1f4d3f; border-bottom: none; font-weight: 700; background: #eef2f0 !important; padding-top: 8px; }
        .foot { margin-top: 16px; font-size: 10px; color: #999; }
      </style></head>
      <body>
        <div class="head">
          <div>
            <h1>Factures</h1>
            <div class="sub">${esc(filterLine)}</div>
          </div>
          <img src="${logo}" alt="DAC arquitectura" />
        </div>
        <table>
          <thead>
            <tr>
              <th>Núm.</th><th>Data</th><th>Client</th><th>NIF/CIF</th><th>Expedient</th>
              <th class="r">Base</th><th class="r">IVA</th><th class="r">Total</th><th class="r">Suplits</th><th class="r">Total final</th><th class="c">Estat</th>
            </tr>
          </thead>
          <tbody>
            ${body || `<tr><td colspan="11" style="padding:14px;color:#888;">Cap factura amb aquests filtres.</td></tr>`}
            ${pdfRows.length ? totalRow : ""}
          </tbody>
        </table>
        <div class="foot">Generat el ${esc(formatDataCa(new Date().toISOString().slice(0, 10)))} · DACARQUITECTURA</div>
      </body></html>`;

    const w = window.open("", "_blank", "width=1100,height=800");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  return (
    <div className="space-y-5">
      <FacturesSummary
        sum={emesesSum}
        count={visibleEmeses.length}
        nPagades={nPagades}
        hidePagades={hidePagades}
        onToggle={() => setHidePagades((v) => !v)}
        nPendents={nPendents}
        hidePendents={hidePendents}
        onTogglePendents={() => setHidePendents((v) => !v)}
        nProperes={properes.length}
        hideProperes={hideProperes}
        onToggleProperes={() => setHideProperes((v) => !v)}
      />

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Any</label>
          <select className="input w-28" value={fAny} onChange={(e) => setFAny(e.target.value)}>
            <option value="">Tots</option>
            {anys.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Trimestre</label>
          <select className="input w-32" value={fTrim} onChange={(e) => setFTrim(e.target.value)}>
            <option value="">Tots</option>
            <option value="1">T1 (gen–mar)</option>
            <option value="2">T2 (abr–jun)</option>
            <option value="3">T3 (jul–set)</option>
            <option value="4">T4 (oct–des)</option>
          </select>
        </div>
        <div className="flex-1 min-w-48">
          <label className="label">Cercar</label>
          <input className="input" placeholder="Núm., client, expedient, concepte…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div>
          <label className="label">Client</label>
          <select className="input" value={fClient} onChange={(e) => setFClient(e.target.value)}>
            <option value="">Tots</option>
            {clientsList.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Estat</label>
          <select className="input" value={fEstat} onChange={(e) => setFEstat(e.target.value)}>
            <option value="">Tots</option>
            <option value="pagada">Pagada</option>
            <option value="pendent">Pendent</option>
            <option value="propera">Propera</option>
          </select>
        </div>
        <div>
          <label className="label">Ordenar per</label>
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="num">Número</option>
            <option value="data">Data</option>
            <option value="base">Base imposable</option>
            <option value="totalFinal">Total final</option>
          </select>
        </div>
        <div className="ml-auto">
          <button type="button" className="btn-ghost inline-flex items-center gap-1.5" onClick={exportPdf} title="Genera un PDF de les factures filtrades">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M12 18v-6" /><path d="m9 15 3 3 3-3" /></svg>
            PDF
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table-compact w-full">
          <thead>
            <tr>
              <th className="th w-24">Núm.</th>
              <th className="th w-28">Data</th>
              <th className="th">Client</th>
              <th className="th w-32">NIF/CIF</th>
              <th className="th">Expedient</th>
              <th className="th w-32 text-right">Base</th>
              <th className="th w-28 text-right">IVA</th>
              <th className="th w-32 text-right">Total</th>
              <th className="th w-28 text-right">Suplits</th>
              <th className="th w-36 text-right">Total final</th>
              <th className="th w-28 text-center">Estat</th>
              <th className="th w-24"></th>
            </tr>
          </thead>
          <tbody>
            {visibleProperes.length > 0 && (
              <>
                <tr><td className="td bg-[var(--color-paper)] text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]" colSpan={12}>Propera facturació</td></tr>
                {visibleProperes.map((f) => <FacturaRow key={f.id} f={f} suplitsByFactura={suplitsByFactura} onEdit={onEdit} />)}
                <SubtotalRow label="Total propera facturació" sum={properesSum} />
              </>
            )}

            {visibleProperes.length > 0 && visibleEmeses.length > 0 && (
              <tr><td className="td bg-[var(--color-paper)] text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]" colSpan={12}>Factures emeses</td></tr>
            )}
            {visibleEmeses.map((f) => <FacturaRow key={f.id} f={f} suplitsByFactura={suplitsByFactura} onEdit={onEdit} />)}
            {visibleEmeses.length > 0 && <SubtotalRow label="Total facturat" sum={emesesSum} emphasis />}
            {visibleEmeses.length === 0 && (
              <tr><td className="td text-[var(--color-muted)]" colSpan={12}>Cap factura facturada amb aquests filtres.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FacturaRow({ f, suplitsByFactura, onEdit }: { f: Factura; suplitsByFactura: Map<number, FacturaSuplit[]>; onEdit: (f: Factura) => void }) {
  const [, startTransition] = useTransition();
  const sup = rowSup(f, suplitsByFactura);
  const t = totals(n(f.preu), sup, ivaPctOf(f));
  return (
    <tr className="cursor-pointer hover:bg-[var(--color-paper)]" onClick={() => onEdit(f)}>
      <td className="td font-mono text-[var(--color-accent)]">{f.num ?? <span className="text-[var(--color-muted)]">—</span>}</td>
      <td className="td tabular-nums">{f.data ? formatDataCa(f.data) : "—"}</td>
      <td className="td">{f.client_nom ?? <span className="text-[var(--color-muted)]">—</span>}</td>
      <td className="td">{f.nif ?? <span className="text-[var(--color-muted)]">—</span>}</td>
      <td className="td">{f.expedient_num ? <span><span className="font-mono">{f.expedient_num}</span> {f.expedient_projecte ?? ""}</span> : <span className="text-[var(--color-muted)]">—</span>}</td>
      <td className="td text-right tabular-nums font-semibold">{formatEur(f.preu)}</td>
      <td className="td text-right tabular-nums text-[var(--color-muted)]">{formatEur(t.iva)}</td>
      <td className="td text-right tabular-nums">{formatEur(t.total)}</td>
      <td className="td text-right tabular-nums">{sup ? formatEur(sup) : "—"}</td>
      <td className="td text-right tabular-nums font-semibold">{formatEur(t.totalFinal)}</td>
      <td className="td text-center">
        {f.estat === "propera" ? (
          <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: "#fef9c3", color: "#854d0e" }}>Propera</span>
        ) : (
          <PagadaToggle id={f.id} pagada={f.pagada} />
        )}
      </td>
      <td className="td text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="text-[var(--color-accent)] hover:underline text-sm mr-3" onClick={() => onEdit(f)}>Editar</button>
        <button type="button" className="text-red-700 hover:underline text-sm" onClick={() => { if (confirm(`Eliminar la factura ${f.num ?? ""}?`)) startTransition(() => deleteFacturaAction(f.id)); }}>Eliminar</button>
      </td>
    </tr>
  );
}

function SubtotalRow({ label, sum, emphasis }: { label: string; sum: GroupSum; emphasis?: boolean }) {
  return (
    <tr className="bg-[var(--color-paper)] border-t-2 border-[var(--color-line)]">
      <td className="td font-medium" colSpan={5}>{label}</td>
      <td className="td text-right tabular-nums font-semibold">{formatEur(sum.base)}</td>
      <td className="td text-right tabular-nums text-[var(--color-muted)]">{formatEur(sum.iva)}</td>
      <td className="td text-right tabular-nums">{formatEur(sum.total)}</td>
      <td className="td text-right tabular-nums">{sum.sup ? formatEur(sum.sup) : "—"}</td>
      <td className={`td text-right tabular-nums font-semibold ${emphasis ? "text-[var(--color-accent)]" : ""}`}>{formatEur(sum.totalFinal)}</td>
      <td className="td" colSpan={2}></td>
    </tr>
  );
}

function FacturaForm({
  factura,
  suplits,
  conceptes,
  clients,
  expedients,
  invoicedByExp,
  suplitSuggestions,
  suggestedNum,
  today,
  onClose,
}: {
  factura: Factura;
  suplits: FacturaSuplit[];
  conceptes: FacturaConcepte[];
  clients: ClientOpt[];
  expedients: ExpedientOpt[];
  invoicedByExp: Map<number, number>;
  suplitSuggestions: string[];
  suggestedNum: string;
  today: string;
  onClose: () => void;
}) {
  const [estat, setEstat] = useState(factura.estat);
  const [num, setNum] = useState(factura.num ?? "");
  const [clientId, setClientId] = useState<number | null>(factura.client_id);
  const [data, setData] = useState(factura.data ?? "");
  const [expedientId, setExpedientId] = useState<number | null>(factura.expedient_id);
  const [concepte, setConcepte] = useState(factura.concepte ?? "");
  const [lang, setLang] = useState<"ca" | "es">(factura.lang ?? "es");
  const [preu, setPreu] = useState(factura.preu);
  const [ivaPct, setIvaPct] = useState(factura.iva_pct ?? String(DEFAULT_IVA));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingSup, startSup] = useTransition();

  const emesa = estat === "emesa";

  function changeEstat(next: string) {
    setEstat(next as typeof estat);
    if (next === "emesa") {
      if (!num.trim()) setNum(suggestedNum);
      if (!data) setData(today);
    }
  }

  const client = clients.find((c) => c.id === clientId) ?? null;
  const expedient = expedients.find((e) => e.id === expedientId) ?? null;

  const clientOpts: ComboOption[] = clients.map((c) => ({ id: c.id, label: c.nom, sub: c.nif ?? undefined }));
  const expedientOpts: ComboOption[] = expedients.map((e) => ({ id: e.id, label: e.projecte ? `${e.num_expedient} · ${e.projecte}` : e.num_expedient }));

  const supTotal = suplits.reduce((s, x) => s + n(x.import), 0);
  const hasConceptes = conceptes.length > 0;
  const conceptesTotal = conceptes.reduce((s, c) => s + n(c.import), 0);
  const base = hasConceptes ? conceptesTotal : n(preu);
  const ivaNum = n(ivaPct);
  const t = totals(base, supTotal, ivaNum);

  // Already invoiced on this expedient (other factures).
  const alreadyOnExp = expedientId ? (invoicedByExp.get(expedientId) ?? 0) - n(factura.preu) : 0;

  function pickExpedient(id: number | null) {
    setExpedientId(id);
    const e = expedients.find((x) => x.id === id);
    if (e) setPreu(e.pressupost); // default to the expedient pressupost
  }

  function save() {
    setError(null);
    if (emesa && (!num.trim() || !data)) {
      setError("Una factura emesa necessita un número i una data.");
      return;
    }
    const patch: FacturaPatch = { estat, num, client_id: clientId, data, expedient_id: expedientId, concepte, lang, preu: hasConceptes ? conceptesTotal : parseFloat(preu) || 0, iva_pct: ivaPct.trim() === "" ? DEFAULT_IVA : parseFloat(ivaPct) || 0 };
    startTransition(async () => {
      await updateFacturaAction(factura.id, patch);
      onClose();
    });
  }

  function generar(mode: "print" | "word" = "print") {
    const L = FACT_LABELS[lang];
    const logo = `${typeof window !== "undefined" ? window.location.origin : ""}/logo.jpg`;
    const fecha = data ? longDate(data, lang) : "";
    const ciutatProf = PROFESSIONAL.ciutat.replace(/^\d+\s*/, ""); // "08028 Barcelona" → "Barcelona"

    const sup = suplits.filter((s) => (s.descripcio ?? "").trim() || n(s.import) > 0);
    const hasSup = sup.length > 0;
    const conc = conceptes.filter((c) => (c.descripcio ?? "").trim() || n(c.import) > 0);
    const showConc = hasConceptes && conc.length > 0;
    const ivaZero = ivaNum === 0;

    const row = (label: string, value: string) =>
      `<tr><td style="padding:3px 16px 3px 0;font-size:9px;font-style:italic;color:#999;white-space:nowrap;vertical-align:top;">${esc(label)}</td><td style="padding:3px 0;font-size:14px;color:#111;">${value}</td></tr>`;
    const bar = (label: string) =>
      `<div style="display:block;background:#e6e6e6;color:#7a7a7a;font-size:11px;letter-spacing:.06em;padding:5px 9px;border-bottom:1px solid #bdbdbd;margin:20px 0 10px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${esc(label)}</div>`;

    const clientCiutat = [client?.codi_postal, client?.ciutat].filter(Boolean).join(" ");
    const concepteHtml = esc(concepte).replace(/\n/g, "<br>");
    const expLine = expedient ? `<div style="margin-top:14px;font-size:14px;">${esc(L.expedient)} ${esc(expedient.num_expedient)}</div>` : "";

    // Economic block — mirrors the FE72.01-08 model: small italic labels on the
    // left, bold base & total values, thin rules under the base and IVA rows.
    const econRule = "border-bottom:1px solid #bbb;";
    const valTd = `${econRule}padding:4px 0;text-align:right;font-size:13px;white-space:nowrap;width:26%;`;
    const concRows = conc
      .map((c) => `<tr><td style="${econRule}padding:4px 10px 4px 0;font-size:11px;color:#555;">${esc(c.descripcio) || "—"}</td><td style="${valTd}">${eur(n(c.import))}</td></tr>`)
      .join("");
    const supRows = sup
      .map((s) => `<tr><td style="${econRule}padding:4px 10px 4px 0;font-size:11px;color:#555;">${esc(s.descripcio) || "—"}</td><td style="${valTd}">+ ${eur(n(s.import))}</td></tr>`)
      .join("");
    const ivaRow = ivaZero
      ? ""
      : `<tr><td style="${econRule}padding:5px 10px 5px 0;font-size:11px;color:#555;">+${fmtPct(ivaNum)}% ${esc(L.ivaWord)}</td><td style="${valTd}">+ ${eur(t.iva)}</td></tr>`;
    const grandTotal = ivaZero ? base + supTotal : (hasSup ? t.totalFinal : t.total);

    const econ = `
      <table style="border-collapse:collapse;width:520px;max-width:100%;table-layout:fixed;">
        ${showConc ? concRows : ""}
        <tr><td style="${econRule}padding:5px 10px 5px 0;font-size:11px;font-weight:bold;font-style:italic;">${esc(L.base)}</td><td style="${econRule}padding:5px 0;text-align:right;font-size:16px;font-weight:bold;white-space:nowrap;width:26%;">${eur(base)}</td></tr>
        ${ivaRow}
        ${hasSup ? supRows : ""}
        <tr><td style="padding:6px 10px 6px 0;font-size:11px;font-weight:bold;font-style:italic;">${esc(L.total)}</td><td style="padding:6px 0;text-align:right;font-size:16px;font-weight:bold;white-space:nowrap;width:26%;">${eur(grandTotal)}</td></tr>
      </table>
      ${ivaZero ? `<div style="margin-top:10px;font-size:11px;font-style:italic;color:#444;max-width:560px;line-height:1.5;">${esc(IVA_EXEMPT_NOTE)}</div>` : ""}`;

    const body = `
      <div style="font-family:${FACTURA_FONT};font-size:13px;color:#111;max-width:760px;margin:0 auto;">
        <div style="text-align:right;margin-bottom:4px;"><img src="${logo}" alt="DAC arquitectura" width="170" height="67" style="width:170px;height:auto;display:inline-block;"/></div>

        ${bar(L.datosProf)}
        <table style="border-collapse:collapse;">
          ${row(L.numero, esc(num))}
          ${row(L.fecha, esc(fecha))}
          ${row(L.sociedad, esc(PROFESSIONAL.societat))}
          ${row("CIF", esc(PROFESSIONAL.cif))}
          ${row(L.direccion, esc(PROFESSIONAL.adreca))}
          ${row(L.ciudad, esc(PROFESSIONAL.ciutat))}
        </table>

        ${bar(L.datosCliente)}
        <table style="border-collapse:collapse;">
          ${row(L.cliente, esc(client?.nom) || "—")}
          ${client?.nif ? row("CIF", esc(client.nif)) : ""}
          ${client?.carrer ? row(L.direccion, esc(client.carrer)) : ""}
          ${clientCiutat ? row(L.ciudad, esc(clientCiutat)) : ""}
        </table>

        ${bar(L.concepto)}
        <div style="font-size:13px;line-height:1.5;">${concepteHtml}</div>
        ${expLine}

        ${bar(L.datosEcon)}
        ${econ}

        <div style="margin-top:30px;font-size:14px;">${esc(ciutatProf)}, ${esc(fecha)}</div>
        <div style="margin-top:46px;font-size:14px;">${esc(PROFESSIONAL.signatari)}, <span style="font-style:italic;">${esc(L.rol)}</span><br>${esc(PROFESSIONAL.societat)}</div>

        ${bar(L.formaPago)}
        <div style="font-size:12px;line-height:1.5;">${esc(L.pagoText)}</div>
        <div style="margin-top:8px;margin-left:24px;font-size:12px;"><strong>${esc(L.bancNom)}</strong>&nbsp;&nbsp;&nbsp;&nbsp;${esc(BANK.iban)}</div>
      </div>`;

    // Force Century Gothic everywhere; print-color-adjust keeps the grey section
    // stripes (and any fills) when the user saves to PDF.
    const headStyle = `<style>@page{size:A4;margin:1.6cm;}html,body{margin:0;}body,table,td,th,tr,div,span,p,strong,em{font-family:${FACTURA_FONT};}*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}</style>`;
    const doc = `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><title>Factura ${esc(num || String(factura.id))}</title>${headStyle}</head><body>${body}</body></html>`;

    if (mode === "word") {
      const blob = new Blob(["﻿", doc], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Factura_${(num || String(factura.id)).replace(/[^\w-]/g, "")}_${lang}.doc`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;
    w.document.write(doc);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--color-line)] p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Estat</label>
            <select className="input" value={estat} onChange={(e) => changeEstat(e.target.value)}>
              <option value="propera">Propera facturació</option>
              <option value="emesa">Facturada</option>
            </select>
          </div>
          <div>
            <label className="label">Número {emesa && <span className="text-red-700">*</span>}</label>
            <input className="input font-mono" placeholder={emesa ? suggestedNum : "—"} value={num} onChange={(e) => setNum(e.target.value)} />
          </div>
          <div>
            <label className="label">Data de factura {emesa && <span className="text-red-700">*</span>}</label>
            <input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
        </div>
        {!emesa && <p className="mt-2 text-xs text-[var(--color-muted)]">Una factura «Propera facturació» no té número ni data fins que la marques com a «Facturada».</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Client</label>
          <Combobox options={clientOpts} value={clientId} onChange={setClientId} placeholder="Cerca client…" emptyLabel="Sense client" overlay />
        </div>
        <div>
          <label className="label">NIF / CIF</label>
          <div className="input bg-[var(--color-paper)]">{client?.nif ?? "—"}</div>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Expedient</label>
          <Combobox options={expedientOpts} value={expedientId} onChange={pickExpedient} placeholder="Cerca expedient…" emptyLabel="Cap" overlay />
        </div>
      </div>

      {/* Concepte */}
      <div>
        <label className="label">Concepte</label>
        <textarea
          className="input min-h-[88px] resize-y"
          placeholder="Descripció del servei facturat… (apareix al cos de la factura generada)"
          value={concepte}
          onChange={(e) => setConcepte(e.target.value)}
        />
        {expedient && <p className="mt-1 text-xs text-[var(--color-muted)]">S&apos;hi afegirà automàticament: <span className="font-mono">{(lang === "ca" ? "EXPEDIENT DAC:" : "EXPEDIENTE DAC:")} {expedient.num_expedient}</span></p>}
      </div>

      {/* Desglossament del preu base (opcional) */}
      <div className="rounded-xl border border-[var(--color-line)] p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Conceptes del preu base (opcional)</span>
          <button type="button" className="btn-ghost px-2.5 py-1 text-sm" onClick={() => startSup(() => addConcepteAction(factura.id))}>+ Afegir concepte</button>
        </div>
        {conceptes.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">Sense desglossament — s&apos;utilitza el preu base manual.</p>
        ) : (
          <div className="space-y-2">
            {conceptes.map((c) => <ConcepteRow key={c.id} row={c} />)}
            <div className="flex justify-end border-t border-[var(--color-line)] pt-2 text-sm font-semibold">
              Suma: <span className="ml-2 tabular-nums">{formatEur(conceptesTotal)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Preu */}
      <div className="rounded-xl border border-[var(--color-line)] p-4 space-y-2">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Preu (base)</label>
            {hasConceptes ? (
              <div className="input bg-[var(--color-paper)] text-right tabular-nums" title="Suma dels conceptes">{formatEur(conceptesTotal)}</div>
            ) : (
              <input type="number" step="0.01" className="input text-right" value={preu} onChange={(e) => setPreu(e.target.value)} />
            )}
          </div>
          <div>
            <label className="label">IVA (%)</label>
            <input type="number" step="0.01" min="0" className="input text-right" value={ivaPct} onChange={(e) => setIvaPct(e.target.value)} />
          </div>
          <div className="self-end text-sm text-[var(--color-muted)]">
            {expedient && <>Pressupost de l&apos;expedient: <span className="font-medium text-[var(--color-ink)]">{formatEur(expedient.pressupost)}</span>{alreadyOnExp > 0.005 && <> · ja facturat en altres: <span className="font-medium text-amber-700">{formatEur(alreadyOnExp)}</span></>}</>}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t border-[var(--color-line)] pt-2 text-sm">
          <span className="text-[var(--color-muted)]">IVA ({fmtPct(ivaNum)}%): <span className="text-[var(--color-ink)] tabular-nums">{formatEur(t.iva)}</span></span>
          <span className="text-[var(--color-muted)]">Total: <span className="text-[var(--color-ink)] tabular-nums">{formatEur(t.total)}</span></span>
          {supTotal > 0 && <span className="text-[var(--color-muted)]">Suplits: <span className="text-[var(--color-ink)] tabular-nums">{formatEur(supTotal)}</span></span>}
          <span className="font-semibold">Total final: <span className="tabular-nums">{formatEur(t.totalFinal)}</span></span>
        </div>
        {ivaNum === 0 && (
          <p className="text-xs italic text-[var(--color-muted)]">Amb IVA 0% s&apos;afegirà a la factura la nota d&apos;exempció (servei cultural, art. 20.1.10 Llei 37/1992).</p>
        )}
      </div>

      {/* Suplits */}
      <div className="rounded-xl border border-[var(--color-line)] p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Suplits (opcional)</span>
          <button type="button" className="btn-ghost px-2.5 py-1 text-sm" onClick={() => startSup(() => addSuplitAction(factura.id))}>+ Afegir suplit</button>
        </div>
        {suplits.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">Cap suplit.</p>
        ) : (
          <div className="space-y-2">
            {suplits.map((s) => <SuplitRow key={s.id} row={s} />)}
          </div>
        )}
        <datalist id="suplit-sugg">{suplitSuggestions.map((d) => <option key={d} value={d} />)}</datalist>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={save} disabled={pending}>{pending ? "Desant…" : "Desar"}</button>
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--color-line)] text-sm" title="Idioma de la factura generada">
          {(["es", "ca"] as const).map((lng) => (
            <button
              key={lng}
              type="button"
              onClick={() => setLang(lng)}
              className={`px-3 py-1.5 ${lang === lng ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"}`}
            >
              {lng === "es" ? "Castellà" : "Català"}
            </button>
          ))}
        </div>
        <button type="button" className="btn-ghost disabled:opacity-50" onClick={() => generar("word")} disabled={pendingSup || !emesa || !num.trim()} title={!emesa ? "Marca-la com a Facturada per generar-la" : undefined}>Word</button>
        <button type="button" className="btn-ghost disabled:opacity-50" onClick={() => generar("print")} disabled={pendingSup || !emesa || !num.trim()} title={!emesa ? "Marca-la com a Facturada per generar-la" : undefined}>PDF / Imprimir</button>
        {emesa && <span className="ml-auto"><PagadaToggle id={factura.id} pagada={factura.pagada} /></span>}
      </div>
    </div>
  );
}

function ConcepteRow({ row }: { row: FacturaConcepte }) {
  const [descripcio, setDescripcio] = useState(row.descripcio ?? "");
  const [importe, setImporte] = useState(row.import);
  const [, startTransition] = useTransition();
  function persist() {
    if (descripcio !== (row.descripcio ?? "") || importe !== row.import) {
      startTransition(() => updateConcepteAction(row.id, descripcio, parseFloat(importe) || 0));
    }
  }
  return (
    <div className="flex items-center gap-2">
      <input className="input flex-1 min-w-0" placeholder="Concepte" value={descripcio} onChange={(e) => setDescripcio(e.target.value)} onBlur={persist} />
      <input type="number" step="0.01" className="input w-32 text-right" placeholder="€" value={importe} onChange={(e) => setImporte(e.target.value)} onBlur={persist} />
      <button type="button" className="shrink-0 text-red-700 hover:underline text-sm" onClick={() => { if (confirm("Eliminar aquest concepte?")) startTransition(() => deleteConcepteAction(row.id)); }}>✕</button>
    </div>
  );
}

function SuplitRow({ row }: { row: FacturaSuplit }) {
  const [descripcio, setDescripcio] = useState(row.descripcio ?? "");
  const [importe, setImporte] = useState(row.import);
  const [, startTransition] = useTransition();
  function persist() {
    if (descripcio !== (row.descripcio ?? "") || importe !== row.import) {
      startTransition(() => updateSuplitAction(row.id, descripcio, parseFloat(importe) || 0));
    }
  }
  return (
    <div className="flex items-center gap-2">
      <input className="input flex-1 min-w-0" list="suplit-sugg" placeholder="Descripció" value={descripcio} onChange={(e) => setDescripcio(e.target.value)} onBlur={persist} />
      <input type="number" step="0.01" className="input w-32 text-right" placeholder="€" value={importe} onChange={(e) => setImporte(e.target.value)} onBlur={persist} />
      <button type="button" className="shrink-0 text-red-700 hover:underline text-sm" onClick={() => { if (confirm("Eliminar aquest suplit?")) startTransition(() => deleteSuplitAction(row.id)); }}>✕</button>
    </div>
  );
}

// ============================================================================
// Estadístiques
// ============================================================================

const TRIM_COLORS = ["#0ea5e9", "#16a34a", "#f59e0b", "#8b5cf6"]; // T1..T4
const MONTHS_CA_SHORT = ["gen", "feb", "mar", "abr", "mai", "jun", "jul", "ago", "set", "oct", "nov", "des"];

function StatsPanel({ factures, today }: { factures: Factura[]; today: string }) {
  const [fAny, setFAny] = useState(today.slice(0, 4));
  const [fTrim, setFTrim] = useState("");
  const [fClient, setFClient] = useState("");
  const [dStart, setDStart] = useState("");
  const [dEnd, setDEnd] = useState("");

  const emeses = useMemo(() => factures.filter((f) => f.estat === "emesa"), [factures]);
  const anys = useMemo(() => Array.from(new Set(emeses.map((f) => (f.data ?? "").slice(0, 4)).filter(Boolean))).sort().reverse(), [emeses]);
  const clientsList = useMemo(() => Array.from(new Set(emeses.map((f) => f.client_nom ?? "").filter(Boolean))).sort((a, b) => a.localeCompare(b, "ca")), [emeses]);

  // Everything below is computed on the BASE imposable (sense IVA ni suplits).
  const rows = emeses
    .filter((f) => {
      if (fAny && (f.data ?? "").slice(0, 4) !== fAny) return false;
      if (fTrim && facturaTrim(f) !== fTrim) return false;
      if (fClient && (f.client_nom ?? "") !== fClient) return false;
      if (dStart && (!f.data || f.data < dStart)) return false;
      if (dEnd && (!f.data || f.data > dEnd)) return false;
      return true;
    })
    .map((f) => ({ f, base: n(f.preu) }));

  const baseTotal = rows.reduce((s, r) => s + r.base, 0);
  const cobrat = rows.filter((r) => r.f.pagada).reduce((s, r) => s + r.base, 0);
  const pendent = baseTotal - cobrat;
  const nPagades = rows.filter((r) => r.f.pagada).length;

  const byClient = new Map<string, number>();
  for (const r of rows) byClient.set(r.f.client_nom ?? "(Sense client)", (byClient.get(r.f.client_nom ?? "(Sense client)") ?? 0) + r.base);
  const clientRows = Array.from(byClient, ([label, v]) => ({ label, value: v, color: "#6366f1", display: formatEur(v) })).sort((a, b) => b.value - a.value);

  // Per month, coloured by trimester (the "sub categories by trimester").
  const byMonth = new Map<string, number>();
  for (const r of rows) { if (r.f.data) { const k = r.f.data.slice(0, 7); byMonth.set(k, (byMonth.get(k) ?? 0) + r.base); } }
  const monthRows = Array.from(byMonth, ([key, v]) => {
    const [y, m] = key.split("-").map(Number);
    const tri = Math.ceil(m / 3);
    return { key, label: `${MONTHS_CA_SHORT[m - 1]} ${String(y).slice(2)} · T${tri}`, value: v, color: TRIM_COLORS[tri - 1], display: formatEur(v) };
  }).sort((a, b) => a.key.localeCompare(b.key));

  // Per trimester totals (the explicit trimester sub-categories).
  const byTrim = [1, 2, 3, 4].map((tri) => ({
    label: `T${tri}`,
    value: rows.filter((r) => r.f.data && Math.ceil(Number(r.f.data.slice(5, 7)) / 3) === tri).reduce((s, r) => s + r.base, 0),
    color: TRIM_COLORS[tri - 1],
  })).filter((t) => t.value > 0);

  // Donuts by the linked expedient's categoria / tipus — by base, with a count.
  function donutSegments(keyFn: (r: { f: Factura; base: number }) => string, metaFn: (key: string) => { label: string; color: string }) {
    const m = new Map<string, { money: number; count: number }>();
    for (const r of rows) { const k = keyFn(r); const g = m.get(k) ?? { money: 0, count: 0 }; g.money += r.base; g.count += 1; m.set(k, g); }
    return Array.from(m, ([key, g]) => ({ ...metaFn(key), value: Math.round(g.money), count: g.count, note: formatEur(g.money) }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);
  }
  const catSegments = donutSegments(
    (r) => r.f.expedient_categoria ?? "",
    (k) => ({ label: (k && CATEGORY_BY_CODE[k]?.label) || "Sense categoria", color: (k && CATEGORY_BY_CODE[k]?.color) || "#9ca3af" }),
  );
  const tipusSegments = donutSegments(
    (r) => r.f.expedient_tipus ?? "",
    (k) => (k === "privat" || k === "public" ? { label: TIPUS[k].label, color: TIPUS[k].color } : { label: "Sense tipus", color: "#9ca3af" }),
  );

  const filterSummary = [
    fAny && `Any ${fAny}`,
    fTrim && `Trimestre T${fTrim}`,
    fClient,
    (dStart || dEnd) && `${dStart || "…"} → ${dEnd || "…"}`,
  ].filter(Boolean).join(" · ") || "Totes les factures emeses";

  function exportStatsPdf() {
    openStatsPdf({
      title: "Facturació — Estadístiques",
      subtitle: filterSummary,
      kpis: [
        { label: "Factures emeses", value: String(rows.length) },
        { label: "Total facturat (base)", value: formatEur(baseTotal) },
        { label: "Cobrat (base)", value: formatEur(cobrat) },
        { label: "Pendent (base)", value: formatEur(pendent) },
      ],
      tables: [
        { title: "Cobraments", columns: [{ label: "Estat" }, { label: "Factures", align: "right" }, { label: "Base", align: "right" }], rows: [["Cobrat", String(nPagades), formatEur(cobrat)], ["Pendent", String(rows.length - nPagades), formatEur(pendent)]] },
        { title: "Base per categoria", columns: [{ label: "Categoria" }, { label: "Factures", align: "right" }, { label: "Base", align: "right" }], rows: catSegments.map((s) => [s.label, String(s.count), formatEur(s.value)]) },
        { title: "Base per tipus", columns: [{ label: "Tipus" }, { label: "Factures", align: "right" }, { label: "Base", align: "right" }], rows: tipusSegments.map((s) => [s.label, String(s.count), formatEur(s.value)]) },
        { title: "Per trimestre", columns: [{ label: "Trimestre" }, { label: "Base", align: "right" }], rows: byTrim.map((t) => [t.label, formatEur(t.value)]) },
        { title: "Per mes", columns: [{ label: "Mes" }, { label: "Base", align: "right" }], rows: monthRows.map((m) => [m.label, formatEur(m.value)]) },
        { title: "Per client", columns: [{ label: "Client" }, { label: "Base", align: "right" }], rows: clientRows.map((c) => [c.label, formatEur(c.value)]) },
      ],
    });
  }

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <div className="rounded-2xl border border-[var(--color-line)] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid flex-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <label className="label">Any</label>
            <select className="input" value={fAny} onChange={(e) => setFAny(e.target.value)}>
              <option value="">Tots</option>
              {anys.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Trimestre</label>
            <select className="input" value={fTrim} onChange={(e) => setFTrim(e.target.value)}>
              <option value="">Tots</option>
              <option value="1">T1 (gen–mar)</option>
              <option value="2">T2 (abr–jun)</option>
              <option value="3">T3 (jul–set)</option>
              <option value="4">T4 (oct–des)</option>
            </select>
          </div>
          <div>
            <label className="label">Client</label>
            <select className="input" value={fClient} onChange={(e) => setFClient(e.target.value)}>
              <option value="">Tots</option>
              {clientsList.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Des de</label>
            <input type="date" className="input" value={dStart} onChange={(e) => setDStart(e.target.value)} />
          </div>
          <div>
            <label className="label">Fins a</label>
            <input type="date" className="input" value={dEnd} onChange={(e) => setDEnd(e.target.value)} />
          </div>
          </div>
          <button type="button" className="btn-ghost shrink-0 inline-flex items-center gap-1.5" onClick={exportStatsPdf} title="Genera un PDF de les estadístiques filtrades">
            <FactPdfIcon /> PDF
          </button>
        </div>
        {(dStart || dEnd) && (
          <button type="button" className="mt-2 text-sm text-[var(--color-muted)] hover:underline" onClick={() => { setDStart(""); setDEnd(""); }}>Esborrar dates</button>
        )}
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Factures emeses" value={String(rows.length)} accent="#1f4d3f" hint={`${nPagades} pagades`} />
        <KpiCard label="Total facturat (base)" value={formatEur(baseTotal)} accent="#0ea5e9" hint="base imposable" />
        <KpiCard label="Cobrat (base)" value={formatEur(cobrat)} accent="#16a34a" />
        <KpiCard label="Pendent de cobrament (base)" value={formatEur(pendent)} accent="#dc2626" />
      </div>

      {/* Circle graphs — sempre per base imposable */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Cobraments" meta="base · pagat / pendent">
          <GradientDonut
            segments={[
              { label: "Cobrat", value: Math.round(cobrat), color: "#16a34a", count: nPagades, note: formatEur(cobrat) },
              { label: "Pendent", value: Math.round(pendent), color: "#dc2626", count: rows.length - nPagades, note: formatEur(pendent) },
            ]}
            centerValue={formatEur(baseTotal)}
            centerLabel="base"
          />
        </ChartCard>
        <ChartCard title="Base per categoria" meta="import · % del total">
          {catSegments.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">Sense dades.</p>
          ) : (
            <GradientDonut segments={catSegments} centerValue={formatEur(baseTotal)} centerLabel="base" />
          )}
        </ChartCard>
        <ChartCard title="Base per tipus" meta="privat / públic">
          {tipusSegments.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">Sense dades.</p>
          ) : (
            <GradientDonut segments={tipusSegments} centerValue={formatEur(baseTotal)} centerLabel="base" />
          )}
        </ChartCard>
      </div>

      <ChartCard title="Per trimestre" meta="base imposable">
        <HBarChart bars={byTrim.map((t) => ({ ...t, display: formatEur(t.value) }))} />
      </ChartCard>

      <ChartCard title="Per mes" meta="base · color per trimestre">
        <HBarChart bars={monthRows} />
      </ChartCard>

      <ChartCard title="Per client" meta="base imposable">
        <HBarChart bars={clientRows} />
      </ChartCard>
    </div>
  );
}

function FactPdfIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M12 18v-6" /><path d="m9 15 3 3 3-3" />
    </svg>
  );
}

function esc(s: string | null | undefined) {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function eur(v: number) {
  return new Intl.NumberFormat("ca-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(v);
}
function fmtPct(v: number) {
  return new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 2 }).format(v);
}

// Generated-invoice document constants ---------------------------------------
const BANK = { nom: "CAJA DE ARQUITECTOS ARQUIA", iban: "ES66 3183 0801 2010 0250 2225" };
const IVA_EXEMPT_NOTE =
  "Aquesta factura no comporta IVA en ser un servei cultural. D'acord amb l'article 20.1.10 de la Llei 37/1992, de 28 de desembre, les classes a títol particular estan exemptes d'IVA.";
// Century Gothic with graceful fallbacks for browsers/OSes that lack it.
const FACTURA_FONT = "'Century Gothic', CenturyGothic, AppleGothic, 'URW Gothic', 'Avant Garde', 'Trebuchet MS', sans-serif";

const FACT_LABELS = {
  es: {
    datosProf: "DATOS FACTURA PROFESIONAL",
    numero: "número", fecha: "fecha", sociedad: "sociedad", direccion: "dirección", ciudad: "ciudad",
    datosCliente: "DATOS CLIENTE", cliente: "cliente",
    concepto: "CONCEPTO", expedient: "EXPEDIENTE DAC:",
    datosEcon: "DATOS ECONOMICOS",
    base: "TOTAL Base Imponible", ivaWord: "IVA", total: "TOTAL",
    rol: "arq. administrador",
    formaPago: "FORMA DE PAGO",
    pagoText: "Para mayor comodidad del cliente, transferencia bancaria, indicando el número de factura, en el siguiente número de cuenta corriente:",
    bancNom: "CAJA DE ARQUITECTOS ARQUIA",
  },
  ca: {
    datosProf: "DADES FACTURA PROFESSIONAL",
    numero: "número", fecha: "data", sociedad: "societat", direccion: "adreça", ciudad: "ciutat",
    datosCliente: "DADES CLIENT", cliente: "client",
    concepto: "CONCEPTE", expedient: "EXPEDIENT DAC:",
    datosEcon: "DADES ECONÒMIQUES",
    base: "TOTAL Base imposable", ivaWord: "IVA", total: "TOTAL",
    rol: "arq. administrador",
    formaPago: "FORMA DE PAGAMENT",
    pagoText: "Per a major comoditat del client, transferència bancària, indicant el número de factura, en el següent número de compte corrent:",
    bancNom: "CAIXA D'ARQUITECTES ARQUIA",
  },
} as const;

const MONTHS = {
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  ca: ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"],
} as const;

function longDate(iso: string, lang: "ca" | "es") {
  const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return "";
  const name = MONTHS[lang][m - 1];
  if (lang === "ca") {
    const prep = /^[aeiouàèéíòóú]/i.test(name) ? "d'" : "de ";
    return `${d} ${prep}${name} de ${y}`;
  }
  return `${d} de ${name} de ${y}`;
}
