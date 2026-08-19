"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { deletePropostaDocAction, duplicatePropostaDocAction } from "./actions";
import { formatDataCa, formatEur, todayIso } from "@/lib/format";
import { openListPdf, openStatsPdf } from "@/lib/pdf";
import { ChartCard, GradientDonut, HBarChart, KpiCard, VBarChart } from "@/components/charts";
import type { PropostaDoc, PropostaDocEstat } from "@/types/db";

type Row = PropostaDoc & { client_nom: string | null; total: string };

const ESTAT_META: Record<PropostaDocEstat, { label: string; bg: string; text: string; color: string }> = {
  pendent: { label: "Pendent", bg: "#fef9c3", text: "#854d0e", color: "#eab308" },
  acceptada: { label: "Acceptada", bg: "#dcfce7", text: "#15803d", color: "#16a34a" },
  rebutjada: { label: "Rebutjada", bg: "#fee2e2", text: "#b91c1c", color: "#dc2626" },
};
const ESTATS: PropostaDocEstat[] = ["pendent", "acceptada", "rebutjada"];

type Tab = "propostes" | "estadistiques";

const trimOf = (d: string | null | undefined) => (d ? String(Math.ceil(Number(d.slice(5, 7)) / 3)) : "");
const num = (v: string | null | undefined) => parseFloat(v ?? "") || 0;
const pctFmt = new Intl.NumberFormat("ca-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtPct = (part: number, whole: number) => `${pctFmt.format(whole > 0 ? (part / whole) * 100 : 0)}%`;

export function PropostesListView({ rows }: { rows: Row[] }) {
  const [tab, setTab] = useState<Tab>("propostes");
  const [listCount, setListCount] = useState(rows.length);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 mb-6 border-b border-[var(--color-line)]">
        <TabBtn current={tab} value="propostes" onClick={setTab}>
          Propostes ({listCount})
        </TabBtn>
        <TabBtn current={tab} value="estadistiques" onClick={setTab}>
          Estadístiques
        </TabBtn>
      </div>

      {tab === "propostes" && <PropostesList rows={rows} onCount={setListCount} />}
      {tab === "estadistiques" && <PropostesStats rows={rows} />}
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
// Llista de propostes
// ============================================================================

function PropostesList({ rows, onCount }: { rows: Row[]; onCount: (n: number) => void }) {
  const [query, setQuery] = useState("");
  const [fAny, setFAny] = useState(String(new Date().getFullYear()));
  const [fTrim, setFTrim] = useState("");
  const [fClient, setFClient] = useState("");
  const [fEstat, setFEstat] = useState("");

  const anys = useMemo(
    () => Array.from(new Set(rows.map((r) => (r.data ?? "").slice(0, 4)).filter(Boolean))).sort().reverse(),
    [rows],
  );
  const clients = useMemo(
    () => Array.from(new Set(rows.map((r) => r.client_nom ?? "").filter(Boolean))).sort((a, b) => a.localeCompare(b, "ca")),
    [rows],
  );

  const q = query.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (fAny && (r.data ?? "").slice(0, 4) !== fAny) return false;
    if (fTrim && trimOf(r.data) !== fTrim) return false;
    if (fClient && (r.client_nom ?? "") !== fClient) return false;
    if (fEstat && r.estat !== fEstat) return false;
    if (q) {
      const hay = `${r.num} ${r.descripcio ?? ""} ${r.client_nom ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  useEffect(() => onCount(filtered.length), [filtered.length, onCount]);

  const filterSummary = [fAny && `Any ${fAny}`, fTrim && `T${fTrim}`, fClient, fEstat && (ESTAT_META[fEstat as PropostaDocEstat]?.label ?? fEstat), q && `"${query.trim()}"`].filter(Boolean).join(" · ") || "Totes les propostes";
  function exportPdf() {
    openListPdf({
      title: "Propostes d'honoraris",
      subtitle: filterSummary,
      columns: [{ label: "Núm." }, { label: "Data" }, { label: "Descripció" }, { label: "Client" }, { label: "Import", align: "right" }, { label: "Estat" }],
      rows: filtered.map((r) => [r.num, formatDataCa(r.data), r.descripcio ?? "—", r.client_nom ?? "—", formatEur(r.total), ESTAT_META[r.estat].label]),
    });
  }

  if (rows.length === 0) {
    return (
      <div className="card text-sm text-[var(--color-muted)]">
        Encara no hi ha cap proposta. Crea&apos;n una de nova per començar.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Any</label>
          <select className="input" value={fAny} onChange={(e) => setFAny(e.target.value)}>
            <option value="">Tots</option>
            {anys.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Trimestre</label>
          <select className="input" value={fTrim} onChange={(e) => setFTrim(e.target.value)}>
            <option value="">Tots</option>
            <option value="1">T1 (gen–mar)</option>
            <option value="2">T2 (abr–jun)</option>
            <option value="3">T3 (jul–set)</option>
            <option value="4">T4 (oct–des)</option>
          </select>
        </div>
        <div className="flex-1 min-w-56">
          <label className="label">Cercar</label>
          <input className="input" placeholder="Núm., descripció, ciutat…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div>
          <label className="label">Client</label>
          <select className="input" value={fClient} onChange={(e) => setFClient(e.target.value)}>
            <option value="">Tots</option>
            {clients.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Estat</label>
          <select className="input" value={fEstat} onChange={(e) => setFEstat(e.target.value)}>
            <option value="">Tots</option>
            <option value="pendent">Pendent</option>
            <option value="acceptada">Acceptada</option>
            <option value="rebutjada">Rebutjada</option>
          </select>
        </div>
        <div className="ml-auto">
          <button type="button" className="btn-ghost inline-flex items-center gap-1.5" onClick={exportPdf} title="Genera un PDF de les propostes filtrades">
            <PdfIcon /> PDF
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th text-center w-28">Núm.</th>
              <th className="th text-center w-32">Data</th>
              <th className="th text-left">Descripció</th>
              <th className="th text-left">Client</th>
              <th className="th text-right w-36">Import</th>
              <th className="th text-center w-32">Estat</th>
              <th className="th text-center w-52"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const m = ESTAT_META[r.estat];
              return (
                <tr key={r.id}>
                  <td className="td text-center font-mono">{r.num}</td>
                  <td className="td text-center tabular-nums">{formatDataCa(r.data)}</td>
                  <td className="td text-left">{r.descripcio ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                  <td className="td text-left">{r.client_nom ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                  <td className="td text-right tabular-nums">{formatEur(r.total)}</td>
                  <td className="td text-center">
                    <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: m.bg, color: m.text }}>
                      {m.label}
                    </span>
                  </td>
                  <td className="td text-center whitespace-nowrap">
                    <Link href={`/propostes/${r.id}`} className="text-[var(--color-accent)] hover:underline mr-3">Obrir</Link>
                    <form action={duplicatePropostaDocAction} className="inline">
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className="text-[var(--color-accent)] hover:underline text-sm mr-3">Duplicar</button>
                    </form>
                    <form action={deletePropostaDocAction} className="inline" onSubmit={(e) => { if (!confirm("Eliminar aquesta proposta?")) e.preventDefault(); }}>
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className="text-red-700 hover:underline text-sm">Eliminar</button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td className="td text-center text-[var(--color-muted)]" colSpan={7}>Cap resultat.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// Estadístiques — pendents vs acceptades
// ============================================================================

const SENSE_CLIENT = "(Sense client)";
const dies = (iso: string | null | undefined, today: string) =>
  iso ? Math.max(0, Math.round((Date.parse(today) - Date.parse(iso)) / 86_400_000)) : 0;

interface ClientStat {
  label: string;
  total: number;
  pendents: number;
  acceptades: number;
  rebutjades: number;
  importAcceptat: number;
  importPendent: number;
}

function PropostesStats({ rows }: { rows: Row[] }) {
  const [fAny, setFAny] = useState(String(new Date().getFullYear()));
  const [fClient, setFClient] = useState("");
  const [query, setQuery] = useState("");

  // El panell només es munta en clicar la pestanya, així que no hi ha SSR:
  // podem llegir la data d'avui directament sense risc d'hidratació.
  const today = todayIso();

  const anys = useMemo(
    () => Array.from(new Set(rows.map((r) => (r.data ?? "").slice(0, 4)).filter(Boolean))).sort().reverse(),
    [rows],
  );
  const clients = useMemo(
    () => Array.from(new Set(rows.map((r) => r.client_nom ?? "").filter(Boolean))).sort((a, b) => a.localeCompare(b, "ca")),
    [rows],
  );

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (fAny && (r.data ?? "").slice(0, 4) !== fAny) return false;
        if (fClient && (r.client_nom ?? "") !== fClient) return false;
        if (q) {
          const hay = `${r.num} ${r.descripcio ?? ""} ${r.client_nom ?? ""} ${r.ciutat ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    [rows, fAny, fClient, q],
  );

  // Recompte i import per estat.
  const perEstat = useMemo(() => {
    const m = Object.fromEntries(ESTATS.map((e) => [e, { count: 0, money: 0 }])) as Record<
      PropostaDocEstat,
      { count: number; money: number }
    >;
    for (const r of filtered) {
      const e = m[r.estat];
      if (!e) continue;
      e.count += 1;
      e.money += num(r.total);
    }
    return m;
  }, [filtered]);

  const total = filtered.length;
  const importTotal = filtered.reduce((s, r) => s + num(r.total), 0);
  const pendents = perEstat.pendent.count;
  const acceptades = perEstat.acceptada.count;
  const rebutjades = perEstat.rebutjada.count;
  const resoltes = acceptades + rebutjades;
  const taxa = resoltes > 0 ? fmtPct(acceptades, resoltes) : "—";
  const importMitja = total ? importTotal / total : 0;

  // Propostes obertes, de la més antiga a la més recent: la llista de seguiment.
  const llistaPendents = useMemo(
    () =>
      filtered
        .filter((r) => r.estat === "pendent")
        .sort((a, b) => (a.data ?? "").localeCompare(b.data ?? "")),
    [filtered],
  );

  // Conversió per client.
  const perClient = useMemo(() => {
    const map = new Map<string, ClientStat>();
    for (const r of filtered) {
      const label = (r.client_nom ?? "").trim() || SENSE_CLIENT;
      const g = map.get(label) ?? { label, total: 0, pendents: 0, acceptades: 0, rebutjades: 0, importAcceptat: 0, importPendent: 0 };
      g.total += 1;
      if (r.estat === "pendent") { g.pendents += 1; g.importPendent += num(r.total); }
      if (r.estat === "acceptada") { g.acceptades += 1; g.importAcceptat += num(r.total); }
      if (r.estat === "rebutjada") g.rebutjades += 1;
      map.set(label, g);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.importAcceptat - a.importAcceptat || b.importPendent - a.importPendent || a.label.localeCompare(b.label, "ca"),
    );
  }, [filtered]);

  // Evolució: per trimestre si hi ha un any triat, per any si no.
  const serie = useMemo(() => {
    const add = (map: Map<string, { acceptat: number; pendent: number }>, key: string, r: Row) => {
      const g = map.get(key) ?? { acceptat: 0, pendent: 0 };
      if (r.estat === "acceptada") g.acceptat += num(r.total);
      if (r.estat === "pendent") g.pendent += num(r.total);
      map.set(key, g);
    };
    const map = new Map<string, { acceptat: number; pendent: number }>();
    if (fAny) {
      for (const t of [1, 2, 3, 4]) map.set(`T${t}`, { acceptat: 0, pendent: 0 });
      for (const r of filtered) add(map, `T${trimOf(r.data)}`, r);
      return Array.from(map.entries()).filter(([k]) => k !== "T");
    }
    for (const r of filtered) {
      const y = (r.data ?? "").slice(0, 4);
      if (y) add(map, y, r);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, fAny]);

  const filterSummary = [fAny ? `Any ${fAny}` : "Tots els anys", fClient, q && `"${query.trim()}"`]
    .filter(Boolean)
    .join(" · ");

  function exportStatsPdf() {
    openStatsPdf({
      title: "Propostes — Estadístiques",
      subtitle: filterSummary,
      kpis: [
        { label: "Propostes", value: String(total) },
        { label: "Pendents", value: `${pendents} · ${formatEur(perEstat.pendent.money)}` },
        { label: "Acceptades", value: `${acceptades} · ${formatEur(perEstat.acceptada.money)}` },
        { label: "Rebutjades", value: `${rebutjades} · ${formatEur(perEstat.rebutjada.money)}` },
        { label: "Taxa d'acceptació", value: taxa },
      ],
      tables: [
        {
          title: `Propostes pendents (${llistaPendents.length})`,
          columns: [
            { label: "Núm." },
            { label: "Data", align: "center" },
            { label: "Dies", align: "right" },
            { label: "Client" },
            { label: "Descripció" },
            { label: "Import", align: "right" },
          ],
          rows: llistaPendents.map((r) => [
            r.num,
            formatDataCa(r.data),
            String(dies(r.data, today)),
            r.client_nom ?? "—",
            r.descripcio ?? "—",
            formatEur(r.total),
          ]),
        },
        {
          title: "Per client",
          columns: [
            { label: "Client" },
            { label: "Propostes", align: "right" },
            { label: "Acceptades", align: "right" },
            { label: "Pendents", align: "right" },
            { label: "Taxa", align: "right" },
            { label: "Import acceptat", align: "right" },
            { label: "Import pendent", align: "right" },
          ],
          rows: perClient.map((g) => [
            g.label,
            String(g.total),
            String(g.acceptades),
            String(g.pendents),
            g.acceptades + g.rebutjades > 0 ? fmtPct(g.acceptades, g.acceptades + g.rebutjades) : "—",
            formatEur(g.importAcceptat),
            formatEur(g.importPendent),
          ]),
        },
        {
          title: fAny ? `Import per trimestre (${fAny})` : "Import per any",
          columns: [{ label: fAny ? "Trimestre" : "Any" }, { label: "Acceptat", align: "right" }, { label: "Pendent", align: "right" }],
          rows: serie.map(([label, g]) => [label, formatEur(g.acceptat), formatEur(g.pendent)]),
        },
      ],
    });
  }

  if (rows.length === 0) {
    return <div className="card text-sm text-[var(--color-muted)]">Encara no hi ha cap proposta per analitzar.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <div className="rounded-2xl border border-[var(--color-line)] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid flex-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Any</label>
              <select className="input" value={fAny} onChange={(e) => setFAny(e.target.value)}>
                <option value="">Tots</option>
                {anys.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Client</label>
              <select className="input" value={fClient} onChange={(e) => setFClient(e.target.value)}>
                <option value="">Tots</option>
                {clients.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Cercar</label>
              <input className="input" placeholder="Núm., descripció, ciutat…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
          <button type="button" className="btn-ghost shrink-0 inline-flex items-center gap-1.5" onClick={exportStatsPdf} title="Genera un PDF de les estadístiques filtrades">
            <PdfIcon /> PDF
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Propostes"
          value={String(total)}
          accent="#1f4d3f"
          hint={`${formatEur(importTotal)} · ${formatEur(importMitja)} de mitjana`}
        />
        <KpiCard
          label="Import pendent"
          value={formatEur(perEstat.pendent.money)}
          accent={ESTAT_META.pendent.color}
          hint={`${pendents} ${pendents === 1 ? "proposta oberta" : "propostes obertes"}`}
        />
        <KpiCard
          label="Import acceptat"
          value={formatEur(perEstat.acceptada.money)}
          accent={ESTAT_META.acceptada.color}
          hint={`${acceptades} ${acceptades === 1 ? "acceptada" : "acceptades"}`}
        />
        <KpiCard
          label="Taxa d'acceptació"
          value={taxa}
          accent={ESTAT_META.acceptada.color}
          hint={resoltes > 0 ? `${acceptades}/${resoltes} resoltes · ${pendents} pendents` : "Cap proposta resolta"}
        />
      </div>

      {/* Donuts: nombre i import per estat */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ChartCard title="Estat de les propostes" meta="nombre">
          <GradientDonut
            segments={ESTATS.map((e) => ({
              label: ESTAT_META[e].label,
              value: perEstat[e].count,
              color: ESTAT_META[e].color,
              note: formatEur(perEstat[e].money),
            }))}
            centerValue={String(total)}
            centerLabel="propostes"
          />
        </ChartCard>
        <ChartCard title="Import per estat" meta="import · % del total">
          {importTotal === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">Sense dades.</p>
          ) : (
            <GradientDonut
              segments={ESTATS.map((e) => ({
                label: ESTAT_META[e].label,
                value: Math.round(perEstat[e].money),
                color: ESTAT_META[e].color,
                count: perEstat[e].count,
                note: formatEur(perEstat[e].money),
              }))}
              centerValue={formatEur(importTotal)}
              centerLabel="import"
            />
          )}
        </ChartCard>
      </div>

      {/* Evolució acceptat vs pendent */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ChartCard title={fAny ? `Import acceptat per trimestre (${fAny})` : "Import acceptat per any"} meta="acceptades">
          <VBarChart
            bars={serie.map(([label, g]) => ({
              label,
              value: g.acceptat,
              color: ESTAT_META.acceptada.color,
              display: formatEur(g.acceptat),
            }))}
          />
        </ChartCard>
        <ChartCard title={fAny ? `Import pendent per trimestre (${fAny})` : "Import pendent per any"} meta="pendents">
          <VBarChart
            bars={serie.map(([label, g]) => ({
              label,
              value: g.pendent,
              color: ESTAT_META.pendent.color,
              display: formatEur(g.pendent),
            }))}
          />
        </ChartCard>
      </div>

      {/* Import pendent per client */}
      <ChartCard title="Import pendent per client" meta="top 10 · propostes obertes">
        <HBarChart
          bars={perClient
            .filter((g) => g.importPendent > 0)
            .sort((a, b) => b.importPendent - a.importPendent)
            .slice(0, 10)
            .map((g) => ({
              label: g.label,
              value: g.importPendent,
              color: ESTAT_META.pendent.color,
              display: formatEur(g.importPendent),
            }))}
        />
      </ChartCard>

      {/* Seguiment de pendents */}
      <ChartCard title={`Propostes pendents (${llistaPendents.length})`} meta="de la més antiga a la més recent">
        <p className="mb-4 text-xs leading-relaxed text-[var(--color-muted)]">
          Propostes encara obertes, ordenades per antiguitat: la llista de qui val la pena
          reclamar. Els dies es compten des de la data de la proposta.
        </p>
        {llistaPendents.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">Cap proposta pendent amb aquests filtres.</p>
        ) : (
          <div className="table-wrap">
            <table className="table-compact w-full">
              <thead>
                <tr>
                  <th className="th text-center w-28">Núm.</th>
                  <th className="th text-center w-32">Data</th>
                  <th className="th text-right w-20">Dies</th>
                  <th className="th text-left">Client</th>
                  <th className="th text-left">Descripció</th>
                  <th className="th text-right w-36">Import</th>
                  <th className="th text-center w-20"></th>
                </tr>
              </thead>
              <tbody>
                {llistaPendents.map((r) => {
                  const d = dies(r.data, today);
                  return (
                    <tr key={r.id}>
                      <td className="td text-center font-mono">{r.num}</td>
                      <td className="td text-center tabular-nums">{formatDataCa(r.data)}</td>
                      <td className={`td text-right tabular-nums font-medium ${d >= 60 ? "text-red-700" : d >= 30 ? "text-amber-700" : "text-[var(--color-muted)]"}`}>{d}</td>
                      <td className="td text-left">{r.client_nom ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                      <td className="td text-left">{r.descripcio ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                      <td className="td text-right tabular-nums">{formatEur(r.total)}</td>
                      <td className="td text-center">
                        <Link href={`/propostes/${r.id}`} className="text-[var(--color-accent)] hover:underline">Obrir</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--color-paper)]">
                  <td className="td text-left font-semibold" colSpan={5}>Total pendent ({llistaPendents.length})</td>
                  <td className="td text-right font-semibold tabular-nums">{formatEur(perEstat.pendent.money)}</td>
                  <td className="td"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </ChartCard>

      {/* Conversió per client */}
      <ChartCard title="Per client" meta="conversió · import">
        {perClient.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">Sense dades.</p>
        ) : (
          <div className="table-wrap">
            <table className="table-compact w-full">
              <thead>
                <tr>
                  <th className="th text-left">Client</th>
                  <th className="th text-right w-24">Propostes</th>
                  <th className="th text-right w-24">Acceptades</th>
                  <th className="th text-right w-24">Pendents</th>
                  <th className="th text-right w-24">Taxa</th>
                  <th className="th text-right w-36">Import acceptat</th>
                  <th className="th text-right w-36">Import pendent</th>
                </tr>
              </thead>
              <tbody>
                {perClient.map((g) => {
                  const res = g.acceptades + g.rebutjades;
                  return (
                    <tr key={g.label}>
                      <td className="td text-left">{g.label}</td>
                      <td className="td text-right tabular-nums">{g.total}</td>
                      <td className="td text-right tabular-nums">{g.acceptades}</td>
                      <td className="td text-right tabular-nums">{g.pendents}</td>
                      <td className="td text-right tabular-nums">{res > 0 ? fmtPct(g.acceptades, res) : "—"}</td>
                      <td className="td text-right tabular-nums font-medium">{formatEur(g.importAcceptat)}</td>
                      <td className="td text-right tabular-nums">{formatEur(g.importPendent)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--color-paper)]">
                  <td className="td text-left font-semibold">Total ({perClient.length} clients)</td>
                  <td className="td text-right font-semibold tabular-nums">{total}</td>
                  <td className="td text-right font-semibold tabular-nums">{acceptades}</td>
                  <td className="td text-right font-semibold tabular-nums">{pendents}</td>
                  <td className="td text-right font-semibold tabular-nums">{taxa}</td>
                  <td className="td text-right font-semibold tabular-nums">{formatEur(perEstat.acceptada.money)}</td>
                  <td className="td text-right font-semibold tabular-nums">{formatEur(perEstat.pendent.money)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

function PdfIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M12 18v-6" /><path d="m9 15 3 3 3-3" />
    </svg>
  );
}
