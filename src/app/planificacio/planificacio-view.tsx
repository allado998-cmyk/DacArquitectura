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
  direccio_obres: boolean;
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
  hores: string;
  comentari: string | null;
  ciutat: string | null;
}

interface VisitaPt {
  idx: number;
  data: string;
  hores: string;
  comentari: string | null;
  ciutat: string | null;
}

const LABEL_W = 220;
const BACK_DAYS = 14;
const FWD_DAYS = 42; // 6 weeks
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
function fmtLong(iso: string) {
  const { y, m, d, dt } = parts(iso);
  const wd = ["dg", "dl", "dt", "dc", "dj", "dv", "ds"][dt.getDay()];
  return `${wd} ${d} ${MONTHS[m - 1]} ${y}`;
}
function fmtHores(v: string | number | null | undefined) {
  const n = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 2 }).format(Math.round((n || 0) * 100) / 100) + " h";
}

export function PlanificacioView({ items, visites, today }: { items: PlanItem[]; visites: Visita[]; today: string }) {
  const [tab, setTab] = useState<"do" | "resta">("resta");
  const [weekOffset, setWeekOffset] = useState(0);
  const [editing, setEditing] = useState<PlanItem | null>(null);

  const start = useMemo(() => addDays(today, -BACK_DAYS + weekOffset * 7), [today, weekOffset]);
  const days = useMemo(() => Array.from({ length: TOTAL }, (_, i) => addDays(start, i)), [start]);
  const todayIdx = dayIndex(today, start);

  const visitsByExp = useMemo(() => {
    const map = new Map<number, VisitaPt[]>();
    for (const v of visites) {
      const idx = dayIndex(v.data, start);
      if (idx < 0 || idx > TOTAL - 1) continue;
      const arr = map.get(v.expedient_id) ?? [];
      arr.push({ idx, data: v.data, hores: v.hores, comentari: v.comentari, ciutat: v.ciutat });
      map.set(v.expedient_id, arr);
    }
    return map;
  }, [visites, start]);

  const visitCountByExp = useMemo(() => {
    const m = new Map<number, number>();
    for (const v of visites) m.set(v.expedient_id, (m.get(v.expedient_id) ?? 0) + 1);
    return m;
  }, [visites]);

  const doItems = items.filter((it) => it.direccio_obres);
  const restaItems = items.filter((it) => !it.direccio_obres);
  const shown = tab === "do" ? doItems : restaItems;

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
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-[var(--color-line)] p-0.5 text-sm">
          <TabBtn active={tab === "resta"} onClick={() => setTab("resta")}>Projectes ({restaItems.length})</TabBtn>
          <TabBtn active={tab === "do"} onClick={() => setTab("do")}>Direcció d&apos;obres ({doItems.length})</TabBtn>
        </div>
        <div className="hidden items-center gap-1 sm:flex">
          <button type="button" className="btn-ghost px-3 py-1.5" onClick={() => setWeekOffset((w) => w - 1)} title="Setmana anterior">‹</button>
          <button type="button" className="btn-ghost px-3 py-1.5 disabled:opacity-50" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>Avui</button>
          <button type="button" className="btn-ghost px-3 py-1.5" onClick={() => setWeekOffset((w) => w + 1)} title="Setmana següent">›</button>
        </div>
      </div>

      <div className="hidden flex-wrap items-center gap-4 text-xs text-[var(--color-muted)] sm:flex">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-white bg-[var(--color-accent)] shadow" /> Visita d&apos;obra
        </span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-[var(--color-accent-soft)]" /> Avui</span>
        <span className="text-amber-700">⚠ sense dates de planificació</span>
      </div>

      {/* Mobile: compact list */}
      <div className="space-y-2 sm:hidden">
        {shown.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-line)] bg-white p-4 text-sm text-[var(--color-muted)]">Cap expedient en aquesta vista.</div>
        ) : (
          shown.map((it) => (
            <MobileRow key={it.id} it={it} today={today} visites={visitCountByExp.get(it.id) ?? 0} onOpen={() => setEditing(it)} />
          ))
        )}
      </div>

      {/* Desktop: gantt */}
      <div className="hidden rounded-2xl border border-[var(--color-line)] bg-white shadow-sm sm:block">
        {/* Month header */}
        <div className="flex border-b border-[var(--color-line)]">
          <div className="shrink-0" style={{ width: LABEL_W }} />
          <div className="flex flex-1">
            {monthSegments.map((seg, i) => (
              <div key={i} className="border-l border-[var(--color-line)] px-2 py-0.5 text-xs font-medium text-[var(--color-muted)]" style={{ flexGrow: seg.span, flexBasis: 0 }}>
                {seg.label}
              </div>
            ))}
          </div>
        </div>

        {/* Day header */}
        <div className="flex border-b border-[var(--color-line)]">
          <div className="shrink-0 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]" style={{ width: LABEL_W }}>Expedient</div>
          <div className="flex flex-1">
            {days.map((iso, i) => {
              const { dt, d } = parts(iso);
              const wd = dt.getDay();
              const weekend = wd === 0 || wd === 6;
              const isToday = i === todayIdx;
              return (
                <div key={iso} className="flex-1 border-l border-[var(--color-line)] py-0.5 text-center text-[9px] leading-tight" style={{ backgroundColor: isToday ? "var(--color-accent-soft)" : weekend ? "#f6f6f3" : undefined }}>
                  <div className="text-[var(--color-muted)]">{["dg", "dl", "dt", "dc", "dj", "dv", "ds"][wd]}</div>
                  <div className={isToday ? "font-bold text-[var(--color-accent)]" : "tabular-nums"}>{d}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rows */}
        {shown.length === 0 ? (
          <div className="px-3 py-6 text-sm text-[var(--color-muted)]">Cap expedient en aquesta vista.</div>
        ) : (
          shown.map((it) => (
            <GanttRow key={it.id} it={it} vis={visitsByExp.get(it.id) ?? []} days={days} start={start} todayIdx={todayIdx} onOpen={() => setEditing(it)} />
          ))
        )}
      </div>

      <ExpedientInfoModal item={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function MobileRow({ it, today, visites, onOpen }: { it: PlanItem; today: string; visites: number; onOpen: () => void }) {
  const cat = it.categoria ? CATEGORY_BY_CODE[it.categoria] : null;
  const color = cat?.color ?? "#1f4d3f";
  const hasDates = !!(it.data_inici && it.data_final);
  let pct = 0;
  if (hasDates) {
    const span = dayIndex(it.data_final!, it.data_inici!);
    const elapsed = dayIndex(today, it.data_inici!);
    pct = span <= 0 ? (elapsed >= 0 ? 100 : 0) : Math.max(0, Math.min(100, (elapsed / span) * 100));
  }
  return (
    <button type="button" onClick={onOpen} className="block w-full rounded-xl border border-[var(--color-line)] bg-white p-3 text-left shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm">
          <span className="font-mono text-[var(--color-accent)]">{it.num_expedient}</span>{" "}
          {it.projecte ?? <span className="text-[var(--color-muted)]">Sense projecte</span>}
        </span>
        {!hasDates && <span className="shrink-0 text-amber-600" title="Sense dates">⚠</span>}
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        {hasDates ? `${fmtShort(it.data_inici)} → ${fmtShort(it.data_final)}` : "Sense dates de planificació"}
        {visites > 0 && ` · ${visites} visita${visites === 1 ? "" : "s"} d'obra`}
      </div>
      {hasDates && (
        <div className="mt-2 h-2 w-full rounded-full bg-[var(--color-line)]">
          <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      )}
    </button>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-md px-3 py-1.5 ${active ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"}`}>
      {children}
    </button>
  );
}

function GanttRow({
  it,
  vis,
  days,
  start,
  todayIdx,
  onOpen,
}: {
  it: PlanItem;
  vis: VisitaPt[];
  days: string[];
  start: string;
  todayIdx: number;
  onOpen: () => void;
}) {
  const [hover, setHover] = useState<VisitaPt | null>(null);
  const missing = !it.data_inici || !it.data_final;
  const cat = it.categoria ? CATEGORY_BY_CODE[it.categoria] : null;
  const color = cat?.color ?? "#1f4d3f";

  let bar: { leftPct: number; widthPct: number } | null = null;
  if (it.data_inici && it.data_final) {
    const si = dayIndex(it.data_inici, start);
    const ei = Math.max(si, dayIndex(it.data_final, start));
    if (ei >= 0 && si <= TOTAL - 1) {
      const clStart = Math.max(0, si);
      const clEnd = Math.min(TOTAL - 1, ei);
      bar = { leftPct: (clStart / TOTAL) * 100, widthPct: ((clEnd - clStart + 1) / TOTAL) * 100 };
    }
  }

  return (
    <div className="flex items-stretch border-b border-[var(--color-line)] last:border-b-0">
      <button type="button" onClick={onOpen} className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-left hover:bg-[var(--color-paper)]" style={{ width: LABEL_W }}>
        {missing && <span className="shrink-0 text-amber-600" title="Sense dates de planificació">⚠</span>}
        <span className="truncate text-xs">
          <span className="font-mono text-[var(--color-accent)]">{it.num_expedient}</span>{" "}
          {it.projecte ?? <span className="text-[var(--color-muted)]">Sense projecte</span>}
        </span>
      </button>
      <div className="relative flex flex-1" style={{ minHeight: 30 }}>
        {days.map((iso, i) => {
          const wd = parts(iso).dt.getDay();
          const weekend = wd === 0 || wd === 6;
          return <div key={iso} className="flex-1 border-l border-[var(--color-line)]" style={{ backgroundColor: i === todayIdx ? "var(--color-accent-soft)" : weekend ? "#f9f9f7" : undefined }} />;
        })}
        {bar && (
          <button
            type="button"
            onClick={onOpen}
            title={`${fmtShort(it.data_inici)} → ${fmtShort(it.data_final)}`}
            className="absolute top-1/2 flex h-4 -translate-y-1/2 items-center overflow-hidden rounded px-1.5 text-[11px] font-medium text-white"
            style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%`, background: `linear-gradient(90deg, ${color}cc, ${color})` }}
          >
            <span className="truncate">{it.projecte ?? it.num_expedient}</span>
          </button>
        )}
        {vis.map((v, k) => (
          <button
            key={k}
            type="button"
            onMouseEnter={() => setHover(v)}
            onMouseLeave={() => setHover((h) => (h === v ? null : h))}
            className="absolute top-1/2 z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--color-accent)] shadow transition hover:scale-150"
            style={{ left: `${((v.idx + 0.5) / TOTAL) * 100}%` }}
            aria-label="Visita d'obra"
          />
        ))}
        {hover && (
          <div
            className="pointer-events-none absolute bottom-full z-30 mb-1 w-48 -translate-x-1/2 rounded-lg border border-[var(--color-line)] bg-white p-2 text-xs shadow-lg"
            style={{ left: `${((hover.idx + 0.5) / TOTAL) * 100}%` }}
          >
            <div className="font-semibold text-[var(--color-accent)]">Visita d&apos;obra</div>
            <div className="capitalize">{fmtLong(hover.data)}</div>
            <div className="text-[var(--color-muted)]">{fmtHores(hover.hores)}{hover.ciutat ? ` · ${hover.ciutat}` : ""}</div>
            {hover.comentari && <div className="mt-0.5 text-[var(--color-muted)]">{hover.comentari}</div>}
          </div>
        )}
      </div>
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
              {item.direccio_obres && <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]">Direcció d&apos;obres</span>}
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
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <Info label="Client" value={item.client_nom ?? "—"} />
        <Info label="Ciutat" value={item.ciutat ?? "—"} />
        <Info label="Categoria">{cat ? <Badge swatch={cat} label={cat.label} /> : "—"}</Info>
        <Info label="Tipologia">{item.tipologia_nom ? <Badge swatch={tipologiaSwatch(item.tipologia_nom)} label={item.tipologia_nom} /> : "—"}</Info>
        <Info label="Pressupost" value={formatEur(item.pressupost)} />
        <Info label="Tancat el" value={fmtShort(item.data_tancament)} />
      </dl>

      {planned > 0 && (
        <div className="rounded-xl border border-[var(--color-line)] p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Hores: fetes vs planificades</span>
            <span className="text-sm font-semibold">{pct}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-[var(--color-line)]">
            <div className="h-3 rounded-full bg-[var(--color-accent)]" style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
          </div>
          <div className="mt-2 text-sm text-[var(--color-muted)]">{fmtHores(actual)} fetes de {fmtHores(planned)} planificades</div>
        </div>
      )}

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
