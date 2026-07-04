"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { createActaAction } from "./actions";
import { openListPdf } from "@/lib/pdf";

type ActaRow = {
  id: number;
  num: string | null;
  tipus: "visita" | "reunio";
  expedient_id: number | null;
  acta_num: string | null;
  data: string | null;
  projecte: string | null;
  client: string | null;
  expedient_num: string | null;
};
type ExpedientOpt = { id: number; num_expedient: string; projecte: string | null };

const TIPUS_LABEL: Record<string, string> = { visita: "Visita d'obra", reunio: "Reunió" };

function fmtData(iso: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function ActesView({ actes, expedients }: { actes: ActaRow[]; expedients: ExpedientOpt[] }) {
  const years = useMemo(() => {
    const s = new Set<string>();
    for (const a of actes) if (a.data) s.add(a.data.slice(0, 4));
    return Array.from(s).sort().reverse();
  }, [actes]);
  const currentYear = String(new Date().getFullYear());

  const [year, setYear] = useState<string>(years.includes(currentYear) ? currentYear : "any");
  const [tipus, setTipus] = useState<string>("any");
  const [q, setQ] = useState("");

  const [modal, setModal] = useState(false);
  const [newTipus, setNewTipus] = useState<"visita" | "reunio">("visita");
  const [newExp, setNewExp] = useState<number | "">("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return actes.filter((a) => {
      if (year !== "any" && (a.data ?? "").slice(0, 4) !== year) return false;
      if (tipus !== "any" && a.tipus !== tipus) return false;
      if (needle) {
        const hay = `${a.num ?? ""} ${a.expedient_num ?? ""} ${a.projecte ?? ""} ${a.client ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [actes, year, tipus, q]);

  function create() {
    startTransition(() => {
      createActaAction(newTipus, newExp === "" ? null : newExp);
    });
  }

  function pdf() {
    openListPdf({
      title: "Actes",
      subtitle: `${filtered.length} ${filtered.length === 1 ? "acta" : "actes"}`,
      columns: [{ label: "Núm" }, { label: "Tipus" }, { label: "Expedient" }, { label: "Projecte" }, { label: "Client" }, { label: "Data", align: "right" }],
      rows: filtered.map((a) => [a.num ?? "", TIPUS_LABEL[a.tipus] ?? a.tipus, a.expedient_num ?? "", a.projecte ?? "", a.client ?? "", fmtData(a.data)]),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Actes</h1>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={pdf}>PDF</button>
          <button className="btn-primary" onClick={() => setModal(true)}>Nova acta</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-56" placeholder="Cercar…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-40" value={tipus} onChange={(e) => setTipus(e.target.value)}>
          <option value="any">Tots els tipus</option>
          <option value="visita">Visita d&apos;obra</option>
          <option value="reunio">Reunió</option>
        </select>
        <select className="input w-32" value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="any">Tots els anys</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th w-28">Núm</th>
              <th className="th w-32">Tipus</th>
              <th className="th w-28">Expedient</th>
              <th className="th">Projecte</th>
              <th className="th">Client</th>
              <th className="th w-28 text-right">Data</th>
              <th className="th w-20"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td className="td text-[var(--color-muted)]" colSpan={7}>Cap acta.</td></tr>
            ) : (
              filtered.map((a) => (
                <tr key={a.id}>
                  <td className="td font-mono">{a.num}</td>
                  <td className="td">{TIPUS_LABEL[a.tipus] ?? a.tipus}</td>
                  <td className="td font-mono">{a.expedient_num ?? "—"}</td>
                  <td className="td">{a.projecte ?? ""}</td>
                  <td className="td">{a.client ?? ""}</td>
                  <td className="td text-right tabular-nums">{fmtData(a.data)}</td>
                  <td className="td text-right"><Link href={`/actes/${a.id}`} className="text-[var(--color-accent)] hover:underline">Obrir</Link></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold">Nova acta</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Per a què és?</label>
                <select className="input" value={newTipus} onChange={(e) => setNewTipus(e.target.value as "visita" | "reunio")}>
                  <option value="visita">Visita d&apos;obra</option>
                  <option value="reunio">Reunió</option>
                </select>
              </div>
              <div>
                <label className="label">Expedient relacionat</label>
                <select className="input" value={newExp === "" ? "" : newExp} onChange={(e) => setNewExp(e.target.value === "" ? "" : Number(e.target.value))}>
                  <option value="">— Sense expedient —</option>
                  {expedients.map((e) => (
                    <option key={e.id} value={e.id}>{e.num_expedient}{e.projecte ? ` — ${e.projecte}` : ""}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn" onClick={() => setModal(false)} disabled={pending}>Cancel·lar</button>
              <button className="btn-primary" onClick={create} disabled={pending}>{pending ? "Creant…" : "Crear acta"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
