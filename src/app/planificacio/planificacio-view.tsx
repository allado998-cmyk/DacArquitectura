"use client";

import { useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { CATEGORY_BY_CODE, ESTAT, TIPUS, tipologiaSwatch } from "@/lib/expedients";
import { formatEur } from "@/lib/format";
import { updateExpedientDatesAction } from "@/app/expedients/actions";

export interface PlanItem {
  id: number;
  num_expedient: string;
  projecte: string | null;
  categoria: string | null;
  client_nom: string | null;
  ciutat: string | null;
  tipus: "public" | "privat";
  tipologia_nom: string | null;
  pressupost: string;
  data_inici: string | null;
  data_final: string | null;
  data_tancament: string | null;
  planned_hores: string;
  actual_hores: string;
}

export interface Visita {
  expedient_id: number;
  data: string;
}

const DAY_W = 30;
const LABEL_W = 240;
const BACK_DAYS = 14;
const FWD_DAYS = 42; // 6 weeks forward
const TOTAL = BACK_DAYS + FWD_DAYS; // 56 days
const MONTHS = ["Gen", "Feb", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Des"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function addDays(iso: string, delta: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}
function dayIndex(iso: string, startIso: string) {
  return Math.round((Date.parse(`${iso}T00:00:00`) - Date.parse(`${startIso}T00:00:00`)) / 86400000);
}
function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d, dt: new Date(y, m - 1, d) };
}
function fmtShort(iso: string | null) {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
function fmtHores(v: string | number | null | undefined) {
  const n = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 2 }).format(Math.round((n || 0) * 100) / 100) + " h";
}

export function PlanificacioView({ items, visites, today }: { items: PlanItem[]; visites: Visita[]; today: string }) {
  const [editing, setEditing] = useState<PlanItem | null>(null);

  const start = useMemo(() => addDays(today, -BACK_DAYS), [today]);
  const days = useMemo(() => Array.from({ length: TOTAL }, (_, i) => addDays(start, i)), [start]);
  const todayIdx = BACK_DAYS;

  const visitsByExp = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const v of visites) {
      const idx = dayIndex(v.data, start);
      if (idx < 0 || idx > TOTAL - 1) continue;
      const arr = map.get(v.expedient_id) ?? [];
      arr.push(idx);
      map.set(v.expedient_id, arr);
    }
    return map;
  }, [visites, start]);

  const gridW = LABEL_W + DAY_W * TOTAL;

  const monthSegments: { label: string; span: number }[] = [];
  for (const iso of days) {
    const { m, y } = parts(iso);
    const label = `${MONTHS[m - 1]} ${y}`;
    const last = monthSegments[monthSegments.length - 1];
    if (last && last.label === label) last.span += 1;
    else monthSegments.push({ label, span: 1 });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--color-muted)]">
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-ink)]" /> Visita d&apos;obra</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-[var(--color-accent-soft)]" /> Avui</span>
        <span className="text-amber-700">⚠ sense dates de planificació</span>
      </div>

      <div className="rounded-2xl border border-[var(--color-line)] bg-white shadow-sm overflow-x-auto">
        <div style={{ minWidth: gridW }}>
          {/* Month header */}
          <div className="flex border-b border-[var(--color-line)]">
            <div className="shrink-0" style={{ width: LABEL_W }} />
            {monthSegments.map((seg, i) => (
              <div key={i} className="border-l border-[var(--color-line)] px-2 py-1 text-xs font-medium text-[var(--color-muted)]" style={{ width: seg.span * DAY_W }}>
                {seg.label}
              </div>
            ))}
          </div>

          {/* Day header */}
          <div className="flex border-b border-[var(--color-line)]">
            <div className="sticky left-0 z-10 shrink-0 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]" style={{ width: LABEL_W }}>
              Expedient
            </div>
            {days.map((iso, i) => {
              const { dt, d } = parts(iso);
              const wd = dt.getDay();
              const weekend = wd === 0 || wd === 6;
              const isToday = i === todayIdx;
              return (
                <div
                  key={iso}
                  className="shrink-0 border-l border-[var(--color-line)] py-1 text-center text-[10px] leading-tight"
                  style={{ width: DAY_W, backgroundColor: isToday ? "var(--color-accent-soft)" : weekend ? "#f6f6f3" : undefined }}
                >
                  <div className="text-[var(--color-muted)]">{["dg", "dl", "dt", "dc", "dj", "dv", "ds"][wd]}</div>
                  <div className={isToday ? "font-bold text-[var(--color-accent)]" : "tabular-nums"}>{d}</div>
                </div>
              );
            })}
          </div>

          {/* Rows */}
          {items.length === 0 ? (
            <div className="px-3 py-6 text-sm text-[var(--color-muted)]">Cap expedient obert.</div>
          ) : (
            items.map((it) => {
              const missing = !it.data_inici || !it.data_final;
              const visitIdxs = visitsByExp.get(it.id) ?? [];
              const cat = it.categoria ? CATEGORY_BY_CODE[it.categoria] : null;
              const color = cat?.color ?? "#1f4d3f";

              let bar: { left: number; width: number } | null = null;
              if (it.data_inici && it.data_final) {
                const si = dayIndex(it.data_inici, start);
                const ei = Math.max(si, dayIndex(it.data_final, start));
                if (ei >= 0 && si <= TOTAL - 1) {
                  const clStart = Math.max(0, si);
                  const clEnd = Math.min(TOTAL - 1, ei);
                  bar = { left: clStart * DAY_W, width: (clEnd - clStart + 1) * DAY_W };
                }
              }

              return (
                <div key={it.id} className="flex items-stretch border-b border-[var(--color-line)] last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setEditing(it)}
                    className="sticky left-0 z-10 flex shrink-0 items-center gap-2 bg-white px-3 py-2 text-left hover:bg-[var(--color-paper)]"
                    style={{ width: LABEL_W }}
                  >
                    {missing && <span className="shrink-0 text-amber-600" title="Sense dates de planificació">⚠</span>}
                    <span className="truncate text-sm">
                      <span className="font-mono text-[var(--color-accent)]">{it.num_expedient}</span>{" "}
                      {it.projecte ?? <span className="text-[var(--color-muted)]">Sense projecte</span>}
                    </span>
                  </button>
                  <div className="relative shrink-0" style={{ width: DAY_W * TOTAL, minHeight: 40 }}>
                    <div className="absolute inset-0 flex">
                      {days.map((iso, i) => {
                        const wd = parts(iso).dt.getDay();
                        const weekend = wd === 0 || wd === 6;
                        return (
                          <div
                            key={iso}
                            className="border-l border-[var(--color-line)]"
                            style={{ width: DAY_W, backgroundColor: i === todayIdx ? "var(--color-accent-soft)" : weekend ? "#f9f9f7" : undefined }}
                          />
                        );
                      })}
                    </div>
                    {bar && (
                      <button
                        type="button"
                        onClick={() => setEditing(it)}
                        title={`${fmtShort(it.data_inici)} → ${fmtShort(it.data_final)}`}
                        className="absolute top-1/2 flex h-6 -translate-y-1/2 items-center overflow-hidden rounded-md px-2 text-xs font-medium text-white shadow-sm"
                        style={{ left: bar.left + 2, width: Math.max(bar.width - 4, 8), background: `linear-gradient(90deg, ${color}cc, ${color})` }}
                      >
                        <span className="truncate">{it.projecte ?? it.num_expedient}</span>
                      </button>
                    )}
                    {visitIdxs.map((idx, k) => (
                      <span
                        key={k}
                        title="Visita d'obra"
                        className="absolute top-1.5 z-20 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-white bg-[var(--color-ink)]"
                        style={{ left: idx * DAY_W + DAY_W / 2 }}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <ExpedientInfoModal item={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function ExpedientInfoModal({ item, onClose }: { item: PlanItem | null; onClose: () => void }) {
  return (
    <Modal
      open={item != null}
      onClose={onClose}
      wide
      title={
        item && (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-[var(--color-accent)]">{item.num_expedient}</span>
              <Badge swatch={TIPUS[item.tipus]} label={TIPUS[item.tipus].label} />
              <Badge swatch={ESTAT.obert} label={ESTAT.obert.label} dot />
            </div>
            <h3 className="text-base font-semibold">{item.projecte ?? "Sense projecte"}</h3>
          </div>
        )
      }
    >
      {item && <ExpedientInfo key={item.id} item={item} onClose={onClose} />}
    </Modal>
  );
}

function Badge({ swatch, label, dot }: { swatch: { bg: string; text: string; color: string }; label: string; dot?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap" style={{ backgroundColor: swatch.bg, color: swatch.text }}>
      {dot && <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: swatch.color }} />}
      {label}
    </span>
  );
}

function ExpedientInfo({ item, onClose }: { item: PlanItem; onClose: () => void }) {
  const [inici, setInici] = useState(item.data_inici ?? "");
  const [final, setFinal] = useState(item.data_final ?? "");
  const [pending, startTransition] = useTransition();

  const planned = parseFloat(item.planned_hores) || 0;
  const actual = parseFloat(item.actual_hores) || 0;
  const pct = planned > 0 ? Math.round((actual / planned) * 100) : null;
  const cat = item.categoria ? CATEGORY_BY_CODE[item.categoria] : null;

  function save() {
    startTransition(async () => {
      await updateExpedientDatesAction(item.id, inici, final);
      onClose();
    });
  }

  return (
    <div className="space-y-5">
      {/* Info */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <Info label="Client" value={item.client_nom ?? "—"} />
        <Info label="Ciutat" value={item.ciutat ?? "—"} />
        <Info label="Categoria">{cat ? <Badge swatch={cat} label={cat.label} /> : "—"}</Info>
        <Info label="Tipologia">{item.tipologia_nom ? <Badge swatch={tipologiaSwatch(item.tipologia_nom)} label={item.tipologia_nom} /> : "—"}</Info>
        <Info label="Pressupost" value={formatEur(item.pressupost)} />
        <Info label="Tancat el" value={fmtShort(item.data_tancament)} />
      </dl>

      {/* Hours planned vs actual */}
      {planned > 0 && (
        <div className="rounded-xl border border-[var(--color-line)] p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Hores: fetes vs planificades</span>
            <span className="text-sm font-semibold">{pct}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-[var(--color-line)]">
            <div className="h-3 rounded-full bg-[var(--color-accent)]" style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
          </div>
          <div className="mt-2 text-sm text-[var(--color-muted)]">
            {fmtHores(actual)} fetes de {fmtHores(planned)} planificades
          </div>
        </div>
      )}

      {/* Dates */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Dates de planificació</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Data inici</label>
            <input type="date" className="input" value={inici} onChange={(e) => setInici(e.target.value)} />
          </div>
          <div>
            <label className="label">Data final (previsió)</label>
            <input type="date" className="input" value={final} onChange={(e) => setFinal(e.target.value)} />
          </div>
        </div>
      </div>

      <button type="button" className="btn-primary w-full justify-center py-3 text-base" onClick={save} disabled={pending}>
        {pending ? "Desant…" : "Desar dates"}
      </button>
    </div>
  );
}

function Info({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</dt>
      <dd className="mt-0.5">{children ?? value}</dd>
    </div>
  );
}
