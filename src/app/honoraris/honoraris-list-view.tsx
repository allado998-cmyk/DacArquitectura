"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { deletePropostaAction } from "./actions";
import { formatDataCa, formatEur } from "@/lib/format";

export interface PropostaListRow {
  id: number;
  num_proposta: string | null;
  data: string;
  projecte: string | null;
  client_nom: string | null;
  total: string;
}

export function HonorarisListView({ rows }: { rows: PropostaListRow[] }) {
  const [query, setQuery] = useState("");
  const [fAny, setFAny] = useState("");
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
    if (fClient && (r.client_nom ?? "") !== fClient) return false;
    if (q) {
      const hay = `${r.num_proposta ?? ""} ${r.projecte ?? ""} ${r.client_nom ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const totalSum = filtered.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);

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
        <div className="flex-1 min-w-48">
          <label className="label">Cercar</label>
          <input className="input" placeholder="Núm., projecte o client…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
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
          <label className="label">Client</label>
          <select className="input" value={fClient} onChange={(e) => setFClient(e.target.value)}>
            <option value="">Tots</option>
            {clients.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
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
              <th className="th text-center w-40">Preu</th>
              <th className="th text-center w-32"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="td text-center font-mono">{r.num_proposta ?? r.id}</td>
                <td className="td text-center tabular-nums">{formatDataCa(r.data)}</td>
                <td className="td text-left">{r.projecte ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                <td className="td text-left">{r.client_nom ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                <td className="td text-center tabular-nums">{formatEur(r.total)}</td>
                <td className="td text-center whitespace-nowrap">
                  <Link href={`/honoraris/${r.id}`} className="text-[var(--color-accent)] hover:underline mr-3">Obrir</Link>
                  <form action={deletePropostaAction} className="inline">
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
                <td className="td text-center font-semibold" colSpan={4}>Total ({filtered.length})</td>
                <td className="td text-center font-semibold tabular-nums">{formatEur(totalSum)}</td>
                <td className="td"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
