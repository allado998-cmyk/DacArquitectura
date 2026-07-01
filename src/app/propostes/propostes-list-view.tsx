"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { deletePropostaDocAction, duplicatePropostaDocAction } from "./actions";
import { formatDataCa, formatEur } from "@/lib/format";
import { openListPdf } from "@/lib/pdf";
import type { PropostaDoc, PropostaDocEstat } from "@/types/db";

type Row = PropostaDoc & { client_nom: string | null; total: string };

const ESTAT_META: Record<PropostaDocEstat, { label: string; bg: string; text: string }> = {
  pendent: { label: "Pendent", bg: "#fef9c3", text: "#854d0e" },
  acceptada: { label: "Acceptada", bg: "#dcfce7", text: "#15803d" },
  rebutjada: { label: "Rebutjada", bg: "#fee2e2", text: "#b91c1c" },
};

const trimOf = (d: string | null | undefined) => (d ? String(Math.ceil(Number(d.slice(5, 7)) / 3)) : "");

export function PropostesListView({ rows }: { rows: Row[] }) {
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

function PdfIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M12 18v-6" /><path d="m9 15 3 3 3-3" />
    </svg>
  );
}
