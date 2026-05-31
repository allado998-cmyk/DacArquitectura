"use client";

import { useMemo, useState, useTransition } from "react";
import { createDedicacioAction, deleteDedicacioAction } from "./actions";
import type { Dedicacio, Expedient } from "@/types/db";
import { Combobox, type ComboOption } from "@/components/combobox";
import { Modal } from "@/components/modal";
import { CATEGORIES, CATEGORY_BY_CODE } from "@/lib/expedients";
import { ChartCard, HBarChart, KpiCard, VBarChart } from "@/components/charts";

const ACCENT_RGB = "31, 77, 63";
const MONTHS_CA = [
  "Gener", "Febrer", "Març", "Abril", "Maig", "Juny",
  "Juliol", "Agost", "Setembre", "Octubre", "Novembre", "Desembre",
];
const WEEKDAYS_CA = ["dl", "dt", "dc", "dj", "dv", "ds", "dg"];
const ACTIVITAT_SUGGESTIONS = ["Treball de web", "Treball de factures", "Administració", "Formació", "Reunió interna"];

type Tab = "registre" | "estadistiques";
type Agrupacio = "dia" | "setmana" | "mes";

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function dateStr(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}
function firstWeekdayMonday(y: number, m: number) {
  return (new Date(y, m, 1).getDay() + 6) % 7;
}
function fmtHores(h: number) {
  return new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 2 }).format(Math.round(h * 100) / 100) + " h";
}
function formatDataLong(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("ca-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(y, m - 1, d));
}
function formatDataMig(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("ca-ES", { weekday: "short", day: "numeric", month: "short" }).format(new Date(y, m - 1, d));
}
function formatDataShort(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function addDays(iso: string, delta: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return dateStr(dt.getFullYear(), dt.getMonth(), dt.getDate());
}
function weekStart(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - day);
  return dateStr(dt.getFullYear(), dt.getMonth(), dt.getDate());
}
function targetLabel(d: Dedicacio) {
  return d.num_expedient ?? d.activitat ?? "—";
}

export function DedicacioView({
  expedients,
  dedicacions,
  tasques,
  today,
}: {
  expedients: Expedient[];
  dedicacions: Dedicacio[];
  tasques: string[];
  today: string;
}) {
  const [tab, setTab] = useState<Tab>("registre");

  // Search by number and project name (both live in the label).
  const expedientOpts: ComboOption[] = expedients.map((e) => ({
    id: e.id,
    label: e.projecte ? `${e.num_expedient} · ${e.projecte}` : e.num_expedient,
  }));

  const activitatSuggestions = useMemo(
    () =>
      Array.from(
        new Set([
          ...ACTIVITAT_SUGGESTIONS,
          ...dedicacions.map((d) => d.activitat ?? "").filter(Boolean),
        ]),
      ),
    [dedicacions],
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 mb-6 border-b border-[var(--color-line)]">
        <TabBtn current={tab} value="registre" onClick={setTab}>Registre</TabBtn>
        <TabBtn current={tab} value="estadistiques" onClick={setTab}>Estadístiques</TabBtn>
      </div>

      {tab === "registre" && (
        <div className="space-y-8">
          <EntryForm expedientOpts={expedientOpts} tasques={tasques} today={today} activitatSuggestions={activitatSuggestions} />
          <Last7Days dedicacions={dedicacions} today={today} />
          <Calendar dedicacions={dedicacions} today={today} />
        </div>
      )}
      {tab === "estadistiques" && <StatsTab dedicacions={dedicacions} expedients={expedients} today={today} />}
    </div>
  );
}

function TabBtn({
  children,
  value,
  current,
  onClick,
}: {
  children: React.ReactNode;
  value: Tab;
  current: Tab;
  onClick: (v: Tab) => void;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`px-4 py-2 text-sm border-b-2 -mb-px ${
        active
          ? "border-[var(--color-accent)] text-[var(--color-accent)] font-medium"
          : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-base font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-[var(--color-muted)]">{label}</div>
    </div>
  );
}

// ============================================================================
// Entry form
// ============================================================================

function EntryForm({
  expedientOpts,
  tasques,
  today,
  activitatSuggestions,
}: {
  expedientOpts: ComboOption[];
  tasques: string[];
  today: string;
  activitatSuggestions: string[];
}) {
  const [mode, setMode] = useState<"expedient" | "activitat">("expedient");
  const [data, setData] = useState(today);
  const [expedientId, setExpedientId] = useState<number | null>(null);
  const [activitat, setActivitat] = useState("");
  const [hores, setHores] = useState("");
  const [tasca, setTasca] = useState("");
  const [comentari, setComentari] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (mode === "expedient" && !expedientId) {
      setError("Selecciona un expedient.");
      return;
    }
    if (mode === "activitat" && !activitat.trim()) {
      setError("Indica l'activitat.");
      return;
    }
    const h = parseFloat(hores.replace(",", "."));
    if (!Number.isFinite(h) || h <= 0) {
      setError("Indica les hores dedicades.");
      return;
    }
    startTransition(async () => {
      await createDedicacioAction({
        expedientId: mode === "expedient" ? expedientId : null,
        activitat: mode === "activitat" ? activitat : "",
        data,
        hores: h,
        tasca,
        comentari,
      });
      setHores("");
      setTasca("");
      setComentari("");
      if (mode === "activitat") setActivitat("");
    });
  }

  return (
    <div className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold tracking-tight">Registrar dedicació</h2>
        <span className="text-sm text-[var(--color-muted)] capitalize">{formatDataLong(today)}</span>
      </div>

      <div className="mb-4 inline-flex rounded-md border border-[var(--color-line)] p-0.5 text-sm">
        <button
          type="button"
          className={`rounded px-3 py-1 ${mode === "expedient" ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-muted)]"}`}
          onClick={() => setMode("expedient")}
        >
          Expedient
        </button>
        <button
          type="button"
          className={`rounded px-3 py-1 ${mode === "activitat" ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-muted)]"}`}
          onClick={() => setMode("activitat")}
        >
          Altra activitat
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-12 items-end">
        <div className="md:col-span-2">
          <label className="label">Data</label>
          <input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="md:col-span-3">
          <label className="label">{mode === "expedient" ? "Expedient" : "Activitat"}</label>
          {mode === "expedient" ? (
            <Combobox
              options={expedientOpts}
              value={expedientId}
              onChange={setExpedientId}
              placeholder="Cerca per número o projecte…"
              emptyLabel="Selecciona…"
              allowEmpty={false}
              overlay
            />
          ) : (
            <>
              <input className="input" list="activitats-list" placeholder="Ex: Treball de web" value={activitat} onChange={(e) => setActivitat(e.target.value)} />
              <datalist id="activitats-list">
                {activitatSuggestions.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </>
          )}
        </div>
        <div className="md:col-span-1">
          <label className="label">Hores</label>
          <input type="number" step="0.25" min="0" className="input text-right" placeholder="5" value={hores} onChange={(e) => setHores(e.target.value)} />
        </div>
        <div className="md:col-span-3">
          <label className="label">Fent què</label>
          <input className="input" list="tasques-list" placeholder="Tasca…" value={tasca} onChange={(e) => setTasca(e.target.value)} />
          <datalist id="tasques-list">
            {tasques.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div className="md:col-span-3">
          <label className="label">Comentari</label>
          <input className="input" placeholder="Opcional" value={comentari} onChange={(e) => setComentari(e.target.value)} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={submit} disabled={pending}>
          {pending ? "Desant…" : "+ Afegir dedicació"}
        </button>
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>
    </div>
  );
}

// ============================================================================
// Últims 7 dies
// ============================================================================

function Last7Days({ dedicacions, today }: { dedicacions: Dedicacio[]; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -i));

  const byDate = useMemo(() => {
    const map = new Map<string, Dedicacio[]>();
    for (const d of dedicacions) {
      const arr = map.get(d.data) ?? [];
      arr.push(d);
      map.set(d.data, arr);
    }
    return map;
  }, [dedicacions]);

  return (
    <div className="card">
      <h2 className="text-lg font-semibold tracking-tight mb-4">Últims 7 dies</h2>
      <div className="space-y-4">
        {days.map((iso) => {
          const items = byDate.get(iso) ?? [];
          const sum = items.reduce((s, d) => s + (parseFloat(d.hores) || 0), 0);
          return (
            <div key={iso} className="grid gap-2 sm:grid-cols-[10rem_1fr]">
              <div className="flex items-start justify-between sm:block">
                <div className={`text-sm font-medium capitalize ${iso === today ? "text-[var(--color-accent)]" : ""}`}>
                  {formatDataMig(iso)}
                  {iso === today && <span className="ml-1 text-xs">(avui)</span>}
                </div>
                <div className="text-xs text-[var(--color-muted)] tabular-nums">{sum ? fmtHores(sum) : "—"}</div>
              </div>
              <div>
                {items.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted)]">Sense dedicació.</p>
                ) : (
                  <ul className="space-y-1">
                    {items.map((d) => (
                      <li key={d.id} className="flex items-baseline gap-2 text-sm">
                        <span className="font-mono text-xs text-[var(--color-muted)] w-28 shrink-0 truncate" title={targetLabel(d)}>{targetLabel(d)}</span>
                        <span className="font-medium tabular-nums w-14 shrink-0">{fmtHores(parseFloat(d.hores) || 0)}</span>
                        <span>{d.tasca ?? <span className="text-[var(--color-muted)]">—</span>}</span>
                        {d.comentari && <span className="text-[var(--color-muted)]">· {d.comentari}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Calendari (últims 3 mesos)
// ============================================================================

function cellStyle(hours: number, max: number): React.CSSProperties {
  if (!hours) return { backgroundColor: "#f1f1ee", color: "#b8b8b2" };
  const t = Math.min(1, hours / Math.max(1, max));
  const op = 0.3 + 0.7 * t;
  return { backgroundColor: `rgba(${ACCENT_RGB}, ${op})`, color: op > 0.55 ? "#fff" : "#1f4d3f" };
}

function Calendar({ dedicacions, today }: { dedicacions: Dedicacio[]; today: string }) {
  const [ty, tm] = today.split("-").map(Number);

  const months = useMemo(() => {
    const out: { year: number; month: number }[] = [];
    for (let i = 2; i >= 0; i--) {
      const dt = new Date(ty, tm - 1 - i, 1);
      out.push({ year: dt.getFullYear(), month: dt.getMonth() });
    }
    return out;
  }, [ty, tm]);

  const monthKeys = new Set(months.map((m) => `${m.year}-${pad(m.month + 1)}`));

  const hoursByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of dedicacions) {
      if (!monthKeys.has(d.data.slice(0, 7))) continue;
      map.set(d.data, (map.get(d.data) ?? 0) + (parseFloat(d.hores) || 0));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dedicacions, ty, tm]);

  const max = Math.max(0, ...hoursByDate.values());
  const total = Array.from(hoursByDate.values()).reduce((s, h) => s + h, 0);
  const dies = hoursByDate.size;

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold tracking-tight">Calendari · últims 3 mesos</h2>
        <div className="flex items-center gap-6 text-sm">
          <Stat label="Hores" value={fmtHores(total)} />
          <Stat label="Dies treballats" value={String(dies)} />
          <Stat label="Mitjana / dia" value={fmtHores(dies ? total / dies : 0)} />
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {months.map(({ year, month }) => (
          <MonthGrid key={`${year}-${month}`} year={year} month={month} hoursByDate={hoursByDate} max={max} today={today} />
        ))}
      </div>

      <Legend max={max} />
    </div>
  );
}

function MonthGrid({
  year,
  month,
  hoursByDate,
  max,
  today,
}: {
  year: number;
  month: number;
  hoursByDate: Map<string, number>;
  max: number;
  today: string;
}) {
  const lead = firstWeekdayMonday(year, month);
  const days = daysInMonth(year, month);
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  return (
    <div className="rounded-lg border border-[var(--color-line)] p-3">
      <div className="text-sm font-medium mb-2">{MONTHS_CA[month]} {year}</div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS_CA.map((w) => (
          <div key={w} className="text-center text-[10px] uppercase text-[var(--color-muted)]">{w}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />;
          const iso = dateStr(year, month, d);
          const hours = hoursByDate.get(iso) ?? 0;
          const isToday = iso === today;
          return (
            <div
              key={iso}
              title={hours ? `${formatDataShort(iso)} · ${fmtHores(hours)}` : formatDataShort(iso)}
              className={`flex aspect-square items-center justify-center rounded text-[11px] tabular-nums ${
                isToday ? "ring-2 ring-[var(--color-accent)] ring-offset-1" : ""
              }`}
              style={cellStyle(hours, max)}
            >
              {hours ? Math.round(hours) : d}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ max }: { max: number }) {
  const steps = [0, 0.25, 0.5, 0.75, 1].map((t) => t * Math.max(1, max));
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-xs text-[var(--color-muted)]">
      <span>Menys</span>
      {steps.map((h, i) => (
        <span key={i} className="inline-block h-3.5 w-3.5 rounded" style={cellStyle(h || (i === 0 ? 0 : 0.01), max)} />
      ))}
      <span>Més</span>
    </div>
  );
}

// ============================================================================
// Estadístiques
// ============================================================================

function StatsTab({
  dedicacions,
  expedients,
  today,
}: {
  dedicacions: Dedicacio[];
  expedients: Expedient[];
  today: string;
}) {
  const [fAny, setFAny] = useState("");
  const [fExpedient, setFExpedient] = useState<number | null>(null);
  const [fClient, setFClient] = useState("");
  const [fCategoria, setFCategoria] = useState("");
  const [agrupacio, setAgrupacio] = useState<Agrupacio>("setmana");
  const [fDia, setFDia] = useState("");
  const [popupDia, setPopupDia] = useState<string | null>(null);

  const anys = useMemo(
    () => Array.from(new Set(dedicacions.map((d) => d.data.slice(0, 4)))).sort().reverse(),
    [dedicacions],
  );
  const clientNoms = useMemo(
    () => Array.from(new Set(dedicacions.map((d) => d.client_nom ?? "").filter(Boolean))).sort((a, b) => a.localeCompare(b, "ca")),
    [dedicacions],
  );
  const expedientOpts: ComboOption[] = useMemo(() => {
    const ids = new Set(dedicacions.map((d) => d.expedient_id).filter((x): x is number => x != null));
    return expedients
      .filter((e) => ids.has(e.id))
      .map((e) => ({ id: e.id, label: e.projecte ? `${e.num_expedient} · ${e.projecte}` : e.num_expedient }));
  }, [dedicacions, expedients]);

  const filtered = useMemo(
    () =>
      dedicacions.filter((d) => {
        if (fAny && d.data.slice(0, 4) !== fAny) return false;
        if (fExpedient != null && d.expedient_id !== fExpedient) return false;
        if (fClient && (d.client_nom ?? "") !== fClient) return false;
        if (fCategoria && (d.categoria ?? "") !== fCategoria) return false;
        if (agrupacio === "dia" && fDia && d.data !== fDia) return false;
        return true;
      }),
    [dedicacions, fAny, fExpedient, fClient, fCategoria, agrupacio, fDia],
  );

  const totalHores = filtered.reduce((s, d) => s + (parseFloat(d.hores) || 0), 0);
  const dies = new Set(filtered.map((d) => d.data)).size;
  const nExpedients = new Set(filtered.map((d) => d.expedient_id).filter(Boolean)).size;

  // Per categoria
  const catRows = CATEGORIES.map((c) => ({
    label: c.label,
    color: c.color,
    hores: filtered.filter((d) => d.categoria === c.code).reduce((s, d) => s + (parseFloat(d.hores) || 0), 0),
  })).filter((r) => r.hores > 0);
  const senseCat = filtered.filter((d) => !d.categoria).reduce((s, d) => s + (parseFloat(d.hores) || 0), 0);
  if (senseCat > 0) catRows.push({ label: "Sense categoria", color: "#9ca3af", hores: senseCat });
  catRows.sort((a, b) => b.hores - a.hores);

  // Per client
  const clientMap = new Map<string, number>();
  for (const d of filtered) {
    const k = d.client_nom ?? "(Sense client)";
    clientMap.set(k, (clientMap.get(k) ?? 0) + (parseFloat(d.hores) || 0));
  }
  const clientRows = Array.from(clientMap, ([label, hores]) => ({ label, hores })).sort((a, b) => b.hores - a.hores);

  // Evolució
  const periodMap = new Map<string, number>();
  for (const d of filtered) {
    const key = agrupacio === "dia" ? d.data : agrupacio === "setmana" ? weekStart(d.data) : d.data.slice(0, 7);
    periodMap.set(key, (periodMap.get(key) ?? 0) + (parseFloat(d.hores) || 0));
  }
  const periodRows = Array.from(periodMap, ([key, hores]) => ({ key, hores })).sort((a, b) => a.key.localeCompare(b.key));
  function periodLabel(key: string) {
    if (agrupacio === "dia") return formatDataShort(key).slice(0, 5);
    if (agrupacio === "setmana") return formatDataShort(key).slice(0, 5);
    const [y, m] = key.split("-").map(Number);
    return `${MONTHS_CA[m - 1].slice(0, 3)} ${String(y).slice(2)}`;
  }

  const popupItems = popupDia ? dedicacions.filter((d) => d.data === popupDia) : [];

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <div className="rounded-2xl border border-[var(--color-line)] bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 items-end">
          <div>
            <label className="label">Any</label>
            <select className="input" value={fAny} onChange={(e) => setFAny(e.target.value)}>
              <option value="">Tots</option>
              {anys.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Projecte</label>
            <Combobox options={expedientOpts} value={fExpedient} onChange={setFExpedient} placeholder="Cerca…" emptyLabel="Tots" overlay />
          </div>
          <div>
            <label className="label">Client</label>
            <select className="input" value={fClient} onChange={(e) => setFClient(e.target.value)}>
              <option value="">Tots</option>
              {clientNoms.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Categoria</label>
            <select className="input" value={fCategoria} onChange={(e) => setFCategoria(e.target.value)}>
              <option value="">Totes</option>
              {CATEGORIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Agrupació</label>
            <select className="input" value={agrupacio} onChange={(e) => setAgrupacio(e.target.value as Agrupacio)}>
              <option value="dia">Per dia</option>
              <option value="setmana">Per setmana</option>
              <option value="mes">Per mes</option>
            </select>
          </div>
          <div>
            <label className="label">Veure un dia</label>
            <div className="flex gap-2">
              <input
                type="date"
                className="input"
                value={fDia}
                onChange={(e) => setFDia(e.target.value)}
              />
              <button
                type="button"
                className="btn-ghost px-3 shrink-0"
                disabled={!fDia}
                onClick={() => fDia && setPopupDia(fDia)}
              >
                Obrir
              </button>
            </div>
          </div>
        </div>
        {agrupacio === "dia" && fDia && (
          <p className="mt-2 text-xs text-[var(--color-muted)]">Mostrant només el dia {formatDataShort(fDia)}.</p>
        )}
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Hores totals" value={fmtHores(totalHores)} accent="#1f4d3f" />
        <KpiCard label="Dies treballats" value={String(dies)} accent="#0ea5e9" />
        <KpiCard label="Expedients" value={String(nExpedients)} accent="#a855f7" />
        <KpiCard label="Mitjana / dia" value={fmtHores(dies ? totalHores / dies : 0)} accent="#f59e0b" />
      </div>

      {/* Categoria + Client */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Hores per categoria">
          <HBarChart bars={catRows.map((r) => ({ label: r.label, value: r.hores, color: r.color, display: fmtHores(r.hores) }))} />
        </ChartCard>
        <ChartCard title="Hores per client">
          <HBarChart bars={clientRows.map((r) => ({ label: r.label, value: r.hores, color: "#6366f1", display: fmtHores(r.hores) }))} />
        </ChartCard>
      </div>

      {/* Evolució */}
      <ChartCard title="Evolució" meta={agrupacio === "dia" ? "per dia" : agrupacio === "setmana" ? "per setmana" : "per mes"}>
        <VBarChart bars={periodRows.map((p) => ({ label: periodLabel(p.key), value: p.hores, color: "#8b5cf6", display: fmtHores(p.hores) }))} />
      </ChartCard>

      {/* Detall */}
      <ChartCard title="Detall" meta={`${filtered.length} registres`}>
        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">Sense dades.</p>
        ) : (
          <div className="table-wrap">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th w-28">Data</th>
                  <th className="th w-28">Expedient</th>
                  <th className="th">Projecte / activitat</th>
                  <th className="th w-36">Categoria</th>
                  <th className="th">Client</th>
                  <th className="th">Tasca</th>
                  <th className="th w-20 text-right">Hores</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const cat = d.categoria ? CATEGORY_BY_CODE[d.categoria] : null;
                  return (
                    <tr key={d.id}>
                      <td className="td tabular-nums">{formatDataShort(d.data)}</td>
                      <td className="td font-mono">{d.num_expedient ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                      <td className="td">{d.projecte ?? d.activitat ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                      <td className="td">
                        {cat ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: cat.bg, color: cat.text }}>
                            {cat.label}
                          </span>
                        ) : (
                          <span className="text-[var(--color-muted)]">—</span>
                        )}
                      </td>
                      <td className="td">{d.client_nom ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                      <td className="td">{d.tasca ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                      <td className="td text-right tabular-nums">{fmtHores(parseFloat(d.hores) || 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      <DiaModal dia={popupDia} items={popupItems} onClose={() => setPopupDia(null)} />
    </div>
  );
}

function DiaModal({ dia, items, onClose }: { dia: string | null; items: Dedicacio[]; onClose: () => void }) {
  const [, startTransition] = useTransition();
  const total = items.reduce((s, d) => s + (parseFloat(d.hores) || 0), 0);
  return (
    <Modal
      open={dia != null}
      onClose={onClose}
      wide
      title={
        dia && (
          <div>
            <h3 className="text-base font-semibold capitalize">{formatDataLong(dia)}</h3>
            <span className="text-sm text-[var(--color-muted)]">{fmtHores(total)} · {items.length} registres</span>
          </div>
        )
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">Sense dedicació aquest dia.</p>
      ) : (
        <div className="table-wrap">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th w-28">Expedient</th>
                <th className="th">Projecte / activitat</th>
                <th className="th">Tasca</th>
                <th className="th">Comentari</th>
                <th className="th w-20 text-right">Hores</th>
                <th className="th w-8"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td className="td font-mono">{d.num_expedient ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                  <td className="td">{d.projecte ?? d.activitat ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                  <td className="td">{d.tasca ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                  <td className="td text-[var(--color-muted)]">{d.comentari ?? ""}</td>
                  <td className="td text-right tabular-nums">{fmtHores(parseFloat(d.hores) || 0)}</td>
                  <td className="td text-right">
                    <button
                      type="button"
                      className="text-red-700 hover:underline text-xs"
                      onClick={() => {
                        if (confirm("Eliminar aquesta dedicació?")) {
                          startTransition(() => deleteDedicacioAction(d.id));
                        }
                      }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
