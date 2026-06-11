"use client";

import { useMemo, useState, useTransition } from "react";
import { createDedicacioAction, deleteDedicacioAction, updateDedicacioAction } from "./actions";
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
const WEEKDAY_NAMES = ["Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte", "Diumenge"];

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
  const [showForm, setShowForm] = useState(false);

  // Search by number and project name (both live in the label).
  const expedientOpts: ComboOption[] = expedients.map((e) => ({
    id: e.id,
    label: e.projecte ? `${e.num_expedient} · ${e.projecte}` : e.num_expedient,
  }));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 mb-6 border-b border-[var(--color-line)]">
        <TabBtn current={tab} value="registre" onClick={setTab}>Registre</TabBtn>
        <TabBtn current={tab} value="estadistiques" onClick={setTab}>Estadístiques</TabBtn>
      </div>

      {tab === "registre" && (
        <div className="space-y-6">
          <button
            type="button"
            className="btn-primary w-full justify-center py-3.5 text-base sm:w-auto"
            onClick={() => setShowForm(true)}
          >
            + Nova dedicació
          </button>
          <Last7Days dedicacions={dedicacions} today={today} expedientOpts={expedientOpts} />
          <Calendar dedicacions={dedicacions} today={today} expedientOpts={expedientOpts} />
        </div>
      )}
      {tab === "estadistiques" && <StatsTab dedicacions={dedicacions} expedients={expedients} today={today} />}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={
          <div>
            <h3 className="text-base font-semibold">Registrar dedicació</h3>
            <span className="text-sm text-[var(--color-muted)] capitalize">{formatDataLong(today)}</span>
          </div>
        }
      >
        <EntryForm expedientOpts={expedientOpts} tasques={tasques} today={today} onDone={() => setShowForm(false)} />
      </Modal>
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
  onDone,
}: {
  expedientOpts: ComboOption[];
  tasques: string[];
  today: string;
  onDone: () => void;
}) {
  const [data, setData] = useState(today);
  const [expedientId, setExpedientId] = useState<number | null>(null);
  const [hores, setHores] = useState("");
  const [tasca, setTasca] = useState("");
  const [comentari, setComentari] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (!expedientId) {
      setError("Selecciona un expedient.");
      return;
    }
    const h = parseFloat(hores.replace(",", "."));
    if (!Number.isFinite(h) || h <= 0) {
      setError("Indica les hores dedicades.");
      return;
    }
    startTransition(async () => {
      await createDedicacioAction({ expedientId, activitat: "", data, hores: h, tasca, comentari });
      onDone();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Expedient</label>
        <Combobox
          options={expedientOpts}
          value={expedientId}
          onChange={setExpedientId}
          placeholder="Cerca per número o projecte…"
          emptyLabel="Selecciona…"
          allowEmpty={false}
          overlay
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Data</label>
          <input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div>
          <label className="label">Hores</label>
          <input type="number" inputMode="decimal" step="0.25" min="0" className="input text-right" placeholder="5" value={hores} onChange={(e) => setHores(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Fent què</label>
        <input className="input" list="tasques-list" placeholder="Tasca…" value={tasca} onChange={(e) => setTasca(e.target.value)} />
        <datalist id="tasques-list">
          {tasques.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="label">Comentari</label>
        <input className="input" placeholder="Opcional" value={comentari} onChange={(e) => setComentari(e.target.value)} />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="button" className="btn-primary w-full justify-center py-3 text-base" onClick={submit} disabled={pending}>
        {pending ? "Desant…" : "+ Afegir dedicació"}
      </button>
    </div>
  );
}

// ============================================================================
// Últims 7 dies
// ============================================================================

function dedTarget(d: Dedicacio) {
  return d.num_expedient ? `${d.num_expedient}${d.projecte ? ` · ${d.projecte}` : ""}` : d.activitat ?? "—";
}

function EditDeleteBtns({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      <button type="button" title="Editar" aria-label="Editar" className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--color-accent)] hover:bg-[var(--color-paper)]" onClick={onEdit}>✎</button>
      <button
        type="button"
        title="Eliminar"
        aria-label="Eliminar"
        className="inline-flex h-6 w-6 items-center justify-center rounded text-red-700 hover:bg-red-50"
        onClick={() => { if (confirm("Eliminar aquesta dedicació?")) onDelete(); }}
      >
        ✕
      </button>
    </span>
  );
}

function Last7Days({
  dedicacions,
  today,
  expedientOpts,
}: {
  dedicacions: Dedicacio[];
  today: string;
  expedientOpts: ComboOption[];
}) {
  const days = Array.from({ length: 4 }, (_, i) => addDays(today, -i));
  const [editing, setEditing] = useState<Dedicacio | null>(null);
  const [, startTransition] = useTransition();

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
      <h2 className="text-lg font-semibold tracking-tight mb-4">Avui i últims dies</h2>
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
                  <ul className="space-y-2">
                    {items.map((d) => {
                      const sub = [d.tasca, d.comentari].filter(Boolean).join(" · ");
                      return (
                        <li key={d.id} className="flex items-start gap-2 text-sm">
                          <span className="w-12 shrink-0 text-right font-semibold tabular-nums">{fmtHores(parseFloat(d.hores) || 0)}</span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{dedTarget(d)}</div>
                            {sub && <div className="truncate text-xs text-[var(--color-muted)]">{sub}</div>}
                          </div>
                          <EditDeleteBtns onEdit={() => setEditing(d)} onDelete={() => startTransition(() => deleteDedicacioAction(d.id))} />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <DedicacioEditModal d={editing} onClose={() => setEditing(null)} expedientOpts={expedientOpts} />
    </div>
  );
}

function DedicacioEditModal({
  d,
  onClose,
  expedientOpts,
}: {
  d: Dedicacio | null;
  onClose: () => void;
  expedientOpts: ComboOption[];
}) {
  return (
    <Modal
      open={d != null}
      onClose={onClose}
      title={d && <h3 className="text-base font-semibold">Editar dedicació</h3>}
    >
      {d && <DedicacioForm key={d.id} d={d} onClose={onClose} expedientOpts={expedientOpts} />}
    </Modal>
  );
}

function DedicacioForm({
  d,
  onClose,
  expedientOpts,
}: {
  d: Dedicacio;
  onClose: () => void;
  expedientOpts: ComboOption[];
}) {
  const [expedientId, setExpedientId] = useState<number | null>(d.expedient_id ?? null);
  const [data, setData] = useState(d.data);
  const [hores, setHores] = useState(d.hores);
  const [tasca, setTasca] = useState(d.tasca ?? "");
  const [comentari, setComentari] = useState(d.comentari ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    if (!expedientId) {
      setError("Selecciona un expedient.");
      return;
    }
    const h = parseFloat(hores);
    startTransition(async () => {
      await updateDedicacioAction(d.id, {
        data,
        hores: Number.isFinite(h) ? h : undefined,
        tasca,
        comentari,
        expedientId,
        activitat: "",
      });
      onClose();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Expedient</label>
          <Combobox options={expedientOpts} value={expedientId} onChange={setExpedientId} placeholder="Cerca per número o projecte…" emptyLabel="Selecciona…" allowEmpty={false} overlay />
        </div>
        <div>
          <label className="label">Data</label>
          <input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div>
          <label className="label">Hores</label>
          <input type="number" step="0.25" min="0" className="input text-right" value={hores} onChange={(e) => setHores(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Fent què</label>
          <input className="input" placeholder="Tasca…" value={tasca} onChange={(e) => setTasca(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Comentari</label>
          <input className="input" placeholder="Opcional" value={comentari} onChange={(e) => setComentari(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={save} disabled={pending}>{pending ? "Desant…" : "Desar"}</button>
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel·lar</button>
        {error && <span className="text-sm text-red-700">{error}</span>}
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

function Calendar({
  dedicacions,
  today,
  expedientOpts,
}: {
  dedicacions: Dedicacio[];
  today: string;
  expedientOpts: ComboOption[];
}) {
  const [ty, tm] = today.split("-").map(Number);
  const [offset, setOffset] = useState(0); // 0 = current month
  const [popupDia, setPopupDia] = useState<string | null>(null);

  const base = new Date(ty, tm - 1 + offset, 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const monthKey = `${year}-${pad(month + 1)}`;

  const hoursByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of dedicacions) {
      if (d.data.slice(0, 7) !== monthKey) continue;
      map.set(d.data, (map.get(d.data) ?? 0) + (parseFloat(d.hores) || 0));
    }
    return map;
  }, [dedicacions, monthKey]);

  const max = Math.max(0, ...hoursByDate.values());
  const total = Array.from(hoursByDate.values()).reduce((s, h) => s + h, 0);
  const dies = hoursByDate.size;

  const lead = firstWeekdayMonday(year, month);
  const days = daysInMonth(year, month);
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Calendari</h2>
          <button type="button" className="btn-ghost px-2 py-1" onClick={() => setOffset((o) => o - 1)}>‹</button>
          <span className="min-w-36 text-center text-sm font-medium">{MONTHS_CA[month]} {year}</span>
          <button type="button" className="btn-ghost px-2 py-1" onClick={() => setOffset((o) => o + 1)}>›</button>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <Stat label="Hores del mes" value={fmtHores(total)} />
          <Stat label="Dies treballats" value={String(dies)} />
          <Stat label="Mitjana / dia" value={fmtHores(dies ? total / dies : 0)} />
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS_CA.map((w) => (
          <div key={w} className="pb-1 text-center text-[11px] uppercase tracking-wide text-[var(--color-muted)]">{w}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />;
          const iso = dateStr(year, month, d);
          const hours = hoursByDate.get(iso) ?? 0;
          const isToday = iso === today;
          return (
            <button
              type="button"
              key={iso}
              onClick={() => setPopupDia(iso)}
              title={hours ? `${formatDataShort(iso)} · ${fmtHores(hours)}` : formatDataShort(iso)}
              className={`relative min-h-16 rounded-lg p-1.5 text-left transition hover:ring-2 hover:ring-[var(--color-accent)]/40 ${
                isToday ? "ring-2 ring-[var(--color-accent)] ring-offset-1" : ""
              }`}
              style={cellStyle(hours, max)}
            >
              <span className="absolute left-1.5 top-1 text-[11px] font-medium opacity-70">{d}</span>
              {hours > 0 && (
                <span className="flex h-full items-center justify-center text-sm font-semibold tabular-nums">
                  {fmtHores(hours)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Legend max={max} />

      <DayModal dia={popupDia} items={popupDia ? dedicacions.filter((d) => d.data === popupDia) : []} onClose={() => setPopupDia(null)} expedientOpts={expedientOpts} />
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
  const [dStart, setDStart] = useState("");
  const [dEnd, setDEnd] = useState("");
  const [showDetall, setShowDetall] = useState(false);

  function quickRange(kind: "dia" | "setmana" | "mes") {
    if (kind === "dia") setDStart(today);
    else if (kind === "setmana") setDStart(addDays(today, -6));
    else setDStart(addDays(today, -29));
    setDEnd(today);
  }

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
        if (dStart && d.data < dStart) return false;
        if (dEnd && d.data > dEnd) return false;
        return true;
      }),
    [dedicacions, fAny, fExpedient, fClient, fCategoria, dStart, dEnd],
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

  // Evolució — granularity auto-derived from the active date span.
  const spanDays = (() => {
    const dates = filtered.map((d) => d.data).sort();
    const from = dStart || dates[0];
    const to = dEnd || dates[dates.length - 1];
    if (!from || !to) return 0;
    return Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  })();
  const agrupacio: Agrupacio = spanDays <= 31 ? "dia" : spanDays <= 140 ? "setmana" : "mes";
  const periodMap = new Map<string, number>();
  for (const d of filtered) {
    const key = agrupacio === "dia" ? d.data : agrupacio === "setmana" ? weekStart(d.data) : d.data.slice(0, 7);
    periodMap.set(key, (periodMap.get(key) ?? 0) + (parseFloat(d.hores) || 0));
  }
  const periodRows = Array.from(periodMap, ([key, hores]) => ({ key, hores })).sort((a, b) => a.key.localeCompare(b.key));
  function periodLabel(key: string) {
    if (agrupacio === "mes") {
      const [y, m] = key.split("-").map(Number);
      return `${MONTHS_CA[m - 1].slice(0, 3)} ${String(y).slice(2)}`;
    }
    return formatDataShort(key).slice(0, 5);
  }

  // Per dia de la setmana — totals i mitjanes
  const weekdayAgg = WEEKDAY_NAMES.map((label) => ({ label, total: 0, dates: new Set<string>() }));
  for (const d of filtered) {
    const [y, m, da] = d.data.split("-").map(Number);
    const wd = (new Date(y, m - 1, da).getDay() + 6) % 7;
    weekdayAgg[wd].total += parseFloat(d.hores) || 0;
    weekdayAgg[wd].dates.add(d.data);
  }
  const weekdayRows = weekdayAgg.map((w) => ({ label: w.label, total: w.total, avg: w.dates.size ? w.total / w.dates.size : 0 }));
  const weekdayMaxAvg = Math.max(1, ...weekdayRows.map((w) => w.avg));

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <div className="rounded-2xl border border-[var(--color-line)] bg-white p-4 shadow-sm space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Des de</label>
            <input type="date" className="input" value={dStart} onChange={(e) => setDStart(e.target.value)} />
          </div>
          <div>
            <label className="label">Fins a</label>
            <input type="date" className="input" value={dEnd} onChange={(e) => setDEnd(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => quickRange("dia")}>Últim dia</button>
            <button type="button" className="btn-ghost" onClick={() => quickRange("setmana")}>Última setmana</button>
            <button type="button" className="btn-ghost" onClick={() => quickRange("mes")}>Últim mes</button>
            {(dStart || dEnd) && (
              <button type="button" className="text-sm text-[var(--color-muted)] hover:underline px-2" onClick={() => { setDStart(""); setDEnd(""); }}>
                Esborrar
              </button>
            )}
          </div>
        </div>
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

      {/* Per dia de la setmana */}
      <ChartCard title="Per dia de la setmana" meta="mitjana · total">
        <div className="space-y-3">
          {weekdayRows.map((w) => (
            <div key={w.label} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-sm">{w.label}</span>
              <div className="relative h-7 flex-1 rounded-full bg-[var(--color-paper)]">
                <div
                  className="flex h-7 items-center justify-end rounded-full pr-2"
                  style={{
                    width: `${Math.max((w.avg / weekdayMaxAvg) * 100, w.avg > 0 ? 8 : 0)}%`,
                    background: "linear-gradient(90deg, #c4b5fd 0%, #8b5cf6 100%)",
                  }}
                >
                  {w.avg > 0 && (
                    <span className="rounded-md bg-white/85 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-[var(--color-ink)]">
                      {fmtHores(w.avg)}
                    </span>
                  )}
                </div>
              </div>
              <span className="w-28 shrink-0 text-right text-xs text-[var(--color-muted)] tabular-nums">
                total {fmtHores(w.total)}
              </span>
            </div>
          ))}
        </div>
      </ChartCard>

      {/* Detall (collapsible) */}
      <div className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-sm">
        <button type="button" className="flex w-full items-center justify-between" onClick={() => setShowDetall((s) => !s)}>
          <span className="text-sm font-semibold tracking-tight">Detall <span className="font-normal text-[var(--color-muted)]">({filtered.length} registres)</span></span>
          <span className="text-sm text-[var(--color-accent)]">{showDetall ? "Amaga ▴" : "Mostra ▾"}</span>
        </button>
        {showDetall && (filtered.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-muted)]">Sense dades.</p>
        ) : (
          <div className="table-wrap mt-4">
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
        ))}
      </div>
    </div>
  );
}

function DayModal({
  dia,
  items,
  onClose,
  expedientOpts,
}: {
  dia: string | null;
  items: Dedicacio[];
  onClose: () => void;
  expedientOpts: ComboOption[];
}) {
  const [editing, setEditing] = useState<Dedicacio | null>(null);
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
                <th className="th w-20"></th>
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
                    <EditDeleteBtns onEdit={() => setEditing(d)} onDelete={() => startTransition(() => deleteDedicacioAction(d.id))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DedicacioEditModal d={editing} onClose={() => setEditing(null)} expedientOpts={expedientOpts} />
    </Modal>
  );
}
