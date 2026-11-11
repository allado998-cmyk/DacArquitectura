"use client";

import { useMemo, useState } from "react";
import { consultaCadastreAction, setIteLinksAction } from "../actions";
import { applyCadastre, teFilesDePlantes, type CadastreApply, type CadastreDades } from "@/lib/ite/cadastre";
import { catLabel, CATALEG_LABELS, findCat } from "@/lib/ite/cataleg";
import { propietatFromClient, tecnicDespatx } from "@/lib/ite/defaults";
import {
  getAt,
  gravetatValor,
  inspeccionsOf,
  LIST_PATHS,
  listOf,
  newDeficiencia,
  newEnvolupant,
  newMesura,
  newPlanta,
  resumDeficiencies,
  setAt,
  syncInspeccions,
  TIPUS_HABITATGE,
  validateIte,
  valoracioFavorable,
} from "@/lib/ite/model";
import { fotoPaquet } from "@/lib/ite/fotos";
import { exportFotosZip, exportPortalXml, exportPortalZip } from "@/lib/ite/portal-client";
import { isObj, type IteObj } from "@/lib/ite/xml";
import { CatSelect } from "./fields";
import { useDraft, useIte } from "./ite-context";
import { PhotoGallery } from "./media";

const str = (v: unknown) => (typeof v === "string" ? v : "");

function DraftText({ path, placeholder, multiline, className }: { path: string; placeholder?: string; multiline?: boolean; className?: string }) {
  const { doc, update } = useIte();
  const value = str(getAt(doc, path));
  const d = useDraft(value, (v) => update((x) => setAt(x, path, multiline ? (v.trim() ? v.replace(/\r\n?/g, "\n") : undefined) : v.trim() || undefined)), multiline ? 1200 : 0);
  if (multiline) {
    const rows = Math.min(16, Math.max(3, Math.ceil(d.value.length / 110) + (d.value.match(/\n/g)?.length ?? 0)));
    return <textarea className={className ?? "input"} rows={rows} placeholder={placeholder} value={d.value} onFocus={d.onFocus} onChange={(e) => d.onChange(e.target.value)} onBlur={d.onBlur} />;
  }
  return <input className={className ?? "input"} placeholder={placeholder} value={d.value} onFocus={d.onFocus} onChange={(e) => d.onChange(e.target.value)} onBlur={d.onBlur} />;
}

function ListActions({ path, i, n, what }: { path: string; i: number; n: number; what: string }) {
  const { update } = useIte();
  const move = (dir: -1 | 1) =>
    update((x) => {
      const l = listOf(x, path).slice();
      const j = i + dir;
      if (j < 0 || j >= l.length) return x;
      [l[i], l[j]] = [l[j], l[i]];
      return setAt(x, path, l);
    });
  return (
    <div className="flex items-center gap-1">
      <button type="button" className="btn-ghost btn-sm" disabled={i === 0} onClick={() => move(-1)} title="Amunt">↑</button>
      <button type="button" className="btn-ghost btn-sm" disabled={i === n - 1} onClick={() => move(1)} title="Avall">↓</button>
      <button type="button" className="btn-danger btn-sm" title="Eliminar" onClick={() => { if (confirm(`Eliminar ${what}? Les seves fotos també.`)) update((x) => setAt(x, path, listOf(x, path).filter((_, j) => j !== i))); }}>✕</button>
    </div>
  );
}

// Floors and doors (section 5) -----------------------------------------------------

function CountInput({ path, i, field }: { path: string; i: number; field: "numHabitatges" | "numLocals" }) {
  const { doc, update } = useIte();
  const value = str(getAt(doc, `${path}.${i}.${field}`)) || "0";
  const d = useDraft(value, (v) =>
    update((x) => {
      const n = Math.max(0, Math.min(50, Math.round(Number(v.replace(",", ".")) || 0)));
      const p = getAt(x, `${path}.${i}`);
      if (!isObj(p)) return x;
      return setAt(x, `${path}.${i}`, syncInspeccions({ ...p, [field]: String(n) }));
    }),
  );
  return <input className="input input-sm w-16 text-right tabular-nums" inputMode="numeric" value={d.value} onFocus={d.onFocus} onChange={(e) => d.onChange(e.target.value)} onBlur={d.onBlur} />;
}

export function PlantesEditor() {
  const { doc, update } = useIte();
  const path = LIST_PATHS.plantes;
  const plantes = listOf(doc, path);
  const tot = plantes.reduce(
    (a, p) => {
      const ins = inspeccionsOf(p);
      return {
        hab: a.hab + (Number(str(p.numHabitatges)) || 0),
        loc: a.loc + (Number(str(p.numLocals)) || 0),
        par: a.par + (str(p.teParquing) === "true" ? 1 : 0),
        vis: a.vis + ins.filter((x) => str(x.revisat) === "true").length,
      };
    },
    { hab: 0, loc: 0, par: 0, vis: 0 },
  );

  function toggleVisit(i: number, k: number, on: boolean) {
    update((x) => {
      const p = getAt(x, `${path}.${i}`);
      if (!isObj(p)) return x;
      const ins = inspeccionsOf(p).map((it, j) => {
        if (j !== k) return it;
        const next = { ...it };
        if (on) next.revisat = "true";
        else delete next.revisat;
        return next;
      });
      return setAt(x, `${path}.${i}`, { ...p, inspeccions: ins });
    });
  }

  return (
    <fieldset className="rounded-lg border border-[var(--color-line)] p-4">
      <legend className="px-1 text-sm font-semibold">Relació d&apos;entitats per planta (existents i inspeccionades)</legend>
      <p className="mb-3 text-xs text-[var(--color-muted)]">Una fila per planta o per porta, com al portal. Marca les portes visitades. Es pot generar des del Cadastre (Dades Generals).</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--color-muted)]">
              <th className="py-1 pr-2 font-medium">Planta</th>
              <th className="py-1 pr-2 text-right font-medium">Habitatges</th>
              <th className="py-1 pr-2 text-right font-medium">Locals</th>
              <th className="py-1 pr-2 text-center font-medium">Pàrquing</th>
              <th className="py-1 pr-2 font-medium">Portes visitades</th>
              <th className="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {plantes.map((p, i) => (
              <tr key={i} className="border-t border-[var(--color-line)]">
                <td className="py-1.5 pr-2"><DraftText path={`${path}.${i}.plantaDescripcio`} className="input input-sm min-w-[180px]" placeholder="p. ex. Principal 1a" /></td>
                <td className="py-1.5 pr-2 text-right"><CountInput path={path} i={i} field="numHabitatges" /></td>
                <td className="py-1.5 pr-2 text-right"><CountInput path={path} i={i} field="numLocals" /></td>
                <td className="py-1.5 pr-2 text-center">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" checked={str(p.teParquing) === "true"} onChange={(e) => update((x) => setAt(x, `${path}.${i}.teParquing`, e.target.checked ? "true" : "false"))} />
                </td>
                <td className="py-1.5 pr-2">
                  <div className="flex flex-wrap gap-2">
                    {inspeccionsOf(p).map((it, k) => (
                      <label key={k} className="flex items-center gap-1 text-xs" title={str(it.tipusInspeccio) === TIPUS_HABITATGE ? "Habitatge" : "Local"}>
                        <input type="checkbox" className="accent-[var(--color-accent)]" checked={str(it.revisat) === "true"} onChange={(e) => toggleVisit(i, k, e.target.checked)} />
                        {str(it.tipusInspeccio) === TIPUS_HABITATGE ? "H" : "L"}{str(it.porta)}
                      </label>
                    ))}
                    {inspeccionsOf(p).length === 0 && <span className="text-xs text-[var(--color-muted)]">—</span>}
                  </div>
                </td>
                <td className="py-1.5"><ListActions path={path} i={i} n={plantes.length} what="aquesta fila" /></td>
              </tr>
            ))}
          </tbody>
          {plantes.length > 0 && (
            <tfoot>
              <tr className="border-t border-[var(--color-line)] text-xs font-medium">
                <td className="py-1.5 pr-2">Total</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{tot.hab}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{tot.loc}</td>
                <td className="py-1.5 pr-2 text-center tabular-nums">{tot.par}</td>
                <td className="py-1.5 pr-2">{tot.vis} visitades de {tot.hab + tot.loc}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <button type="button" className="btn-ghost btn-sm mt-3" onClick={() => update((x) => setAt(x, path, [...listOf(x, path), newPlanta("", 1, 0)]))}>+ Afegir fila</button>
    </fieldset>
  );
}

// Envelope (section 6) -----------------------------------------------------------

export function EnvolupantsEditor() {
  const { doc, update, cataleg } = useIte();
  const path = LIST_PATHS.envolupants;
  const items = listOf(doc, path);
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-muted)]">Descripció del sistema envolupant de l&apos;edifici: un element per façana, coberta, pati… amb les seves fotografies.</p>
      {items.map((e, i) => (
        <div key={i} className="rounded-lg border border-[var(--color-line)] bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Element {i + 1}</span>
              <CatSelect cat="tipus_envolupant" className="input input-sm w-48" placeholder="Tipus…" value={e.envolupantTipus as IteObj | undefined} onChange={(id) => update((x) => {
                const obj = id ? findCat(cataleg, "tipus_envolupant", id) : undefined;
                return setAt(x, `${path}.${i}.envolupantTipus`, obj ? structuredClone(obj) : undefined);
              })} />
            </div>
            <ListActions path={path} i={i} n={items.length} what={`l'element ${i + 1}`} />
          </div>
          <label className="label">Descripció</label>
          <DraftText path={`${path}.${i}.envolupantDescripcio`} multiline placeholder="p. ex. FAÇANA DAVANTERA, CARRER … La façana principal …" />
          <div className="mt-3"><PhotoGallery path={`${path}.${i}.fotos`} /></div>
        </div>
      ))}
      <button type="button" className="btn-ghost" onClick={() => update((x) => setAt(x, path, [...listOf(x, path), newEnvolupant()]))}>+ Afegir element de l&apos;envolupant</button>
    </div>
  );
}

// Deficiencies (section 8) ---------------------------------------------------------

const GRAVETAT_COLORS: Record<string, string> = {
  MG: "bg-red-700 text-white",
  G: "bg-red-100 text-red-800",
  I: "bg-amber-100 text-amber-800",
  LL: "bg-emerald-100 text-emerald-800",
};

export function DeficienciesEditor() {
  const { doc, update, cataleg } = useIte();
  const path = LIST_PATHS.deficiencies;
  const items = listOf(doc, path);
  const counts = items.reduce<Record<string, number>>((a, d) => { const v = gravetatValor(d) || "?"; a[v] = (a[v] ?? 0) + 1; return a; }, {});
  const setCat = (i: number, field: "tipusDeficiencia" | "gravetat", cat: string, id: string) =>
    update((x) => {
      const obj = id ? findCat(cataleg, cat, id) : undefined;
      return setAt(x, `${path}.${i}.${field}`, obj ? structuredClone(obj) : undefined);
    });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-[var(--color-muted)]">8. Relació i qualificació de les deficiències detectades:</span>
        {(["MG", "G", "I", "LL"] as const).map((g) => counts[g] ? <span key={g} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${GRAVETAT_COLORS[g]}`}>{counts[g]} {g}</span> : null)}
        {items.length === 0 && <span className="text-[var(--color-muted)]">cap.</span>}
      </div>
      {(cataleg.tipus_deficiencia?.length ?? 0) < 40 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          La llista de tipus de deficiència només té els {cataleg.tipus_deficiencia?.length ?? 0} tipus vistos en informes importats, i la de gravetats {cataleg.gravetat?.length ?? 0} de 4. Importa més informes del portal (botó «Importar del portal» a la llista) per completar-les.
        </p>
      )}
      {items.map((d, i) => (
        <div key={i} className="rounded-lg border border-[var(--color-line)] bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Deficiència {i + 1}</span>
              {gravetatValor(d) && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${GRAVETAT_COLORS[gravetatValor(d)] ?? ""}`}>{catLabel(d.gravetat as IteObj)}</span>}
            </div>
            <ListActions path={path} i={i} n={items.length} what={`la deficiència ${i + 1}`} />
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <div>
              <label className="label">Tipus</label>
              <CatSelect cat="tipus_deficiencia" value={d.tipusDeficiencia as IteObj | undefined} onChange={(id) => setCat(i, "tipusDeficiencia", "tipus_deficiencia", id)} placeholder="Tria el tipus…" />
            </div>
            <div>
              <label className="label">Gravetat</label>
              <CatSelect cat="gravetat" value={d.gravetat as IteObj | undefined} onChange={(id) => setCat(i, "gravetat", "gravetat", id)} placeholder="Tria…" />
            </div>
          </div>
          <label className="label mt-3">Descripció de la deficiència i localització</label>
          <DraftText path={`${path}.${i}.deficienciaDescripcio`} multiline />
          <label className="label mt-3">Observacions</label>
          <DraftText path={`${path}.${i}.deficienciaObservacions`} multiline />
          <div className="mt-3"><PhotoGallery path={`${path}.${i}.fotos`} /></div>
        </div>
      ))}
      <button type="button" className="btn-ghost" onClick={() => update((x) => setAt(x, path, [...listOf(x, path), newDeficiencia()]))}>+ Afegir deficiència</button>
    </div>
  );
}

// Sustainability measures (section 10) -----------------------------------------------

export function MesuresEditor() {
  const { doc, update } = useIte();
  const path = LIST_PATHS.mesures;
  const items = listOf(doc, path);
  return (
    <fieldset className="rounded-lg border border-[var(--color-line)] p-4">
      <legend className="px-1 text-sm font-semibold">Recomanacions tècniques, desglossades per millores</legend>
      <div className="space-y-3">
        {items.map((_, i) => (
          <div key={i}>
            <div className="mb-1 flex items-center justify-between">
              <span className="label mb-0">Mesura {i + 1}. Descripció</span>
              <ListActions path={path} i={i} n={items.length} what={`la mesura ${i + 1}`} />
            </div>
            <DraftText path={`${path}.${i}.descripcioMesura`} multiline />
          </div>
        ))}
      </div>
      <button type="button" className="btn-ghost btn-sm mt-3" onClick={() => update((x) => setAt(x, path, [...listOf(x, path), newMesura()]))}>+ Afegir mesura</button>
    </fieldset>
  );
}

// Conservation summary (section 11) --------------------------------------------------

const SISTEMES: Record<string, string> = { DEF_ESTRUCTURES: "Estructures", DEF_ENVOLUPANT: "Envolupant", DEF_INSTALACIONS: "Instal·lacions", DEF_INSTAL_LACIONS: "Instal·lacions", DEF_ALTRES: "Altres" };

export function ConservacioResum() {
  const { doc, cataleg } = useIte();
  const resum = resumDeficiencies(doc, cataleg);
  const favorable = valoracioFavorable(doc);
  return (
    <div className="space-y-4">
      <fieldset className="rounded-lg border border-[var(--color-line)] p-4">
        <legend className="px-1 text-sm font-semibold">11.1 Localització i qualificació de les deficiències</legend>
        <p className="mb-2 text-xs text-[var(--color-muted)]">Es calcula sol a partir de les deficiències, com al portal.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[var(--color-muted)]">
                <th className="py-1 text-left font-medium">Sistema</th>
                <th className="py-1 text-left font-medium">Localització</th>
                {["MG", "G", "I", "LL", "SD"].map((g) => <th key={g} className="w-10 py-1 text-center font-medium">{g}</th>)}
              </tr>
            </thead>
            <tbody>
              {resum.map((r) => {
                const sist = isObj(r.categoria.mestre) ? SISTEMES[str(r.categoria.mestre.codi)] ?? str(r.categoria.mestre.codi) : "";
                return (
                  <tr key={str(r.categoria.id)} className="border-t border-[var(--color-line)]">
                    <td className="py-1 text-xs text-[var(--color-muted)]">{sist}</td>
                    <td className="py-1">{catLabel(r.categoria)}{r.n > 0 && <span className="text-xs text-[var(--color-muted)]"> ({r.n})</span>}</td>
                    {["MG", "G", "I", "LL"].map((g) => <td key={g} className="py-1 text-center font-semibold">{r.pitjor === g ? "X" : ""}</td>)}
                    <td className="py-1 text-center text-[var(--color-muted)]">{r.n === 0 ? "X" : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </fieldset>
      <div className={`rounded-lg border p-4 ${favorable ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
        <p className="text-sm font-semibold">11.4 Valoració final de l&apos;estat de conservació: {favorable ? "FAVORABLE" : "DESFAVORABLE"}</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">Automàtica: favorable si no hi ha deficiències o totes són lleus.</p>
      </div>
    </div>
  );
}

// Dades generals: links, owner and technician helpers, cadastre ----------------------

type Opt = { id: number; nom: string };
export type ClientOpt = Opt & { nif: string | null; carrer: string | null; ciutat: string | null; codi_postal: string | null };
export type ContacteOpt = { id: number; client_id: number | null; nom: string | null; telefon: string | null; mail: string | null };
export type ExpedientOpt = { id: number; num_expedient: string; projecte: string | null; client_id: number | null };

export function VinclesPanel({ expedientId, clientId, expedients, clients, onChange }: { expedientId: number | null; clientId: number | null; expedients: ExpedientOpt[]; clients: ClientOpt[]; onChange: (e: number | null, c: number | null) => void }) {
  const { iteId } = useIte();
  const set = (e: number | null, c: number | null) => { onChange(e, c); void setIteLinksAction(iteId, e, c); };
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="label">Expedient</label>
        <select className="input" value={expedientId ?? ""} onChange={(ev) => {
          const e = ev.target.value === "" ? null : Number(ev.target.value);
          const exp = expedients.find((x) => x.id === e);
          set(e, clientId ?? exp?.client_id ?? null);
        }}>
          <option value="">— Sense expedient —</option>
          {expedients.map((e) => <option key={e.id} value={e.id}>{e.num_expedient}{e.projecte ? ` — ${e.projecte}` : ""}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Client (propietat)</label>
        <select className="input" value={clientId ?? ""} onChange={(ev) => set(expedientId, ev.target.value === "" ? null : Number(ev.target.value))}>
          <option value="">— Sense client —</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </div>
    </div>
  );
}

export function PropietatDesDeClient({ clientId, clients, contactes }: { clientId: number | null; clients: ClientOpt[]; contactes: ContacteOpt[] }) {
  const { update, cataleg } = useIte();
  const [cid, setCid] = useState<number | "">(clientId ?? "");
  const [ctid, setCtid] = useState<number | "">("");
  const propis = useMemo(() => contactes.filter((c) => cid !== "" && c.client_id === cid), [contactes, cid]);
  const altres = useMemo(() => contactes.filter((c) => cid === "" || c.client_id !== cid), [contactes, cid]);
  function apply() {
    const c = clients.find((x) => x.id === cid);
    if (!c) return;
    const ct = contactes.find((x) => x.id === ctid) ?? propis.find((x) => x.telefon || x.mail) ?? null;
    const p = propietatFromClient(c, ct, cataleg);
    update((x) => setAt(x, "propietat", { ...(isObj(x.propietat) ? x.propietat : { id: "null" }), ...p }));
  }
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg bg-[var(--color-paper)] p-3">
      <div className="min-w-[200px] flex-1">
        <label className="label">Omplir la propietat des de la Base de Dades</label>
        <select className="input" value={cid} onChange={(e) => { setCid(e.target.value === "" ? "" : Number(e.target.value)); setCtid(""); }}>
          <option value="">Tria el client…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}{c.nif ? ` · ${c.nif}` : ""}</option>)}
        </select>
      </div>
      <div className="min-w-[200px] flex-1">
        <label className="label">Contacte (telèfon i correu)</label>
        <select className="input" value={ctid} onChange={(e) => setCtid(e.target.value === "" ? "" : Number(e.target.value))}>
          <option value="">{propis.length ? "El primer del client" : "—"}</option>
          {propis.length > 0 && <optgroup label="Del client">{propis.map((c) => <option key={c.id} value={c.id}>{c.nom ?? c.mail ?? c.telefon}</option>)}</optgroup>}
          <optgroup label="Tots">{altres.map((c) => <option key={c.id} value={c.id}>{c.nom ?? c.mail ?? c.telefon}</option>)}</optgroup>
        </select>
      </div>
      <button type="button" className="btn-ghost" disabled={cid === ""} onClick={apply}>Omplir</button>
    </div>
  );
}

export function TecnicDespatxButton() {
  const { update, cataleg } = useIte();
  return (
    <button type="button" className="btn-ghost btn-sm" onClick={() => update((x) => setAt(x, "tecnics", [tecnicDespatx(cataleg), ...listOf(x, "tecnics").slice(1)]))}>
      Posar les dades de David Lladó
    </button>
  );
}

export function CadastrePanel() {
  const { doc, update, cataleg } = useIte();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<CadastreDades | null>(null);
  const [what, setWhat] = useState<CadastreApply>({});
  const finca = str(getAt(doc, "edifici.cadasFinca"));
  const full = str(getAt(doc, "edifici.cadasPlanol"));

  async function consulta() {
    setBusy(true); setErr(null); setRes(null);
    const r = await consultaCadastreAction(finca, full);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setRes(r.dades);
    const nomDefecte = !str(doc.nom) || str(doc.nom) === "Inspecció Tècnica de l'Edifici";
    setWhat({ adreca: true, any: true, superficie: true, plantes: !teFilesDePlantes(doc), nom: nomDefecte });
  }
  function aplicar() {
    if (!res) return;
    update((x) => applyCadastre(x, res, cataleg, what));
    setRes(null);
  }
  const opt = (k: keyof CadastreApply, label: string) => (
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--color-accent)]" checked={!!what[k]} onChange={(e) => setWhat({ ...what, [k]: e.target.checked })} />{label}</label>
  );
  const habitatges = res?.unitats.filter((u) => /residen/i.test(u.us)).length ?? 0;
  return (
    <div className="rounded-lg bg-[var(--color-paper)] p-3">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-ghost" disabled={busy || !(finca && full)} onClick={consulta}>{busy ? "Consultant…" : "Obtenir dades del Cadastre"}</button>
        <span className="text-xs text-[var(--color-muted)]">{finca && full ? `Ref. ${finca}${full}` : "Escriu la finca i el full de plànol."}</span>
      </div>
      {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
      {res && (
        <div className="mt-3 space-y-2 text-sm">
          <p>
            <strong>{res.viaWord || res.viaCodi} {res.nomVia}, {res.numero}</strong> · {res.codiPostal} {res.municipi} ({res.provincia}) · construït el {res.anyConstruccio ?? "?"} ·{" "}
            {res.unitats.length} immobles ({habitatges} habitatges) · {res.superficieConstruida.toLocaleString("ca")} m² construïts
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {opt("adreca", "Adreça de l'edifici")}
            {opt("any", "Any de construcció")}
            {opt("superficie", "Superfície construïda (font: Cadastre)")}
            {opt("plantes", teFilesDePlantes(doc) ? "Taula de plantes (substitueix l'actual)" : "Taula de plantes")}
            {opt("nom", "Nom de l'informe")}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary btn-sm" onClick={aplicar}>Aplicar</button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setRes(null)}>Cancel·lar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Export ---------------------------------------------------------------------------

export function ExportPanel() {
  const { iteId, doc, cataleg } = useIte();
  const check = useMemo(() => validateIte(doc, cataleg), [doc, cataleg]);
  const paquet = useMemo(() => fotoPaquet(doc, cataleg), [doc, cataleg]);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgCopia, setMsgCopia] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function fotos() {
    setBusy(true); setMsg("Preparant…");
    try {
      const r = await exportFotosZip(doc, cataleg, setMsg);
      setMsg(`Descarregat ${r.name}: ${r.fotos} fitxers${r.falten ? ` (${r.falten} sense arxiu a l'app, no hi són)` : ""}. Descomprimeix-lo: cada carpeta és un apartat del portal i index.txt diu on va cada foto i el seu peu.`);
    } catch (e) {
      setMsg(`No s'ha pogut preparar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function zip() {
    setBusy(true); setMsgCopia("Preparant…");
    try {
      const name = await exportPortalZip(iteId, doc, cataleg, setMsgCopia);
      setMsgCopia(`Descarregat ${name}.`);
    } catch (e) {
      setMsgCopia(`No s'ha pogut exportar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const lists = Object.entries(cataleg).filter(([k]) => CATALEG_LABELS[k]).map(([k, l]) => `${CATALEG_LABELS[k]}: ${l.length}`);
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[var(--color-line)] bg-white p-4">
        <h3 className="text-sm font-semibold">Fotos per al portal</h3>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Totes les fotos i el PDF de l&apos;informe en un zip, amb una carpeta per apartat del portal i un nom que diu on va cada fitxer: <code>D03-2.jpg</code> és la deficiència 3, foto 2; <code>E01-1.jpg</code>, l&apos;element 1 de l&apos;envolupant. Hi va un <code>index.txt</code> amb els peus de foto. Les dades les entra Claude al formulari del portal; les fotos es pugen des d&apos;aquest zip, a mà o amb Claude a l&apos;ordinador.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary" disabled={busy || paquet.fitxers.length === 0} onClick={fotos}>{busy ? "Preparant…" : `Descarregar fotos (${paquet.fitxers.length})`}</button>
          {paquet.falten.length > 0 && <span className="text-xs text-amber-800">{paquet.falten.length} sense arxiu a l&apos;app</span>}
        </div>
        {msg && <p className="mt-2 text-sm">{msg}</p>}
      </div>

      <div className="rounded-lg border border-[var(--color-line)] bg-white p-4">
        <h3 className="text-sm font-semibold">Revisió de l&apos;informe</h3>
        {check.errors.length === 0 && check.warnings.length === 0 && <p className="mt-1 text-sm text-emerald-700">Tot correcte.</p>}
        {check.errors.length > 0 && (
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-red-700">{check.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        )}
        {check.warnings.length > 0 && (
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-amber-800">{check.warnings.map((e, i) => <li key={i}>{e}</li>)}</ul>
        )}
      </div>

      <details className="rounded-lg border border-[var(--color-line)] bg-white p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Fitxer en el format del portal</summary>
        <p className="mt-2 text-[var(--color-muted)]">
          El mateix zip que fa «Exportar informe» al portal (XML i fotos), sense signatura. <strong>El portal no l&apos;importa</strong>: només readmet fitxers signats per ell mateix (comprovat l&apos;11/11/2026). Queda com a còpia de l&apos;informe en el seu format.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="btn-ghost" disabled={busy} onClick={zip}>Exportar (.zip)</button>
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => setMsgCopia(`Descarregat ${exportPortalXml(iteId, doc, cataleg)} (sense fotos).`)}>Només l&apos;XML</button>
        </div>
        {msgCopia && <p className="mt-2">{msgCopia}</p>}
      </details>

      <details className="rounded-lg border border-[var(--color-line)] bg-white p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Llistes desplegables conegudes</summary>
        <p className="mt-2 text-[var(--color-muted)]">Els valors de les llistes (tipus de deficiència, orientació, tipus de via, municipis…) són els del portal, amb el seu codi intern. Només es coneixen els que han aparegut en informes importats; cada informe que s&apos;importa n&apos;hi afegeix.</p>
        <p className="mt-2 text-xs text-[var(--color-muted)]">{lists.join(" · ")}</p>
      </details>
    </div>
  );
}
