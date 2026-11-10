"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { createIteAction, deleteIteAction } from "./actions";
import { importPortalFile } from "@/lib/ite/portal-client";

export type IteListRow = {
  id: number;
  nom: string;
  adreca: string | null;
  data_inspeccio: string | null;
  expedient_num: string | null;
  client_nom: string | null;
  deficiencies: number;
  exportat: string | null;
  updated: string;
};
type ExpedientOpt = { id: number; num_expedient: string; projecte: string | null; client_id: number | null; adreca: string | null };
type ClientOpt = { id: number; nom: string };

function fmtData(iso: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function IteListView({ ites, expedients, clients }: { ites: IteListRow[]; expedients: ExpedientOpt[]; clients: ClientOpt[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(false);
  const [newExp, setNewExp] = useState<number | "">("");
  const [newClient, setNewClient] = useState<number | "">("");
  const [pending, startTransition] = useTransition();
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return ites;
    return ites.filter((i) => `${i.nom} ${i.adreca ?? ""} ${i.expedient_num ?? ""} ${i.client_nom ?? ""}`.toLowerCase().includes(needle));
  }, [ites, q]);

  function onExpedient(v: number | "") {
    setNewExp(v);
    const e = v === "" ? null : expedients.find((x) => x.id === v);
    if (e?.client_id) setNewClient(e.client_id);
  }

  function create() {
    startTransition(() => {
      createIteAction({ expedientId: newExp === "" ? null : newExp, clientId: newClient === "" ? null : newClient });
    });
  }

  async function onImport(file: File | undefined) {
    if (!file) return;
    setImporting(true);
    setImportMsg("Obrint el fitxer…");
    try {
      const r = await importPortalFile(file, setImportMsg);
      const parts = [`Importat «${r.nom}».`];
      if (r.fotos) parts.push(`${r.fotos} fotos.`);
      if (r.fotosFalten) parts.push(`${r.fotosFalten} fotos no eren al fitxer.`);
      if (r.catalegNous > 0) parts.push(`${r.catalegNous} valors nous a les llistes desplegables.`);
      setImportMsg(parts.join(" "));
      router.push(`/ite/${r.id}`);
    } catch (e) {
      setImportMsg(`No s'ha pogut importar: ${e instanceof Error ? e.message : String(e)}`);
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">ITE</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Informes d&apos;inspecció tècnica preparats aquí i exportats per importar-los al portal de l&apos;Agència de l&apos;Habitatge.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-ghost" disabled={importing} onClick={() => fileRef.current?.click()} title="El zip de «Exportar informe» del portal (o només l'XML)">
            Importar del portal
          </button>
          <input ref={fileRef} type="file" accept=".zip,.xml,application/zip,text/xml,application/xml" className="hidden" onChange={(e) => { void onImport(e.target.files?.[0]); e.target.value = ""; }} />
          <button className="btn-primary" onClick={() => setModal(true)}>Nou informe</button>
        </div>
      </div>

      {importMsg && (
        <div className="rounded-lg border border-[var(--color-line)] bg-white px-4 py-3 text-sm">{importMsg}</div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-72" placeholder="Cercar per nom, adreça, expedient o client…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="text-sm text-[var(--color-muted)]">{filtered.length} {filtered.length === 1 ? "informe" : "informes"}</span>
      </div>

      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Nom</th>
              <th className="th">Adreça</th>
              <th className="th w-28">Expedient</th>
              <th className="th w-28 text-right">Inspecció</th>
              <th className="th w-24 text-right">Deficiències</th>
              <th className="th w-28 text-right">Exportat</th>
              <th className="th w-32"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td className="td text-[var(--color-muted)]" colSpan={7}>Cap informe. Crea&apos;n un de nou o importa&apos;n un del portal.</td></tr>
            ) : (
              filtered.map((i) => (
                <tr key={i.id} className="cursor-pointer hover:bg-[var(--color-paper)]" onClick={() => router.push(`/ite/${i.id}`)}>
                  <td className="td">
                    <Link href={`/ite/${i.id}`} className="text-[var(--color-accent)] hover:underline" onClick={(e) => e.stopPropagation()}>{i.nom || "(sense nom)"}</Link>
                    {i.client_nom && <div className="text-xs text-[var(--color-muted)]">{i.client_nom}</div>}
                  </td>
                  <td className="td text-sm">{i.adreca ?? ""}</td>
                  <td className="td font-mono text-sm">{i.expedient_num ?? "—"}</td>
                  <td className="td text-right tabular-nums">{fmtData(i.data_inspeccio)}</td>
                  <td className="td text-right tabular-nums">{i.deficiencies}</td>
                  <td className="td text-right tabular-nums">{i.exportat ? fmtData(i.exportat) : <span className="text-[var(--color-muted)]">—</span>}</td>
                  <td className="td" onClick={(e) => e.stopPropagation()}>
                    <form action={deleteIteAction} className="flex justify-end">
                      <input type="hidden" name="id" value={i.id} />
                      <button type="submit" className="text-sm text-red-700 hover:underline" onClick={(e) => { if (!confirm(`Eliminar l'informe «${i.nom}» i les seves fotos?`)) e.preventDefault(); }}>Eliminar</button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-lg font-semibold">Nou informe ITE</h2>
            <p className="mb-4 text-sm text-[var(--color-muted)]">El tècnic redactor (David Lladó) ja hi surt. De l&apos;expedient s&apos;agafa l&apos;adreça de l&apos;edifici; del client, la propietat.</p>
            <div className="space-y-4">
              <div>
                <label className="label">Expedient</label>
                <select className="input" value={newExp === "" ? "" : newExp} onChange={(e) => onExpedient(e.target.value === "" ? "" : Number(e.target.value))}>
                  <option value="">— Sense expedient —</option>
                  {expedients.map((e) => (
                    <option key={e.id} value={e.id}>{e.num_expedient}{e.projecte ? ` — ${e.projecte}` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Propietat (client)</label>
                <select className="input" value={newClient === "" ? "" : newClient} onChange={(e) => setNewClient(e.target.value === "" ? "" : Number(e.target.value))}>
                  <option value="">— Sense client —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn" onClick={() => setModal(false)} disabled={pending}>Cancel·lar</button>
              <button className="btn-primary" onClick={create} disabled={pending}>{pending ? "Creant…" : "Crear informe"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
