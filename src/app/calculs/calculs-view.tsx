"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { createCalculAction, deleteCalculAction, duplicateCalculAction } from "./actions";
import { CALC_GROUPS, CALC_TYPES, calcType, type CalcTipus } from "@/lib/calculs";
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
// "tots": every calculation, whatever its type; "perfils": the profile and weld tables.
type Tab = CalcTipus | "tots" | "perfils";

function fmtData(iso: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

const isTab = (t: string | undefined): t is Tab => t === "tots" || t === "perfils" || CALC_TYPES.some((x) => x.tipus === t);

// The menu: every type in its group (Estintolaments, Biguetes, Inèrcies,
// Soldadures), then the reference tables. A sidebar from laptop width up, a
// grouped dropdown on a phone.
const MENU = [
  ...CALC_GROUPS.map((g) => ({ title: g, items: CALC_TYPES.filter((t) => t.group === g).map((t) => ({ tab: t.tipus as Tab, label: t.tab })) })),
  { title: "Referència", items: [{ tab: "perfils" as Tab, label: "Perfils i soldadures" }] },
].filter((g) => g.items.length > 0);

export function CalculsView({ calculs, expedients, initialTab }: { calculs: CalculRow[]; expedients: ExpedientOpt[]; initialTab?: string }) {
  const [tab, setTabState] = useState<Tab>(isTab(initialTab) ? initialTab : "tots");
  function setTab(t: Tab) {
    setTabState(t);
    window.history.replaceState(null, "", `/calculs?tab=${t}`);
  }

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of calculs) m.set(c.tipus, (m.get(c.tipus) ?? 0) + 1);
    return m;
  }, [calculs]);
  const count = (t: Tab) => (t === "tots" ? calculs.length : t === "perfils" ? null : counts.get(t) ?? 0);

  return (
    <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      {/* phone and tablet: one grouped dropdown */}
      <div className="mb-5 lg:hidden">
        <label className="label" htmlFor="calc-tipus">Tipus de càlcul</label>
        <select id="calc-tipus" className="input" value={tab} onChange={(e) => setTab(e.target.value as Tab)}>
          <option value="tots">Tots els càlculs ({calculs.length})</option>
          {MENU.map((g) => (
            <optgroup key={g.title} label={g.title}>
              {g.items.map((it) => (
                <option key={it.tab} value={it.tab}>{it.label}{count(it.tab) != null ? ` (${count(it.tab)})` : ""}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* laptop and up: sidebar */}
      <nav aria-label="Tipus de càlcul" className="hidden lg:sticky lg:top-4 lg:block">
        <NavItem active={tab === "tots"} onClick={() => setTab("tots")} count={calculs.length} strong>
          Tots els càlculs
        </NavItem>
        {MENU.map((g) => (
          <div key={g.title} className="mt-4">
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">{g.title}</div>
            {g.items.map((it) => (
              <NavItem key={it.tab} active={tab === it.tab} onClick={() => setTab(it.tab)} count={count(it.tab)}>
                {it.label}
              </NavItem>
            ))}
          </div>
        ))}
      </nav>

      <div className="min-w-0">
        {tab === "perfils" ? (
          <PerfilsRef />
        ) : (
          <CalcList key={tab} tipus={tab} rows={tab === "tots" ? calculs : calculs.filter((c) => c.tipus === tab)} expedients={expedients} />
        )}
      </div>
    </div>
  );
}

function NavItem({ active, onClick, count, strong, children }: { active: boolean; onClick: () => void; count: number | null; strong?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-start justify-between gap-2 rounded-md border-l-2 px-3 py-1.5 text-left text-sm leading-snug ${
        active
          ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] font-medium text-[var(--color-accent)]"
          : "border-transparent text-[var(--color-ink)] hover:bg-[var(--color-paper)]"
      } ${strong ? "font-medium" : ""}`}
    >
      <span>{children}</span>
      {count != null && (
        <span className={`mt-0.5 shrink-0 rounded-full px-1.5 text-[11px] tabular-nums ${count > 0 ? "bg-[var(--color-paper)] text-[var(--color-ink)]" : "text-[var(--color-muted)]"}`}>{count}</span>
      )}
    </button>
  );
}

function CalcList({ tipus, rows, expedients }: { tipus: CalcTipus | "tots"; rows: CalculRow[]; expedients: ExpedientOpt[] }) {
  const all = tipus === "tots";
  const t = all ? null : calcType(tipus);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(false);
  const [newTipus, setNewTipus] = useState<CalcTipus>(all ? CALC_TYPES[0].tipus : tipus);
  const [newExp, setNewExp] = useState<number | "">("");
  const [pending, startTransition] = useTransition();

  const withVerdict = useMemo(() => rows.map((r) => ({ ...r, v: verdict(calcType(r.tipus).compute(r.dades ?? {})) })), [rows]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return withVerdict;
    return withVerdict.filter((r) =>
      `${r.num ?? ""} ${r.expedient_num ?? ""} ${r.referencia ?? ""} ${r.projecte ?? ""} ${r.client ?? ""} ${r.situacio ?? ""} ${r.element ?? ""} ${all ? calcType(r.tipus).tab : ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [withVerdict, q, all]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t ? t.tab : "Tots els càlculs"}</h2>
          <p className="max-w-3xl text-sm text-[var(--color-muted)]">{t ? t.desc : "Tots els càlculs de tots els tipus. Tria un tipus al menú per veure'n només els d'aquell tipus."}</p>
        </div>
        <button className="btn-primary" onClick={() => setModal(true)}>+ Nou càlcul</button>
      </div>

      <input className="input w-72" placeholder={all ? "Cercar a tots els càlculs…" : "Cercar…"} value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th w-28">Núm</th>
              {all && <th className="th">Tipus</th>}
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
                <td className="td text-[var(--color-muted)]" colSpan={all ? 9 : 8}>Cap càlcul.</td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id}>
                  <td className="td font-mono">{c.num}</td>
                  {all && <td className="td text-sm">{calcType(c.tipus).tab}</td>}
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
            {all ? (
              <div className="mb-4 mt-3">
                <label className="label">Tipus de càlcul</label>
                <select className="input" value={newTipus} onChange={(e) => setNewTipus(e.target.value as CalcTipus)}>
                  {CALC_GROUPS.map((g) => (
                    <optgroup key={g} label={g}>
                      {CALC_TYPES.filter((x) => x.group === g).map((x) => <option key={x.tipus} value={x.tipus}>{x.tab}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            ) : (
              <p className="mb-4 text-sm text-[var(--color-muted)]">{t!.tab}</p>
            )}
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
              <button className="btn-primary" disabled={pending} onClick={() => startTransition(() => createCalculAction(all ? newTipus : tipus, newExp === "" ? null : newExp))}>
                {pending ? "Creant…" : "Crear càlcul"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
