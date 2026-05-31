"use client";

import { useId } from "react";

// Mix a hex colour with white by `amt` (0..1) to build soft gradients.
export function lighten(hex: string, amt = 0.45): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  r = Math.round(r + (255 - r) * amt);
  g = Math.round(g + (255 - g) * amt);
  b = Math.round(b + (255 - b) * amt);
  return `rgb(${r}, ${g}, ${b})`;
}

export function ChartCard({
  title,
  meta,
  children,
  className = "",
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight text-[var(--color-ink)]">{title}</h3>
        {meta != null && <span className="text-xs text-[var(--color-muted)] whitespace-nowrap">{meta}</span>}
      </div>
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string;
  accent: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: `linear-gradient(135deg, ${lighten(accent, 0.3)}, ${accent})` }} />
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">{label}</span>
      </div>
      <div className="text-3xl font-semibold tracking-tight tabular-nums text-[var(--color-ink)]">{value}</div>
      {hint && <div className="mt-1 text-xs text-[var(--color-muted)]">{hint}</div>}
    </div>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  color: string; // hex
  display: string; // formatted value shown in the pill
}

function Empty() {
  return <p className="text-sm text-[var(--color-muted)]">Sense dades.</p>;
}

// Vertical gradient bars with floating value pills; the tallest bar's label
// is highlighted with a dark pill (dashboard style).
export function VBarChart({ bars, height = 220 }: { bars: BarDatum[]; height?: number }) {
  if (bars.length === 0) return <Empty />;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const maxIdx = bars.reduce((mi, b, i, arr) => (b.value > arr[mi].value ? i : mi), 0);

  return (
    <div>
      <div className="flex items-end gap-2 sm:gap-3" style={{ height }}>
        {bars.map((b, i) => {
          const pct = (b.value / max) * 100;
          const hi = i === maxIdx;
          return (
            <div key={b.label} className="flex h-full flex-1 flex-col items-center justify-end">
              <span
                className={`mb-2 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
                  hi ? "bg-[var(--color-ink)] text-white" : "text-[var(--color-ink)]"
                }`}
              >
                {b.display}
              </span>
              <div
                className="w-full rounded-b-md rounded-t-2xl"
                style={{
                  height: `${Math.max(pct, 3)}%`,
                  background: `linear-gradient(180deg, ${lighten(b.color, 0.55)} 0%, ${b.color} 100%)`,
                }}
                title={`${b.label}: ${b.display}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3">
        {bars.map((b, i) => (
          <div key={b.label} className="min-w-0 flex-1 text-center">
            <span
              className={`inline-block max-w-full truncate text-xs ${
                i === maxIdx
                  ? "rounded-md bg-[var(--color-ink)] px-2 py-0.5 text-white"
                  : "text-[var(--color-muted)]"
              }`}
              title={b.label}
            >
              {b.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Horizontal gradient bars with a value pill at the end of each bar.
export function HBarChart({ bars }: { bars: BarDatum[] }) {
  if (bars.length === 0) return <Empty />;
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="space-y-3">
      {bars.map((b) => {
        const pct = (b.value / max) * 100;
        return (
          <div key={b.label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-sm" title={b.label}>{b.label}</span>
            <div className="relative h-7 flex-1 rounded-full bg-[var(--color-paper)]">
              <div
                className="flex h-7 items-center justify-end rounded-full pr-2"
                style={{
                  width: `${Math.max(pct, 8)}%`,
                  background: `linear-gradient(90deg, ${lighten(b.color, 0.5)} 0%, ${b.color} 100%)`,
                }}
              >
                <span className="rounded-md bg-white/85 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-[var(--color-ink)]">
                  {b.display}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string; // hex
  note?: string;
}

export function GradientDonut({
  segments,
  centerValue,
  centerLabel,
  size = 200,
  thickness = 28,
}: {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  size?: number;
  thickness?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const drawn = segments.filter((s) => s.value > 0);
  const gap = drawn.length > 1 ? Math.min(c * 0.02, 10) : 0;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>
            {drawn.map((s, i) => (
              <linearGradient key={i} id={`${uid}-g${i}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={lighten(s.color, 0.4)} />
                <stop offset="100%" stopColor={s.color} />
              </linearGradient>
            ))}
          </defs>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0f1f4" strokeWidth={thickness} />
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {drawn.map((s, i) => {
              const frac = total ? s.value / total : 0;
              const len = Math.max(frac * c - gap, 0.0001);
              const el = (
                <circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={`url(#${uid}-g${i})`}
                  strokeWidth={thickness}
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="round"
                />
              );
              offset += frac * c;
              return el;
            })}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{centerValue}</span>
          <span className="text-xs text-[var(--color-muted)]">{centerLabel}</span>
        </div>
      </div>
      <ul className="space-y-2.5 text-sm">
        {segments.map((s) => (
          <li key={s.label} className="flex items-start gap-2.5">
            <span className="mt-1 inline-block h-3 w-3 rounded-md" style={{ background: `linear-gradient(135deg, ${lighten(s.color, 0.4)}, ${s.color})` }} />
            <span>
              <span className="font-medium">{s.label}</span>{" "}
              <span className="text-[var(--color-muted)] tabular-nums">
                {s.value}
                {total ? ` · ${Math.round((s.value / total) * 100)}%` : ""}
              </span>
              {s.note && <span className="block text-xs text-[var(--color-muted)]">{s.note}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// 100%-width stacked gradient bar with labelled amounts below.
export function StackedBar({
  segments,
  total,
  fmt,
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
  fmt: (n: number) => string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex h-7 w-full gap-1 overflow-hidden rounded-full">
        {segments.map((s) => {
          const pct = total ? (s.value / total) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <div
              key={s.label}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${lighten(s.color, 0.4)}, ${s.color})` }}
              title={`${s.label}: ${fmt(s.value)} (${Math.round(pct)}%)`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        {segments.map((s) => {
          const pct = total ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={s.label} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-md" style={{ background: `linear-gradient(135deg, ${lighten(s.color, 0.4)}, ${s.color})` }} />
              <span className="font-medium">{s.label}</span>
              <span className="text-[var(--color-muted)] tabular-nums">{fmt(s.value)} · {pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
