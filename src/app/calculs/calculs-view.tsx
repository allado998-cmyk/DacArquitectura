"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { createCalculAction, deleteCalculAction, duplicateCalculAction } from "./actions";
import { CALC_TYPES, calcType, type CalcTipus } from "@/lib/calculs";
import { verdict } from "@/lib/calculs/common";
import { PerfilsRef } from "./perfils-ref";

export interface CalculRow {
  id: number;
  num: string | null;
  tipus: CalcTipus;
  expedient_id: number | null;
  referencia: string | null;
  projecte: string | null;
  client: string | null;
  situacio: string | null;
  element: string | null;
  data: string | null;
  versio: string | null;
  dades: Record<string, unknown>;
  expedient_num: string | null;
}
type ExpedientOpt = { id: number; num_expedient: string; projecte: string | null };
type Tab = CalcTipus | "perfils";

function fmtData(iso: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

export function CalculsView({ calculs, expedients, initialTab }: { calculs: CalculRow[]; expedients: ExpedientOpt[]; initialTab?: string }) {
  const [tab, setTabState] = useState<Tab>(initialTab === "perfils" || CALC_TYPES.some((t) => t.tipus === initialTab) ? (initialTab as Tab) : "paret");
  function setTab(t: Tab) {
    setTabState(t);
    window.history.replaceState(null, "", `/calculs?tab=${t}`);
  }

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of calculs) m.set(c.tipus, (m.get(c.tipus) ?? 0) + 1);
    return m;
  }, [calculs]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-1 border-b border-[var(--color-line)]">
        {CALC_TYPES.map((t) => (
          <TabBtn key={t.tipus} active={tab === t.tipus} onClick={() => setTab(t.tipus)}>
            {t.tab} ({counts.get(t.tipus) ?? 0})
          </TabBtn>
        ))}
        <TabBtn active={tab === "perfils"} onClick={() => setTab("perfils")}>
          Perfils i soldadures
        </TabBtn>
      </div>

      {tab === "perfils" ? (
        <PerfilsRef />
      ) : (
        <CalcList key={tab} tipus={tab} rows={calculs.filter((c) => c.tipus === tab)} expedients={expedients} />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm ${
        active ? "border-[var(--color-accent)] font-medium text-[var(--color-accent)]" : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function CalcList({ tipus, rows, expedients }: { tipus: CalcTipus; rows: CalculRow[]; expedients: ExpedientOpt[] }) {
  const t = calcType(tipus);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(false);
  const [newExp, setNewExp] = useState<number | "">("");
  const [pending, startTransition] = useTransition();

  const withVerdict = useMemo(() => rows.map((r) => ({ ...r, v: verdict(t.compute(r.dades ?? {})) })), [rows, t]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return withVerdict;
    return withVerdict.filter((r) => `${r.num ?? ""} ${r.expedient_num ?? ""} ${r.referencia ?? ""} ${r.projecte ?? ""} ${r.client ?? ""} ${r.situacio ?? ""} ${r.element ?? ""}`.toLowerCase().includes(needle));
  }, [withVerdict, q]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-[var(--color-muted)]">{t.desc}</p>
        <button className="btn-primary" onClick={() => setModal(true)}>+ Nou càlcul</button>
      </div>

      <input className="input w-72" placeholder="Cercar…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th w-28">Núm</th>
              <th className="th w-28">Expedient</th>
              <th className="th">Projecte</th>
              <th className="th">Element</th>
              <th className="th w-16 text-center">Versió</th>
              <th className="th w-28 text-right">Data</th>
              <th className="th w-36">Resultat</th>
              <th className="th w-48"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="td text-[var(--color-muted)]" colSpan={8}>Cap càlcul.</td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id}>
                  <td className="td font-mono">{c.num}</td>
                  <td className="td font-mono">{c.expedient_num ?? c.referencia ?? "—"}</td>
                  <td className="td">
                    <div>{c.projecte ?? ""}</div>
                    {c.client && <div className="text-xs text-[var(--color-muted)]">{c.client}</div>}
                  </td>
                  <td className="td">
                    <div>{c.element ?? ""}</div>
                    {c.situacio && <div className="text-xs text-[var(--color-muted)]">{c.situacio}</div>}
                  </td>
                  <td className="td text-center">{c.versio ?? ""}</td>
                  <td className="td text-right tabular-nums">{fmtData(c.data)}</td>
                  <td className="td">
                    {c.v.total === 0 ? (
                      <span className="text-xs text-[var(--color-muted)]">—</span>
                    ) : (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${c.v.ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                        {c.v.ok ? "Compleix" : `${c.v.failed} NO`}
                      </span>
                    )}
                  </td>
                  <td className="td">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/calculs/${c.id}`} className="text-[var(--color-accent)] hover:underline">Obrir</Link>
                      <form action={duplicateCalculAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <button type="submit" className="text-[var(--color-muted)] hover:underline">Duplicar</button>
                      </form>
                      <form action={deleteCalculAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <button type="submit" className="text-red-700 hover:underline" onClick={(e) => { if (!confirm(`Eliminar el càlcul ${c.num}?`)) e.preventDefault(); }}>Eliminar</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-lg font-semibold">Nou càlcul</h2>
            <p className="mb-4 text-sm text-[var(--color-muted)]">{t.tab}</p>
            <label className="label">Expedient relacionat</label>
            <select className="input" value={newExp === "" ? "" : newExp} onChange={(e) => setNewExp(e.target.value === "" ? "" : Number(e.target.value))}>
              <option value="">— Sense expedient —</option>
              {expedients.map((e) => (
                <option key={e.id} value={e.id}>{e.num_expedient}{e.projecte ? ` — ${e.projecte}` : ""}</option>
              ))}
            </select>
            <p className="mt-2 text-xs text-[var(--color-muted)]">L&apos;encapçalament (referència, projecte, adreça, ciutat i client) s&apos;omple amb les dades de l&apos;expedient.</p>
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn" onClick={() => setModal(false)} disabled={pending}>Cancel·lar</button>
              <button className="btn-primary" disabled={pending} onClick={() => startTransition(() => createCalculAction(tipus, newExp === "" ? null : newExp))}>
                {pending ? "Creant…" : "Crear càlcul"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
