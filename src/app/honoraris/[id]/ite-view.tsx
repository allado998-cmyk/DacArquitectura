"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { updateIteAction, updatePropostaAction, type IteUpdate } from "./actions";
import { formatEur } from "@/lib/format";
import type { Client, IteTarifa, Proposta } from "@/types/db";

function n(v: string | number | null | undefined): number {
  if (v == null || v === "") return 0;
  const x = typeof v === "string" ? parseFloat(v.replace(",", ".")) : v;
  return Number.isFinite(x) ? x : 0;
}
function fmt2(v: number) {
  return new Intl.NumberFormat("ca-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
}

// Entitats equivalents = mult × UT. (Habitatges & <200 use mult 1, then 2/3/4/5.)
type UtKey = "ut_habitatges" | "ut_locals_200" | "ut_locals_400" | "ut_locals_600" | "ut_locals_800" | "ut_locals_1000";
const ROWS: { key: UtKey; nom: string; mult: number }[] = [
  { key: "ut_habitatges", nom: "Nº d'Habitatges", mult: 1 },
  { key: "ut_locals_200", nom: "Nº de Locals < 200 m²", mult: 1 },
  { key: "ut_locals_400", nom: "Nº de Locals < 400 m²", mult: 2 },
  { key: "ut_locals_600", nom: "Nº de Locals < 600 m²", mult: 3 },
  { key: "ut_locals_800", nom: "Nº de Locals < 800 m²", mult: 4 },
  { key: "ut_locals_1000", nom: "Nº de Locals < 1000 m²", mult: 5 },
];

function itePreu(ent: number, t: { p1: number; p2: number; p3: number; inc: number }): number {
  if (ent < 6) return t.p1;
  if (ent < 11) return t.p2;
  return t.p3 + t.inc * (ent - 10);
}

export function IteView({ proposta, clients, tarifa, preuHoraIte }: { proposta: Proposta; clients: Client[]; tarifa: IteTarifa; preuHoraIte: string }) {
  const [data, setData] = useState(proposta.data);
  const [projecte, setProjecte] = useState(proposta.projecte ?? "");
  const [clientId, setClientId] = useState<number | "">(proposta.client_id ?? "");
  const [contacte, setContacte] = useState(proposta.contacte_prescriptor ?? "");
  const [override, setOverride] = useState<string>(proposta.total_honoraris_override ?? "");

  const [ut, setUt] = useState<Record<string, string>>({
    ut_habitatges: proposta.ut_habitatges ?? "0",
    ut_locals_200: proposta.ut_locals_200 ?? "0",
    ut_locals_400: proposta.ut_locals_400 ?? "0",
    ut_locals_600: proposta.ut_locals_600 ?? "0",
    ut_locals_800: proposta.ut_locals_800 ?? "0",
    ut_locals_1000: proposta.ut_locals_1000 ?? "0",
  });
  const [iva, setIva] = useState(proposta.ite_iva_pct ?? "21");
  const [comissioOn, setComissioOn] = useState(proposta.ite_comissio_activa);
  const [comissio, setComissio] = useState(proposta.ite_comissio_pct ?? "10");

  const [, startTransition] = useTransition();

  function persistHeader(patch: Parameters<typeof updatePropostaAction>[1] = {}) {
    startTransition(() => {
      updatePropostaAction(proposta.id, {
        data,
        projecte: projecte.trim() || null,
        client_id: clientId === "" ? null : clientId,
        contacte_prescriptor: contacte.trim() || null,
        total_honoraris_override: override === "" ? null : n(override),
        ...patch,
      });
    });
  }
  function persistIte(patch: IteUpdate) {
    startTransition(() => updateIteAction(proposta.id, patch));
  }

  const totalEntitats = ROWS.reduce((s, r) => s + r.mult * n(ut[r.key]), 0);
  const computedPreu = itePreu(totalEntitats, { p1: n(tarifa.preu_1) || 650, p2: n(tarifa.preu_2) || 750, p3: n(tarifa.preu_3) || 850, inc: n(tarifa.increment) });
  const effectivePreu = override === "" ? computedPreu : n(override);
  const ivaN = Math.max(0, n(iva));
  const comissioAmount = comissioOn ? effectivePreu * (Math.max(0, n(comissio)) / 100) : 0;
  const base = effectivePreu + comissioAmount;
  const ivaAmount = base * (ivaN / 100);
  const totalFacturar = base + ivaAmount;
  const despesaPerEntitat = totalEntitats > 0 ? totalFacturar / totalEntitats : 0;
  const rateIte = n(preuHoraIte);
  const maxHores = rateIte > 0 ? base / 2 / rateIte : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <Link href="/honoraris" className="text-sm text-[var(--color-muted)] hover:underline">← Tots els càlculs</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Càlcul ITE {proposta.num_proposta}</h1>
        </div>
        <span className="rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)]">ITE</span>
      </div>

      {/* Header */}
      <section className="card">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label">Data</label>
            <input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} onBlur={() => persistHeader({ data })} />
          </div>
          <div>
            <label className="label">Proposta núm.</label>
            <div className="input bg-[var(--color-paper)] font-mono">{proposta.num_proposta}</div>
          </div>
          <div>
            <label className="label">Projecte</label>
            <input type="text" className="input" placeholder="Nom del projecte" value={projecte} onChange={(e) => setProjecte(e.target.value)} onBlur={() => persistHeader({ projecte: projecte.trim() || null })} />
          </div>
          <div>
            <label className="label">Client</label>
            <select className="input" value={clientId === "" ? "" : clientId} onChange={(e) => { const v = e.target.value === "" ? "" : Number(e.target.value); setClientId(v); persistHeader({ client_id: v === "" ? null : v }); }}>
              <option value="">— Selecciona —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="label">Contacte Prescriptor</label>
            <input type="text" className="input" value={contacte} onChange={(e) => setContacte(e.target.value)} onBlur={() => persistHeader({ contacte_prescriptor: contacte || null })} />
          </div>
        </div>
      </section>

      {/* Relació d'entitats */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Relació d&apos;entitats</h2>
        <div className="table-wrap">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Nom</th>
                <th className="th w-40 text-center">UT</th>
                <th className="th w-48 text-right">Entitats equivalents</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => {
                const ent = r.mult * n(ut[r.key]);
                return (
                  <tr key={r.key}>
                    <td className="td">{r.nom}</td>
                    <td className="td">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        className="input text-right"
                        style={{ backgroundColor: "#fff9c4" }}
                        value={ut[r.key]}
                        onChange={(e) => setUt((p) => ({ ...p, [r.key]: e.target.value }))}
                        onBlur={() => persistIte({ [r.key]: n(ut[r.key]) } as IteUpdate)}
                      />
                    </td>
                    <td className="td text-right font-mono tabular-nums">{fmt2(ent)}</td>
                  </tr>
                );
              })}
              <tr className="bg-[var(--color-paper)]">
                <td className="td font-semibold" colSpan={2}>Total entitats</td>
                <td className="td text-right font-semibold font-mono tabular-nums">{fmt2(totalEntitats)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Resum facturació */}
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">Resum facturació</h2>
        <div className="space-y-2 text-sm">
          {/* Preu ITE proposat — editable (rounded/negotiated) */}
          <div className="flex items-center justify-between gap-3">
            <span>Preu ITE proposat</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                className="input w-40 text-right"
                placeholder={fmt2(computedPreu)}
                value={override}
                onChange={(e) => setOverride(e.target.value)}
                onBlur={() => persistHeader()}
                title="Deixa-ho buit per fer servir el preu calculat automàticament"
              />
              <span className="font-mono">€</span>
            </div>
          </div>
          <p className="pl-0 text-xs text-[var(--color-muted)]">
            Calculat: {formatEur(computedPreu)} (segons total entitats). Deixa el camp buit per usar-lo, o escriu un preu per arrodonir-lo.
          </p>

          {/* Comissió (opcional) — s'afegeix al preu ITE proposat */}
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={comissioOn} onChange={(e) => { setComissioOn(e.target.checked); persistIte({ ite_comissio_activa: e.target.checked }); }} />
              <span>Comissió</span>
            </label>
            <div className="flex items-center gap-2">
              <input type="number" step="0.5" min="0" className="input w-20 text-right disabled:opacity-50" value={comissio} disabled={!comissioOn} onChange={(e) => setComissio(e.target.value)} onBlur={() => persistIte({ ite_comissio_pct: Math.max(0, n(comissio)) })} />
              <span>%</span>
              <span className="w-28 text-right font-mono tabular-nums">{formatEur(comissioAmount)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-2">
            <span className="font-semibold">Base imponible</span>
            <span className="font-mono font-semibold">{formatEur(base)}</span>
          </div>

          <SummaryPercent label="IVA" value={iva} amount={ivaAmount} onChange={setIva} onCommit={() => persistIte({ ite_iva_pct: Math.max(0, n(iva)) })} />

          <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-3">
            <span className="font-semibold">Total a facturar</span>
            <span className="font-mono font-semibold">{formatEur(totalFacturar)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold">Màxim d&apos;hores a treballar</span>
            <span className="font-mono font-semibold">{fmt2(maxHores)} h</span>
          </div>
          {rateIte <= 0 && (
            <p className="text-xs text-amber-700">Afegeix un concepte de Despeses Directes anomenat «ITE» amb el seu €/hora a Base de Dades per calcular les hores.</p>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-muted)]">Despesa per entitat (IVA inclòs)</span>
            <span className="font-mono">{formatEur(despesaPerEntitat)}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryPercent({ label, value, amount, onChange, onCommit }: { label: string; value: string; amount: number; onChange: (v: string) => void; onCommit: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <input type="number" step="0.5" min="0" className="input w-20 text-right" value={value} onChange={(e) => onChange(e.target.value)} onBlur={onCommit} />
        <span>%</span>
        <span className="w-28 text-right font-mono tabular-nums">{formatEur(amount)}</span>
      </div>
    </div>
  );
}
