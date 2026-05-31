"use client";

import Link from "next/link";
import { useState } from "react";
import { deletePropostaDocAction } from "./actions";
import { formatDataCa } from "@/lib/format";
import type { PropostaDoc, PropostaDocEstat } from "@/types/db";

const ESTAT_META: Record<PropostaDocEstat, { label: string; bg: string; text: string }> = {
  pendent: { label: "Pendent", bg: "#fef9c3", text: "#854d0e" },
  acceptada: { label: "Acceptada", bg: "#dcfce7", text: "#15803d" },
  rebutjada: { label: "Rebutjada", bg: "#fee2e2", text: "#b91c1c" },
};

export function PropostesListView({ rows }: { rows: PropostaDoc[] }) {
  const [query, setQuery] = useState("");
  const [fEstat, setFEstat] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (fEstat && r.estat !== fEstat) return false;
    if (q) {
      const hay = `${r.num} ${r.descripcio ?? ""} ${r.ciutat ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

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
        <div className="flex-1 min-w-56">
          <label className="label">Cercar</label>
          <input className="input" placeholder="Núm., descripció, ciutat…" value={query} onChange={(e) => setQuery(e.target.value)} />
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
      </div>

      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th text-center w-28">Núm.</th>
              <th className="th text-center w-32">Data</th>
              <th className="th text-center">Descripció</th>
              <th className="th text-center">Ciutat</th>
              <th className="th text-center w-32">Estat</th>
              <th className="th text-center w-32"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const m = ESTAT_META[r.estat];
              return (
                <tr key={r.id}>
                  <td className="td text-center font-mono">{r.num}</td>
                  <td className="td text-center tabular-nums">{formatDataCa(r.data)}</td>
                  <td className="td text-center">{r.descripcio ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                  <td className="td text-center">{r.ciutat ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                  <td className="td text-center">
                    <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: m.bg, color: m.text }}>
                      {m.label}
                    </span>
                  </td>
                  <td className="td text-center whitespace-nowrap">
                    <Link href={`/propostes/${r.id}`} className="text-[var(--color-accent)] hover:underline mr-3">Obrir</Link>
                    <form action={deletePropostaDocAction} className="inline">
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className="text-red-700 hover:underline text-sm">Eliminar</button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td className="td text-center text-[var(--color-muted)]" colSpan={6}>Cap resultat.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
