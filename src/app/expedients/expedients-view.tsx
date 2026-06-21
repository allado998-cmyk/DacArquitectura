"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
import { ChartCard, GradientDonut, HBarChart, KpiCard } from "@/components/charts";

type Tab = "llista" | "estadistiques";

export interface CalculOpt {
  id: number;
  num_proposta: string | null;
  projecte: string | null;
  total: string;
}
export interface PropostaOpt {
  id: number;
  num: string;
  descripcio: string | null;
  total: string;
}

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
  calculs,
  propostes,
}: {
  expedients: Expedient[];
  clients: Client[];
  dedicacions: Dedicacio[];
  tipologies: Tipologia[];
  calculs: CalculOpt[];
  propostes: PropostaOpt[];
}) {
  const [tab, setTab] = useState<Tab>("llista");
  const [listCount, setListCount] = useState(expedients.length);
  const [, startTransition] = useTransition();

  const clientOpts: ComboOption[] = clients.map((c) => ({
    id: c.id,
    label: c.nom,
    sub: c.ciutat ?? undefined,
  }));

  // Distinct ciutats already in use (from expedients + clients) — used to offer
  // a quick-pick dropdown in the form while still allowing free text.
  const ciutats = useMemo(() => {
    const set = new Set<string>();
    for (const e of expedients) if (e.ciutat?.trim()) set.add(e.ciutat.trim());
    for (const c of clients) if (c.ciutat?.trim()) set.add(c.ciutat.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ca"));
  }, [expedients, clients]);

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
          Expedients ({listCount})
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

      {tab === "llista" && <ExpedientsList rows={expedients} clientOpts={clientOpts} ciutats={ciutats} dedicByExp={dedicByExp} tipologies={tipologies} calculs={calculs} propostes={propostes} onCount={setListCount} />}
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
  ciutats,
  dedicByExp,
  tipologies,
  calculs,
  propostes,
  onCount,
}: {
  rows: Expedient[];
  clientOpts: ComboOption[];
  ciutats: string[];
  dedicByExp: Map<number, Dedicacio[]>;
  tipologies: Tipologia[];
  calculs: CalculOpt[];
  propostes: PropostaOpt[];
  onCount: (n: number) => void;
}) {
  const [detail, setDetail] = useState<Expedient | null>(null);
  const [editing, setEditing] = useState<Expedient | null>(null);
  const [query, setQuery] = useState("");
  const [fAny, setFAny] = useState(String(new Date().getFullYear()));
  const [fClient, setFClient] = useState("");
  const [fCategoria, setFCategoria] = useState("");
  const [fTipus, setFTipus] = useState("");
  const [fTipologia, setFTipologia] = useState("");
  const [fWeb, setFWeb] = useState("");
  const [fEstat, setFEstat] = useState("");

  const anys = useMemo(() => Array.from(new Set(rows.map((r) => anyOf(r.num_expedient)))).sort().reverse(), [rows]);
  const clientsList = useMemo(
    () => Array.from(new Set(rows.map((r) => r.client_nom ?? "").filter(Boolean))).sort((a, b) => a.localeCompare(b, "ca")),
    [rows],
  );

  const q = query.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (fAny && anyOf(r.num_expedient) !== fAny) return false;
    if (fClient && (r.client_nom ?? "") !== fClient) return false;
    if (fCategoria && (r.categoria ?? "") !== fCategoria) return false;
    if (fTipus && r.tipus !== fTipus) return false;
    if (fTipologia && String(r.tipologia_id ?? "") !== fTipologia) return false;
    if (fWeb && (fWeb === "si") !== r.web) return false;
    if (fEstat && r.estat !== fEstat) return false;
    if (q) {
      const hay = `${r.num_expedient} ${r.projecte ?? ""} ${r.client_nom ?? ""} ${r.ciutat ?? ""} ${r.tipologia_nom ?? ""} ${r.categoria ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  useEffect(() => onCount(filtered.length), [filtered.length, onCount]);

  const filterSummary = [
    fAny && `Any ${fAny}`,
    fClient,
    fCategoria && (CATEGORY_BY_CODE[fCategoria]?.label ?? fCategoria),
    fTipologia && tipologies.find((t) => String(t.id) === fTipologia)?.nom,
    fTipus && (fTipus === "public" ? "Públic" : "Privat"),
    fWeb && `Web: ${fWeb === "si" ? "Sí" : "No"}`,
    fEstat && (fEstat === "obert" ? "Oberts" : "Tancats"),
    q && `"${query.trim()}"`,
  ].filter(Boolean).join(" · ") || "Tots els expedients";

  function exportPdf() {
    exportExpedientsListPdf(filtered, filterSummary);
  }

  if (rows.length === 0) {
    return (
      <div className="card text-sm text-[var(--color-muted)]">
        Encara no hi ha cap expedient. Crea&apos;n un de nou per començar.
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Any</label>
          <select className="input w-28" value={fAny} onChange={(e) => setFAny(e.target.value)}>
            <option value="">Tots</option>
            {anys.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-48">
          <label className="label">Cercar</label>
          <input className="input" placeholder="Projecte, client, núm.…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div>
          <label className="label">Client</label>
          <select className="input" value={fClient} onChange={(e) => setFClient(e.target.value)}>
            <option value="">Tots</option>
            {clientsList.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Categoria</label>
          <select className="input" value={fCategoria} onChange={(e) => setFCategoria(e.target.value)}>
            <option value="">Totes</option>
            {CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tipologia</label>
          <select className="input" value={fTipologia} onChange={(e) => setFTipologia(e.target.value)}>
            <option value="">Totes</option>
            {[...tipologies].sort((a, b) => a.nom.localeCompare(b.nom, "ca")).map((t) => <option key={t.id} value={String(t.id)}>{t.nom}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tipus</label>
          <select className="input" value={fTipus} onChange={(e) => setFTipus(e.target.value)}>
            <option value="">Tots</option>
            <option value="privat">Privat</option>
            <option value="public">Públic</option>
          </select>
        </div>
        <div>
          <label className="label">Web</label>
          <select className="input" value={fWeb} onChange={(e) => setFWeb(e.target.value)}>
            <option value="">Tots</option>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        </div>
        <div>
          <label className="label">Estat</label>
          <select className="input" value={fEstat} onChange={(e) => setFEstat(e.target.value)}>
            <option value="">Tots</option>
            <option value="obert">Obert</option>
            <option value="tancat">Tancat</option>
          </select>
        </div>
        <div className="ml-auto">
          <button type="button" className="btn-ghost inline-flex items-center gap-1.5" onClick={exportPdf} title="Genera un PDF dels expedients filtrats">
            <PdfIcon /> PDF
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table-compact w-full">
          <thead>
            <tr>
              <th className="th w-28">Núm.</th>
              <th className="th" style={{ minWidth: "16rem" }}>Projecte</th>
              <th className="th" style={{ minWidth: "16rem" }}>Client</th>
              <th className="th w-40">Ciutat</th>
              <th className="th w-44">Categoria</th>
              <th className="th w-44">Tipologia</th>
              <th className="th w-28">Tipus</th>
              <th className="th w-16 text-center">Web</th>
              <th className="th w-36 text-right">Pressupost</th>
              <th className="th w-32">Tancat el</th>
              <th className="th w-28">Estat</th>
              <th className="th w-20"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <ExpedientRow key={r.id} row={r} onOpen={() => setDetail(r)} onEdit={() => setEditing(r)} />
            ))}
            {filtered.length === 0 && (
              <tr><td className="td text-[var(--color-muted)]" colSpan={12}>Cap resultat.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <DedicacioModal
        expedient={detail}
        dedicacions={detail ? dedicByExp.get(detail.id) ?? [] : []}
        onClose={() => setDetail(null)}
      />

      <ExpedientEditModal row={editing} clientOpts={clientOpts} ciutats={ciutats} tipologies={tipologies} calculs={calculs} propostes={propostes} onClose={() => setEditing(null)} />
    </>
  );
}

function ExpedientRow({
  row,
  onOpen,
  onEdit,
}: {
  row: Expedient;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const [, startTransition] = useTransition();
  return (
    <tr className="cursor-pointer hover:bg-[var(--color-paper)]" onClick={onOpen}>
      <td className="td font-mono text-[var(--color-accent)]">{row.num_expedient}</td>
      <td className="td">{row.projecte ?? <span className="text-[var(--color-muted)]">—</span>}</td>
      <td className="td">{row.client_nom ?? <span className="text-[var(--color-muted)]">—</span>}</td>
      <td className="td">{row.ciutat ?? <span className="text-[var(--color-muted)]">—</span>}</td>
      <td className="td"><CategoriaBadge code={row.categoria} /></td>
      <td className="td"><TipologiaBadge nom={row.tipologia_nom} /></td>
      <td className="td"><Badge swatch={TIPUS[row.tipus]} label={TIPUS[row.tipus].label} /></td>
      <td className="td text-center">
        {row.web ? (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-700" title="Web: sí">✓</span>
        ) : (
          <span className="text-[var(--color-muted)]">—</span>
        )}
      </td>
      <td className="td text-right tabular-nums">{formatEur(row.pressupost)}</td>
      <td className="td tabular-nums">{fmtDate(row.data_tancament) ?? <span className="text-[var(--color-muted)]">—</span>}</td>
      <td className="td"><Badge swatch={ESTAT[row.estat]} label={ESTAT[row.estat].label} dot /></td>
      <td className="td whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <IconBtn title="Editar" onClick={onEdit} className="text-[var(--color-accent)]">✎</IconBtn>
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

function ExpedientEditModal({
  row,
  clientOpts,
  ciutats,
  tipologies,
  calculs,
  propostes,
  onClose,
}: {
  row: Expedient | null;
  clientOpts: ComboOption[];
  ciutats: string[];
  tipologies: Tipologia[];
  calculs: CalculOpt[];
  propostes: PropostaOpt[];
  onClose: () => void;
}) {
  return (
    <Modal
      open={row != null}
      onClose={onClose}
      wide
      title={row && <h3 className="text-base font-semibold">Editar expedient <span className="font-mono">{row.num_expedient}</span></h3>}
    >
      {row && <ExpedientForm key={row.id} row={row} clientOpts={clientOpts} ciutats={ciutats} tipologies={tipologies} calculs={calculs} propostes={propostes} onClose={onClose} />}
    </Modal>
  );
}

function ExpedientForm({
  row,
  clientOpts,
  ciutats,
  tipologies,
  calculs,
  propostes,
  onClose,
}: {
  row: Expedient;
  clientOpts: ComboOption[];
  ciutats: string[];
  tipologies: Tipologia[];
  calculs: CalculOpt[];
  propostes: PropostaOpt[];
  onClose: () => void;
}) {
  const [num, setNum] = useState(row.num_expedient);
  const [projecte, setProjecte] = useState(row.projecte ?? "");
  const [clientId, setClientId] = useState<number | null>(row.client_id);
  const [ciutat, setCiutat] = useState(row.ciutat ?? "");
  const [categoria, setCategoria] = useState<string>(row.categoria ?? "");
  const [tipologiaId, setTipologiaId] = useState<number | null>(row.tipologia_id);
  const [estat, setEstat] = useState(row.estat);
  const [tipus, setTipus] = useState(row.tipus);
  const [direccioObres, setDireccioObres] = useState(row.direccio_obres);
  const [web, setWeb] = useState(row.web);
  const [pressupost, setPressupost] = useState(row.pressupost);
  const [origen, setOrigen] = useState(row.pressupost_origen);
  const [calculId, setCalculId] = useState<number | null>(row.calcul_id);
  const [propostaDocId, setPropostaDocId] = useState<number | null>(row.proposta_doc_id);
  const [dataInici, setDataInici] = useState(row.data_inici ?? "");
  const [dataFinal, setDataFinal] = useState(row.data_final ?? "");
  const [dataTancament, setDataTancament] = useState(row.data_tancament ?? "");
  const [pending, startTransition] = useTransition();

  const calculOpts: ComboOption[] = calculs.map((c) => ({
    id: c.id,
    label: c.num_proposta ? `CH ${c.num_proposta}${c.projecte ? ` · ${c.projecte}` : ""}` : `#${c.id}`,
    sub: formatEur(c.total),
  }));
  const propostaOpts: ComboOption[] = propostes.map((p) => ({
    id: p.id,
    label: `${p.num}${p.descripcio ? ` · ${p.descripcio}` : ""}`,
    sub: formatEur(p.total),
  }));

  const linkedCalcul = calculs.find((c) => c.id === calculId);
  const linkedProposta = propostes.find((p) => p.id === propostaDocId);
  const effectivePressupost =
    origen === "calcul" ? linkedCalcul?.total ?? "0" : origen === "proposta" ? linkedProposta?.total ?? "0" : pressupost;

  function save() {
    if (!num.trim()) return;
    const patch: ExpedientPatch = {
      num_expedient: num,
      projecte,
      client_id: clientId,
      ciutat,
      categoria,
      tipologia_id: tipologiaId,
      estat,
      tipus,
      direccio_obres: direccioObres,
      web,
      pressupost: parseFloat(pressupost) || 0,
      pressupost_origen: origen,
      calcul_id: calculId,
      proposta_doc_id: propostaDocId,
      data_inici: dataInici,
      data_final: dataFinal,
      data_tancament: dataTancament,
    };
    startTransition(async () => {
      await updateExpedientAction(row.id, patch);
      onClose();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Número</label>
          <input className="input font-mono" value={num} onChange={(e) => setNum(e.target.value)} />
        </div>
        <div>
          <label className="label">Projecte</label>
          <input className="input" value={projecte} onChange={(e) => setProjecte(e.target.value)} placeholder="Nom del projecte" />
        </div>
        <div>
          <label className="label">Client</label>
          <Combobox options={clientOpts} value={clientId} onChange={setClientId} placeholder="Cerca client…" emptyLabel="Cap client" overlay />
        </div>
        <div>
          <label className="label">Ciutat</label>
          <input className="input" list="ciutats-list" value={ciutat} onChange={(e) => setCiutat(e.target.value)} placeholder="Tria o escriu una ciutat…" />
          <datalist id="ciutats-list">
            {ciutats.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div>
          <label className="label">Categoria</label>
          <select className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">—</option>
            {CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tipologia</label>
          <Combobox
            options={[...tipologies].sort((a, b) => a.nom.localeCompare(b.nom, "ca")).map((t) => ({ id: t.id, label: t.nom }))}
            value={tipologiaId}
            onChange={setTipologiaId}
            placeholder="Cerca tipologia…"
            emptyLabel="—"
            overlay
          />
        </div>
        <div>
          <label className="label">Tipus</label>
          <select className="input" value={tipus} onChange={(e) => setTipus(e.target.value as typeof tipus)}>
            <option value="privat">Privat</option>
            <option value="public">Públic</option>
          </select>
        </div>
        <div>
          <label className="label">Direcció d&apos;obres?</label>
          <select className="input" value={direccioObres ? "si" : "no"} onChange={(e) => setDireccioObres(e.target.value === "si")}>
            <option value="no">No</option>
            <option value="si">Sí</option>
          </select>
        </div>
        <div>
          <label className="label">Web?</label>
          <select className="input" value={web ? "si" : "no"} onChange={(e) => setWeb(e.target.value === "si")}>
            <option value="no">No</option>
            <option value="si">Sí</option>
          </select>
        </div>
        <div className="sm:col-span-2 rounded-lg border border-[var(--color-line)] p-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Origen del pressupost</label>
              <select className="input" value={origen} onChange={(e) => setOrigen(e.target.value as typeof origen)}>
                <option value="manual">Manual</option>
                <option value="calcul">Del càlcul d&apos;honoraris</option>
                <option value="proposta">De la proposta d&apos;honoraris</option>
              </select>
            </div>
            <div>
              <label className="label">Pressupost (€)</label>
              {origen === "manual" ? (
                <input type="number" step="0.01" className="input text-right" value={pressupost} onChange={(e) => setPressupost(e.target.value)} />
              ) : (
                <div className="input bg-[var(--color-paper)] text-right tabular-nums">{formatEur(effectivePressupost)}</div>
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Càlcul d&apos;honoraris</label>
              <Combobox options={calculOpts} value={calculId} onChange={setCalculId} placeholder="Cerca…" emptyLabel="Cap" overlay />
            </div>
            <div>
              <label className="label">Proposta d&apos;honoraris</label>
              <Combobox options={propostaOpts} value={propostaDocId} onChange={setPropostaDocId} placeholder="Cerca…" emptyLabel="Cap" overlay />
            </div>
          </div>
        </div>
        <div>
          <label className="label">Data inici</label>
          <input type="date" className="input" value={dataInici} onChange={(e) => setDataInici(e.target.value)} />
        </div>
        <div>
          <label className="label">Data final (previsió)</label>
          <input type="date" className="input" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} />
        </div>
        <div>
          <label className="label">Estat</label>
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
        </div>
        <div>
          <label className="label">Tancat el</label>
          <input type="date" className="input" value={dataTancament} onChange={(e) => setDataTancament(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={save} disabled={pending}>{pending ? "Desant…" : "Desar"}</button>
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel·lar</button>
      </div>
    </div>
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
          {(() => {
            const planned = parseFloat(expedient.planned_hores ?? "0") || 0;
            const pct = planned > 0 ? Math.round((total / planned) * 100) : null;
            return (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard label="Hores fetes" value={fmtHores(total)} accent="#1f4d3f" />
                {planned > 0 ? (
                  <>
                    <KpiCard label="Hores planificades" value={fmtHores(planned)} accent="#0ea5e9" />
                    <KpiCard label="% realitzat" value={`${pct}%`} accent="#f59e0b" hint={`${fmtHores(total)} / ${fmtHores(planned)}`} />
                  </>
                ) : (
                  <KpiCard label="Dies" value={String(new Set(dedicacions.map((d) => d.data)).size)} accent="#3b82f6" />
                )}
                <KpiCard label="Pressupost" value={formatEur(expedient.pressupost)} accent="#7c3aed" />
              </div>
            );
          })()}

          {(() => {
            const visites = dedicacions.filter((d) => (d.tasca ?? "").trim().toLowerCase() === "visita direcció d'obres").length;
            return visites > 0 ? (
              <p className="text-sm text-[var(--color-muted)]">Visites d&apos;obra: <span className="font-semibold text-[var(--color-ink)]">{visites}</span></p>
            ) : null;
          })()}

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
  const [fAny, setFAny] = useState(String(new Date().getFullYear()));
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

  const byCiutat = groupBySum(filtered, (r) => (r.ciutat ?? "").trim() || "(Sense ciutat)");
  const byTipologia = groupBySum(filtered, (r) => r.tipologia_nom ?? "(Sense tipologia)");
  // Pressupost split by category — drives the category donut (count + money).
  const catPressupost = CATEGORIES.map((c) => {
    const grp = filtered.filter((r) => r.categoria === c.code);
    return { label: c.label, color: c.color, count: grp.length, value: grp.reduce((s, r) => s + (parseFloat(r.pressupost) || 0), 0) };
  }).filter((g) => g.value > 0);
  const senseCat = filtered.filter((r) => !r.categoria);
  const senseCatPress = senseCat.reduce((s, r) => s + (parseFloat(r.pressupost) || 0), 0);
  if (senseCatPress > 0) catPressupost.push({ label: "Sense categoria", color: "#9ca3af", count: senseCat.length, value: senseCatPress });

  const filterSummary = [
    fAny && `Any ${fAny}`,
    fEstat && (fEstat === "obert" ? "Oberts" : "Tancats"),
    fCategoria && (CATEGORY_BY_CODE[fCategoria]?.label ?? fCategoria),
    fTipologia && tipologies.find((t) => String(t.id) === fTipologia)?.nom,
    fTipus && (fTipus === "public" ? "Públic" : "Privat"),
    fCiutat,
  ].filter(Boolean).join(" · ") || "Tots els expedients";

  function exportStatsPdf() {
    exportExpedientsStatsPdf({
      filterSummary, total, oberts, tancats, privats, publics,
      pressupostTotal, pressupostPrivat, pressupostPublic, pressupostObert, pressupostMitja,
      cat: catPressupost.map((g) => ({ label: g.label, count: g.count, money: g.value })),
      tipologia: byTipologia.map((g) => ({ label: g.key, count: g.count, money: g.money })),
      ciutat: byCiutat.map((g) => ({ label: g.key, count: g.count, money: g.money })),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button type="button" className="btn-ghost inline-flex items-center gap-1.5" onClick={exportStatsPdf} title="Genera un PDF de les estadístiques filtrades">
          <PdfIcon /> PDF
        </button>
      </div>
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

      {/* Pressupost per tipus + per categoria (donuts) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ChartCard title="Pressupost per tipus" meta="privat / públic">
          {pressupostTotal === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">Sense dades.</p>
          ) : (
            <GradientDonut
              segments={[
                { label: "Privat", value: Math.round(pressupostPrivat), color: TIPUS.privat.color, count: privats, note: formatEur(pressupostPrivat) },
                { label: "Públic", value: Math.round(pressupostPublic), color: TIPUS.public.color, count: publics, note: formatEur(pressupostPublic) },
              ]}
              centerValue={formatEur(pressupostTotal)}
              centerLabel="pressupost"
            />
          )}
        </ChartCard>
        <ChartCard title="Pressupost per categoria" meta="import · % del total">
          {catPressupost.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">Sense dades.</p>
          ) : (
            <GradientDonut
              segments={catPressupost.map((g) => ({ label: g.label, value: Math.round(g.value), color: g.color, count: g.count, note: formatEur(g.value) }))}
              centerValue={formatEur(pressupostTotal)}
              centerLabel="pressupost"
            />
          )}
        </ChartCard>
      </div>

      {/* Tipologia */}
      <ChartCard title="Expedients per tipologia" meta="nombre">
        <HBarChart bars={byTipologia.map((g) => ({ label: g.key, value: g.count, color: tipologiaSwatch(g.key).color, display: String(g.count) }))} />
      </ChartCard>

      {/* Ciutat */}
      <ChartCard title="Expedients per ciutat" meta="nombre">
        <HBarChart bars={byCiutat.map((g) => ({ label: g.key, value: g.count, color: "#6366f1", display: String(g.count) }))} />
      </ChartCard>
    </div>
  );
}

interface Group {
  key: string;
  count: number;
  money: number;
}

function groupBySum(rows: Expedient[], keyFn: (r: Expedient) => string): Group[] {
  const map = new Map<string, Group>();
  for (const r of rows) {
    const key = keyFn(r);
    const g = map.get(key) ?? { key, count: 0, money: 0 };
    g.count += 1;
    g.money += parseFloat(r.pressupost) || 0;
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

// ============================================================================
// PDF export (list + stats), respecting the active filters
// ============================================================================

function PdfIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M12 18v-6" /><path d="m9 15 3 3 3-3" />
    </svg>
  );
}

function escHtml(s: string | null | undefined) {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function eur(v: number) {
  return new Intl.NumberFormat("ca-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(v || 0);
}
function openPdf(title: string, headSub: string, innerHtml: string) {
  const logo = `${typeof window !== "undefined" ? window.location.origin : ""}/logo.jpg`;
  const html = `<!DOCTYPE html><html lang="ca"><head><meta charset="utf-8"><title>${escHtml(title)}</title>
    <style>
      @page { size: A4 landscape; margin: 1.2cm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: Arial, Helvetica, sans-serif; }
      body { margin: 0; color: #1a1a1a; }
      .head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
      .head h1 { font-size: 20px; margin: 0 0 2px; font-weight: 700; }
      .head .sub { font-size: 12px; color: #666; }
      .head img { width: 150px; height: auto; }
      h2 { font-size: 13px; margin: 18px 0 6px; }
      .kpis { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 4px; }
      .kpi { border: 1px solid #e2e2dd; border-radius: 10px; padding: 8px 12px; min-width: 150px; }
      .kpi .l { font-size: 10px; text-transform: uppercase; letter-spacing: .03em; color: #777; }
      .kpi .v { font-size: 16px; font-weight: 700; }
      table { border-collapse: collapse; width: 100%; font-size: 11px; margin-bottom: 4px; }
      thead th { background: #1f4d3f; color: #fff; font-weight: 600; text-align: left; padding: 7px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; }
      tbody td { padding: 6px 8px; border-bottom: 1px solid #e7e7e3; }
      tbody tr:nth-child(even) td { background: #f7f7f5; }
      td.r, th.r { text-align: right; white-space: nowrap; }
      td.c, th.c { text-align: center; }
      td.mono { font-family: "Courier New", monospace; }
      tr.tot td { border-top: 2px solid #1f4d3f; border-bottom: none; font-weight: 700; background: #eef2f0 !important; padding-top: 8px; }
      .foot { margin-top: 16px; font-size: 10px; color: #999; }
    </style></head><body>
      <div class="head"><div><h1>${escHtml(title)}</h1><div class="sub">${escHtml(headSub)}</div></div><img src="${logo}" alt="DAC arquitectura" /></div>
      ${innerHtml}
      <div class="foot">Generat el ${new Date().toLocaleDateString("ca-ES")} · DACARQUITECTURA</div>
    </body></html>`;
  const w = window.open("", "_blank", "width=1100,height=800");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

function exportExpedientsListPdf(rows: Expedient[], filterSummary: string) {
  const body = rows
    .map((r) => `<tr>
      <td class="mono">${escHtml(r.num_expedient)}</td>
      <td>${escHtml(r.projecte ?? "—")}</td>
      <td>${escHtml(r.client_nom ?? "—")}</td>
      <td>${escHtml(r.ciutat ?? "—")}</td>
      <td>${escHtml((r.categoria && CATEGORY_BY_CODE[r.categoria]?.label) || "—")}</td>
      <td>${escHtml(r.tipologia_nom ?? "—")}</td>
      <td>${escHtml(TIPUS[r.tipus].label)}</td>
      <td class="c">${r.web ? "Sí" : "—"}</td>
      <td class="r">${eur(parseFloat(r.pressupost) || 0)}</td>
      <td>${escHtml(ESTAT[r.estat].label)}</td>
      <td>${fmtDate(r.data_tancament) ?? "—"}</td>
    </tr>`)
    .join("");
  const sum = rows.reduce((s, r) => s + (parseFloat(r.pressupost) || 0), 0);
  const totalRow = `<tr class="tot"><td colspan="8">Total (${rows.length} ${rows.length === 1 ? "expedient" : "expedients"})</td><td class="r">${eur(sum)}</td><td colspan="2"></td></tr>`;
  const table = `<table><thead><tr>
      <th>Núm.</th><th>Projecte</th><th>Client</th><th>Ciutat</th><th>Categoria</th><th>Tipologia</th><th>Tipus</th><th class="c">Web</th><th class="r">Pressupost</th><th>Estat</th><th>Tancat el</th>
    </tr></thead><tbody>${body || `<tr><td colspan="11" style="padding:14px;color:#888;">Cap expedient amb aquests filtres.</td></tr>`}${rows.length ? totalRow : ""}</tbody></table>`;
  openPdf("Expedients", filterSummary, table);
}

interface StatsPdfData {
  filterSummary: string;
  total: number;
  oberts: number;
  tancats: number;
  privats: number;
  publics: number;
  pressupostTotal: number;
  pressupostPrivat: number;
  pressupostPublic: number;
  pressupostObert: number;
  pressupostMitja: number;
  cat: { label: string; count: number; money: number }[];
  tipologia: { label: string; count: number; money: number }[];
  ciutat: { label: string; count: number; money: number }[];
}

function breakdownTable(title: string, rowsData: { label: string; count: number; money: number }[], total: number) {
  if (rowsData.length === 0) return "";
  const body = rowsData
    .map((g) => `<tr><td>${escHtml(g.label)}</td><td class="r">${g.count}</td><td class="r">${total ? Math.round((g.money / total) * 100) : 0}%</td><td class="r">${eur(g.money)}</td></tr>`)
    .join("");
  return `<h2>${escHtml(title)}</h2><table><thead><tr><th>Concepte</th><th class="r">Expedients</th><th class="r">% pressupost</th><th class="r">Pressupost</th></tr></thead><tbody>${body}</tbody></table>`;
}

function exportExpedientsStatsPdf(d: StatsPdfData) {
  const kpis = `<div class="kpis">
      <div class="kpi"><div class="l">Expedients</div><div class="v">${d.total}</div></div>
      <div class="kpi"><div class="l">Oberts / Tancats</div><div class="v">${d.oberts} / ${d.tancats}</div></div>
      <div class="kpi"><div class="l">Privats / Públics</div><div class="v">${d.privats} / ${d.publics}</div></div>
      <div class="kpi"><div class="l">Pressupost total</div><div class="v">${eur(d.pressupostTotal)}</div></div>
      <div class="kpi"><div class="l">Pressupost en obert</div><div class="v">${eur(d.pressupostObert)}</div></div>
      <div class="kpi"><div class="l">Pressupost mitjà</div><div class="v">${eur(d.pressupostMitja)}</div></div>
    </div>`;
  const tipus = breakdownTable("Pressupost per tipus", [
    { label: "Privat", count: d.privats, money: d.pressupostPrivat },
    { label: "Públic", count: d.publics, money: d.pressupostPublic },
  ].filter((x) => x.money > 0 || x.count > 0), d.pressupostTotal);
  const inner = kpis + tipus + breakdownTable("Pressupost per categoria", d.cat, d.pressupostTotal) + breakdownTable("Per tipologia", d.tipologia, d.pressupostTotal) + breakdownTable("Per ciutat", d.ciutat, d.pressupostTotal);
  openPdf("Expedients — Estadístiques", d.filterSummary, inner);
}
