"use client";

import Link from "next/link";
import { Fragment, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { deleteCalculAction, updateCalculAction, type CalculPatch } from "../actions";
import { calcType } from "@/lib/calculs";
import { allChecks, fmt, verdict, verdictText, weldResultText, type LoadsTable, type Row, type Section, type WeldCombo } from "@/lib/calculs/common";
import { PLATE, perfilOptions, perfilProps } from "@/lib/calculs/perfils";
import { newSostre, type Sostre } from "@/lib/calculs/paret";
import { AJUDA, type AuxImage } from "@/lib/calculs/ajuda";
import { downloadCalculWord, openCalculPdf } from "@/lib/calculs/report";
import { calculFileName } from "@/lib/file-names";
import { parseLocaleNumber } from "@/lib/format";
import { Combobox } from "@/components/combobox";
import { PerfilsRef } from "../perfils-ref";
import type { CalculEstructural } from "@/types/db";

export type ExpedientOpt = { id: number; num_expedient: string; projecte: string | null; adreca: string | null; ciutat: string | null; client_id: number | null; client_nom: string | null };

type Dades = Record<string, unknown>;
type SetDada = (key: string, value: unknown) => void;

export function CalculView({ calcul, expedients }: { calcul: CalculEstructural; expedients: ExpedientOpt[] }) {
  const t = calcType(calcul.tipus);
  const [doc, setDoc] = useState<CalculPatch>(() => ({
    expedient_id: calcul.expedient_id,
    client_id: calcul.client_id,
    referencia: calcul.referencia ?? "",
    projecte: calcul.projecte ?? "",
    adreca: calcul.adreca ?? "",
    ciutat: calcul.ciutat ?? "",
    client: calcul.client ?? "",
    arquitecte: calcul.arquitecte ?? "",
    situacio: calcul.situacio ?? "",
    element: calcul.element ?? "",
    data: calcul.data ?? "",
    versio: calcul.versio ?? "",
    dades: { ...t.defaults(), ...(calcul.dades ?? {}) },
  }));
  const result = useMemo(() => t.compute(doc.dades), [t, doc.dades]);
  // For each profile input that has it: the catalogue profiles that pass right now.
  const valids = useMemo(() => t.perfilsValids?.(doc.dades) ?? {}, [t, doc.dades]);
  const v = verdict(result);
  const failed = allChecks(result).filter((c) => !c.ok);

  // Autosave shortly after the last change.
  const [rev, setRev] = useState(0);
  const [savedRev, setSavedRev] = useState(0);
  const [saveError, setSaveError] = useState(false);
  const docRef = useRef(doc);
  docRef.current = doc;
  useEffect(() => {
    if (rev === savedRev) return;
    const h = setTimeout(async () => {
      const r = rev;
      try {
        await updateCalculAction(calcul.id, docRef.current);
        setSavedRev(r);
        setSaveError(false);
      } catch {
        setSaveError(true);
      }
    }, 700);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev]);
  const unsaved = rev !== savedRev;
  useEffect(() => {
    if (!unsaved) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [unsaved]);

  function update(patch: Partial<CalculPatch>) {
    setDoc((d) => ({ ...d, ...patch }));
    setRev((r) => r + 1);
  }
  const setDada: SetDada = (key, value) => {
    setDoc((d) => ({ ...d, dades: { ...d.dades, [key]: value } }));
    setRev((r) => r + 1);
  };

  function fillFromExpedient(id: number | null) {
    const e = id == null ? null : expedients.find((x) => x.id === id);
    if (!e) {
      update({ expedient_id: null });
      return;
    }
    update({
      expedient_id: e.id,
      referencia: e.num_expedient,
      projecte: e.projecte ?? doc.projecte,
      adreca: e.adreca ?? doc.adreca,
      ciutat: e.ciutat ?? doc.ciutat,
      client: e.client_nom ?? doc.client,
      client_id: e.client_id ?? doc.client_id,
    });
  }

  // Profiles used by the calculation, highlighted in the reference panel.
  const profilesInUse = useMemo(() => {
    const out: string[] = [];
    for (const s of result.sections) for (const b of s.blocks) for (const r of b.rows) if (r.input?.type === "profile" && typeof r.value === "string" && r.value !== PLATE) out.push(r.value);
    return out;
  }, [result]);
  const [refOpen, setRefOpen] = useState<string[] | null>(null);
  const [aux, setAux] = useState<AuxImage | null>(null);

  const [generating, setGenerating] = useState(false);
  const live = (): CalculEstructural => ({ ...calcul, ...doc });
  const fileName = () => calculFileName({ fileTitle: t.fileTitle, referencia: doc.referencia, versio: doc.versio, data: doc.data });

  const expedientOpts = expedients.map((e) => ({ id: e.id, label: e.num_expedient, sub: e.projecte ?? undefined }));

  return (
    <AuxContext.Provider value={setAux}>
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/calculs?tab=${t.tipus}`} className="text-sm text-[var(--color-muted)] hover:underline">← Càlculs</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{calcul.num} · {t.tab}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs ${saveError ? "text-red-700" : "text-[var(--color-muted)]"}`}>{saveError ? "No s'ha pogut desar" : unsaved ? "Desant…" : "Desat"}</span>
          <button type="button" className="btn-ghost" onClick={() => setRefOpen(profilesInUse)}>Taules de perfils</button>
          <button
            type="button"
            className="btn-ghost"
            disabled={generating}
            onClick={async () => {
              setGenerating(true);
              try {
                await downloadCalculWord(live(), result, fileName());
              } finally {
                setGenerating(false);
              }
            }}
          >
            Word
          </button>
          <button type="button" className="btn-primary" onClick={() => openCalculPdf(live(), result, fileName())}>PDF / Imprimir</button>
        </div>
      </div>

      {/* Encapçalament */}
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">Dades generals</h2>
        <div className="mb-5 grid gap-4 rounded-lg bg-[var(--color-paper)] p-4 sm:grid-cols-2">
          <div>
            <label className="label">Expedient</label>
            <Combobox options={expedientOpts} value={doc.expedient_id} onChange={fillFromExpedient} placeholder="Cercar expedient…" emptyLabel="— Sense expedient —" />
            {doc.expedient_id != null && (
              <button type="button" className="mt-1 text-xs text-[var(--color-accent)] hover:underline" onClick={() => fillFromExpedient(doc.expedient_id)}>
                Tornar a omplir l&apos;encapçalament des de l&apos;expedient
              </button>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Referència DAC" value={doc.referencia} onChange={(v) => update({ referencia: v })} />
          <Field className="sm:col-span-3" label="Projecte" value={doc.projecte} onChange={(v) => update({ projecte: v })} />
          <Field className="sm:col-span-3" label="Adreça" value={doc.adreca} onChange={(v) => update({ adreca: v })} />
          <Field label="Ciutat" value={doc.ciutat} onChange={(v) => update({ ciutat: v })} />
          <Field className="sm:col-span-2" label="Client" value={doc.client} onChange={(v) => update({ client: v })} />
          <Field className="sm:col-span-2" label="Arquitecte" value={doc.arquitecte} onChange={(v) => update({ arquitecte: v })} />
          <Field label={t.situacioLabel} value={doc.situacio} onChange={(v) => update({ situacio: v })} placeholder="p. ex. Planta baixa" />
          <Field className="sm:col-span-3" label="Referència element" value={doc.element} onChange={(v) => update({ element: v })} placeholder="p. ex. Detall base recolzament IPE-270" />
          <div>
            <label className="label">Data</label>
            <input type="date" className="input" value={doc.data} onChange={(e) => update({ data: e.target.value })} />
          </div>
          <Field label="Versió càlcul" value={doc.versio} onChange={(v) => update({ versio: v })} />
        </div>
      </section>

      {/* Resultat */}
      <section className={`rounded-lg border px-5 py-4 ${v.ok ? "border-emerald-200 bg-emerald-50" : v.total ? "border-red-200 bg-red-50" : "border-[var(--color-line)] bg-white"}`}>
        <p className={`font-semibold ${v.ok ? "text-emerald-800" : v.total ? "text-red-800" : "text-[var(--color-muted)]"}`}>{verdictText(v)}</p>
        {failed.length > 0 && (
          <ul className="mt-1 list-disc pl-5 text-sm text-red-800">
            {failed.map((f, i) => (
              <li key={i}>
                {f.label} <span className="text-red-700/70">· {f.section}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {result.sections.map((s) => (
        <SectionCard key={s.key} section={s} dades={doc.dades} setDada={setDada} valids={valids} onShowProfile={(name) => setRefOpen([name])} />
      ))}

      <div className="flex justify-end">
        <form action={deleteCalculAction}>
          <input type="hidden" name="id" value={calcul.id} />
          <button type="submit" className="btn-danger" onClick={(e) => { if (!confirm(`Eliminar el càlcul ${calcul.num}?`)) e.preventDefault(); }}>
            Eliminar càlcul
          </button>
        </form>
      </div>

      {refOpen && <RefDrawer highlight={refOpen} onClose={() => setRefOpen(null)} />}
      {aux && <AuxViewer img={aux} onClose={() => setAux(null)} />}
    </div>
    </AuxContext.Provider>
  );
}

function Field({ label, value, onChange, className, placeholder }: { label: string; value: string; onChange: (v: string) => void; className?: string; placeholder?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      <input className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// ---- sections ----

type Valids = Record<string, Set<string>>;

function SectionCard({ section, dades, setDada, valids, onShowProfile }: { section: Section; dades: Dades; setDada: SetDada; valids: Valids; onShowProfile: (name: string) => void }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--color-line)] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] bg-[var(--color-paper)] px-5 py-3">
        <h2 className="text-base font-semibold">{section.title}</h2>
        {section.toggle && (
          <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
            <input type="checkbox" checked={section.enabled} onChange={(e) => setDada(section.toggle!, e.target.checked)} />
            Incloure al càlcul i a l&apos;informe
          </label>
        )}
      </div>
      {!section.enabled ? (
        <p className="px-5 py-3 text-sm text-[var(--color-muted)]">Opció no inclosa.</p>
      ) : (
        <div className="overflow-x-auto">
          {section.loads && <LoadsEditor loads={section.loads} dades={dades} setDada={setDada} />}
          {section.welds && <WeldsTable welds={section.welds} dades={dades} setDada={setDada} />}
          {section.blocks.length > 0 && (
            <table className="w-full min-w-[760px] text-sm">
              <colgroup>
                <col />
                <col className="w-20" />
                <col className="w-52" />
                <col className="w-48" />
                <col className="w-36" />
              </colgroup>
              <tbody>
                {section.blocks.map((b, bi) => (
                  <BlockRows key={bi} title={b.title} rows={b.rows} dades={dades} setDada={setDada} valids={valids} onShowProfile={onShowProfile} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}

function BlockRows({ title, rows, dades, setDada, valids, onShowProfile }: { title?: string; rows: Row[]; dades: Dades; setDada: SetDada; valids: Valids; onShowProfile: (name: string) => void }) {
  return (
    <>
      {title && (
        <tr>
          <td colSpan={5} className="border-b border-[var(--color-line)] bg-[#f3f6f9] px-5 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#2f5d8f]">
            {title}
          </td>
        </tr>
      )}
      {rows.map((r, i) =>
        r.input?.type === "profile" && r.input.byType ? (
          <ProfileByTypeRows key={i} row={r} inputKey={r.input.key} value={String(dades[r.input.key] ?? "")} setDada={setDada} valids={valids[r.input.key]} onShowProfile={onShowProfile} />
        ) : (
        <tr key={i} className="border-b border-[var(--color-line)] last:border-b-0">
          <td className="px-5 py-2 align-middle">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {r.label}
              {r.aux?.map((img) => <AuxButton key={img.src} img={img} />)}
            </div>
            {r.formula && <div className="text-xs italic text-[var(--color-muted)]">{r.formula}</div>}
            {r.hint && <div className="text-xs text-[var(--color-muted)]">{r.hint}</div>}
          </td>
          <td className="px-2 py-2 text-center text-xs text-[var(--color-muted)]">{r.sym ?? ""}</td>
          <td className="px-2 py-2">
            <ValueCell row={r} dades={dades} setDada={setDada} onShowProfile={onShowProfile} />
          </td>
          <td className="px-2 py-2">
            {r.check && (
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <Badge ok={r.check.ok} />
                <span className="text-xs text-[var(--color-muted)] tabular-nums">
                  {r.check.op} {fmt(r.check.limit, r.check.decimals ?? 2)} {r.check.unit ?? ""}
                </span>
              </span>
            )}
          </td>
          <td className="px-5 py-2 text-right text-xs whitespace-nowrap text-[#3f7cc0] tabular-nums">{r.alt ? `= ${fmt(r.alt.value, r.alt.decimals ?? 2)} ${r.alt.unit}` : ""}</td>
        </tr>
        ),
      )}
    </>
  );
}

// ---- profile picked by type (paret): type, then profile, with the ones that pass ----

const typeLabel = (title: string) => title.replace(/^Perfils /, "");
const weight = (name: string) => perfilProps(name)?.p ?? Infinity;
const lightestFirst = (names: string[]) => [...names].sort((a, b) => weight(a) - weight(b));
const SUGGESTED = 10; // passing profiles listed for the chosen type

function ProfileByTypeRows({
  row,
  inputKey,
  value,
  setDada,
  valids,
  onShowProfile,
}: {
  row: Row;
  inputKey: string;
  value: string;
  setDada: SetDada;
  valids?: Set<string>;
  onShowProfile: (name: string) => void;
}) {
  const group = PROFILE_GROUPS.find((g) => g.names.includes(value));
  const pick = (name: string) => setDada(inputKey, name);
  // Choosing a type picks its lightest profile that passes (or its biggest, if none does).
  function pickType(family: string) {
    const g = PROFILE_GROUPS.find((x) => x.family === family);
    if (g) pick(lightestFirst(g.names.filter((n) => valids?.has(n)))[0] ?? g.names[g.names.length - 1]);
  }
  const here = group ? lightestFirst(group.names.filter((n) => valids?.has(n))) : [];
  const others = PROFILE_GROUPS.filter((g) => g !== group)
    .map((g) => lightestFirst(g.names.filter((n) => valids?.has(n)))[0])
    .filter((n): n is string => !!n);
  const chip = (n: string, withWeight: boolean) => (
    <button
      key={n}
      type="button"
      onClick={() => pick(n)}
      className={`rounded-full border px-2 py-0.5 ${n === value ? "border-emerald-700 bg-emerald-700 text-white" : "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"}`}
      title={`${fmt(weight(n), 1)} kg/m`}
    >
      {n}
      {withWeight && <span className="ml-1 opacity-70">{fmt(weight(n), 1)} kg/m</span>}
    </button>
  );

  return (
    <>
      <tr className="border-b-0">
        <td className="px-5 pt-2 align-middle">{row.label}</td>
        <td className="px-2 pt-2" />
        <td colSpan={2} className="px-2 pt-2">
          <div className="flex items-center gap-1">
            <select className="input input-dada w-24 shrink-0" aria-label="Tipus de perfil" value={group?.family ?? ""} onChange={(e) => pickType(e.target.value)}>
              {!group && <option value="">—</option>}
              {PROFILE_GROUPS.map((g) => <option key={g.family} value={g.family}>{typeLabel(g.title)}</option>)}
            </select>
            <select className="input input-dada" aria-label="Perfil" value={value} onChange={(e) => pick(e.target.value)}>
              {!group && <option value={value}>{value || "—"}</option>}
              {group?.names.map((n) => <option key={n} value={n}>{valids?.has(n) ? `${n}  ✓ compleix` : n}</option>)}
            </select>
            {group && (
              <button type="button" className="shrink-0 rounded px-1.5 py-1 text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]" title="Veure a les taules de perfils" onClick={() => onShowProfile(value)}>
                ⓘ
              </button>
            )}
          </div>
        </td>
        <td />
      </tr>
      <tr className="border-b border-[var(--color-line)]">
        <td colSpan={5} className="space-y-1.5 px-5 pb-3 pt-2 text-xs">
          {valids && group && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[var(--color-muted)]">
                {here.length ? `${typeLabel(group.title)} que compleixen, del més lleuger al més pesant:` : `Cap ${typeLabel(group.title)} compleix amb aquestes càrregues i aquesta llum.`}
              </span>
              {here.slice(0, SUGGESTED).map((n) => chip(n, false))}
              {here.length > SUGGESTED && <span className="text-[var(--color-muted)]">i {here.length - SUGGESTED} més</span>}
            </div>
          )}
          {valids && others.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[var(--color-muted)]">El més lleuger que compleix d&apos;altres tipus:</span>
              {others.map((n) => chip(n, true))}
            </div>
          )}
          {valids && !here.length && !others.length && (
            <p className="text-red-800">Cap perfil del catàleg compleix: prova amb més perfils o revisa les càrregues i la llum.</p>
          )}
        </td>
      </tr>
    </>
  );
}

function Badge({ ok }: { ok: boolean }) {
  return <span className={`inline-block min-w-[38px] rounded px-1.5 py-0.5 text-center text-xs font-bold text-white ${ok ? "bg-emerald-700" : "bg-red-700"}`}>{ok ? "OK!" : "NO!"}</span>;
}

const PROFILE_GROUPS = perfilOptions();

function ValueCell({ row, dades, setDada, onShowProfile }: { row: Row; dades: Dades; setDada: SetDada; onShowProfile: (name: string) => void }) {
  const inp = row.input;
  if (!inp) {
    return (
      <div className="text-right font-medium tabular-nums">
        {typeof row.value === "string" ? row.value : fmt(row.value, row.decimals ?? 2)}
        {row.unit && <span className="ml-1 text-xs font-normal text-[var(--color-muted)]">{row.unit}</span>}
      </div>
    );
  }
  if (inp.type === "profile") {
    const value = String(dades[inp.key] ?? "");
    const known = PROFILE_GROUPS.some((g) => g.names.includes(value)) || (inp.allowPlate && value === PLATE);
    return (
      <div className="flex items-center gap-1">
        <select className="input input-dada" value={value} onChange={(e) => setDada(inp.key, e.target.value)}>
          {!known && <option value={value}>{value || "—"}</option>}
          {inp.allowPlate && <option value={PLATE}>Xapa (gruix a mà)</option>}
          {PROFILE_GROUPS.map((g) => (
            <optgroup key={g.family} label={g.title}>
              {g.names.map((n) => <option key={n} value={n}>{n}</option>)}
            </optgroup>
          ))}
        </select>
        {value !== PLATE && (
          <button type="button" className="shrink-0 rounded px-1.5 py-1 text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]" title="Veure a les taules de perfils" onClick={() => onShowProfile(value)}>
            ⓘ
          </button>
        )}
      </div>
    );
  }
  if (inp.type === "select") {
    return (
      <select className="input input-dada" value={String(dades[inp.key] ?? "")} onChange={(e) => setDada(inp.key, e.target.value)}>
        {inp.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  const hasAuto = inp.auto !== undefined;
  const isAuto = hasAuto && dades[inp.key] == null;
  return (
    <div className="flex items-center gap-1.5">
      <NumInput value={dades[inp.key]} onChange={(n) => setDada(inp.key, n)} auto={inp.auto} integer={inp.integer} />
      <span className="w-12 shrink-0 text-xs text-[var(--color-muted)]">{row.unit ?? ""}</span>
      {hasAuto && (isAuto ? (
        <span className="shrink-0 text-[10px] uppercase text-[var(--color-muted)]" title="Valor del catàleg; escriu-hi per canviar-lo">auto</span>
      ) : (
        <button type="button" className="shrink-0 text-xs text-[var(--color-accent)]" title="Tornar al valor del catàleg" onClick={() => setDada(inp.key, null)}>↺</button>
      ))}
    </div>
  );
}

// With decimals, a value shows that many (1,7 → 1,70) while it isn't being typed in.
function toText(v: unknown, decimals?: number): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "";
  return (decimals == null ? String(v) : v.toFixed(decimals)).replace(".", ",");
}

function NumInput({
  value,
  onChange,
  auto,
  integer,
  className,
  decimals,
}: {
  value: unknown;
  onChange: (n: number | null) => void;
  auto?: number | null;
  integer?: boolean;
  className?: string;
  decimals?: number;
}) {
  const [text, setText] = useState(toText(value, decimals));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(toText(value, decimals));
  }, [value, decimals]);
  return (
    <input
      className={`input input-dada text-right tabular-nums ${className ?? ""}`}
      inputMode="decimal"
      value={text}
      placeholder={auto != null ? toText(decimals == null ? Math.round(auto * 1000) / 1000 : auto, decimals) : undefined}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setText(toText(value, decimals));
      }}
      onChange={(e) => {
        const s = e.target.value;
        setText(s);
        if (s.trim() === "") return onChange(null);
        const n = parseLocaleNumber(s);
        if (Number.isFinite(n)) onChange(integer ? Math.round(n) : n);
      }}
    />
  );
}

// ---- paret: estat de càrregues ----

function LoadsEditor({ loads, dades, setDada }: { loads: LoadsTable; dades: Dades; setDada: SetDada }) {
  const sostres = (dades.sostres as Sostre[] | undefined) ?? [];
  const setSostre = (i: number, patch: Partial<Sostre>) => setDada("sostres", sostres.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const th = "px-2 py-1.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]";
  const num = "px-2 py-1.5 text-right tabular-nums whitespace-nowrap";
  return (
    <div>
      <table className="w-full min-w-[860px] text-sm">
        <thead className="border-b border-[var(--color-line)] bg-white">
          <tr>
            <th className="py-1.5 pl-5 pr-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Concepte</th>
            <th className={`${th} w-40`}>Càrrega</th>
            <th className={`${th} w-36`}>Amplària</th>
            <th className={`${th} w-32`}>S/majorar</th>
            <th className={`${th} w-24`}>Coef.</th>
            <th className={`${th} w-32 pr-5`}>Majorada</th>
          </tr>
        </thead>
        <tbody>
          {loads.groups.map((g, gi) => {
            const si = g.sostreIndex;
            const s = si != null ? sostres[si] : null;
            return (
              <Fragment key={gi}>
                <tr className="border-b border-[var(--color-line)] bg-[#f3f6f9]">
                  <td colSpan={6} className="px-5 py-1.5">
                    {s && si != null ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <input className="input input-sm w-56 font-semibold" value={s.nom} onChange={(e) => setSostre(si, { nom: e.target.value })} />
                        <AuxButton img={AJUDA.sobrecarregues} />
                        <AuxButton img={AJUDA.sobrecarreguesNotes} />
                        <span className="text-xs uppercase text-[var(--color-muted)]">Nombre</span>
                        <div className="w-20">
                          <NumInput value={s.nombre} onChange={(n) => setSostre(si, { nombre: n ?? 0 })} className="input-sm" />
                        </div>
                        <span className="text-xs text-[var(--color-muted)]">ut</span>
                        <button type="button" className="ml-auto text-xs text-red-700 hover:underline" onClick={() => setDada("sostres", sostres.filter((_, j) => j !== si))}>
                          Treure sostre
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold uppercase tracking-wide text-[#2f5d8f]">{g.title}</span>
                    )}
                  </td>
                </tr>
                {g.lines.map((l, li) => {
                  if (l.heading) {
                    return (
                      <tr key={li}>
                        <td colSpan={6} className="px-5 pt-2 text-xs italic text-[var(--color-muted)]">{l.heading}</td>
                      </tr>
                    );
                  }
                  if (l.param) {
                    const p = l.param;
                    return (
                      <tr key={li} className="border-b border-[var(--color-line)]">
                        <td className="px-5 py-1.5">{p.label}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            <NumInput value={dades[p.key]} onChange={(n) => setDada(p.key, n)} className="input-sm" decimals={2} />
                            <span className="w-12 text-xs text-[var(--color-muted)]">{p.unit}</span>
                          </div>
                        </td>
                        <td colSpan={4} />
                      </tr>
                    );
                  }
                  const ln = l.line!;
                  const qInput =
                    s && si != null && ln.qKey ? (
                      <NumInput value={s[ln.qKey as keyof Sostre]} onChange={(n) => setSostre(si, { [ln.qKey!]: n ?? 0 } as Partial<Sostre>)} className="input-sm" decimals={2} />
                    ) : ln.qKey ? (
                      <NumInput value={dades[ln.qKey]} onChange={(n) => setDada(ln.qKey!, n)} auto={ln.qAuto} className="input-sm" decimals={2} />
                    ) : null;
                  const gammaInput =
                    ln.gammaKey && s && si != null ? (
                      <NumInput value={s[ln.gammaKey as keyof Sostre]} onChange={(n) => setSostre(si, { [ln.gammaKey!]: n ?? 0 } as Partial<Sostre>)} className="input-sm" decimals={2} />
                    ) : ln.gammaKey ? (
                      <NumInput value={dades[ln.gammaKey]} onChange={(n) => setDada(ln.gammaKey!, n)} className="input-sm" decimals={2} />
                    ) : null;
                  return (
                    <tr key={li} className="border-b border-[var(--color-line)]">
                      <td className="px-5 py-1.5">
                        {ln.label}
                        {ln.qAuto !== undefined && (
                          <div className="text-xs text-[var(--color-muted)]">
                            {dades[ln.qKey!] == null ? "Del catàleg (nombre × pes del perfil); escriu-hi per canviar-lo." : (
                              <button type="button" className="text-[var(--color-accent)] hover:underline" onClick={() => setDada(ln.qKey!, null)}>↺ Tornar al pes del catàleg ({fmt(ln.qAuto, 3)} kN/ml)</button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1">
                          {qInput}
                          <span className="w-12 text-xs text-[var(--color-muted)]">{ln.qUnit}</span>
                        </div>
                      </td>
                      <td className={num}>
                        {ln.widthKey && s && si != null ? (
                          <div className="flex items-center gap-1">
                            <NumInput value={s.amplada} onChange={(n) => setSostre(si, { amplada: n ?? 0 })} className="input-sm" />
                            <span className="text-xs text-[var(--color-muted)]">m</span>
                          </div>
                        ) : ln.width != null ? (
                          <span className="text-[var(--color-muted)]">{fmt(ln.width)} {ln.widthUnit}</span>
                        ) : null}
                      </td>
                      <td className={num}>{fmt(ln.unf)} <span className="text-xs text-[var(--color-muted)]">kN/ml</span></td>
                      <td className={num}>{gammaInput ?? <span className="text-[var(--color-muted)]">{fmt(ln.gamma)}</span>}</td>
                      <td className={`${num} pr-5`}>{fmt(ln.fac)} <span className="text-xs text-[var(--color-muted)]">kN/ml</span></td>
                    </tr>
                  );
                })}
                {g.total && (
                  <tr className="border-b border-[var(--color-line)] font-semibold">
                    <td className="px-5 py-1.5">{g.total.label}</td>
                    <td className={num}>{fmt(g.total.q)} <span className="text-xs font-normal text-[var(--color-muted)]">kN/m²</span></td>
                    <td />
                    <td className={num}>{fmt(g.total.unf)} <span className="text-xs font-normal text-[var(--color-muted)]">kN/ml</span></td>
                    <td />
                    <td className={`${num} pr-5`}>{fmt(g.total.fac)} <span className="text-xs font-normal text-[var(--color-muted)]">kN/ml</span></td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          <tr className="bg-[var(--color-paper)] font-semibold">
            <td className="px-5 py-2">Total estat de càrregues sobre el perfil</td>
            <td />
            <td />
            <td className={num}>{fmt(loads.totalUnf)} <span className="text-xs font-normal text-[var(--color-muted)]">kN/ml</span></td>
            <td />
            <td className={`${num} pr-5`}>{fmt(loads.totalFac)} <span className="text-xs font-normal text-[var(--color-muted)]">kN/ml</span></td>
          </tr>
        </tbody>
      </table>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
        <button type="button" className="btn-ghost" onClick={() => setDada("sostres", [...sostres, newSostre(sostres.length + 1)])}>
          + Afegir sostre
        </button>
        <span className="text-xs text-[var(--color-muted)]">Q ELS = sense majorar · Q ELU = majorada</span>
      </div>
    </div>
  );
}

// ---- soldadura: combinacions ----

function WeldsTable({ welds, dades, setDada }: { welds: WeldCombo[]; dades: Dades; setDada: SetDada }) {
  const cell = "px-2 py-1.5 text-right tabular-nums whitespace-nowrap";
  const shade = (on: boolean) => (on ? "bg-[#e3e3e3] font-semibold" : "");
  // Combinations left out (they aren't welded there): no check, not in the report.
  const ocultes = Array.isArray(dades.ocultes) ? (dades.ocultes as string[]) : [];
  const toggle = (key: string, include: boolean) => setDada("ocultes", include ? ocultes.filter((k) => k !== key) : [...ocultes, key]);
  return (
    <div>
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-[var(--color-line)]">
          <tr className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
            <th className="px-5 py-1.5 text-left font-semibold">Peça</th>
            <th className="w-28 px-2 py-1.5 text-right font-semibold">Gruix</th>
            <th className="w-32 px-2 py-1.5 text-right font-semibold">Gola màxima</th>
            <th className="w-32 px-2 py-1.5 pr-5 text-right font-semibold">Gola mínima</th>
          </tr>
        </thead>
        <tbody>
          {welds.map((w, i) => {
            const included = w.included !== false;
            return (
              <Fragment key={w.key ?? i}>
                {(["a", "b"] as const).map((k) => {
                  const p = w[k];
                  const isThin = w.thin === k;
                  const isThick = w.thin != null && !isThin;
                  return (
                    <tr key={k} className={included ? "" : "text-[var(--color-muted)] opacity-50"}>
                      <td className="px-5 py-1.5">{p.label}</td>
                      <td className={cell}>{fmt(p.t, 2)} <span className="text-xs text-[var(--color-muted)]">mm</span></td>
                      <td className={`${cell} ${included ? shade(isThin) : ""}`}>{fmt(p.aMax, 1)}</td>
                      <td className={`${cell} pr-5 ${included ? shade(isThick) : ""}`}>{fmt(p.aMin, 1)}</td>
                    </tr>
                  );
                })}
                <tr className="border-b-2 border-[var(--color-line)]">
                  <td colSpan={4} className="px-5 pb-2.5 pt-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {included ? (
                        <span className="inline-flex items-center gap-2">
                          <Badge ok={w.ok} />
                          <span className={w.ok ? "font-medium" : "text-red-800"}>{weldResultText(w)}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--color-muted)]">No inclosa: no es comprova ni surt a l&apos;informe.</span>
                      )}
                      {w.key && (
                        <label className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
                          <input type="checkbox" checked={included} onChange={(e) => toggle(w.key!, e.target.checked)} />
                          Incloure a l&apos;informe
                        </label>
                      )}
                    </div>
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <p className="px-5 py-3 text-xs text-[var(--color-muted)]">
        Ombrejats: la gola màxima de la peça més prima i la mínima de la més gruixuda. La primera ha d&apos;estar dins del marge de la peça més gruixuda i la segona dins del de la més prima.
      </p>
    </div>
  );
}

// ---- help images (CTE extracts) ----

const AuxContext = createContext<(img: AuxImage) => void>(() => {});

function AuxButton({ img }: { img: AuxImage }) {
  const open = useContext(AuxContext);
  return (
    <button
      type="button"
      title={img.title}
      onClick={() => open(img)}
      className="inline-flex items-center gap-1 rounded border border-[var(--color-line)] bg-white px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
      </svg>
      {img.short}
    </button>
  );
}

function AuxViewer({ img, onClose }: { img: AuxImage; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <figure className="max-h-full w-full max-w-[960px] overflow-auto rounded-lg bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-4">
          <figcaption className="text-sm font-semibold">{img.title}</figcaption>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-0.5 text-[var(--color-muted)] hover:bg-[var(--color-paper)]" aria-label="Tancar">✕</button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.src} alt={img.title} className="h-auto w-full" />
      </figure>
    </div>
  );
}

// ---- reference panel ----

function RefDrawer({ highlight, onClose }: { highlight: string[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="h-full w-full max-w-[1100px] overflow-y-auto bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Perfils i soldadures</h2>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-[var(--color-muted)] hover:bg-[var(--color-paper)]" aria-label="Tancar">✕</button>
        </div>
        <PerfilsRef highlight={highlight} />
      </div>
    </div>
  );
}
