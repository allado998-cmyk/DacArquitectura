"use client";

import { useMemo, useState, useTransition } from "react";
import { createDedicacioAction, deleteDedicacioAction } from "./actions";
import type { Dedicacio, Expedient } from "@/types/db";
import { Combobox, type ComboOption } from "@/components/combobox";
import { CATEGORY_BY_CODE } from "@/lib/expedients";

const ACCENT_RGB = "31, 77, 63"; // var(--color-accent) = #1f4d3f
const MONTHS_CA = [
  "Gener", "Febrer", "Març", "Abril", "Maig", "Juny",
  "Juliol", "Agost", "Setembre", "Octubre", "Novembre", "Desembre",
];
const WEEKDAYS_CA = ["dl", "dt", "dc", "dj", "dv", "ds", "dg"];

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
  return (new Date(y, m, 1).getDay() + 6) % 7; // 0 = Monday
}
function fmtHores(h: number) {
  const r = Math.round(h * 100) / 100;
  return new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 2 }).format(r) + " h";
}
function formatDataLong(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("ca-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}
function formatDataShort(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
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
  const currentYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(currentYear);

  const expedientOpts: ComboOption[] = expedients.map((e) => ({
    id: e.id,
    label: e.num_expedient,
    sub: e.projecte_nom ?? undefined,
  }));

  // Hours per date (full dataset), and per-year subset.
  const yearDedic = useMemo(
    () => dedicacions.filter((d) => d.data.startsWith(`${year}-`)),
    [dedicacions, year],
  );

  const hoursByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of yearDedic) {
      map.set(d.data, (map.get(d.data) ?? 0) + (parseFloat(d.hores) || 0));
    }
    return map;
  }, [yearDedic]);

  const maxDay = Math.max(0, ...hoursByDate.values());
  const totalYear = yearDedic.reduce((s, d) => s + (parseFloat(d.hores) || 0), 0);
  const diesTreballats = hoursByDate.size;

  const anysAmbDades = useMemo(
    () =>
      Array.from(new Set([currentYear, ...dedicacions.map((d) => Number(d.data.slice(0, 4)))])).sort(
        (a, b) => b - a,
      ),
    [dedicacions, currentYear],
  );

  return (
    <div className="space-y-8">
      <EntryForm expedientOpts={expedientOpts} tasques={tasques} today={today} />

      {/* Calendari anual */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Calendari {year}</h2>
            <div className="flex items-center gap-1">
              <button type="button" className="btn-ghost px-2 py-1" onClick={() => setYear((y) => y - 1)}>‹</button>
              <select
                className="input w-auto py-1"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {anysAmbDades.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <button type="button" className="btn-ghost px-2 py-1" onClick={() => setYear((y) => y + 1)}>›</button>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <Stat label="Hores l'any" value={fmtHores(totalYear)} />
            <Stat label="Dies treballats" value={String(diesTreballats)} />
            <Stat label="Mitjana / dia" value={fmtHores(diesTreballats ? totalYear / diesTreballats : 0)} />
          </div>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }, (_, m) => (
            <MonthGrid key={m} year={year} month={m} hoursByDate={hoursByDate} max={maxDay} today={today} />
          ))}
        </div>

        <Legend max={maxDay} />
      </div>

      {/* Dedicació per expedient */}
      <ExpedientsDedicacio expedients={expedients} dedicacions={dedicacions} />
    </div>
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
}: {
  expedientOpts: ComboOption[];
  tasques: string[];
  today: string;
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
      await createDedicacioAction({ expedientId, data, hores: h, tasca, comentari });
      setHores("");
      setTasca("");
      setComentari("");
    });
  }

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-semibold tracking-tight">Registrar dedicació</h2>
        <span className="text-sm text-[var(--color-muted)] capitalize">{formatDataLong(today)}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-12 items-end">
        <div className="md:col-span-2">
          <label className="label">Data</label>
          <input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="md:col-span-3">
          <label className="label">Expedient</label>
          <Combobox
            options={expedientOpts}
            value={expedientId}
            onChange={setExpedientId}
            placeholder="Cerca expedient…"
            emptyLabel="Selecciona…"
            allowEmpty={false}
          />
        </div>
        <div className="md:col-span-1">
          <label className="label">Hores</label>
          <input
            type="number"
            step="0.25"
            min="0"
            className="input text-right"
            placeholder="5"
            value={hores}
            onChange={(e) => setHores(e.target.value)}
          />
        </div>
        <div className="md:col-span-3">
          <label className="label">Fent què</label>
          <input
            className="input"
            list="tasques-list"
            placeholder="Tasca…"
            value={tasca}
            onChange={(e) => setTasca(e.target.value)}
          />
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
// Year calendar
// ============================================================================

function cellStyle(hours: number, max: number): React.CSSProperties {
  if (!hours) return { backgroundColor: "#f1f1ee", color: "#b8b8b2" };
  const t = Math.min(1, hours / Math.max(1, max));
  const op = 0.3 + 0.7 * t;
  return { backgroundColor: `rgba(${ACCENT_RGB}, ${op})`, color: op > 0.55 ? "#fff" : "#1f4d3f" };
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
      <div className="text-sm font-medium mb-2">{MONTHS_CA[month]}</div>
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
      <span className="ml-2">(nombres = hores aprox.)</span>
    </div>
  );
}

// ============================================================================
// Per-expedient breakdown
// ============================================================================

function ExpedientsDedicacio({
  expedients,
  dedicacions,
}: {
  expedients: Expedient[];
  dedicacions: Dedicacio[];
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const byExpedient = useMemo(() => {
    const map = new Map<number, Dedicacio[]>();
    for (const d of dedicacions) {
      const arr = map.get(d.expedient_id) ?? [];
      arr.push(d);
      map.set(d.expedient_id, arr);
    }
    return map;
  }, [dedicacions]);

  const rows = expedients
    .map((e) => {
      const items = byExpedient.get(e.id) ?? [];
      const total = items.reduce((s, d) => s + (parseFloat(d.hores) || 0), 0);
      return { exp: e, items, total };
    })
    .filter((r) => r.items.length > 0)
    .sort((a, b) => b.total - a.total);

  if (rows.length === 0) {
    return (
      <div className="card text-sm text-[var(--color-muted)]">
        Encara no hi ha cap dedicació registrada.
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold tracking-tight mb-4">Dedicació per expedient</h2>
      <div className="divide-y divide-[var(--color-line)]">
        {rows.map(({ exp, items, total }) => {
          const open = openId === exp.id;
          const cat = exp.categoria ? CATEGORY_BY_CODE[exp.categoria] : null;
          return (
            <div key={exp.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 py-3 text-left hover:bg-[var(--color-paper)] px-1 -mx-1 rounded"
                onClick={() => setOpenId(open ? null : exp.id)}
              >
                <span className="text-[var(--color-muted)] text-xs w-4">{open ? "▾" : "▸"}</span>
                <span className="font-mono text-sm w-20">{exp.num_expedient}</span>
                {cat && (
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: cat.color }} title={cat.label} />
                )}
                <span className="flex-1 truncate text-sm">
                  {exp.projecte_nom ?? <span className="text-[var(--color-muted)]">Sense projecte</span>}
                </span>
                <span className="text-xs text-[var(--color-muted)]">{items.length} dies</span>
                <span className="font-semibold tabular-nums w-20 text-right">{fmtHores(total)}</span>
              </button>

              {open && (
                <div className="pb-3 pl-9 pr-1">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[var(--color-muted)]">
                        <th className="text-left font-medium py-1 w-28">Data</th>
                        <th className="text-right font-medium py-1 w-20">Hores</th>
                        <th className="text-left font-medium py-1 pl-4">Tasca</th>
                        <th className="text-left font-medium py-1">Comentari</th>
                        <th className="py-1 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((d) => (
                        <tr key={d.id} className="border-t border-[var(--color-line)]">
                          <td className="py-1.5 tabular-nums">{formatDataShort(d.data)}</td>
                          <td className="py-1.5 text-right tabular-nums">{fmtHores(parseFloat(d.hores) || 0)}</td>
                          <td className="py-1.5 pl-4">{d.tasca ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                          <td className="py-1.5 text-[var(--color-muted)]">{d.comentari ?? ""}</td>
                          <td className="py-1.5 text-right">
                            <button
                              type="button"
                              className="text-red-700 hover:underline text-xs disabled:opacity-50"
                              disabled={pending}
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
                    <tfoot>
                      <tr className="border-t border-[var(--color-line)] font-semibold">
                        <td className="py-1.5">Total</td>
                        <td className="py-1.5 text-right tabular-nums">{fmtHores(total)}</td>
                        <td colSpan={3}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
