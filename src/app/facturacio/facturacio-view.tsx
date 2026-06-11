"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addSuplitAction,
  deleteFacturaAction,
  deleteSuplitAction,
  setPagadaAction,
  updateFacturaAction,
  updateSuplitAction,
  type FacturaPatch,
} from "./actions";
import type { Factura, FacturaSuplit } from "@/types/db";
import { formatEur, formatDataCa } from "@/lib/format";
import { Combobox, type ComboOption } from "@/components/combobox";
import { Modal } from "@/components/modal";
import { ChartCard, GradientDonut, HBarChart, KpiCard } from "@/components/charts";
import { PROFESSIONAL } from "@/lib/proposta-doc";

export interface ClientOpt { id: number; nom: string; nif: string | null }
export interface ExpedientOpt { id: number; num_expedient: string; projecte: string | null; pressupost: string }
export interface Invoiced { expedient_id: number; total: string }

const IVA = 0.21;
type Tab = "factures" | "estadistiques";

function n(v: string | number | null | undefined) {
  const x = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return Number.isFinite(x) ? (x as number) : 0;
}
function totals(preu: number, suplits: number) {
  const iva = preu * IVA;
  const total = preu + iva;
  return { iva, total, totalFinal: total + suplits };
}

export function FacturacioView({
  factures,
  suplits,
  clients,
  expedients,
  invoiced,
  suplitSuggestions,
  suggestedNum,
  today,
}: {
  factures: Factura[];
  suplits: FacturaSuplit[];
  clients: ClientOpt[];
  expedients: ExpedientOpt[];
  invoiced: Invoiced[];
  suplitSuggestions: string[];
  suggestedNum: string;
  today: string;
}) {
  const [tab, setTab] = useState<Tab>("factures");
  const [editing, setEditing] = useState<Factura | null>(null);

  const suplitsByFactura = useMemo(() => {
    const m = new Map<number, FacturaSuplit[]>();
    for (const s of suplits) (m.get(s.factura_id) ?? m.set(s.factura_id, []).get(s.factura_id)!).push(s);
    return m;
  }, [suplits]);
  const invoicedByExp = useMemo(() => {
    const m = new Map<number, number>();
    for (const i of invoiced) m.set(i.expedient_id, n(i.total));
    return m;
  }, [invoiced]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 mb-6 border-b border-[var(--color-line)]">
        <TabBtn current={tab} value="factures" onClick={setTab}>Factures ({factures.length})</TabBtn>
        <TabBtn current={tab} value="estadistiques" onClick={setTab}>Estadístiques</TabBtn>
      </div>

      {tab === "factures" ? (
        <FacturesList factures={factures} suplitsByFactura={suplitsByFactura} onEdit={setEditing} />
      ) : (
        <StatsPanel factures={factures} suplitsByFactura={suplitsByFactura} />
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

function FacturesList({ factures, suplitsByFactura, onEdit }: { factures: Factura[]; suplitsByFactura: Map<number, FacturaSuplit[]>; onEdit: (f: Factura) => void }) {
  const [, startTransition] = useTransition();
  if (factures.length === 0) {
    return <div className="card text-sm text-[var(--color-muted)]">Encara no hi ha cap factura. Crea&apos;n una de nova per començar.</div>;
  }
  return (
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
          {factures.map((f) => {
            const sup = (suplitsByFactura.get(f.id) ?? []).reduce((s, x) => s + n(x.import), 0);
            const t = totals(n(f.preu), sup);
            return (
              <tr key={f.id} className="cursor-pointer hover:bg-[var(--color-paper)]" onClick={() => onEdit(f)}>
                <td className="td font-mono text-[var(--color-accent)]">{f.num ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                <td className="td tabular-nums">{f.data ? formatDataCa(f.data) : "—"}</td>
                <td className="td">{f.client_nom ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                <td className="td">{f.nif ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                <td className="td">{f.expedient_num ? <span><span className="font-mono">{f.expedient_num}</span> {f.expedient_projecte ?? ""}</span> : <span className="text-[var(--color-muted)]">—</span>}</td>
                <td className="td text-right tabular-nums">{formatEur(f.preu)}</td>
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
          })}
        </tbody>
      </table>
    </div>
  );
}

function FacturaForm({
  factura,
  suplits,
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
  const [preu, setPreu] = useState(factura.preu);
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
  const t = totals(n(preu), supTotal);

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
    const patch: FacturaPatch = { estat, num, client_id: clientId, data, expedient_id: expedientId, preu: parseFloat(preu) || 0 };
    startTransition(async () => {
      await updateFacturaAction(factura.id, patch);
      onClose();
    });
  }

  function generar() {
    const sup = suplits.filter((s) => (s.descripcio ?? "").trim() || n(s.import) > 0);
    const supRows = sup
      .map((s) => `<tr><td style="padding:5px 8px;border:1px solid #ddd;">${esc(s.descripcio)}</td><td style="padding:5px 8px;border:1px solid #ddd;text-align:right;">${eur(n(s.import))}</td></tr>`)
      .join("");
    const body = `
      <div style="font-family:Arial,sans-serif;font-size:12px;color:#111;max-width:780px;margin:0 auto;">
        <div style="text-align:right;"><img src="${typeof window !== "undefined" ? window.location.origin : ""}/logo.jpg" width="150" style="width:150px;height:auto;"/></div>
        <div style="display:flex;justify-content:space-between;border-bottom:2px solid #1f4d3f;padding-bottom:8px;margin-top:8px;">
          <div><div style="font-size:18px;font-weight:bold;color:#1f4d3f;">FACTURA ${esc(num)}</div><div style="color:#555;">${data ? formatDataCa(data) : ""}</div></div>
          <div style="text-align:right;font-size:11px;color:#555;"><strong>${PROFESSIONAL.societat}</strong><br>CIF: ${PROFESSIONAL.cif}<br>${PROFESSIONAL.adreca}<br>${PROFESSIONAL.ciutat}</div>
        </div>
        <div style="margin:14px 0;">
          <strong>Client:</strong> ${esc(client?.nom)}${client?.nif ? ` — CIF/NIF: ${esc(client.nif)}` : ""}<br>
          ${expedient ? `<strong>Expedient:</strong> ${esc(expedient.num_expedient)} ${esc(expedient.projecte)}` : ""}
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#f2f4f2;"><th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Concepte</th><th style="padding:6px 8px;border:1px solid #ddd;text-align:right;width:140px;">Import</th></tr></thead>
          <tbody>
            <tr><td style="padding:6px 8px;border:1px solid #ddd;">Honoraris${expedient?.projecte ? ` — ${esc(expedient.projecte)}` : ""}</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:right;">${eur(n(preu))}</td></tr>
          </tbody>
          <tfoot>
            <tr><td style="padding:5px 8px;border:1px solid #ddd;text-align:right;">Base imposable</td><td style="padding:5px 8px;border:1px solid #ddd;text-align:right;">${eur(n(preu))}</td></tr>
            <tr><td style="padding:5px 8px;border:1px solid #ddd;text-align:right;">IVA (21%)</td><td style="padding:5px 8px;border:1px solid #ddd;text-align:right;">${eur(t.iva)}</td></tr>
            <tr style="font-weight:bold;"><td style="padding:5px 8px;border:1px solid #ddd;text-align:right;">Total</td><td style="padding:5px 8px;border:1px solid #ddd;text-align:right;">${eur(t.total)}</td></tr>
          </tfoot>
        </table>
        ${supRows ? `<div style="font-weight:bold;margin:14px 0 4px;">Suplits</div><table style="width:100%;border-collapse:collapse;"><tbody>${supRows}</tbody></table>` : ""}
        <div style="text-align:right;font-size:15px;font-weight:bold;color:#1f4d3f;margin-top:14px;">TOTAL FINAL: ${eur(t.totalFinal)}</div>
      </div>`;
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html lang="ca"><head><meta charset="utf-8"><title>Factura ${num}</title><style>@page{size:A4;margin:1.6cm;}body{margin:0;}</style></head><body>${body}</body></html>`);
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
        <div>
          <label className="label">Expedient</label>
          <Combobox options={expedientOpts} value={expedientId} onChange={pickExpedient} placeholder="Cerca expedient…" emptyLabel="Cap" overlay />
        </div>
        <div>
          <label className="label">Expedient (nom)</label>
          <div className="input bg-[var(--color-paper)] truncate">{expedient ? `${expedient.num_expedient} · ${expedient.projecte ?? "—"}` : "—"}</div>
        </div>
      </div>

      {/* Preu */}
      <div className="rounded-xl border border-[var(--color-line)] p-4 space-y-2">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Preu (base)</label>
            <input type="number" step="0.01" className="input text-right" value={preu} onChange={(e) => setPreu(e.target.value)} />
          </div>
          <div className="self-end text-sm text-[var(--color-muted)]">
            {expedient && <>Pressupost de l&apos;expedient: <span className="font-medium text-[var(--color-ink)]">{formatEur(expedient.pressupost)}</span>{alreadyOnExp > 0.005 && <> · ja facturat en altres: <span className="font-medium text-amber-700">{formatEur(alreadyOnExp)}</span></>}</>}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t border-[var(--color-line)] pt-2 text-sm">
          <span className="text-[var(--color-muted)]">IVA (21%): <span className="text-[var(--color-ink)] tabular-nums">{formatEur(t.iva)}</span></span>
          <span className="text-[var(--color-muted)]">Total: <span className="text-[var(--color-ink)] tabular-nums">{formatEur(t.total)}</span></span>
          {supTotal > 0 && <span className="text-[var(--color-muted)]">Suplits: <span className="text-[var(--color-ink)] tabular-nums">{formatEur(supTotal)}</span></span>}
          <span className="font-semibold">Total final: <span className="tabular-nums">{formatEur(t.totalFinal)}</span></span>
        </div>
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
        <button type="button" className="btn-ghost disabled:opacity-50" onClick={generar} disabled={pendingSup || !emesa || !num.trim()} title={!emesa ? "Marca-la com a Facturada per generar-la" : undefined}>Generar factura</button>
        {emesa && <span className="ml-auto"><PagadaToggle id={factura.id} pagada={factura.pagada} /></span>}
      </div>
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

function StatsPanel({ factures, suplitsByFactura }: { factures: Factura[]; suplitsByFactura: Map<number, FacturaSuplit[]> }) {
  const rows = factures.filter((f) => f.estat === "emesa").map((f) => {
    const sup = (suplitsByFactura.get(f.id) ?? []).reduce((s, x) => s + n(x.import), 0);
    const t = totals(n(f.preu), sup);
    return { f, base: n(f.preu), ...t, sup };
  });
  const baseTotal = rows.reduce((s, r) => s + r.base, 0);
  const finalTotal = rows.reduce((s, r) => s + r.totalFinal, 0);
  const cobrat = rows.filter((r) => r.f.pagada).reduce((s, r) => s + r.totalFinal, 0);
  const pendent = finalTotal - cobrat;
  const nPagades = rows.filter((r) => r.f.pagada).length;

  const byClient = new Map<string, number>();
  for (const r of rows) byClient.set(r.f.client_nom ?? "(Sense client)", (byClient.get(r.f.client_nom ?? "(Sense client)") ?? 0) + r.totalFinal);
  const clientRows = Array.from(byClient, ([label, v]) => ({ label, value: v, color: "#6366f1", display: formatEur(v) })).sort((a, b) => b.value - a.value);

  const byMonth = new Map<string, number>();
  for (const r of rows) { if (r.f.data) { const k = r.f.data.slice(0, 7); byMonth.set(k, (byMonth.get(k) ?? 0) + r.totalFinal); } }
  const monthRows = Array.from(byMonth, ([label, v]) => ({ label, value: v, color: "#1f4d3f", display: formatEur(v) })).sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Factures emeses" value={String(rows.length)} accent="#1f4d3f" hint={`${nPagades} pagades`} />
        <KpiCard label="Total facturat" value={formatEur(finalTotal)} accent="#0ea5e9" hint="amb IVA i suplits" />
        <KpiCard label="Cobrat" value={formatEur(cobrat)} accent="#16a34a" />
        <KpiCard label="Pendent de cobrament" value={formatEur(pendent)} accent="#dc2626" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ChartCard title="Cobraments" meta="pagat / pendent">
          <GradientDonut
            segments={[
              { label: "Cobrat", value: Math.round(cobrat), color: "#16a34a", note: formatEur(cobrat) },
              { label: "Pendent", value: Math.round(pendent), color: "#dc2626", note: formatEur(pendent) },
            ]}
            centerValue={formatEur(finalTotal)}
            centerLabel="total"
          />
        </ChartCard>
        <ChartCard title="Per mes" meta="total final">
          <HBarChart bars={monthRows} />
        </ChartCard>
      </div>

      <ChartCard title="Per client" meta="total final">
        <HBarChart bars={clientRows} />
      </ChartCard>

      <p className="text-xs text-[var(--color-muted)]">Base imposable total (sense IVA): {formatEur(baseTotal)}</p>
    </div>
  );
}

function esc(s: string | null | undefined) {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function eur(v: number) {
  return new Intl.NumberFormat("ca-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(v);
}
