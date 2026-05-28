"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  addAltraDespesaLineAction,
  addDespesaDirectaLineAction,
  deleteAltraDespesaLineAction,
  deleteDespesaDirectaLineAction,
  updateAltraDespesaLineAction,
  updateDespesaDirectaLineAction,
  updatePropostaAction,
} from "./actions";
import { formatEur } from "@/lib/format";
import type {
  Client,
  ConcepteAltraDespesa,
  ConcepteDespesaDirecta,
  Projecte,
  Proposta,
  PropostaAltraDespesaLine,
  PropostaDespesaDirectaLine,
} from "@/types/db";

const IVA_RATE = 0.21;

function n(v: string | number | null | undefined): number {
  if (v == null || v === "") return 0;
  const x = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(x) ? x : 0;
}

export function HonorarisView({
  proposta,
  projectes,
  clients,
  conceptesDirectes,
  conceptesAltres,
  initialLinesDirectes,
  initialLinesAltres,
}: {
  proposta: Proposta;
  projectes: Projecte[];
  clients: Client[];
  conceptesDirectes: ConcepteDespesaDirecta[];
  conceptesAltres: ConcepteAltraDespesa[];
  initialLinesDirectes: PropostaDespesaDirectaLine[];
  initialLinesAltres: PropostaAltraDespesaLine[];
}) {
  // Header (with optimistic local state, persisted onBlur).
  const [data, setData] = useState(proposta.data);
  const [projecteId, setProjecteId] = useState<number | "">(proposta.projecte_id ?? "");
  const [clientId, setClientId] = useState<number | "">(proposta.client_id ?? "");
  const [contacte, setContacte] = useState(proposta.contacte_prescriptor ?? "");

  // Resum free inputs.
  const [despesesIndirectes, setDespesesIndirectes] = useState<string>(proposta.despeses_indirectes);
  const [benefici, setBenefici] = useState<string>(proposta.benefici);

  // Resum Final override (nullable).
  const [totalOverride, setTotalOverride] = useState<string>(proposta.total_honoraris_override ?? "");

  // Lines, kept locally for snappy edits; persisted via server actions.
  const [linesDirectes, setLinesDirectes] = useState(initialLinesDirectes);
  const [linesAltres, setLinesAltres] = useState(initialLinesAltres);

  const [, startTransition] = useTransition();

  const totalDirectes = useMemo(
    () => linesDirectes.reduce((s, l) => s + n(l.hores) * n(l.preu_hora), 0),
    [linesDirectes]
  );
  const totalAltres = useMemo(
    () => linesAltres.reduce((s, l) => s + n(l.unitats) * n(l.preu_unitat), 0),
    [linesAltres]
  );

  const totalHonorarisComputed = totalDirectes + totalAltres + n(despesesIndirectes) + n(benefici);
  const totalHonorarisFinal = totalOverride === "" ? totalHonorarisComputed : n(totalOverride);
  const iva = totalHonorarisFinal * IVA_RATE;
  const totalAIngresar = totalHonorarisFinal + iva;

  // Helpers ----------------------------------------------------------------

  function persistHeader(patch: Parameters<typeof updatePropostaAction>[1]) {
    startTransition(() => {
      updatePropostaAction(proposta.id, patch);
    });
  }

  // Despeses Directes ------------------------------------------------------

  function handleAddDirecta(concepteId: number) {
    const concepte = conceptesDirectes.find((c) => c.id === concepteId);
    if (!concepte) return;
    startTransition(async () => {
      const newId = await addDespesaDirectaLineAction(proposta.id, concepteId);
      if (newId) {
        setLinesDirectes((prev) => [
          ...prev,
          {
            id: newId,
            proposta_id: proposta.id,
            concepte_id: concepteId,
            concepte_nom: concepte.nom,
            hores: "0",
            preu_hora: proposta.preu_hora_default,
            ordre: (prev[prev.length - 1]?.ordre ?? 0) + 10,
          },
        ]);
      }
    });
  }

  function updateDirectaLocal(lineId: number, patch: Partial<PropostaDespesaDirectaLine>) {
    setLinesDirectes((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...patch } : l)));
  }

  function persistDirecta(lineId: number, patch: { hores?: number; preu_hora?: number; concepte_id?: number }) {
    startTransition(() => {
      updateDespesaDirectaLineAction(proposta.id, lineId, patch);
    });
  }

  function handleDeleteDirecta(lineId: number) {
    setLinesDirectes((prev) => prev.filter((l) => l.id !== lineId));
    startTransition(() => {
      deleteDespesaDirectaLineAction(proposta.id, lineId);
    });
  }

  // Altres Despeses --------------------------------------------------------

  function handleAddAltra(concepteId: number) {
    const concepte = conceptesAltres.find((c) => c.id === concepteId);
    if (!concepte) return;
    startTransition(async () => {
      const newId = await addAltraDespesaLineAction(proposta.id, concepteId);
      if (newId) {
        setLinesAltres((prev) => [
          ...prev,
          {
            id: newId,
            proposta_id: proposta.id,
            concepte_id: concepteId,
            concepte_nom: concepte.nom,
            unitats: "0",
            preu_unitat: concepte.preu_unitat_default,
            ordre: (prev[prev.length - 1]?.ordre ?? 0) + 10,
          },
        ]);
      }
    });
  }

  function updateAltraLocal(lineId: number, patch: Partial<PropostaAltraDespesaLine>) {
    setLinesAltres((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...patch } : l)));
  }

  function persistAltra(lineId: number, patch: { unitats?: number; preu_unitat?: number; concepte_id?: number }) {
    startTransition(() => {
      updateAltraDespesaLineAction(proposta.id, lineId, patch);
    });
  }

  function handleDeleteAltra(lineId: number) {
    setLinesAltres((prev) => prev.filter((l) => l.id !== lineId));
    startTransition(() => {
      deleteAltraDespesaLineAction(proposta.id, lineId);
    });
  }

  // ------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <Link href="/honoraris" className="text-sm text-[var(--color-muted)] hover:underline">← Totes les propostes</Link>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">Proposta núm. {proposta.id}</h1>
        </div>
        <Link href="/parameters" className="text-sm text-[var(--color-accent)] hover:underline">
          Gestionar paràmetres →
        </Link>
      </div>

      {/* ============ Header ============ */}
      <section className="card">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label" htmlFor="data">Data</label>
            <input
              id="data"
              type="date"
              className="input"
              value={data}
              onChange={(e) => setData(e.target.value)}
              onBlur={() => persistHeader({ data })}
            />
          </div>
          <div>
            <label className="label">Proposta núm.</label>
            <div className="input bg-[var(--color-paper)] font-mono">{proposta.id}</div>
          </div>
          <div>
            <label className="label" htmlFor="projecte">Projecte</label>
            <select
              id="projecte"
              className="input"
              value={projecteId === "" ? "" : projecteId}
              onChange={(e) => {
                const v = e.target.value === "" ? "" : Number(e.target.value);
                setProjecteId(v);
                persistHeader({ projecte_id: v === "" ? null : v });
              }}
            >
              <option value="">— Selecciona —</option>
              {projectes.map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="client">Client</label>
            <select
              id="client"
              className="input"
              value={clientId === "" ? "" : clientId}
              onChange={(e) => {
                const v = e.target.value === "" ? "" : Number(e.target.value);
                setClientId(v);
                persistHeader({ client_id: v === "" ? null : v });
              }}
            >
              <option value="">— Selecciona —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="label" htmlFor="contacte">Contacte Prescriptor</label>
            <input
              id="contacte"
              type="text"
              className="input"
              value={contacte}
              onChange={(e) => setContacte(e.target.value)}
              onBlur={() => persistHeader({ contacte_prescriptor: contacte || null })}
            />
          </div>
        </div>
        {(projectes.length === 0 || clients.length === 0) && (
          <p className="mt-4 text-xs text-[var(--color-muted)]">
            Si no veus opcions a Projecte o Client, afegeix-les a{" "}
            <Link href="/parameters" className="underline">Paràmetres</Link>.
          </p>
        )}
      </section>

      {/* ============ Despeses Directes ============ */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Despeses Directes</h2>
        <div className="table-wrap">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th w-2/5">Concepte</th>
                <th className="th w-24">Hores</th>
                <th className="th w-32">€ / hora</th>
                <th className="th w-32 text-right">Total</th>
                <th className="th w-10"></th>
              </tr>
            </thead>
            <tbody>
              {linesDirectes.length === 0 && (
                <tr>
                  <td className="td text-[var(--color-muted)]" colSpan={5}>Cap línia. Afegeix-ne una a sota.</td>
                </tr>
              )}
              {linesDirectes.map((l) => {
                const total = n(l.hores) * n(l.preu_hora);
                return (
                  <tr key={l.id}>
                    <td className="td">
                      <select
                        className="input"
                        value={l.concepte_id}
                        onChange={(e) => {
                          const newId = Number(e.target.value);
                          const c = conceptesDirectes.find((x) => x.id === newId);
                          updateDirectaLocal(l.id, { concepte_id: newId, concepte_nom: c?.nom });
                          persistDirecta(l.id, { concepte_id: newId });
                        }}
                      >
                        {conceptesDirectes.map((c) => (
                          <option key={c.id} value={c.id}>{c.nom}</option>
                        ))}
                      </select>
                    </td>
                    <td className="td">
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        className="input text-right"
                        value={l.hores}
                        onChange={(e) => updateDirectaLocal(l.id, { hores: e.target.value })}
                        onBlur={() => persistDirecta(l.id, { hores: n(l.hores) })}
                      />
                    </td>
                    <td className="td">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input text-right"
                        value={l.preu_hora}
                        onChange={(e) => updateDirectaLocal(l.id, { preu_hora: e.target.value })}
                        onBlur={() => persistDirecta(l.id, { preu_hora: n(l.preu_hora) })}
                      />
                    </td>
                    <td className="td text-right font-mono">{formatEur(total)}</td>
                    <td className="td text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteDirecta(l.id)}
                        className="text-red-700 hover:underline text-sm"
                        aria-label="Eliminar línia"
                      >×</button>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-[var(--color-paper)]">
                <td className="td font-semibold" colSpan={3}>Total Despeses Directes</td>
                <td className="td text-right font-semibold font-mono">{formatEur(totalDirectes)}</td>
                <td className="td"></td>
              </tr>
            </tbody>
          </table>
        </div>
        <AddLineDropdown
          label="Afegir despesa directa"
          options={conceptesDirectes}
          onPick={handleAddDirecta}
        />
      </section>

      {/* ============ Altres Despeses Importants ============ */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Altres Despeses Importants</h2>
        <div className="table-wrap">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th w-2/5">Concepte</th>
                <th className="th w-24">Unitats</th>
                <th className="th w-32">€ / unitat</th>
                <th className="th w-32 text-right">Total</th>
                <th className="th w-10"></th>
              </tr>
            </thead>
            <tbody>
              {linesAltres.length === 0 && (
                <tr>
                  <td className="td text-[var(--color-muted)]" colSpan={5}>Cap línia. Afegeix-ne una a sota.</td>
                </tr>
              )}
              {linesAltres.map((l) => {
                const total = n(l.unitats) * n(l.preu_unitat);
                return (
                  <tr key={l.id}>
                    <td className="td">
                      <select
                        className="input"
                        value={l.concepte_id}
                        onChange={(e) => {
                          const newId = Number(e.target.value);
                          const c = conceptesAltres.find((x) => x.id === newId);
                          updateAltraLocal(l.id, { concepte_id: newId, concepte_nom: c?.nom });
                          persistAltra(l.id, { concepte_id: newId });
                        }}
                      >
                        {conceptesAltres.map((c) => (
                          <option key={c.id} value={c.id}>{c.nom}</option>
                        ))}
                      </select>
                    </td>
                    <td className="td">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        className="input text-right"
                        value={l.unitats}
                        onChange={(e) => updateAltraLocal(l.id, { unitats: e.target.value })}
                        onBlur={() => persistAltra(l.id, { unitats: n(l.unitats) })}
                      />
                    </td>
                    <td className="td">
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        className="input text-right"
                        value={l.preu_unitat}
                        onChange={(e) => updateAltraLocal(l.id, { preu_unitat: e.target.value })}
                        onBlur={() => persistAltra(l.id, { preu_unitat: n(l.preu_unitat) })}
                      />
                    </td>
                    <td className="td text-right font-mono">{formatEur(total)}</td>
                    <td className="td text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteAltra(l.id)}
                        className="text-red-700 hover:underline text-sm"
                        aria-label="Eliminar línia"
                      >×</button>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-[var(--color-paper)]">
                <td className="td font-semibold" colSpan={3}>Total Altres Despeses</td>
                <td className="td text-right font-semibold font-mono">{formatEur(totalAltres)}</td>
                <td className="td"></td>
              </tr>
            </tbody>
          </table>
        </div>
        <AddLineDropdown
          label="Afegir altra despesa"
          options={conceptesAltres}
          onPick={handleAddAltra}
        />
      </section>

      {/* ============ Resum ============ */}
      <section className="card">
        <h2 className="text-lg font-semibold mb-4">Resum</h2>
        <div className="space-y-2 text-sm">
          <SummaryRow label="Despeses Directes" value={formatEur(totalDirectes)} />
          <SummaryRow label="Altres Despeses" value={formatEur(totalAltres)} />
          <SummaryRowEditable
            label="Despeses Indirectes"
            value={despesesIndirectes}
            onChange={(v) => setDespesesIndirectes(v)}
            onCommit={() => persistHeader({ despeses_indirectes: n(despesesIndirectes) })}
          />
          <SummaryRowEditable
            label="Benefici"
            value={benefici}
            onChange={(v) => setBenefici(v)}
            onCommit={() => persistHeader({ benefici: n(benefici) })}
          />
          <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-3 mt-3">
            <span className="font-semibold">Total Honoraris</span>
            <span className="font-semibold font-mono">{formatEur(totalHonorarisComputed)}</span>
          </div>
        </div>
      </section>

      {/* ============ Resum Final ============ */}
      <section className="card">
        <h2 className="text-lg font-semibold mb-4">Resum Final</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span>Total Honoraris</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                className="input text-right w-40"
                placeholder={String(totalHonorarisComputed.toFixed(2))}
                value={totalOverride}
                onChange={(e) => setTotalOverride(e.target.value)}
                onBlur={() =>
                  persistHeader({
                    total_honoraris_override: totalOverride === "" ? null : n(totalOverride),
                  })
                }
              />
              {totalOverride !== "" && (
                <button
                  type="button"
                  className="text-xs text-[var(--color-muted)] hover:underline"
                  onClick={() => {
                    setTotalOverride("");
                    persistHeader({ total_honoraris_override: null });
                  }}
                >
                  Restablir
                </button>
              )}
            </div>
          </div>
          <SummaryRow label="IVA (21%)" value={formatEur(iva)} />
          <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-3 mt-3">
            <span className="font-semibold">Total a Ingressar</span>
            <span className="font-semibold font-mono text-lg">{formatEur(totalAIngresar)}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function SummaryRowEditable({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <input
        type="number"
        step="0.01"
        className="input text-right w-40"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
      />
    </div>
  );
}

function AddLineDropdown<T extends { id: number; nom: string }>({
  label,
  options,
  onPick,
}: {
  label: string;
  options: T[];
  onPick: (id: number) => void;
}) {
  const [val, setVal] = useState<string>("");

  if (options.length === 0) {
    return (
      <p className="text-xs text-[var(--color-muted)] mt-3">
        No hi ha conceptes disponibles. Crea'n a{" "}
        <Link href="/parameters" className="underline">Paràmetres</Link>.
      </p>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <select
        className="input max-w-xs"
        value={val}
        onChange={(e) => setVal(e.target.value)}
      >
        <option value="">— {label} —</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.nom}</option>
        ))}
      </select>
      <button
        type="button"
        className="btn-ghost"
        disabled={!val}
        onClick={() => {
          if (val) {
            onPick(Number(val));
            setVal("");
          }
        }}
      >
        + Afegir
      </button>
    </div>
  );
}
