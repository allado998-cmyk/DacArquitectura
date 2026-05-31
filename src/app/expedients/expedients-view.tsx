"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createExpedientAction,
  deleteExpedientAction,
  updateExpedientAction,
  type ExpedientPatch,
} from "./actions";
import type { Client, Dedicacio, Expedient, Tipologia } from "@/types/db";
import { formatEur } from "@/lib/format";
import { CATEGORIES, CATEGORY_BY_CODE, ESTAT, TIPUS, tipologiaSwatch } from "@/lib/expedients";
import { Combobox, type ComboOption } from "@/components/combobox";
import { Modal } from "@/components/modal";
import { ChartCard, GradientDonut, HBarChart, KpiCard, StackedBar, VBarChart } from "@/components/charts";

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
function fmtHores(h: number) {
  return new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 2 }).format(Math.round(h * 100) / 100) + " h";
}

export function ExpedientsView({
  expedients,
  clients,
  dedicacions,
  tipologies,
}: {
  expedients: Expedient[];
  clients: Client[];
  dedicacions: Dedicacio[];
  tipologies: Tipologia[];
}) {
  const [tab, setTab] = useState<Tab>("llista");
  const [, startTransition] = useTransition();

  const clientOpts: ComboOption[] = clients.map((c) => ({
    id: c.id,
    label: c.nom,
    sub: c.ciutat ?? undefined,
  }));

  const dedicByExp = useMemo(() => {
    const map = new Map<number, Dedicacio[]>();
    for (const d of dedicacions) {
      if (d.expedient_id == null) continue;
      const arr = map.get(d.expedient_id) ?? [];
      arr.push(d);
      map.set(d.expedient_id, arr);
    }
    return map;
  }, [dedicacions]);

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

      {tab === "llista" && <ExpedientsList rows={expedients} clientOpts={clientOpts} dedicByExp={dedicByExp} tipologies={tipologies} />}
      {tab === "estadistiques" && <StatsPanel rows={expedients} tipologies={tipologies} />}
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

function TipologiaBadge({ nom }: { nom: string | null }) {
  if (!nom) return <span className="text-[var(--color-muted)]">—</span>;
  return <Badge swatch={tipologiaSwatch(nom)} label={nom} />;
}

// ============================================================================
// Llista
// ============================================================================

function ExpedientsList({
  rows,
  clientOpts,
  dedicByExp,
  tipologies,
}: {
  rows: Expedient[];
  clientOpts: ComboOption[];
  dedicByExp: Map<number, Dedicacio[]>;
  tipologies: Tipologia[];
}) {
  const [detail, setDetail] = useState<Expedient | null>(null);

  if (rows.length === 0) {
    return (
      <div className="card text-sm text-[var(--color-muted)]">
        Encara no hi ha cap expedient. Crea&apos;n un de nou per començar.
      </div>
    );
  }

  return (
    <>
      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th w-28">Núm.</th>
              <th className="th" style={{ minWidth: "16rem" }}>Projecte</th>
              <th className="th" style={{ minWidth: "16rem" }}>Client</th>
              <th className="th w-40">Ciutat</th>
              <th className="th w-44">Categoria</th>
              <th className="th w-44">Tipologia</th>
              <th className="th w-28">Tipus</th>
              <th className="th w-36 text-right">Pressupost</th>
              <th className="th w-32">Tancat el</th>
              <th className="th w-28">Estat</th>
              <th className="th w-20"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <ExpedientRow key={r.id} row={r} clientOpts={clientOpts} tipologies={tipologies} onOpen={() => setDetail(r)} />
            ))}
          </tbody>
        </table>
      </div>

      <DedicacioModal
        expedient={detail}
        dedicacions={detail ? dedicByExp.get(detail.id) ?? [] : []}
        onClose={() => setDetail(null)}
      />
    </>
  );
}

function ExpedientRow({
  row,
  clientOpts,
  tipologies,
  onOpen,
}: {
  row: Expedient;
  clientOpts: ComboOption[];
  tipologies: Tipologia[];
  onOpen: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const [num, setNum] = useState(row.num_expedient);
  const [projecte, setProjecte] = useState(row.projecte ?? "");
  const [clientId, setClientId] = useState<number | null>(row.client_id);
  const [ciutat, setCiutat] = useState(row.ciutat ?? "");
  const [categoria, setCategoria] = useState<string>(row.categoria ?? "");
  const [tipologiaId, setTipologiaId] = useState<string>(row.tipologia_id != null ? String(row.tipologia_id) : "");
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
    setTipologiaId(row.tipologia_id != null ? String(row.tipologia_id) : "");
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
      tipologia_id: tipologiaId ? Number(tipologiaId) : null,
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
      <tr className="cursor-pointer hover:bg-[var(--color-paper)]" onClick={onOpen}>
        <td className="td font-mono text-[var(--color-accent)]">{row.num_expedient}</td>
        <td className="td">{row.projecte ?? <span className="text-[var(--color-muted)]">—</span>}</td>
        <td className="td">{row.client_nom ?? <span className="text-[var(--color-muted)]">—</span>}</td>
        <td className="td">{row.ciutat ?? <span className="text-[var(--color-muted)]">—</span>}</td>
        <td className="td"><CategoriaBadge code={row.categoria} /></td>
        <td className="td"><TipologiaBadge nom={row.tipologia_nom} /></td>
        <td className="td"><Badge swatch={TIPUS[row.tipus]} label={TIPUS[row.tipus].label} /></td>
        <td className="td text-right tabular-nums">{formatEur(row.pressupost)}</td>
        <td className="td tabular-nums">{fmtDate(row.data_tancament) ?? <span className="text-[var(--color-muted)]">—</span>}</td>
        <td className="td"><Badge swatch={ESTAT[row.estat]} label={ESTAT[row.estat].label} dot /></td>
        <td className="td whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            <IconBtn title="Editar" onClick={() => setEditing(true)} className="text-[var(--color-accent)]">✎</IconBtn>
            <IconBtn
              title="Eliminar"
              className="text-red-700"
              onClick={() => {
                if (confirm(`Eliminar l'expedient ${row.num_expedient}?`)) {
                  startTransition(() => deleteExpedientAction(row.id));
                }
              }}
            >
              ✕
            </IconBtn>
          </div>
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
        <select className="input" value={tipologiaId} onChange={(e) => setTipologiaId(e.target.value)}>
          <option value="">—</option>
          {tipologies.map((t) => (
            <option key={t.id} value={t.id}>{t.nom}</option>
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
      <td className="td align-top whitespace-nowrap">
        <div className="flex items-center justify-end gap-1">
          <IconBtn title="Desar" onClick={save} disabled={pending} className="text-[var(--color-accent)]">✓</IconBtn>
          <IconBtn
            title="Cancel·lar"
            className="text-[var(--color-muted)]"
            onClick={() => {
              reset();
              setEditing(false);
            }}
          >
            ✕
          </IconBtn>
        </div>
      </td>
    </tr>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  className = "",
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-sm hover:bg-[var(--color-paper)] disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

function DedicacioModal({
  expedient,
  dedicacions,
  onClose,
}: {
  expedient: Expedient | null;
  dedicacions: Dedicacio[];
  onClose: () => void;
}) {
  const total = dedicacions.reduce((s, d) => s + (parseFloat(d.hores) || 0), 0);
  return (
    <Modal
      open={expedient != null}
      onClose={onClose}
      wide
      title={
        expedient && (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-[var(--color-accent)]">{expedient.num_expedient}</span>
              <Badge swatch={TIPUS[expedient.tipus]} label={TIPUS[expedient.tipus].label} />
              <Badge swatch={ESTAT[expedient.estat]} label={ESTAT[expedient.estat].label} dot />
            </div>
            <h3 className="text-base font-semibold">{expedient.projecte ?? "Sense projecte"}</h3>
          </div>
        )
      }
    >
      {expedient && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Hores dedicades" value={fmtHores(total)} accent="#1f4d3f" />
            <KpiCard label="Dies" value={String(new Set(dedicacions.map((d) => d.data)).size)} accent="#3b82f6" />
            <KpiCard label="Pressupost" value={formatEur(expedient.pressupost)} accent="#7c3aed" />
          </div>

          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)] pt-2">
            Dedicació vinculada
          </h4>
          {dedicacions.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">Encara no hi ha hores registrades en aquest expedient.</p>
          ) : (
            <div className="table-wrap">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th w-28">Data</th>
                    <th className="th w-24 text-right">Hores</th>
                    <th className="th">Tasca</th>
                    <th className="th">Comentari</th>
                  </tr>
                </thead>
                <tbody>
                  {dedicacions.map((d) => (
                    <tr key={d.id}>
                      <td className="td tabular-nums">{fmtDate(d.data)}</td>
                      <td className="td text-right tabular-nums">{fmtHores(parseFloat(d.hores) || 0)}</td>
                      <td className="td">{d.tasca ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                      <td className="td text-[var(--color-muted)]">{d.comentari ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ============================================================================
// Estadístiques
// ============================================================================

function anyOf(num: string): string {
  const m = /^(\d{2})-/.exec(num);
  return m ? `20${m[1]}` : "—";
}

function StatsPanel({ rows, tipologies }: { rows: Expedient[]; tipologies: Tipologia[] }) {
  const [fAny, setFAny] = useState("");
  const [fEstat, setFEstat] = useState("");
  const [fCategoria, setFCategoria] = useState("");
  const [fTipologia, setFTipologia] = useState("");
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
        if (fTipologia && String(r.tipologia_id ?? "") !== fTipologia) return false;
        if (fTipus && r.tipus !== fTipus) return false;
        if (fCiutat && (r.ciutat ?? "").trim() !== fCiutat) return false;
        return true;
      }),
    [rows, fAny, fEstat, fCategoria, fTipologia, fTipus, fCiutat],
  );

  const total = filtered.length;
  const oberts = filtered.filter((r) => r.estat === "obert").length;
  const tancats = total - oberts;
  const publics = filtered.filter((r) => r.tipus === "public").length;
  const privats = total - publics;
  const pressupostTotal = filtered.reduce((s, r) => s + (parseFloat(r.pressupost) || 0), 0);
  const pressupostPublic = filtered.filter((r) => r.tipus === "public").reduce((s, r) => s + (parseFloat(r.pressupost) || 0), 0);
  const pressupostPrivat = pressupostTotal - pressupostPublic;
  const pressupostObert = filtered.filter((r) => r.estat === "obert").reduce((s, r) => s + (parseFloat(r.pressupost) || 0), 0);
  const pressupostMitja = total ? pressupostTotal / total : 0;

  const byCiutat = groupBy(filtered, (r) => (r.ciutat ?? "").trim() || "(Sense ciutat)");
  const byAny = groupBy(filtered, (r) => anyOf(r.num_expedient)).sort((a, b) => a.key.localeCompare(b.key));
  const catGroups = CATEGORIES.map((c) => ({
    code: c.code,
    label: c.label,
    color: c.color,
    count: filtered.filter((r) => r.categoria === c.code).length,
  })).filter((g) => g.count > 0);
  const byTipologia = groupBy(filtered, (r) => r.tipologia_nom ?? "(Sense tipologia)");

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <div className="rounded-2xl border border-[var(--color-line)] bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <FilterSelect label="Any" value={fAny} onChange={setFAny} options={anys.map((a) => [a, a])} />
          <FilterSelect label="Estat" value={fEstat} onChange={setFEstat} options={[["obert", "Oberts"], ["tancat", "Tancats"]]} />
          <FilterSelect label="Categoria" value={fCategoria} onChange={setFCategoria} options={CATEGORIES.map((c) => [c.code, c.label])} />
          <FilterSelect label="Tipologia" value={fTipologia} onChange={setFTipologia} options={tipologies.map((t) => [String(t.id), t.nom])} />
          <FilterSelect label="Tipus" value={fTipus} onChange={setFTipus} options={[["privat", "Privat"], ["public", "Públic"]]} />
          <FilterSelect label="Ciutat" value={fCiutat} onChange={setFCiutat} options={ciutats.map((c) => [c, c])} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Expedients" value={String(total)} accent="#1f4d3f" hint={`${oberts} oberts · ${tancats} tancats`} />
        <KpiCard label="Pressupost total" value={formatEur(pressupostTotal)} accent="#0ea5e9" hint="Suma dels filtrats" />
        <KpiCard label="Pressupost en obert" value={formatEur(pressupostObert)} accent="#ef4444" hint={`${oberts} oberts`} />
        <KpiCard label="Pressupost mitjà" value={formatEur(pressupostMitja)} accent="#a855f7" hint="Per expedient" />
      </div>

      {/* Donuts */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ChartCard title="Estat dels expedients" meta="oberts / tancats">
          <GradientDonut
            segments={[
              { label: "Oberts", value: oberts, color: ESTAT.obert.color },
              { label: "Tancats", value: tancats, color: ESTAT.tancat.color },
            ]}
            centerValue={String(total)}
            centerLabel="expedients"
          />
        </ChartCard>
        <ChartCard title="Tipus d'expedient" meta="privat / públic">
          <GradientDonut
            segments={[
              { label: "Privat", value: privats, color: TIPUS.privat.color, note: formatEur(pressupostPrivat) },
              { label: "Públic", value: publics, color: TIPUS.public.color, note: formatEur(pressupostPublic) },
            ]}
            centerValue={String(total)}
            centerLabel="expedients"
          />
        </ChartCard>
      </div>

      {/* Pressupost per tipus */}
      <ChartCard title="Pressupost per tipus" meta="% del total">
        {pressupostTotal === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">Sense dades.</p>
        ) : (
          <StackedBar
            segments={[
              { label: "Privat", value: pressupostPrivat, color: TIPUS.privat.color },
              { label: "Públic", value: pressupostPublic, color: TIPUS.public.color },
            ]}
            total={pressupostTotal}
            fmt={formatEur}
          />
        )}
      </ChartCard>

      {/* Categoria */}
      <ChartCard title="Expedients per categoria" meta="nombre">
        <VBarChart bars={catGroups.map((g) => ({ label: g.label, value: g.count, color: g.color, display: String(g.count) }))} />
      </ChartCard>

      {/* Tipologia */}
      <ChartCard title="Expedients per tipologia" meta="nombre">
        <HBarChart bars={byTipologia.map((g) => ({ label: g.key, value: g.count, color: tipologiaSwatch(g.key).color, display: String(g.count) }))} />
      </ChartCard>

      {/* Ciutat + Any */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Expedients per ciutat" meta="nombre">
          <HBarChart bars={byCiutat.map((g) => ({ label: g.key, value: g.count, color: "#6366f1", display: String(g.count) }))} />
        </ChartCard>
        <ChartCard title="Expedients per any" meta="nombre">
          <VBarChart bars={byAny.map((g) => ({ label: g.key, value: g.count, color: "#1f4d3f", display: String(g.count) }))} />
        </ChartCard>
      </div>
    </div>
  );
}

interface Group {
  key: string;
  count: number;
}

function groupBy(rows: Expedient[], keyFn: (r: Expedient) => string): Group[] {
  const map = new Map<string, Group>();
  for (const r of rows) {
    const key = keyFn(r);
    const g = map.get(key) ?? { key, count: 0 };
    g.count += 1;
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
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </div>
  );
}
