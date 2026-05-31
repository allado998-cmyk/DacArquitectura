"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  addLiniaAction,
  addPagamentAction,
  addServeiAction,
  deleteLiniaAction,
  deletePagamentAction,
  deleteServeiAction,
  setEstatAction,
  updateLiniaAction,
  updatePagamentAction,
  updatePropostaDocAction,
  updateServeiAction,
} from "../actions";
import type {
  PropostaDoc,
  PropostaDocLinia,
  PropostaDocPagament,
  PropostaDocServei,
} from "@/types/db";
import { formatEur } from "@/lib/format";
import { buildPropostaHtml, buildWordDoc, FIXED_EXCLUSIONS, FIXED_INCLUSIONS, PROFESSIONAL, type DocData, type Lang } from "@/lib/proposta-doc";

export function PropostaEditView({
  doc,
  serveis,
  inclusions,
  exclusions,
  pagaments,
}: {
  doc: PropostaDoc;
  serveis: PropostaDocServei[];
  inclusions: PropostaDocLinia[];
  exclusions: PropostaDocLinia[];
  pagaments: PropostaDocPagament[];
}) {
  const [lang, setLang] = useState<Lang>("ca");
  const [, startTransition] = useTransition();

  const data: DocData = {
    num: doc.num,
    data: doc.data,
    descripcio: doc.descripcio,
    adreca: doc.adreca,
    ciutat: doc.ciutat,
    serveis: serveis.map((s) => ({ descripcio: s.descripcio, preu: parseFloat(s.preu) || 0 })),
    inclusions: inclusions.map((i) => i.text ?? ""),
    exclusions: exclusions.map((e) => e.text ?? ""),
    pagaments: pagaments.map((p) => ({ descripcio: p.descripcio, import: p.import != null ? parseFloat(p.import) : null })),
  };

  const subtotal = data.serveis.reduce((s, x) => s + x.preu, 0);
  const iva = subtotal * 0.21;

  function downloadWord() {
    const html = buildWordDoc(data, lang);
    const blob = new Blob(["﻿", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Proposta_${doc.num}_${lang}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/propostes" className="text-sm text-[var(--color-muted)] hover:underline">← Totes les propostes</Link>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input w-auto py-1.5"
            value={doc.estat}
            onChange={(e) => startTransition(() => setEstatAction(doc.id, e.target.value))}
          >
            <option value="pendent">Pendent</option>
            <option value="acceptada">Acceptada</option>
            <option value="rebutjada">Rebutjada</option>
          </select>
          <div className="inline-flex rounded-md border border-[var(--color-line)] p-0.5 text-sm">
            <button type="button" className={`rounded px-3 py-1 ${lang === "ca" ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-muted)]"}`} onClick={() => setLang("ca")}>Català</button>
            <button type="button" className={`rounded px-3 py-1 ${lang === "es" ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-muted)]"}`} onClick={() => setLang("es")}>Castellà</button>
          </div>
          <button type="button" className="btn-ghost" onClick={downloadWord}>Word</button>
          <button type="button" className="btn-primary" onClick={() => window.print()}>PDF / Imprimir</button>
        </div>
      </div>

      <h1 className="no-print text-2xl font-semibold tracking-tight">Proposta {doc.num}</h1>

      {/* Datos Propuesta */}
      <section className="no-print card">
        <h2 className="text-lg font-semibold mb-4">Dades de la Proposta</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Número"><div className="input bg-[var(--color-paper)] font-mono">{doc.num}</div></Field>
          <DateField doc={doc} />
          <div className="sm:col-span-2">
            <label className="label">Descripció</label>
            <DocTextarea doc={doc} field="descripcio" />
          </div>
          <div>
            <label className="label">Adreça</label>
            <DocInput doc={doc} field="adreca" />
          </div>
          <div>
            <label className="label">Ciutat</label>
            <DocInput doc={doc} field="ciutat" />
          </div>
        </div>
      </section>

      {/* Datos Profesionales (fixed) */}
      <section className="no-print card">
        <h2 className="text-lg font-semibold mb-4">Dades Professionals</h2>
        <dl className="grid gap-2 sm:grid-cols-2 text-sm">
          <Info label="Societat" value={PROFESSIONAL.societat} />
          <Info label="CIF" value={PROFESSIONAL.cif} />
          <Info label="Adreça" value={PROFESSIONAL.adreca} />
          <Info label="Ciutat" value={PROFESSIONAL.ciutat} />
        </dl>
        <p className="mt-3 text-xs text-[var(--color-muted)]">Aquestes dades són fixes i apareixen sempre al document.</p>
      </section>

      {/* Serveis */}
      <section className="no-print card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Servei pressupostat proposat</h2>
          <button type="button" className="btn-ghost" onClick={() => startTransition(() => addServeiAction(doc.id))}>+ Afegir línia</button>
        </div>
        <div className="table-wrap">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Concepte</th>
                <th className="th w-40 text-right">Import</th>
                <th className="th w-10"></th>
              </tr>
            </thead>
            <tbody>
              {serveis.length === 0 && (
                <tr><td className="td text-[var(--color-muted)]" colSpan={3}>Cap línia encara.</td></tr>
              )}
              {serveis.map((s) => <ServeiRow key={s.id} docId={doc.id} row={s} />)}
            </tbody>
            <tfoot>
              <tr><td className="td text-right font-medium">Subtotal</td><td className="td text-right tabular-nums">{formatEur(subtotal)}</td><td className="td"></td></tr>
              <tr><td className="td text-right font-medium">IVA (21%)</td><td className="td text-right tabular-nums">{formatEur(iva)}</td><td className="td"></td></tr>
              <tr className="bg-[var(--color-paper)]"><td className="td text-right font-semibold">TOTAL amb IVA</td><td className="td text-right font-semibold tabular-nums">{formatEur(subtotal + iva)}</td><td className="td"></td></tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Inclusions */}
      <LiniaSection
        title="Especificacions del servei (INCLOU)"
        docId={doc.id}
        taula="inclusio"
        rows={inclusions}
        fixed={FIXED_INCLUSIONS[lang]}
      />

      {/* Exclusions */}
      <LiniaSection
        title="Exclusions del servei (EXCLOU)"
        docId={doc.id}
        taula="exclusio"
        rows={exclusions}
        fixed={FIXED_EXCLUSIONS[lang]}
      />

      {/* Pagaments */}
      <section className="no-print card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Forma de pagament</h2>
          <button type="button" className="btn-ghost" onClick={() => startTransition(() => addPagamentAction(doc.id))}>+ Afegir línia</button>
        </div>
        <div className="space-y-2">
          {pagaments.length === 0 && <p className="text-sm text-[var(--color-muted)]">Cap línia encara.</p>}
          {pagaments.map((p) => <PagamentRow key={p.id} docId={doc.id} row={p} />)}
        </div>
        <p className="mt-3 text-sm">
          <span className="text-[var(--color-muted)]">Acceptació: </span>
          <span className="font-semibold">{formatEur(subtotal)} + IVA</span>
        </p>
      </section>

      {/* Preview */}
      <section className="card">
        <h2 className="no-print text-lg font-semibold mb-4">Vista prèvia del document ({lang === "ca" ? "Català" : "Castellà"})</h2>
        <div className="print-area" dangerouslySetInnerHTML={{ __html: buildPropostaHtml(data, lang) }} />
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function DateField({ doc }: { doc: PropostaDoc }) {
  const [v, setV] = useState(doc.data);
  const [, startTransition] = useTransition();
  return (
    <div>
      <label className="label">Data</label>
      <input type="date" className="input" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => startTransition(() => updatePropostaDocAction(doc.id, { data: v }))} />
    </div>
  );
}

function DocInput({ doc, field }: { doc: PropostaDoc; field: "adreca" | "ciutat" }) {
  const [v, setV] = useState(doc[field] ?? "");
  const [, startTransition] = useTransition();
  return (
    <input className="input" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => startTransition(() => updatePropostaDocAction(doc.id, { [field]: v.trim() || null }))} />
  );
}

function DocTextarea({ doc, field }: { doc: PropostaDoc; field: "descripcio" }) {
  const [v, setV] = useState(doc[field] ?? "");
  const [, startTransition] = useTransition();
  return (
    <textarea className="input min-h-20" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => startTransition(() => updatePropostaDocAction(doc.id, { [field]: v.trim() || null }))} />
  );
}

function ServeiRow({ docId, row }: { docId: number; row: PropostaDocServei }) {
  const [descripcio, setDescripcio] = useState(row.descripcio ?? "");
  const [preu, setPreu] = useState(row.preu);
  const [, startTransition] = useTransition();
  function persist() {
    if (descripcio !== (row.descripcio ?? "") || preu !== row.preu) {
      startTransition(() => updateServeiAction(docId, row.id, descripcio, parseFloat(preu) || 0));
    }
  }
  return (
    <tr>
      <td className="td"><input className="input" value={descripcio} onChange={(e) => setDescripcio(e.target.value)} onBlur={persist} placeholder="Descripció del servei" /></td>
      <td className="td"><input type="number" step="0.01" className="input text-right" value={preu} onChange={(e) => setPreu(e.target.value)} onBlur={persist} /></td>
      <td className="td text-right">
        <button type="button" className="text-red-700 hover:underline text-sm" onClick={() => startTransition(() => deleteServeiAction(docId, row.id))}>✕</button>
      </td>
    </tr>
  );
}

function LiniaSection({
  title,
  docId,
  taula,
  rows,
  fixed,
}: {
  title: string;
  docId: number;
  taula: "inclusio" | "exclusio";
  rows: PropostaDocLinia[];
  fixed: string[];
}) {
  const [, startTransition] = useTransition();
  return (
    <section className="no-print card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button type="button" className="btn-ghost" onClick={() => startTransition(() => addLiniaAction(docId, taula))}>+ Afegir línia</button>
      </div>
      <div className="space-y-2">
        {rows.map((r) => <LiniaRow key={r.id} docId={docId} taula={taula} row={r} />)}
        {fixed.map((f, i) => (
          <div key={`f${i}`} className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
            <span className="flex-1 rounded-md border border-dashed border-[var(--color-line)] px-3 py-2">{f}</span>
            <span className="text-xs">fix</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function LiniaRow({ docId, taula, row }: { docId: number; taula: "inclusio" | "exclusio"; row: PropostaDocLinia }) {
  const [text, setText] = useState(row.text ?? "");
  const [, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <input className="input flex-1" value={text} onChange={(e) => setText(e.target.value)} onBlur={() => { if (text !== (row.text ?? "")) startTransition(() => updateLiniaAction(docId, taula, row.id, text)); }} placeholder="Text de la línia" />
      <button type="button" className="text-red-700 hover:underline text-sm" onClick={() => startTransition(() => deleteLiniaAction(docId, taula, row.id))}>✕</button>
    </div>
  );
}

function PagamentRow({ docId, row }: { docId: number; row: PropostaDocPagament }) {
  const [descripcio, setDescripcio] = useState(row.descripcio ?? "");
  const [importe, setImporte] = useState(row.import ?? "");
  const [, startTransition] = useTransition();
  function persist() {
    if (descripcio !== (row.descripcio ?? "") || importe !== (row.import ?? "")) {
      startTransition(() => updatePagamentAction(docId, row.id, descripcio, importe === "" ? null : parseFloat(importe)));
    }
  }
  return (
    <div className="flex items-center gap-2">
      <input className="input flex-1" value={descripcio} onChange={(e) => setDescripcio(e.target.value)} onBlur={persist} placeholder="Ex: En finalitzar el servei" />
      <input type="number" step="0.01" className="input w-40 text-right" value={importe} onChange={(e) => setImporte(e.target.value)} onBlur={persist} placeholder="€" />
      <button type="button" className="text-red-700 hover:underline text-sm" onClick={() => startTransition(() => deletePagamentAction(docId, row.id))}>✕</button>
    </div>
  );
}
