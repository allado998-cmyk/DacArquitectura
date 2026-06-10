"use client";

import { useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { CATEGORY_BY_CODE } from "@/lib/expedients";
import { updateExpedientDatesAction } from "@/app/expedients/actions";

export interface PlanItem {
  id: number;
  num_expedient: string;
  projecte: string | null;
  categoria: string | null;
  client_nom: string | null;
  data_inici: string | null;
  data_final: string | null;
}

const DAY_W = 30;
const LABEL_W = 230;
const BACK_DAYS = 14;
const FWD_DAYS = 28;
const TOTAL = BACK_DAYS + FWD_DAYS; // 42 days
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
function fmtShort(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function PlanificacioView({ items, today }: { items: PlanItem[]; today: string }) {
  const [editing, setEditing] = useState<PlanItem | null>(null);

  const start = useMemo(() => addDays(today, -BACK_DAYS), [today]);
  const days = useMemo(() => Array.from({ length: TOTAL }, (_, i) => addDays(start, i)), [start]);
  const todayIdx = BACK_DAYS;

  const withDates = items.filter((it) => it.data_inici && it.data_final);
  const missing = items.filter((it) => !it.data_inici || !it.data_final);

  // Only the ones whose range intersects the visible window.
  const bars = withDates
    .map((it) => {
      const si = dayIndex(it.data_inici!, start);
      const ei = Math.max(si, dayIndex(it.data_final!, start));
      return { it, si, ei };
    })
    .filter((b) => b.ei >= 0 && b.si <= TOTAL - 1)
    .sort((a, b) => a.si - b.si || a.it.num_expedient.localeCompare(b.it.num_expedient));

  const gridW = LABEL_W + DAY_W * TOTAL;

  // Month label segments across the header.
  const monthSegments: { label: string; span: number }[] = [];
  for (const iso of days) {
    const { m, y } = parts(iso);
    const label = `${MONTHS[m - 1]} ${y}`;
    const last = monthSegments[monthSegments.length - 1];
    if (last && last.label === label) last.span += 1;
    else monthSegments.push({ label, span: 1 });
  }

  return (
    <div className="space-y-6">
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
          {bars.length === 0 ? (
            <div className="px-3 py-6 text-sm text-[var(--color-muted)]">Cap expedient obert amb dates dins del període.</div>
          ) : (
            bars.map(({ it, si, ei }) => {
              const clStart = Math.max(0, si);
              const clEnd = Math.min(TOTAL - 1, ei);
              const left = clStart * DAY_W;
              const width = (clEnd - clStart + 1) * DAY_W;
              const cat = it.categoria ? CATEGORY_BY_CODE[it.categoria] : null;
              const color = cat?.color ?? "#1f4d3f";
              return (
                <div key={it.id} className="flex items-stretch border-b border-[var(--color-line)] last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setEditing(it)}
                    className="sticky left-0 z-10 flex shrink-0 flex-col justify-center bg-white px-3 py-2 text-left hover:bg-[var(--color-paper)]"
                    style={{ width: LABEL_W }}
                  >
                    <span className="truncate text-sm font-medium">
                      <span className="font-mono text-[var(--color-accent)]">{it.num_expedient}</span>{" "}
                      {it.projecte ?? <span className="text-[var(--color-muted)]">Sense projecte</span>}
                    </span>
                    {it.client_nom && <span className="truncate text-xs text-[var(--color-muted)]">{it.client_nom}</span>}
                  </button>
                  <div className="relative shrink-0" style={{ width: DAY_W * TOTAL }}>
                    {/* grid + weekend + today background */}
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
                    {/* bar */}
                    <button
                      type="button"
                      onClick={() => setEditing(it)}
                      title={`${it.num_expedient} · ${it.projecte ?? ""} — ${fmtShort(it.data_inici!)} → ${fmtShort(it.data_final!)}`}
                      className="absolute top-1/2 flex h-6 -translate-y-1/2 items-center overflow-hidden rounded-md px-2 text-xs font-medium text-white shadow-sm"
                      style={{ left: left + 2, width: Math.max(width - 4, 8), background: `linear-gradient(90deg, ${color}cc, ${color})` }}
                    >
                      <span className="truncate">{it.projecte ?? it.num_expedient}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Missing-dates alert */}
      {missing.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="mb-2 text-sm font-semibold text-amber-800">
            ⚠ {missing.length} expedient{missing.length === 1 ? "" : "s"} obert{missing.length === 1 ? "" : "s"} sense dates de planificació
          </div>
          <p className="mb-3 text-xs text-amber-700">Fes clic per emplenar la data d&apos;inici i la data final (previsió).</p>
          <div className="flex flex-wrap gap-2">
            {missing.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => setEditing(it)}
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm hover:border-amber-500"
              >
                <span className="font-mono text-[var(--color-accent)]">{it.num_expedient}</span>{" "}
                <span className="text-[var(--color-muted)]">{it.projecte ?? "—"}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <DatesModal item={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function DatesModal({ item, onClose }: { item: PlanItem | null; onClose: () => void }) {
  return (
    <Modal
      open={item != null}
      onClose={onClose}
      title={
        item && (
          <div>
            <h3 className="text-base font-semibold">Dates de planificació</h3>
            <span className="text-sm text-[var(--color-muted)]">
              <span className="font-mono">{item.num_expedient}</span> · {item.projecte ?? "—"}
            </span>
          </div>
        )
      }
    >
      {item && <DatesForm key={item.id} item={item} onClose={onClose} />}
    </Modal>
  );
}

function DatesForm({ item, onClose }: { item: PlanItem; onClose: () => void }) {
  const [inici, setInici] = useState(item.data_inici ?? "");
  const [final, setFinal] = useState(item.data_final ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await updateExpedientDatesAction(item.id, inici, final);
      onClose();
    });
  }

  return (
    <div className="space-y-4">
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
      <button type="button" className="btn-primary w-full justify-center py-3 text-base" onClick={save} disabled={pending}>
        {pending ? "Desant…" : "Desar"}
      </button>
    </div>
  );
}
