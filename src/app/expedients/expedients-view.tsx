"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createExpedientAction,
  deleteExpedientAction,
  updateExpedientAction,
  type ExpedientPatch,
} from "./actions";
import type { Client, Expedient } from "@/types/db";
import { formatEur } from "@/lib/format";
import { CATEGORIES, CATEGORY_BY_CODE, ESTAT, TIPUS } from "@/lib/expedients";
import { Combobox, type ComboOption } from "@/components/combobox";

type Tab = "llista" | "estadistiques";

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDate(iso: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function ExpedientsView({
  expedients,
  clients,
}: {
  expedients: Expedient[];
  clients: Client[];
}) {
  const [tab, setTab] = useState<Tab>("llista");
  const [, startTransition] = useTransition();

  const clientOpts: ComboOption[] = clients.map((c) => ({
    id: c.id,
    label: c.nom,
    sub: c.nif ?? c.ciutat ?? undefined,
  }));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 mb-6 border-b border-[var(--color-line)]">
        <TabBtn current={tab} value="llista" onClick={setTab}>
          Expedients ({expedients.length})
        </TabBtn>
        <TabBtn current={tab} value="estadistiques" onClick={setTab}>
          Estadístiques
        </TabBtn>

        {tab === "llista" && (
          <button
            type="button"
            className="btn-primary ml-auto"
            onClick={() => startTransition(() => createExpedientAction())}
          >
            + Nou expedient
          </button>
        )}
      </div>

      {tab === "llista" && <ExpedientsList rows={expedients} clientOpts={clientOpts} />}
      {tab === "estadistiques" && <StatsPanel rows={expedients} />}
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

// ============================================================================
// Badges
// ============================================================================

function Badge({ swatch, label, dot }: { swatch: { bg: string; text: string; color: string }; label: string; dot?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: swatch.bg, color: swatch.text }}
    >
      {dot && <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: swatch.color }} />}
      {label}
    </span>
  );
}

function CategoriaBadge({ code }: { code: string | null }) {
  if (!code) return <span className="text-[var(--color-muted)]">—</span>;
  const m = CATEGORY_BY_CODE[code];
  if (!m) return <span className="text-[var(--color-muted)]">—</span>;
  return <Badge swatch={m} label={m.label} />;
}

// ============================================================================
// Llista
// ============================================================================

function ExpedientsList({ rows, clientOpts }: { rows: Expedient[]; clientOpts: ComboOption[] }) {
  if (rows.length === 0) {
    return (
      <div className="card text-sm text-[var(--color-muted)]">
        Encara no hi ha cap expedient. Crea&apos;n un de nou per començar.
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="w-full">
        <thead>
          <tr>
            <th className="th w-28">Núm.</th>
            <th className="th" style={{ minWidth: "16rem" }}>Projecte</th>
            <th className="th" style={{ minWidth: "16rem" }}>Client</th>
            <th className="th w-40">Ciutat</th>
            <th className="th w-44">Categoria</th>
            <th className="th w-28">Tipus</th>
            <th className="th w-36">Pressupost</th>
            <th className="th w-32">Tancat el</th>
            <th className="th w-28">Estat</th>
            <th className="th w-32"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <ExpedientRow key={r.id} row={r} clientOpts={clientOpts} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpedientRow({ row, clientOpts }: { row: Expedient; clientOpts: ComboOption[] }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const [num, setNum] = useState(row.num_expedient);
  const [projecte, setProjecte] = useState(row.projecte ?? "");
  const [clientId, setClientId] = useState<number | null>(row.client_id);
  const [ciutat, setCiutat] = useState(row.ciutat ?? "");
  const [categoria, setCategoria] = useState<string>(row.categoria ?? "");
  const [estat, setEstat] = useState(row.estat);
  const [tipus, setTipus] = useState(row.tipus);
  const [pressupost, setPressupost] = useState(row.pressupost);
  const [dataTancament, setDataTancament] = useState(row.data_tancament ?? "");

  function reset() {
    setNum(row.num_expedient);
    setProjecte(row.projecte ?? "");
    setClientId(row.client_id);
    setCiutat(row.ciutat ?? "");
    setCategoria(row.categoria ?? "");
    setEstat(row.estat);
    setTipus(row.tipus);
    setPressupost(row.pressupost);
    setDataTancament(row.data_tancament ?? "");
  }

  function save() {
    if (!num.trim()) return;
    const patch: ExpedientPatch = {
      num_expedient: num,
      projecte,
      client_id: clientId,
      ciutat,
      categoria,
      estat,
      tipus,
      pressupost: parseFloat(pressupost) || 0,
      data_tancament: dataTancament,
    };
    startTransition(async () => {
      await updateExpedientAction(row.id, patch);
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <tr>
        <td className="td font-mono">{row.num_expedient}</td>
        <td className="td">{row.projecte ?? <span className="text-[var(--color-muted)]">—</span>}</td>
        <td className="td">{row.client_nom ?? <span className="text-[var(--color-muted)]">—</span>}</td>
        <td className="td">{row.ciutat ?? <span className="text-[var(--color-muted)]">—</span>}</td>
        <td className="td"><CategoriaBadge code={row.categoria} /></td>
        <td className="td"><Badge swatch={TIPUS[row.tipus]} label={TIPUS[row.tipus].label} /></td>
        <td className="td text-right tabular-nums">{formatEur(row.pressupost)}</td>
        <td className="td tabular-nums">{fmtDate(row.data_tancament) ?? <span className="text-[var(--color-muted)]">—</span>}</td>
        <td className="td"><Badge swatch={ESTAT[row.estat]} label={ESTAT[row.estat].label} dot /></td>
        <td className="td text-right whitespace-nowrap">
          <button type="button" className="text-[var(--color-accent)] hover:underline text-sm mr-3" onClick={() => setEditing(true)}>
            Editar
          </button>
          <button
            type="button"
            className="text-red-700 hover:underline text-sm"
            onClick={() => {
              if (confirm(`Eliminar l'expedient ${row.num_expedient}?`)) {
                startTransition(() => deleteExpedientAction(row.id));
              }
            }}
          >
            Eliminar
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ backgroundColor: "var(--color-paper)" }}>
      <td className="td align-top">
        <input className="input font-mono" value={num} onChange={(e) => setNum(e.target.value)} />
      </td>
      <td className="td align-top">
        <input className="input" value={projecte} onChange={(e) => setProjecte(e.target.value)} placeholder="Nom del projecte" />
      </td>
      <td className="td align-top">
        <Combobox options={clientOpts} value={clientId} onChange={setClientId} placeholder="Cerca client…" overlay />
      </td>
      <td className="td align-top">
        <input className="input" value={ciutat} onChange={(e) => setCiutat(e.target.value)} placeholder="Ciutat" />
      </td>
      <td className="td align-top">
        <select className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">—</option>
          {CATEGORIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
      </td>
      <td className="td align-top">
        <select className="input" value={tipus} onChange={(e) => setTipus(e.target.value as typeof tipus)}>
          <option value="privat">Privat</option>
          <option value="public">Públic</option>
        </select>
      </td>
      <td className="td align-top">
        <input type="number" step="0.01" className="input text-right" value={pressupost} onChange={(e) => setPressupost(e.target.value)} />
      </td>
      <td className="td align-top">
        <input type="date" className="input" value={dataTancament} onChange={(e) => setDataTancament(e.target.value)} />
      </td>
      <td className="td align-top">
        <select
          className="input"
          value={estat}
          onChange={(e) => {
            const next = e.target.value as typeof estat;
            setEstat(next);
            if (next === "tancat" && !dataTancament) setDataTancament(todayLocal());
          }}
        >
          <option value="obert">Obert</option>
          <option value="tancat">Tancat</option>
        </select>
      </td>
      <td className="td align-top text-right whitespace-nowrap">
        <button type="button" className="text-[var(--color-accent)] hover:underline text-sm mr-3 disabled:opacity-50" onClick={save} disabled={pending}>
          Desar
        </button>
        <button
          type="button"
          className="text-[var(--color-muted)] hover:underline text-sm"
          onClick={() => {
            reset();
            setEditing(false);
          }}
        >
          Cancel·lar
        </button>
      </td>
    </tr>
  );
}

// ============================================================================
// Estadístiques
// ============================================================================

function anyOf(num: string): string {
  const m = /^(\d{2})-/.exec(num);
  return m ? `20${m[1]}` : "—";
}

function StatsPanel({ rows }: { rows: Expedient[] }) {
  const [fAny, setFAny] = useState("");
  const [fEstat, setFEstat] = useState("");
  const [fCategoria, setFCategoria] = useState("");
  const [fTipus, setFTipus] = useState("");
  const [fCiutat, setFCiutat] = useState("");

  const anys = useMemo(
    () => Array.from(new Set(rows.map((r) => anyOf(r.num_expedient)))).sort().reverse(),
    [rows],
  );
  const ciutats = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => (r.ciutat ?? "").trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "ca"),
      ),
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (fAny && anyOf(r.num_expedient) !== fAny) return false;
        if (fEstat && r.estat !== fEstat) return false;
        if (fCategoria && r.categoria !== fCategoria) return false;
        if (fTipus && r.tipus !== fTipus) return false;
        if (fCiutat && (r.ciutat ?? "").trim() !== fCiutat) return false;
        return true;
      }),
    [rows, fAny, fEstat, fCategoria, fTipus, fCiutat],
  );

  const total = filtered.length;
  const oberts = filtered.filter((r) => r.estat === "obert").length;
  const tancats = total - oberts;
  const publics = filtered.filter((r) => r.tipus === "public").length;
  const privats = total - publics;
  const pressupostTotal = filtered.reduce((s, r) => s + (parseFloat(r.pressupost) || 0), 0);
  const pressupostPublic = filtered.filter((r) => r.tipus === "public").reduce((s, r) => s + (parseFloat(r.pressupost) || 0), 0);
  const pressupostPrivat = pressupostTotal - pressupostPublic;
  const pressupostObert = filtered
    .filter((r) => r.estat === "obert")
    .reduce((s, r) => s + (parseFloat(r.pressupost) || 0), 0);
  const pressupostMitja = total ? pressupostTotal / total : 0;

  const estatSegments = [
    { label: "Oberts", value: oberts, color: ESTAT.obert.color },
    { label: "Tancats", value: tancats, color: ESTAT.tancat.color },
  ];
  const tipusSegments = [
    { label: "Privat", value: privats, color: TIPUS.privat.color, note: formatEur(pressupostPrivat) },
    { label: "Públic", value: publics, color: TIPUS.public.color, note: formatEur(pressupostPublic) },
  ];

  const byCiutat = groupBy(filtered, (r) => (r.ciutat ?? "").trim() || "(Sense ciutat)");
  const byAny = groupBy(filtered, (r) => anyOf(r.num_expedient)).sort((a, b) => a.key.localeCompare(b.key));
  const catGroups = CATEGORIES.map((c) => {
    const items = filtered.filter((r) => r.categoria === c.code);
    return {
      key: c.label,
      color: c.color,
      count: items.length,
      pressupost: items.reduce((s, r) => s + (parseFloat(r.pressupost) || 0), 0),
    };
  }).filter((g) => g.count > 0);
  const senseCat = filtered.filter((r) => !r.categoria).length;

  return (
    <div className="space-y-8">
      {/* Filtres */}
      <div className="rounded-lg border border-[var(--color-line)] bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <FilterSelect label="Any" value={fAny} onChange={setFAny} options={anys.map((a) => [a, a])} />
          <FilterSelect label="Estat" value={fEstat} onChange={setFEstat} options={[["obert", "Oberts"], ["tancat", "Tancats"]]} />
          <FilterSelect label="Categoria" value={fCategoria} onChange={setFCategoria} options={CATEGORIES.map((c) => [c.code, c.label])} />
          <FilterSelect label="Tipus" value={fTipus} onChange={setFTipus} options={[["privat", "Privat"], ["public", "Públic"]]} />
          <FilterSelect label="Ciutat" value={fCiutat} onChange={setFCiutat} options={ciutats.map((c) => [c, c])} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Kpi label="Expedients" value={String(total)} accent="var(--color-accent)" hint={`${oberts} oberts · ${tancats} tancats`} />
        <Kpi label="Pressupost total" value={formatEur(pressupostTotal)} accent="#0ea5e9" hint="Suma de tots els filtrats" />
        <Kpi label="Pressupost en obert" value={formatEur(pressupostObert)} accent={ESTAT.obert.color} hint={`${oberts} expedients oberts`} />
        <Kpi label="Pressupost mitjà" value={formatEur(pressupostMitja)} accent="#7c3aed" hint="Per expedient" />
      </div>

      {/* Donuts */}
      <div className="grid gap-4 sm:grid-cols-2">
        <DonutCard title="Estat" segments={estatSegments} centerLabel={`${total}`} centerSub="expedients" />
        <DonutCard title="Tipus" segments={tipusSegments} centerLabel={`${total}`} centerSub="expedients" />
      </div>

      {/* Pressupost per tipus */}
      <div className="card">
        <SectionTitle>Pressupost per tipus</SectionTitle>
        {pressupostTotal === 0 ? (
          <Empty />
        ) : (
          <StackedBudget
            segments={[
              { label: "Privat", value: pressupostPrivat, color: TIPUS.privat.color },
              { label: "Públic", value: pressupostPublic, color: TIPUS.public.color },
            ]}
            total={pressupostTotal}
          />
        )}
      </div>

      {/* Categoria */}
      <div className="card">
        <SectionTitle>Per categoria</SectionTitle>
        {catGroups.length === 0 ? (
          <Empty />
        ) : (
          <div className="space-y-3">
            {catGroups.map((g) => (
              <ColorBar key={g.key} label={g.key} color={g.color} count={g.count} pressupost={g.pressupost} max={Math.max(...catGroups.map((x) => x.count))} />
            ))}
            {senseCat > 0 && <p className="text-xs text-[var(--color-muted)] pt-1">{senseCat} sense categoria assignada.</p>}
          </div>
        )}
      </div>

      {/* Ciutat + Any */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <SectionTitle>Per ciutat</SectionTitle>
          <BarList groups={byCiutat} />
        </div>
        <div className="card">
          <SectionTitle>Per any</SectionTitle>
          <BarList groups={byAny} />
        </div>
      </div>
    </div>
  );
}

interface Group {
  key: string;
  count: number;
  pressupost: number;
}

function groupBy(rows: Expedient[], keyFn: (r: Expedient) => string): Group[] {
  const map = new Map<string, Group>();
  for (const r of rows) {
    const key = keyFn(r);
    const g = map.get(key) ?? { key, count: 0, pressupost: 0 };
    g.count += 1;
    g.pressupost += parseFloat(r.pressupost) || 0;
    map.set(key, g);
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)] mb-4">{children}</h3>;
}

function Empty() {
  return <p className="text-sm text-[var(--color-muted)]">Sense dades.</p>;
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Tots</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </div>
  );
}

function Kpi({ label, value, accent, hint }: { label: string; value: string; accent: string; hint?: string }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-[var(--color-line)] bg-white p-4">
      <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accent }} />
      <div className="label mb-1">{label}</div>
      <div className="text-2xl font-semibold tracking-tight tabular-nums" style={{ color: accent }}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-[var(--color-muted)]">{hint}</div>}
    </div>
  );
}

function DonutCard({
  title,
  segments,
  centerLabel,
  centerSub,
}: {
  title: string;
  segments: { label: string; value: number; color: string; note?: string }[];
  centerLabel: string;
  centerSub: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div className="card">
      <SectionTitle>{title}</SectionTitle>
      {total === 0 ? (
        <Empty />
      ) : (
        <div className="flex items-center gap-6">
          <Donut segments={segments} centerLabel={centerLabel} centerSub={centerSub} />
          <ul className="space-y-2 text-sm">
            {segments.map((s) => (
              <li key={s.label} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: s.color }} />
                <span>
                  <span className="font-medium">{s.label}</span>{" "}
                  <span className="text-[var(--color-muted)]">
                    {s.value} · {total ? Math.round((s.value / total) * 100) : 0}%
                  </span>
                  {s.note && <span className="block text-xs text-[var(--color-muted)]">{s.note}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Donut({
  segments,
  size = 132,
  thickness = 20,
  centerLabel,
  centerSub,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel: string;
  centerSub: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0ee" strokeWidth={thickness} />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map((s) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += len;
            return el;
          })}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{centerLabel}</span>
        <span className="text-xs text-[var(--color-muted)]">{centerSub}</span>
      </div>
    </div>
  );
}

function StackedBudget({
  segments,
  total,
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
}) {
  return (
    <div className="space-y-3">
      <div className="flex h-6 w-full overflow-hidden rounded-full bg-[var(--color-line)]">
        {segments.map((s) => {
          const pct = total ? (s.value / total) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <div
              key={s.label}
              className="h-full"
              style={{ width: `${pct}%`, backgroundColor: s.color }}
              title={`${s.label}: ${formatEur(s.value)} (${Math.round(pct)}%)`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        {segments.map((s) => {
          const pct = total ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={s.label} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="font-medium">{s.label}</span>
              <span className="text-[var(--color-muted)] tabular-nums">{formatEur(s.value)} · {pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ColorBar({
  label,
  color,
  count,
  pressupost,
  max,
}: {
  label: string;
  color: string;
  count: number;
  pressupost: number;
  max: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm mb-1">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
          {label}
        </span>
        <span className="whitespace-nowrap text-[var(--color-muted)] tabular-nums">
          {count} · {formatEur(pressupost)}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-[var(--color-line)]">
        <div className="h-2.5 rounded-full" style={{ width: `${(count / Math.max(1, max)) * 100}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function BarList({ groups }: { groups: Group[] }) {
  const max = Math.max(1, ...groups.map((g) => g.count));
  if (groups.length === 0) return <Empty />;
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <ColorBar key={g.key} label={g.key} color="var(--color-accent)" count={g.count} pressupost={g.pressupost} max={max} />
      ))}
    </div>
  );
}
