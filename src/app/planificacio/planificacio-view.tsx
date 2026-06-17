"use client";

import { useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { formatEur } from "@/lib/format";
import { updateExpedientDatesAction } from "@/app/expedients/actions";
import { addFitaAction, deleteFitaAction, updateFitaTipusColorAction } from "./actions";

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
export interface Fita {
  id: number;
  expedient_id: number;
  data: string;
  tipus_id: number;
  nom: string;
  forma: string;
  color: string;
}
export interface FitaTipus {
  id: number;
  nom: string;
  forma: string;
  color: string;
}

const LABEL_W = 220;
const HOURS_W = 108;
const BACK_DAYS = 14;
const FWD_DAYS = 42;
const TOTAL = BACK_DAYS + FWD_DAYS;
const MONTHS = ["Gen", "Feb", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Des"];
const COLOR_DO = "#14b8a6"; // docència — turquoise
const COLOR_DIR = "#dc2626"; // direcció d'obres — vermell
const COLOR_REST = "#2563eb"; // resta — blau
const FITA_COLOR = "#facc15"; // default yellow — high contrast on the bars
// Neutral dark halo so any fill colour stays legible both on the coloured bars
// and on the white gaps between them.
const FITA_GLOW = "drop-shadow(0 0 1px rgba(0,0,0,0.9)) drop-shadow(0 0 3px rgba(0,0,0,0.55))";
const VISITA_GLOW = "0 0 0 2px #fff, 0 0 7px 2px rgba(31,77,63,0.85)";
const FORMES: { value: string; label: string }[] = [
  { value: "diamond", label: "Diamant" },
  { value: "circle", label: "Cercle" },
  { value: "square", label: "Quadrat" },
  { value: "triangle", label: "Triangle" },
  { value: "star", label: "Estrella" },
];
// Saturated colours that read clearly over the teal / red / blue bars and over
// the white gaps between them. (Avoids pale tones that vanish on the bars.)
const FITA_COLORS: { value: string; label: string }[] = [
  { value: "#facc15", label: "Groc" },
  { value: "#f97316", label: "Taronja" },
  { value: "#ec4899", label: "Rosa" },
  { value: "#a855f7", label: "Lila" },
  { value: "#84cc16", label: "Llima" },
  { value: "#ffffff", label: "Blanc" },
];

type TabKey = "resta" | "do" | "docencia" | "tots";

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
  return `${["dg", "dl", "dt", "dc", "dj", "dv", "ds"][dt.getDay()]} ${d} ${MONTHS[m - 1]} ${y}`;
}
function fmtHores(v: string | number | null | undefined) {
  const n = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 2 }).format(Math.round((n || 0) * 100) / 100) + " h";
}
function hc(v: string | number | null | undefined) {
  const n = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return new Intl.NumberFormat("ca-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0) + "h";
}
function itemColor(it: PlanItem) {
  if (it.categoria === "do") return COLOR_DO;
  if (it.direccio_obres) return COLOR_DIR;
  return COLOR_REST;
}

function Shape({ forma, color, size = 13 }: { forma: string; color: string; size?: number }) {
  const s = size;
  const stroke = "#fff";
  if (forma === "circle") return <svg width={s} height={s}><circle cx={s / 2} cy={s / 2} r={s / 2 - 1} fill={color} stroke={stroke} /></svg>;
  if (forma === "square") return <svg width={s} height={s}><rect x={1} y={1} width={s - 2} height={s - 2} rx={1.5} fill={color} stroke={stroke} /></svg>;
  if (forma === "triangle") return <svg width={s} height={s}><polygon points={`${s / 2},1 ${s - 1},${s - 1} 1,${s - 1}`} fill={color} stroke={stroke} /></svg>;
  if (forma === "star") return (
    <svg width={s} height={s} viewBox="0 0 24 24"><path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z" fill={color} stroke={stroke} strokeWidth="1" /></svg>
  );
  return <svg width={s} height={s}><rect x={s * 0.2} y={s * 0.2} width={s * 0.6} height={s * 0.6} transform={`rotate(45 ${s / 2} ${s / 2})`} fill={color} stroke={stroke} /></svg>;
}

export function PlanificacioView({
  items,
  visites,
  fites,
  fitaTipus,
  today,
}: {
  items: PlanItem[];
  visites: Visita[];
  fites: Fita[];
  fitaTipus: FitaTipus[];
  today: string;
}) {
  const [tab, setTab] = useState<TabKey>("tots");
  const [weekOffset, setWeekOffset] = useState(0);
  const [editing, setEditing] = useState<PlanItem | null>(null);

  const start = useMemo(() => addDays(today, -BACK_DAYS + weekOffset * 7), [today, weekOffset]);
  const days = useMemo(() => Array.from({ length: TOTAL }, (_, i) => addDays(start, i)), [start]);
  const todayIdx = dayIndex(today, start);

  const visitsByExp = useMemo(() => {
    const map = new Map<number, Visita[]>();
    for (const v of visites) (map.get(v.expedient_id) ?? map.set(v.expedient_id, []).get(v.expedient_id)!).push(v);
    return map;
  }, [visites]);
  const fitesByExp = useMemo(() => {
    const map = new Map<number, Fita[]>();
    for (const f of fites) (map.get(f.expedient_id) ?? map.set(f.expedient_id, []).get(f.expedient_id)!).push(f);
    return map;
  }, [fites]);
  const visitCountByExp = useMemo(() => {
    const m = new Map<number, number>();
    for (const v of visites) m.set(v.expedient_id, (m.get(v.expedient_id) ?? 0) + 1);
    return m;
  }, [visites]);

  const counts = {
    resta: items.filter((it) => !it.direccio_obres && it.categoria !== "do").length,
    do: items.filter((it) => it.direccio_obres).length,
    docencia: items.filter((it) => it.categoria === "do").length,
    tots: items.length,
  };
  const shown = items.filter((it) => {
    if (tab === "do") return it.direccio_obres;
    if (tab === "docencia") return it.categoria === "do";
    if (tab === "resta") return !it.direccio_obres && it.categoria !== "do";
    return true;
  });

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--color-line)] p-0.5 text-sm">
          <TabBtn active={tab === "tots"} onClick={() => setTab("tots")}>Tots ({counts.tots})</TabBtn>
          <TabBtn active={tab === "resta"} onClick={() => setTab("resta")}>Projectes ({counts.resta})</TabBtn>
          <TabBtn active={tab === "do"} onClick={() => setTab("do")}>Direcció d&apos;obres ({counts.do})</TabBtn>
          <TabBtn active={tab === "docencia"} onClick={() => setTab("docencia")}>Docència ({counts.docencia})</TabBtn>
        </div>
        <div className="hidden items-center gap-1 sm:flex">
          <button type="button" className="btn-ghost px-3 py-1.5" onClick={() => setWeekOffset((w) => w - 1)} title="Setmana anterior">‹</button>
          <button type="button" className="btn-ghost px-3 py-1.5 disabled:opacity-50" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>Avui</button>
          <button type="button" className="btn-ghost px-3 py-1.5" onClick={() => setWeekOffset((w) => w + 1)} title="Setmana següent">›</button>
        </div>
      </div>

      <div className="hidden flex-wrap items-center gap-4 text-xs text-[var(--color-muted)] sm:flex">
        <Legend color={COLOR_REST} label="Projectes" />
        <Legend color={COLOR_DIR} label="Direcció d'obres" />
        <Legend color={COLOR_DO} label="Docència" />
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full border-2 border-white bg-[var(--color-accent)] shadow" /> Visita d&apos;obra</span>
        <span className="flex items-center gap-1.5"><Shape forma="diamond" color={FITA_COLOR} size={12} /> Fita</span>
        <span className="text-amber-700">⚠ sense dates</span>
      </div>

      {/* Mobile list */}
      <div className="space-y-2 sm:hidden">
        {shown.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-line)] bg-white p-4 text-sm text-[var(--color-muted)]">Cap expedient en aquesta vista.</div>
        ) : (
          shown.map((it) => <MobileRow key={it.id} it={it} today={today} visites={visitCountByExp.get(it.id) ?? 0} onOpen={() => setEditing(it)} />)
        )}
      </div>

      {/* Desktop gantt */}
      <div className="hidden rounded-2xl border border-[var(--color-line)] bg-white shadow-sm sm:block">
        <div className="flex border-b border-[var(--color-line)]">
          <div className="shrink-0" style={{ width: LABEL_W + HOURS_W }} />
          <div className="flex flex-1">
            {monthSegments.map((seg, i) => (
              <div key={i} className="border-l border-[var(--color-line)] px-2 py-0.5 text-xs font-medium text-[var(--color-muted)]" style={{ flexGrow: seg.span, flexBasis: 0 }}>{seg.label}</div>
            ))}
          </div>
        </div>
        <div className="flex border-b border-[var(--color-line)]">
          <div className="shrink-0 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]" style={{ width: LABEL_W }}>Expedient</div>
          <div className="shrink-0 border-l border-[var(--color-line)] px-2 py-1 text-center text-[10px] uppercase tracking-wide text-[var(--color-muted)]" style={{ width: HOURS_W }}>
            Hores fet/plan
          </div>
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
        {shown.length === 0 ? (
          <div className="px-3 py-6 text-sm text-[var(--color-muted)]">Cap expedient en aquesta vista.</div>
        ) : (
          shown.map((it) => (
            <GanttRow key={it.id} it={it} vis={visitsByExp.get(it.id) ?? []} fites={fitesByExp.get(it.id) ?? []} days={days} start={start} todayIdx={todayIdx} onOpen={() => setEditing(it)} />
          ))
        )}
      </div>

      <ExpedientInfoModal item={editing} fites={editing ? fitesByExp.get(editing.id) ?? [] : []} fitaTipus={fitaTipus} visites={editing ? visitCountByExp.get(editing.id) ?? 0 : 0} onClose={() => setEditing(null)} />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-4 rounded" style={{ backgroundColor: color }} /> {label}</span>;
}
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-md px-3 py-1.5 ${active ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"}`}>{children}</button>;
}

function MobileRow({ it, today, visites, onOpen }: { it: PlanItem; today: string; visites: number; onOpen: () => void }) {
  const color = itemColor(it);
  const pH = parseFloat(it.planned_hores) || 0;
  const hPct = pH > 0 ? Math.round(((parseFloat(it.actual_hores) || 0) / pH) * 100) : null;
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
        <span className="min-w-0 truncate text-sm"><span className="font-mono text-[var(--color-accent)]">{it.num_expedient}</span> {it.projecte ?? <span className="text-[var(--color-muted)]">Sense projecte</span>}</span>
        {!hasDates && <span className="shrink-0 text-amber-600">⚠</span>}
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        {hasDates ? `${fmtShort(it.data_inici)} → ${fmtShort(it.data_final)}` : "Sense dates de planificació"}
        {visites > 0 && ` · ${visites} visita${visites === 1 ? "" : "s"} d'obra`}
      </div>
      <div className="mt-1 text-xs">
        <span className="font-semibold text-[var(--color-accent)]">{hc(it.actual_hores)} fetes</span>
        {pH > 0 && (
          <span className="text-[var(--color-muted)]"> / {hc(pH)} plan. · <span className="font-semibold" style={{ color: hPct! > 100 ? "#dc2626" : "var(--color-accent)" }}>{hPct}%</span></span>
        )}
      </div>
      {hasDates && <div className="mt-2 h-2 w-full rounded-full bg-[var(--color-line)]"><div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} /></div>}
    </button>
  );
}

interface Tip {
  pct: number;
  title: string;
  lines: string[];
}

function GanttRow({ it, vis, fites, days, start, todayIdx, onOpen }: { it: PlanItem; vis: Visita[]; fites: Fita[]; days: string[]; start: string; todayIdx: number; onOpen: () => void }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const missing = !it.data_inici || !it.data_final;
  const color = itemColor(it);
  const planned = parseFloat(it.planned_hores) || 0;
  const actual = parseFloat(it.actual_hores) || 0;
  const pct = planned > 0 ? Math.round((actual / planned) * 100) : null;
  const pctColor = pct != null && pct > 100 ? "#dc2626" : "var(--color-accent)";

  let bar: { leftPct: number; widthPct: number; showStart: boolean; showEnd: boolean } | null = null;
  if (it.data_inici && it.data_final) {
    const si = dayIndex(it.data_inici, start);
    const ei = Math.max(si, dayIndex(it.data_final, start));
    if (ei >= 0 && si <= TOTAL - 1) {
      const clStart = Math.max(0, si);
      const clEnd = Math.min(TOTAL - 1, ei);
      bar = { leftPct: (clStart / TOTAL) * 100, widthPct: ((clEnd - clStart + 1) / TOTAL) * 100, showStart: si >= 0, showEnd: ei <= TOTAL - 1 };
    }
  }

  return (
    <div className="flex items-stretch border-b border-[var(--color-line)] last:border-b-0">
      <div className="group relative shrink-0" style={{ width: LABEL_W }}>
        <button type="button" onClick={onOpen} className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left hover:bg-[var(--color-paper)]">
          {missing && <span className="shrink-0 text-amber-600" title="Sense dates de planificació">⚠</span>}
          <span className="truncate text-xs"><span className="font-mono text-[var(--color-accent)]">{it.num_expedient}</span> {it.projecte ?? <span className="text-[var(--color-muted)]">Sense projecte</span>}</span>
        </button>
        <div className="pointer-events-none absolute left-2 top-full z-40 hidden w-64 origin-top scale-95 rounded-lg border border-[var(--color-line)] bg-white p-3 shadow-xl transition group-hover:block group-hover:scale-100">
          <div className="text-sm font-semibold leading-snug">{it.projecte ?? "Sense projecte"}</div>
          <div className="mt-0.5 text-xs text-[var(--color-muted)]">
            <span className="font-mono text-[var(--color-accent)]">{it.num_expedient}</span>
            {it.client_nom ? <> · {it.client_nom}</> : null}
          </div>
        </div>
      </div>
      <div
        className="flex shrink-0 flex-col justify-center border-l border-[var(--color-line)] px-2"
        style={{ width: HOURS_W }}
        title={`Fetes ${fmtHores(actual)} / Planificades ${planned > 0 ? fmtHores(planned) : "—"}`}
      >
        {planned > 0 ? (
          <>
            <div className="flex items-baseline justify-between gap-1 text-xs font-bold tabular-nums" style={{ color: pctColor }}>
              <span>{pct}%</span>
              <span>{hc(actual)}/{hc(planned)}</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-[var(--color-line)]">
              <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, pct ?? 0)}%`, backgroundColor: pctColor }} />
            </div>
          </>
        ) : (
          <div className="text-center leading-tight">
            <div className="text-xs font-bold tabular-nums text-[var(--color-accent)]">{hc(actual)}</div>
            <div className="text-[10px] text-[var(--color-muted)]">fetes</div>
          </div>
        )}
      </div>
      <div className="relative flex flex-1" style={{ minHeight: 32 }}>
        {days.map((iso, i) => {
          const wd = parts(iso).dt.getDay();
          const weekend = wd === 0 || wd === 6;
          return <div key={iso} className="flex-1 border-l border-[var(--color-line)]" style={{ backgroundColor: i === todayIdx ? "var(--color-accent-soft)" : weekend ? "#f9f9f7" : undefined }} />;
        })}

        {bar && (
          <>
            <button type="button" onClick={onOpen} className="absolute top-1/2 h-5 -translate-y-1/2 rounded" style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%`, background: `linear-gradient(90deg, ${color}bb, ${color})` }} aria-label="Període" />
            {bar.showStart && (
              <div
                className="absolute top-1/2 z-10 h-6 w-2.5 -translate-x-1/2 -translate-y-1/2 cursor-default"
                style={{ left: `${bar.leftPct}%` }}
                onMouseEnter={() => setTip({ pct: bar!.leftPct, title: "Inici", lines: [fmtLong(it.data_inici!)] })}
                onMouseLeave={() => setTip(null)}
                onClick={onOpen}
              >
                <div className="mx-auto h-full w-[3px] rounded" style={{ backgroundColor: color, filter: "brightness(0.7)" }} />
              </div>
            )}
            {bar.showEnd && (
              <div
                className="absolute top-1/2 z-10 h-6 w-2.5 -translate-x-1/2 -translate-y-1/2 cursor-default"
                style={{ left: `${bar.leftPct + bar.widthPct}%` }}
                onMouseEnter={() => setTip({ pct: bar!.leftPct + bar!.widthPct, title: "Final (previsió)", lines: [fmtLong(it.data_final!)] })}
                onMouseLeave={() => setTip(null)}
                onClick={onOpen}
              >
                <div className="mx-auto h-full w-[3px] rounded" style={{ backgroundColor: color, filter: "brightness(0.7)" }} />
              </div>
            )}
          </>
        )}

        {/* Visites — on the line */}
        {vis.map((v, k) => {
          const idx = dayIndex(v.data, start);
          if (idx < 0 || idx > TOTAL - 1) return null;
          const pct = ((idx + 0.5) / TOTAL) * 100;
          return (
            <button
              key={k}
              type="button"
              onMouseEnter={() => setTip({ pct, title: "Visita d'obra", lines: [fmtLong(v.data), `${fmtHores(v.hores)}${v.ciutat ? ` · ${v.ciutat}` : ""}`, ...(v.comentari ? [v.comentari] : [])] })}
              onMouseLeave={() => setTip(null)}
              className="absolute top-1/2 z-20 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-accent)] transition hover:scale-150"
              style={{ left: `${pct}%`, boxShadow: VISITA_GLOW }}
              aria-label="Visita d'obra"
            />
          );
        })}

        {/* Fites — on the line */}
        {fites.map((f) => {
          const idx = dayIndex(f.data, start);
          if (idx < 0 || idx > TOTAL - 1) return null;
          const pct = ((idx + 0.5) / TOTAL) * 100;
          return (
            <span
              key={f.id}
              className="absolute top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 cursor-default transition hover:scale-125"
              style={{ left: `${pct}%`, filter: FITA_GLOW }}
              onMouseEnter={() => setTip({ pct, title: f.nom, lines: [fmtLong(f.data)] })}
              onMouseLeave={() => setTip(null)}
            >
              <Shape forma={f.forma} color={f.color || FITA_COLOR} />
            </span>
          );
        })}

        {tip && (
          <div className="pointer-events-none absolute bottom-full z-30 mb-1 w-48 -translate-x-1/2 rounded-lg border border-[var(--color-line)] bg-white p-2 text-xs shadow-lg" style={{ left: `${tip.pct}%` }}>
            <div className="font-semibold text-[var(--color-accent)]">{tip.title}</div>
            {tip.lines.map((l, i) => <div key={i} className="capitalize text-[var(--color-muted)]">{l}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}

function ExpedientInfoModal({ item, fites, fitaTipus, visites, onClose }: { item: PlanItem | null; fites: Fita[]; fitaTipus: FitaTipus[]; visites: number; onClose: () => void }) {
  return (
    <Modal
      open={item != null}
      onClose={onClose}
      wide
      title={item && (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-[var(--color-accent)]">{item.num_expedient}</span>
            {item.direccio_obres && <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]">Direcció d&apos;obres</span>}
          </div>
          <h3 className="text-base font-semibold">{item.projecte ?? "Sense projecte"}</h3>
        </div>
      )}
    >
      {item && <ExpedientInfo key={item.id} item={item} fites={fites} fitaTipus={fitaTipus} visites={visites} onClose={onClose} />}
    </Modal>
  );
}

function Badge({ swatch, label, dot }: { swatch: { bg: string; text: string; color: string }; label: string; dot?: boolean }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap" style={{ backgroundColor: swatch.bg, color: swatch.text }}>{dot && <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: swatch.color }} />}{label}</span>;
}

function ExpedientInfo({ item, fites, fitaTipus, visites, onClose }: { item: PlanItem; fites: Fita[]; fitaTipus: FitaTipus[]; visites: number; onClose: () => void }) {
  const [inici, setInici] = useState(item.data_inici ?? "");
  const [final, setFinal] = useState(item.data_final ?? "");
  const [pending, startTransition] = useTransition();

  // Fita form
  const [tipusSel, setTipusSel] = useState<string>("new");
  const [novaNom, setNovaNom] = useState("");
  const [forma, setForma] = useState("diamond");
  const [color, setColor] = useState(FITA_COLOR);
  const [fitaData, setFitaData] = useState("");
  const [pendingFita, startFita] = useTransition();

  const selectedTipus = tipusSel === "new" ? null : fitaTipus.find((t) => String(t.id) === tipusSel) ?? null;
  // When changing the colour of an existing fita type, persist it right away.
  function pickColor(c: string) {
    setColor(c);
    if (selectedTipus) startFita(() => updateFitaTipusColorAction(selectedTipus.id, c));
  }

  const planned = parseFloat(item.planned_hores) || 0;
  const actual = parseFloat(item.actual_hores) || 0;
  const pct = planned > 0 ? Math.round((actual / planned) * 100) : null;

  function saveDates() {
    startTransition(async () => {
      await updateExpedientDatesAction(item.id, inici, final);
      onClose();
    });
  }
  function addFita() {
    if (!fitaData) return;
    const isNew = tipusSel === "new";
    if (isNew && !novaNom.trim()) return;
    startFita(async () => {
      await addFitaAction({ expedientId: item.id, tipusId: isNew ? null : Number(tipusSel), novaNom, forma, color, data: fitaData });
      setFitaData("");
      setNovaNom("");
    });
  }

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <Info label="Client" value={item.client_nom ?? "—"} />
        <Info label="Ciutat" value={item.ciutat ?? "—"} />
        <Info label="Pressupost" value={formatEur(item.pressupost)} />
        <Info label="Visites d'obra" value={String(visites)} />
        <Info label="Tancat el" value={fmtShort(item.data_tancament)} />
      </dl>

      {planned > 0 && (
        <div className="rounded-xl border border-[var(--color-line)] p-4">
          <div className="mb-2 flex items-baseline justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Hores: fetes vs planificades</span><span className="text-sm font-semibold">{pct}%</span></div>
          <div className="h-3 w-full rounded-full bg-[var(--color-line)]"><div className="h-3 rounded-full bg-[var(--color-accent)]" style={{ width: `${Math.min(100, pct ?? 0)}%` }} /></div>
          <div className="mt-2 text-sm text-[var(--color-muted)]">{fmtHores(actual)} fetes de {fmtHores(planned)} planificades</div>
        </div>
      )}

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Dates de planificació</div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Data inici</label><input type="date" className="input" value={inici} onChange={(e) => setInici(e.target.value)} /></div>
          <div><label className="label">Data final (previsió)</label><input type="date" className="input" value={final} onChange={(e) => setFinal(e.target.value)} /></div>
        </div>
        <button type="button" className="btn-primary mt-3 w-full justify-center py-2.5" onClick={saveDates} disabled={pending}>{pending ? "Desant…" : "Desar dates"}</button>
      </div>

      {/* Fites */}
      <div className="rounded-xl border border-[var(--color-line)] p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Fites</div>
        {fites.length > 0 && (
          <ul className="mb-3 space-y-1">
            {fites.slice().sort((a, b) => a.data.localeCompare(b.data)).map((f) => (
              <li key={f.id} className="flex items-center gap-2 text-sm">
                <Shape forma={f.forma} color={f.color || FITA_COLOR} />
                <span className="font-medium">{f.nom}</span>
                <span className="text-[var(--color-muted)] tabular-nums">{fmtShort(f.data)}</span>
                <button type="button" className="ml-auto text-red-700 hover:underline text-xs" onClick={() => { if (confirm("Eliminar aquesta fita?")) startFita(() => deleteFitaAction(f.id)); }}>✕</button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="label">Fita</label>
            <select
              className="input"
              value={tipusSel}
              onChange={(e) => {
                setTipusSel(e.target.value);
                const t = fitaTipus.find((x) => String(x.id) === e.target.value);
                setColor(t?.color || FITA_COLOR);
              }}
            >
              <option value="new">Nova fita…</option>
              {fitaTipus.map((t) => <option key={t.id} value={String(t.id)}>{t.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Data</label>
            <input type="date" className="input" value={fitaData} onChange={(e) => setFitaData(e.target.value)} />
          </div>
          {tipusSel === "new" && (
            <>
              <div>
                <label className="label">Nom (ex: Classe)</label>
                <input className="input" value={novaNom} onChange={(e) => setNovaNom(e.target.value)} placeholder="Nom de la fita" />
              </div>
              <div>
                <label className="label">Forma</label>
                <div className="flex items-center gap-2">
                  <select className="input" value={forma} onChange={(e) => setForma(e.target.value)}>
                    {FORMES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <Shape forma={forma} color={color} size={18} />
                </div>
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <label className="label">Color{selectedTipus ? ` · ${selectedTipus.nom}` : ""}</label>
            <div className="flex flex-wrap items-center gap-2">
              {FITA_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  aria-label={c.label}
                  onClick={() => pickColor(c.value)}
                  className={`h-7 w-7 rounded-full border transition ${color === c.value ? "ring-2 ring-[var(--color-accent)] ring-offset-1" : "border-[var(--color-line)]"}`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
              <span className="ml-1 inline-flex items-center"><Shape forma={selectedTipus?.forma ?? forma} color={color} size={18} /></span>
            </div>
            {selectedTipus && <p className="mt-1 text-xs text-[var(--color-muted)]">El color s&apos;aplica a totes les fites «{selectedTipus.nom}».</p>}
          </div>
        </div>
        <button type="button" className="btn-ghost mt-3" onClick={addFita} disabled={pendingFita}>+ Afegir fita</button>
      </div>
    </div>
  );
}

function Info({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return <div><dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</dt><dd className="mt-0.5">{children ?? value}</dd></div>;
}
