"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createExpedientAction,
  deleteExpedientAction,
  updateExpedientAction,
  type ExpedientPatch,
} from "./actions";
import type { Expedient, ExpedientCategoria } from "@/types/db";
import { formatEur, formatNumber } from "@/lib/format";

type Tab = "llista" | "estadistiques";

const CATEGORIES: { code: ExpedientCategoria; label: string; short: string }[] = [
  { code: "re", label: "Rehabilitació", short: "RE" },
  { code: "co", label: "Consultoria", short: "CO" },
  { code: "ed", label: "Edificació", short: "ED" },
  { code: "rec", label: "Reconstrucció", short: "REC" },
  { code: "do", label: "Docència", short: "DO" },
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.code, c.label]),
);

export function ExpedientsView({ expedients }: { expedients: Expedient[] }) {
  const [tab, setTab] = useState<Tab>("llista");
  const [, startTransition] = useTransition();

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

      {tab === "llista" && <ExpedientsList rows={expedients} />}
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
// Llista
// ============================================================================

function ExpedientsList({ rows }: { rows: Expedient[] }) {
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
            <th className="th">Projecte</th>
            <th className="th">Client</th>
            <th className="th">Ciutat</th>
            <th className="th w-40">Categoria</th>
            <th className="th w-24">Estat</th>
            <th className="th w-28">Visibilitat</th>
            <th className="th w-36">Pressupost</th>
            <th className="th w-20"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <ExpedientRow key={r.id} row={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpedientRow({ row }: { row: Expedient }) {
  const [num, setNum] = useState(row.num_expedient);
  const [projecte, setProjecte] = useState(row.projecte ?? "");
  const [client, setClient] = useState(row.client ?? "");
  const [ciutat, setCiutat] = useState(row.ciutat ?? "");
  const [categoria, setCategoria] = useState<string>(row.categoria ?? "");
  const [estat, setEstat] = useState(row.estat);
  const [visibilitat, setVisibilitat] = useState(row.visibilitat);
  const [pressupost, setPressupost] = useState(row.pressupost);
  const [, startTransition] = useTransition();

  function patch(overrides?: Partial<ExpedientPatch>): ExpedientPatch {
    return {
      num_expedient: num,
      projecte,
      client,
      ciutat,
      categoria,
      estat,
      visibilitat,
      pressupost: parseFloat(pressupost) || 0,
      ...overrides,
    };
  }

  function persist(overrides?: Partial<ExpedientPatch>) {
    if (!num.trim()) return;
    startTransition(() => updateExpedientAction(row.id, patch(overrides)));
  }

  const obert = estat === "obert";

  return (
    <tr>
      <td className="td">
        <input
          className="input font-mono"
          value={num}
          onChange={(e) => setNum(e.target.value)}
          onBlur={() => persist()}
        />
      </td>
      <td className="td">
        <input className="input" value={projecte} onChange={(e) => setProjecte(e.target.value)} onBlur={() => persist()} />
      </td>
      <td className="td">
        <input className="input" value={client} onChange={(e) => setClient(e.target.value)} onBlur={() => persist()} />
      </td>
      <td className="td">
        <input className="input" value={ciutat} onChange={(e) => setCiutat(e.target.value)} onBlur={() => persist()} />
      </td>
      <td className="td">
        <select
          className="input"
          value={categoria}
          onChange={(e) => {
            setCategoria(e.target.value);
            persist({ categoria: e.target.value });
          }}
        >
          <option value="">—</option>
          {CATEGORIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </td>
      <td className="td">
        <button
          type="button"
          onClick={() => {
            const next = obert ? "tancat" : "obert";
            setEstat(next);
            persist({ estat: next });
          }}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{
            backgroundColor: obert ? "#fee2e2" : "#dcfce7",
            color: obert ? "#b91c1c" : "#15803d",
          }}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: obert ? "#dc2626" : "#16a34a" }}
          />
          {obert ? "Obert" : "Tancat"}
        </button>
      </td>
      <td className="td">
        <button
          type="button"
          onClick={() => {
            const next = visibilitat === "public" ? "privat" : "public";
            setVisibilitat(next);
            persist({ visibilitat: next });
          }}
          className="rounded-md border px-2.5 py-1 text-xs font-medium"
          style={
            visibilitat === "public"
              ? { borderColor: "var(--color-accent)", color: "var(--color-accent)", backgroundColor: "var(--color-accent-soft)" }
              : { borderColor: "var(--color-line)", color: "var(--color-muted)", backgroundColor: "white" }
          }
        >
          {visibilitat === "public" ? "Públic" : "Privat"}
        </button>
      </td>
      <td className="td">
        <input
          type="number"
          step="0.01"
          className="input text-right"
          value={pressupost}
          onChange={(e) => setPressupost(e.target.value)}
          onBlur={() => persist()}
        />
      </td>
      <td className="td text-right">
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
  const [fVisibilitat, setFVisibilitat] = useState("");
  const [fCiutat, setFCiutat] = useState("");

  const anys = useMemo(
    () => Array.from(new Set(rows.map((r) => anyOf(r.num_expedient)))).sort().reverse(),
    [rows],
  );
  const ciutats = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => (r.ciutat ?? "").trim()).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, "ca"),
      ),
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (fAny && anyOf(r.num_expedient) !== fAny) return false;
        if (fEstat && r.estat !== fEstat) return false;
        if (fCategoria && r.categoria !== fCategoria) return false;
        if (fVisibilitat && r.visibilitat !== fVisibilitat) return false;
        if (fCiutat && (r.ciutat ?? "").trim() !== fCiutat) return false;
        return true;
      }),
    [rows, fAny, fEstat, fCategoria, fVisibilitat, fCiutat],
  );

  const total = filtered.length;
  const oberts = filtered.filter((r) => r.estat === "obert").length;
  const tancats = total - oberts;
  const publics = filtered.filter((r) => r.visibilitat === "public").length;
  const pressupostTotal = filtered.reduce((s, r) => s + (parseFloat(r.pressupost) || 0), 0);
  const pressupostMitja = total ? pressupostTotal / total : 0;

  const byCiutat = groupBy(filtered, (r) => (r.ciutat ?? "").trim() || "(Sense ciutat)");
  const byCategoria = groupBy(filtered, (r) =>
    r.categoria ? CATEGORY_LABEL[r.categoria] : "(Sense categoria)",
  );
  const byEstat = groupBy(filtered, (r) => (r.estat === "obert" ? "Oberts" : "Tancats"));
  const byVisibilitat = groupBy(filtered, (r) => (r.visibilitat === "public" ? "Públic" : "Privat"));
  const byAny = groupBy(filtered, (r) => anyOf(r.num_expedient));

  return (
    <div className="space-y-8">
      {/* Filtres */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <FilterSelect label="Any" value={fAny} onChange={setFAny} options={anys.map((a) => [a, a])} />
        <FilterSelect
          label="Estat"
          value={fEstat}
          onChange={setFEstat}
          options={[
            ["obert", "Oberts"],
            ["tancat", "Tancats"],
          ]}
        />
        <FilterSelect
          label="Categoria"
          value={fCategoria}
          onChange={setFCategoria}
          options={CATEGORIES.map((c) => [c.code, c.label])}
        />
        <FilterSelect
          label="Visibilitat"
          value={fVisibilitat}
          onChange={setFVisibilitat}
          options={[
            ["public", "Públic"],
            ["privat", "Privat"],
          ]}
        />
        <FilterSelect label="Ciutat" value={fCiutat} onChange={setFCiutat} options={ciutats.map((c) => [c, c])} />
      </div>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        <Kpi label="Expedients" value={formatNumber(total).replace(",00", "")} />
        <Kpi label="Oberts" value={String(oberts)} accent="#dc2626" />
        <Kpi label="Tancats" value={String(tancats)} accent="#16a34a" />
        <Kpi label="Pressupost total" value={formatEur(pressupostTotal)} />
        <Kpi label="Pressupost mitjà" value={formatEur(pressupostMitja)} />
        <Kpi label="Públics / Privats" value={`${publics} / ${total - publics}`} />
      </div>

      {/* Desglossos */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Breakdown title="Per ciutat" groups={byCiutat} />
        <Breakdown title="Per categoria" groups={byCategoria} />
        <Breakdown title="Per estat" groups={byEstat} />
        <Breakdown title="Públic / Privat" groups={byVisibilitat} />
        <Breakdown title="Per any" groups={byAny} />
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
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card py-4">
      <div className="label mb-1">{label}</div>
      <div className="text-2xl font-semibold tracking-tight" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
    </div>
  );
}

function Breakdown({ title, groups }: { title: string; groups: Group[] }) {
  const max = Math.max(1, ...groups.map((g) => g.count));
  return (
    <div className="card">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {groups.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">Sense dades.</p>
      ) : (
        <div className="space-y-2.5">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="flex items-baseline justify-between text-sm mb-1">
                <span className="truncate pr-2">{g.key}</span>
                <span className="whitespace-nowrap text-[var(--color-muted)]">
                  {g.count} · {formatEur(g.pressupost)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--color-line)]">
                <div
                  className="h-2 rounded-full bg-[var(--color-accent)]"
                  style={{ width: `${(g.count / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
