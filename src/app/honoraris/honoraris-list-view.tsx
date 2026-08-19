"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { deletePropostaAction } from "./actions";
import { formatDataCa, formatEur } from "@/lib/format";
import { openListPdf, openStatsPdf } from "@/lib/pdf";
import { ChartCard, HBarChart, KpiCard, VBarChart } from "@/components/charts";

export interface PropostaListRow {
  id: number;
  num_proposta: string | null;
  data: string;
  projecte: string | null;
  client_nom: string | null;
  contacte_prescriptor: string | null;
  total: string;
  es_ite?: boolean;
}

type Tab = "calculs" | "estadistiques";

const trimOf = (d: string) => (d ? String(Math.ceil(Number(d.slice(5, 7)) / 3)) : "");
const num = (v: string | null | undefined) => parseFloat(v ?? "") || 0;

export function HonorarisListView({ rows }: { rows: PropostaListRow[] }) {
  const [tab, setTab] = useState<Tab>("calculs");
  const [listCount, setListCount] = useState(rows.length);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 mb-6 border-b border-[var(--color-line)]">
        <TabBtn current={tab} value="calculs" onClick={setTab}>
          Càlculs ({listCount})
        </TabBtn>
        <TabBtn current={tab} value="estadistiques" onClick={setTab}>
          Estadístiques
        </TabBtn>
      </div>

      {tab === "calculs" && <CalculsList rows={rows} onCount={setListCount} />}
      {tab === "estadistiques" && <PrescriptorsStats rows={rows} />}
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
// Llista de càlculs
// ============================================================================

function CalculsList({ rows, onCount }: { rows: PropostaListRow[]; onCount: (n: number) => void }) {
  const [query, setQuery] = useState("");
  const [fAny, setFAny] = useState(String(new Date().getFullYear()));
  const [fTrim, setFTrim] = useState("");
  const [fClient, setFClient] = useState("");

  const anys = useMemo(
    () => Array.from(new Set(rows.map((r) => r.data.slice(0, 4)))).sort().reverse(),
    [rows],
  );
  const clients = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.client_nom ?? "").filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "ca"),
      ),
    [rows],
  );

  const q = query.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (fAny && r.data.slice(0, 4) !== fAny) return false;
    if (fTrim && trimOf(r.data) !== fTrim) return false;
    if (fClient && (r.client_nom ?? "") !== fClient) return false;
    if (q) {
      const hay = `${r.num_proposta ?? ""} ${r.projecte ?? ""} ${r.client_nom ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  useEffect(() => onCount(filtered.length), [filtered.length, onCount]);

  const totalSum = filtered.reduce((s, r) => s + num(r.total), 0);

  const filterSummary = [fAny && `Any ${fAny}`, fTrim && `T${fTrim}`, fClient, q && `"${query.trim()}"`].filter(Boolean).join(" · ") || "Tots els càlculs";
  function exportPdf() {
    openListPdf({
      title: "Càlculs d'honoraris",
      subtitle: filterSummary,
      columns: [{ label: "Núm." }, { label: "Data" }, { label: "Projecte" }, { label: "Client" }, { label: "Preu", align: "right" }],
      rows: filtered.map((r) => [`CH-${r.num_proposta ?? r.id}`, formatDataCa(r.data), r.projecte ?? "—", r.client_nom ?? "—", formatEur(r.total)]),
      totalRow: ["Total", "", "", `${filtered.length}`, formatEur(totalSum)],
    });
  }

  if (rows.length === 0) {
    return (
      <div className="card text-sm text-[var(--color-muted)]">
        Encara no hi ha cap càlcul. Crea&apos;n un de nou per començar.
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
            {anys.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
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
        <div className="flex-1 min-w-48">
          <label className="label">Cercar</label>
          <input className="input" placeholder="Núm., projecte o client…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div>
          <label className="label">Client</label>
          <select className="input" value={fClient} onChange={(e) => setFClient(e.target.value)}>
            <option value="">Tots</option>
            {clients.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto">
          <button type="button" className="btn-ghost inline-flex items-center gap-1.5" onClick={exportPdf} title="Genera un PDF dels càlculs filtrats">
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
              <th className="th text-left">Projecte</th>
              <th className="th text-left">Client</th>
              <th className="th text-right w-40">Preu</th>
              <th className="th text-center w-32"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="td text-center font-mono whitespace-nowrap">
                  CH-{r.num_proposta ?? r.id}
                  {r.es_ite && <span className="ml-1.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold not-italic text-green-700">ITE</span>}
                </td>
                <td className="td text-center tabular-nums">{formatDataCa(r.data)}</td>
                <td className="td text-left">{r.projecte ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                <td className="td text-left">{r.client_nom ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                <td className="td text-right tabular-nums">{formatEur(r.total)}</td>
                <td className="td text-center whitespace-nowrap">
                  <Link href={`/honoraris/${r.id}`} className="text-[var(--color-accent)] hover:underline mr-3">Obrir</Link>
                  <form action={deletePropostaAction} className="inline" onSubmit={(e) => { if (!confirm("Eliminar aquest càlcul?")) e.preventDefault(); }}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="text-red-700 hover:underline text-sm">Eliminar</button>
                  </form>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td className="td text-center text-[var(--color-muted)]" colSpan={6}>Cap resultat.</td>
              </tr>
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="bg-[var(--color-paper)]">
                <td className="td text-left font-semibold" colSpan={4}>Total ({filtered.length})</td>
                <td className="td text-right font-semibold tabular-nums">{formatEur(totalSum)}</td>
                <td className="td"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// Estadístiques de prescriptors
// ============================================================================

const SENSE = "(Sense prescriptor)";
const PALETTE = ["#1f4d3f", "#0ea5e9", "#a855f7", "#f59e0b", "#ef4444", "#10b981", "#6366f1", "#ec4899", "#14b8a6", "#f97316"];

// Free-text field: fold case and repeated spaces so "MMMU" and "mmmu " group.
const keyOf = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const pctFmt = new Intl.NumberFormat("ca-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtPct = (part: number, whole: number) => `${pctFmt.format(whole > 0 ? (part / whole) * 100 : 0)}%`;

interface PrescriptorStat {
  key: string;
  label: string;
  count: number;
  total: number;
  avg: number;
  primer: string; // ISO date del primer càlcul
  ultim: string; // ISO date de l'últim càlcul
  rank: number;
}

function rankPrescriptors(rows: PropostaListRow[]): PrescriptorStat[] {
  const map = new Map<string, PrescriptorStat>();
  for (const r of rows) {
    const k = keyOf(r.contacte_prescriptor);
    if (!k) continue; // els càlculs sense prescriptor no entren al rànquing
    const g = map.get(k) ?? {
      key: k,
      label: (r.contacte_prescriptor ?? "").trim(),
      count: 0,
      total: 0,
      avg: 0,
      primer: r.data,
      ultim: r.data,
      rank: 0,
    };
    g.count += 1;
    g.total += num(r.total);
    if (r.data < g.primer) g.primer = r.data;
    if (r.data > g.ultim) g.ultim = r.data;
    map.set(k, g);
  }
  const items = Array.from(map.values());
  for (const g of items) g.avg = g.count ? g.total / g.count : 0;
  items.sort((a, b) => b.total - a.total || b.count - a.count || a.label.localeCompare(b.label, "ca"));
  items.forEach((g, i) => { g.rank = i + 1; });
  return items;
}

function PrescriptorsStats({ rows }: { rows: PropostaListRow[] }) {
  const [fAny, setFAny] = useState(String(new Date().getFullYear()));
  const [fPrescriptor, setFPrescriptor] = useState("");
  const [query, setQuery] = useState("");

  const anys = useMemo(
    () => Array.from(new Set(rows.map((r) => r.data.slice(0, 4)))).sort().reverse(),
    [rows],
  );
  const prescriptorOpts = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      const k = keyOf(r.contacte_prescriptor);
      if (k && !map.has(k)) map.set(k, (r.contacte_prescriptor ?? "").trim());
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], "ca"));
  }, [rows]);

  const q = query.trim().toLowerCase();

  // `base` ignora el filtre de prescriptor: el rànquing ha de poder comparar-los
  // entre ells encara que n'hi hagi un de seleccionat.
  const base = useMemo(
    () =>
      rows.filter((r) => {
        if (fAny && r.data.slice(0, 4) !== fAny) return false;
        if (q) {
          const hay = `${r.num_proposta ?? ""} ${r.projecte ?? ""} ${r.client_nom ?? ""} ${r.contacte_prescriptor ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    [rows, fAny, q],
  );
  const filtered = useMemo(
    () => (fPrescriptor ? base.filter((r) => keyOf(r.contacte_prescriptor) === fPrescriptor) : base),
    [base, fPrescriptor],
  );

  const ranked = useMemo(() => rankPrescriptors(base), [base]);

  const totalCalculs = filtered.length;
  const importTotal = filtered.reduce((s, r) => s + num(r.total), 0);
  const importMitja = totalCalculs ? importTotal / totalCalculs : 0;
  const senseCount = filtered.filter((r) => !keyOf(r.contacte_prescriptor)).length;
  const nPrescriptors = useMemo(
    () => new Set(filtered.map((r) => keyOf(r.contacte_prescriptor)).filter(Boolean)).size,
    [filtered],
  );

  // Concentració: quina part de la facturació depèn dels 5 primers prescriptors.
  const rankedTotal = ranked.reduce((s, g) => s + g.total, 0);
  const top5Total = ranked.slice(0, 5).reduce((s, g) => s + g.total, 0);
  const top5Pct = fmtPct(top5Total, rankedTotal);

  // Els 25 millors; si el prescriptor seleccionat en queda fora, s'hi afegeix.
  const top25 = ranked.slice(0, 25);
  const seleccionat = fPrescriptor ? ranked.find((g) => g.key === fPrescriptor) : undefined;
  const taula = seleccionat && seleccionat.rank > 25 ? [...top25, seleccionat] : top25;

  // Evolució: per trimestre si hi ha un any triat, per any si no.
  const serie = useMemo(() => {
    if (fAny) {
      const q4 = [1, 2, 3, 4].map((t) => ({ label: `T${t}`, value: 0 }));
      for (const r of filtered) {
        const i = Number(trimOf(r.data)) - 1;
        if (i >= 0 && i < 4) q4[i].value += num(r.total);
      }
      return q4;
    }
    const map = new Map<string, number>();
    for (const r of filtered) {
      const y = r.data.slice(0, 4);
      map.set(y, (map.get(y) ?? 0) + num(r.total));
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value }));
  }, [filtered, fAny]);

  const prescriptorLabel = fPrescriptor
    ? seleccionat?.label ?? prescriptorOpts.find(([k]) => k === fPrescriptor)?.[1] ?? fPrescriptor
    : "";
  const filterSummary = [
    fAny ? `Any ${fAny}` : "Tots els anys",
    prescriptorLabel,
    q && `"${query.trim()}"`,
  ].filter(Boolean).join(" · ");

  function exportStatsPdf() {
    openStatsPdf({
      title: "Honoraris — Prescriptors",
      subtitle: filterSummary,
      kpis: [
        { label: "Càlculs", value: String(totalCalculs) },
        { label: "Import total", value: formatEur(importTotal) },
        { label: "Import mitjà", value: formatEur(importMitja) },
        { label: "Prescriptors", value: String(nPrescriptors) },
        { label: "Import amb prescriptor", value: formatEur(rankedTotal) },
        { label: "Concentració top 5", value: top5Pct },
      ],
      tables: [
        {
          title: `Millors ${taula.length} prescriptors`,
          columns: [
            { label: "#", align: "right" },
            { label: "Prescriptor" },
            { label: "Càlculs", align: "right" },
            { label: "Import total", align: "right" },
            { label: "Import mitjà", align: "right" },
            { label: "% del total", align: "right" },
            { label: "Últim càlcul", align: "center" },
          ],
          rows: taula.map((g) => [
            String(g.rank),
            g.label,
            String(g.count),
            formatEur(g.total),
            formatEur(g.avg),
            fmtPct(g.total, rankedTotal),
            formatDataCa(g.ultim),
          ]),
        },
        {
          title: fAny ? `Import per trimestre (${fAny})` : "Import per any",
          columns: [{ label: fAny ? "Trimestre" : "Any" }, { label: "Import", align: "right" }],
          rows: serie.map((p) => [p.label, formatEur(p.value)]),
        },
      ],
    });
  }

  if (rows.length === 0) {
    return <div className="card text-sm text-[var(--color-muted)]">Encara no hi ha cap càlcul per analitzar.</div>;
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
                {anys.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Prescriptor</label>
              <select className="input" value={fPrescriptor} onChange={(e) => setFPrescriptor(e.target.value)}>
                <option value="">Tots</option>
                {prescriptorOpts.map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Cercar</label>
              <input className="input" placeholder="Prescriptor, projecte o client…" value={query} onChange={(e) => setQuery(e.target.value)} />
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
          label="Càlculs"
          value={String(totalCalculs)}
          accent="#1f4d3f"
          hint={senseCount > 0 ? `${senseCount} sense prescriptor` : "Tots amb prescriptor"}
        />
        <KpiCard label="Import total" value={formatEur(importTotal)} accent="#0ea5e9" hint="Suma dels filtrats" />
        <KpiCard label="Import mitjà" value={formatEur(importMitja)} accent="#a855f7" hint="Per càlcul" />
        <KpiCard
          label="Prescriptors"
          value={String(nPrescriptors)}
          accent="#f59e0b"
          hint={rankedTotal > 0 ? `Top 5 = ${top5Pct} de ${formatEur(rankedTotal)}` : "Sense import"}
        />
      </div>

      {/* Evolució */}
      <ChartCard
        title={fAny ? `Import per trimestre (${fAny})` : "Import per any"}
        meta={prescriptorLabel || "tots els prescriptors"}
      >
        <VBarChart
          bars={serie.map((p, i) => ({
            label: p.label,
            value: p.value,
            color: PALETTE[i % PALETTE.length],
            display: formatEur(p.value),
          }))}
        />
      </ChartCard>

      {/* Top 10 per import */}
      <ChartCard title="Prescriptors per import" meta={fAny ? `top 10 · ${fAny}` : "top 10 · tots els anys"}>
        <HBarChart
          bars={ranked.slice(0, 10).map((g, i) => ({
            label: g.label,
            value: g.total,
            color: PALETTE[i % PALETTE.length],
            display: formatEur(g.total),
          }))}
        />
      </ChartCard>

      {/* Rànquing */}
      <ChartCard title="Millors 25 prescriptors" meta="per import total">
        <p className="mb-4 text-xs leading-relaxed text-[var(--color-muted)]">
          Rànquing dels prescriptors que més honoraris han generat — la gent a qui val la pena
          cuidar. Respecta el filtre d&apos;any i el cercador, però no el de prescriptor (així es
          poden comparar entre ells); si en tries un que queda fora del top 25, la seva fila
          s&apos;hi afegeix al final. Els càlculs sense prescriptor no hi entren.
        </p>
        {taula.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">Sense dades.</p>
        ) : (
          <div className="table-wrap">
            <table className="table-compact w-full">
              <thead>
                <tr>
                  <th className="th text-right w-12">#</th>
                  <th className="th text-left">Prescriptor</th>
                  <th className="th text-right w-24">Càlculs</th>
                  <th className="th text-right w-36">Import total</th>
                  <th className="th text-right w-36">Import mitjà</th>
                  <th className="th text-right w-28">% del total</th>
                  <th className="th text-center w-32">Últim càlcul</th>
                </tr>
              </thead>
              <tbody>
                {taula.map((g) => {
                  const hi = fPrescriptor === g.key;
                  return (
                    <tr key={g.key} className={hi ? "bg-[var(--color-paper)]" : undefined}>
                      <td className="td text-right tabular-nums text-[var(--color-muted)]">{g.rank}</td>
                      <td className={`td text-left ${hi ? "font-semibold" : ""}`}>{g.label}</td>
                      <td className="td text-right tabular-nums">{g.count}</td>
                      <td className="td text-right tabular-nums font-medium">{formatEur(g.total)}</td>
                      <td className="td text-right tabular-nums">{formatEur(g.avg)}</td>
                      <td className="td text-right tabular-nums">{fmtPct(g.total, rankedTotal)}</td>
                      <td className="td text-center tabular-nums">{formatDataCa(g.ultim)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--color-paper)]">
                  <td className="td"></td>
                  <td className="td text-left font-semibold">Total ({ranked.length} prescriptors)</td>
                  <td className="td text-right font-semibold tabular-nums">{ranked.reduce((s, g) => s + g.count, 0)}</td>
                  <td className="td text-right font-semibold tabular-nums">{formatEur(rankedTotal)}</td>
                  <td className="td" colSpan={3}></td>
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
