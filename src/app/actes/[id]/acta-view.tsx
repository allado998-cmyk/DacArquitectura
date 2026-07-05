"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { updateActaAction, deleteActaAction, duplicateActaAction, createActaContacteAction, type ActaPatch } from "../actions";
import { openActaPdf, downloadActaWord, actaTitle, ACTA_REASONS } from "@/lib/acta-doc";
import type { Acta, ActaAssistent, ActaTema } from "@/types/db";

type ExpedientOpt = { id: number; num_expedient: string; projecte: string | null };
type Contacte = { nom: string | null; telefon: string | null; mail: string | null; client_nom?: string | null };

export function ActaView({ acta, expedients, contactes }: { acta: Acta; expedients: ExpedientOpt[]; contactes: Contacte[] }) {
  const [tipus, setTipus] = useState<string>(acta.tipus);
  const [expedientId, setExpedientId] = useState<number | "">(acta.expedient_id ?? "");
  const [actaNum, setActaNum] = useState(acta.acta_num ?? "");
  const [data, setData] = useState(acta.data ?? "");
  const [hora, setHora] = useState(acta.hora ?? "");
  const [lloc, setLloc] = useState(acta.lloc ?? "");
  const [projecte, setProjecte] = useState(acta.projecte ?? "");
  const [referencia, setReferencia] = useState(acta.referencia ?? "");
  const [ubicacio, setUbicacio] = useState(acta.ubicacio ?? "");
  const [client, setClient] = useState(acta.client ?? "");
  const [assistents, setAssistents] = useState<ActaAssistent[]>(acta.assistents ?? []);
  const [temes, setTemes] = useState<ActaTema[]>(acta.temes ?? []);
  const [properaVisita, setProperaVisita] = useState(acta.propera_visita ?? "");
  const [sigDo, setSigDo] = useState(acta.sig_do ?? "");
  const [sigDe, setSigDe] = useState(acta.sig_de ?? "");
  const [sigAdjEmpresa, setSigAdjEmpresa] = useState(acta.sig_adj_empresa ?? "");
  const [sigAdjPersona, setSigAdjPersona] = useState(acta.sig_adj_persona ?? "");
  const [sigPromEmpresa, setSigPromEmpresa] = useState(acta.sig_prom_empresa ?? "");
  const [sigPromPersona, setSigPromPersona] = useState(acta.sig_prom_persona ?? "");

  // All DB contacts, kept locally so newly-created ones show up immediately.
  const [contactList, setContactList] = useState<Contacte[]>(contactes);
  const [newContact, setNewContact] = useState(false);
  const [ncNom, setNcNom] = useState("");
  const [ncTel, setNcTel] = useState("");
  const [ncMail, setNcMail] = useState("");

  const [saved, setSaved] = useState(true);
  const [, startTransition] = useTransition();

  function currentPatch(override: Partial<ActaPatch> = {}): ActaPatch {
    return {
      tipus,
      expedient_id: expedientId === "" ? null : expedientId,
      acta_num: actaNum,
      data,
      hora,
      lloc,
      projecte,
      referencia,
      ubicacio,
      client,
      assistents,
      temes,
      propera_visita: properaVisita,
      sig_do: sigDo,
      sig_de: sigDe,
      sig_adj_empresa: sigAdjEmpresa,
      sig_adj_persona: sigAdjPersona,
      sig_prom_empresa: sigPromEmpresa,
      sig_prom_persona: sigPromPersona,
      ...override,
    };
  }
  function save(override: Partial<ActaPatch> = {}) {
    setSaved(false);
    startTransition(async () => {
      await updateActaAction(acta.id, currentPatch(override));
      setSaved(true);
    });
  }

  // Build a fresh Acta object for PDF/Word from the live state.
  function liveActa(): Acta {
    return {
      ...acta,
      tipus, acta_num: actaNum, data, hora, lloc, projecte, referencia, ubicacio, client,
      assistents, temes, propera_visita: properaVisita,
      sig_do: sigDo, sig_de: sigDe,
      sig_adj_empresa: sigAdjEmpresa, sig_adj_persona: sigAdjPersona,
      sig_prom_empresa: sigPromEmpresa, sig_prom_persona: sigPromPersona,
      expedient_id: expedientId === "" ? null : expedientId,
    };
  }

  // Assistents helpers
  function setAss(next: ActaAssistent[]) { setAssistents(next); save({ assistents: next }); }
  function addAssistent(nom = "", empresa = "") { setAss([...assistents, { present: true, nom, empresa }]); }
  function updAssistent(i: number, patch: Partial<ActaAssistent>) {
    setAssistents((prev) => prev.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  }
  function commitAssistents() { save({ assistents }); }
  function delAssistent(i: number) { setAss(assistents.filter((_, j) => j !== i)); }
  function saveNewContact() {
    const nom = ncNom.trim();
    if (!nom && !ncTel.trim() && !ncMail.trim()) { setNewContact(false); return; }
    startTransition(async () => {
      const res = await createActaContacteAction({ nom, telefon: ncTel, mail: ncMail });
      if (res) {
        setContactList((prev) => [...prev, { nom: res.nom, telefon: ncTel, mail: ncMail, client_nom: null }].sort((a, b) => (a.nom ?? "").localeCompare(b.nom ?? "", "ca")));
        addAssistent(res.nom);
      }
      setNcNom(""); setNcTel(""); setNcMail(""); setNewContact(false);
    });
  }

  // Temes helpers
  function setTms(next: ActaTema[]) { setTemes(next); save({ temes: next }); }
  function addTema() { setTms([...temes, { titol: "", text: "", responsable: "", estat: "pendent" }]); }
  function updTema(i: number, patch: Partial<ActaTema>) {
    setTemes((prev) => prev.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  }
  function commitTemes() { save({ temes }); }
  function setTemaResponsable(i: number, value: string) {
    setTms(temes.map((t, j) => (j === i ? { ...t, responsable: value } : t)));
  }
  function delTema(i: number) { setTms(temes.filter((_, j) => j !== i)); }
  function toggleTemaEstat(i: number) {
    const next: ActaTema[] = temes.map((t, j) => (j === i ? { ...t, estat: t.estat === "fet" ? "pendent" : "fet" } : t));
    setTms(next);
  }
  function moveTema(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= temes.length) return;
    const next = [...temes];
    [next[i], next[j]] = [next[j], next[i]];
    setTms(next);
  }

  function onExpedientChange(v: number | "") {
    setExpedientId(v);
    const patch: Partial<ActaPatch> = { expedient_id: v === "" ? null : v };
    if (v !== "") {
      const e = expedients.find((x) => x.id === v);
      if (e) {
        setReferencia(e.num_expedient);
        patch.referencia = e.num_expedient;
        if (!projecte.trim() && e.projecte) {
          setProjecte(e.projecte);
          patch.projecte = e.projecte;
        }
      }
    }
    save(patch);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/actes" className="text-sm text-[var(--color-muted)] hover:underline">← Totes les actes</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{acta.num} · {actaTitle(tipus).replace(/[[\]]/g, "")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-muted)]">{saved ? "Desat" : "Desant…"}</span>
          <button className="btn" onClick={() => openActaPdf(liveActa())}>PDF</button>
          <button className="btn" onClick={() => downloadActaWord(liveActa())}>Word</button>
          <form action={duplicateActaAction}>
            <input type="hidden" name="id" value={acta.id} />
            <button className="btn" type="submit">Duplicar</button>
          </form>
        </div>
      </div>

      {/* Tipus + expedient */}
      <section className="card">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Motiu de l&apos;acta</label>
            <select className="input" value={tipus} onChange={(e) => { const v = e.target.value; setTipus(v); save({ tipus: v }); }}>
              {ACTA_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Expedient relacionat</label>
            <select className="input" value={expedientId === "" ? "" : expedientId} onChange={(e) => onExpedientChange(e.target.value === "" ? "" : Number(e.target.value))}>
              <option value="">— Sense expedient —</option>
              {expedients.map((e) => <option key={e.id} value={e.id}>{e.num_expedient}{e.projecte ? ` — ${e.projecte}` : ""}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Dades generals */}
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">Dades generals</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Projecte</label>
            <textarea className="input min-h-[70px]" value={projecte} onChange={(e) => setProjecte(e.target.value)} onBlur={() => save()} />
          </div>
          <div>
            <label className="label">Referència</label>
            <input className="input" value={referencia} onChange={(e) => setReferencia(e.target.value)} onBlur={() => save()} />
          </div>
          <div>
            <label className="label">Client</label>
            <input className="input" value={client} onChange={(e) => setClient(e.target.value)} onBlur={() => save()} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Ubicació</label>
            <input className="input" value={ubicacio} onChange={(e) => setUbicacio(e.target.value)} onBlur={() => save()} />
          </div>
          <div>
            <label className="label">Acta nº</label>
            <input className="input" value={actaNum} onChange={(e) => setActaNum(e.target.value)} onBlur={() => save()} />
          </div>
          <div>
            <label className="label">Lloc</label>
            <input className="input" value={lloc} onChange={(e) => setLloc(e.target.value)} onBlur={() => save()} />
          </div>
          <div>
            <label className="label">Data</label>
            <input type="date" className="input" value={data} onChange={(e) => { setData(e.target.value); save({ data: e.target.value }); }} />
          </div>
          <div>
            <label className="label">Hora</label>
            <input className="input" placeholder="13:00" value={hora} onChange={(e) => setHora(e.target.value)} onBlur={() => save()} />
          </div>
        </div>
      </section>

      {/* Assistents */}
      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Assistents</h2>
          <div className="flex items-center gap-2">
            <select className="input w-64" value="" onChange={(e) => { const c = contactList[Number(e.target.value)]; if (c) addAssistent(c.nom ?? ""); e.target.value = ""; }}>
              <option value="">+ Afegir de contactes…</option>
              {contactList.map((c, i) => <option key={i} value={i}>{c.nom}{c.client_nom ? ` — ${c.client_nom}` : ""}</option>)}
            </select>
            <button className="btn" onClick={() => setNewContact((v) => !v)}>+ Nou contacte</button>
            <button className="btn" onClick={() => addAssistent()}>+ Assistent</button>
          </div>
        </div>
        {newContact && (
          <div className="mb-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-3">
            <p className="mb-2 text-xs text-[var(--color-muted)]">Nou contacte (es desarà a Base de Dades i s&apos;afegirà com a assistent)</p>
            <div className="flex flex-wrap items-center gap-2">
              <input className="input flex-1 min-w-[160px]" placeholder="Nom" value={ncNom} onChange={(e) => setNcNom(e.target.value)} autoFocus />
              <input className="input w-40" placeholder="Telèfon" value={ncTel} onChange={(e) => setNcTel(e.target.value)} />
              <input className="input w-52" placeholder="Correu" value={ncMail} onChange={(e) => setNcMail(e.target.value)} />
              <button className="btn-primary" onClick={saveNewContact}>Desar</button>
              <button className="btn-ghost" onClick={() => { setNewContact(false); setNcNom(""); setNcTel(""); setNcMail(""); }}>Cancel·lar</button>
            </div>
          </div>
        )}
        <div className="space-y-2">
          {assistents.length === 0 && <p className="text-sm text-[var(--color-muted)]">Cap assistent.</p>}
          {assistents.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs" title="Present">
                <input type="checkbox" checked={a.present} onChange={(e) => { updAssistent(i, { present: e.target.checked }); save({ assistents: assistents.map((x, j) => j === i ? { ...x, present: e.target.checked } : x) }); }} />
              </label>
              <input className="input flex-1" placeholder="Nom (inicials)" value={a.nom} onChange={(e) => updAssistent(i, { nom: e.target.value })} onBlur={commitAssistents} />
              <input className="input w-48" placeholder="Empresa / rol" value={a.empresa} onChange={(e) => updAssistent(i, { empresa: e.target.value })} onBlur={commitAssistents} />
              <button className="btn-ghost" onClick={() => delAssistent(i)} title="Eliminar">✕</button>
            </div>
          ))}
        </div>
      </section>

      {/* Temes tractats */}
      <section className="card">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Temes tractats</h2>
          <button className="btn" onClick={addTema}>+ Tema</button>
        </div>
        <p className="mb-3 text-xs text-[var(--color-muted)]">Marca cada tema com a Pendent o Fet, i ordena&apos;ls amb les fletxes.</p>
        <div className="space-y-4">
          {temes.length === 0 && <p className="text-sm text-[var(--color-muted)]">Cap tema.</p>}
          {temes.map((t, i) => {
            const fet = t.estat === "fet";
            return (
              <div key={i} className={`rounded-lg border p-3 ${fet ? "border-green-200 bg-green-50/40" : "border-[var(--color-line)]"}`}>
                <div className="mb-2 flex items-center gap-2">
                  <button
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${fet ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-800"}`}
                    onClick={() => toggleTemaEstat(i)}
                    title="Canviar entre Pendent i Fet"
                  >
                    {fet ? "✓ Fet" : "● Pendent"}
                  </button>
                  <input className={`input flex-1 font-semibold ${fet ? "line-through opacity-60" : ""}`} placeholder="Títol (opcional)" value={t.titol} onChange={(e) => updTema(i, { titol: e.target.value })} onBlur={commitTemes} />
                  <button className="btn-ghost" onClick={() => moveTema(i, -1)} title="Amunt" disabled={i === 0}>↑</button>
                  <button className="btn-ghost" onClick={() => moveTema(i, 1)} title="Avall" disabled={i === temes.length - 1}>↓</button>
                  <button className="btn-ghost" onClick={() => delTema(i)} title="Eliminar">✕</button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
                  <textarea className="input min-h-[80px]" placeholder="Text del tema" value={t.text} onChange={(e) => updTema(i, { text: e.target.value })} onBlur={commitTemes} />
                  <div>
                    <select className="input" value={t.responsable} onChange={(e) => setTemaResponsable(i, e.target.value)} title="Responsable (assistent de la reunió)">
                      <option value="">— Responsable —</option>
                      {assistents.filter((a) => a.nom.trim()).map((a, ai) => <option key={ai} value={a.nom}>{a.nom}</option>)}
                      {t.responsable && !assistents.some((a) => a.nom === t.responsable) && <option value={t.responsable}>{t.responsable}</option>}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Propera visita */}
      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">Propera visita</h2>
        <input className="input" value={properaVisita} onChange={(e) => setProperaVisita(e.target.value)} onBlur={() => save()} />
      </section>

      {/* Signatures */}
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">Signatures</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Director d&apos;obra</label>
            <input className="input" value={sigDo} onChange={(e) => setSigDo(e.target.value)} onBlur={() => save()} />
          </div>
          <div>
            <label className="label">Director d&apos;execució de l&apos;obra</label>
            <input className="input" value={sigDe} onChange={(e) => setSigDe(e.target.value)} onBlur={() => save()} />
          </div>
          <div>
            <label className="label">Empresa adjudicatària</label>
            <input className="input" placeholder="Nom empresa" value={sigAdjEmpresa} onChange={(e) => setSigAdjEmpresa(e.target.value)} onBlur={() => save()} />
          </div>
          <div>
            <label className="label">Representant adjudicatària</label>
            <input className="input" placeholder="Nom persona" value={sigAdjPersona} onChange={(e) => setSigAdjPersona(e.target.value)} onBlur={() => save()} />
          </div>
          <div>
            <label className="label">Ens promotor</label>
            <input className="input" placeholder="Nom entitat" value={sigPromEmpresa} onChange={(e) => setSigPromEmpresa(e.target.value)} onBlur={() => save()} />
          </div>
          <div>
            <label className="label">Representant promotor</label>
            <input className="input" placeholder="Nom persona" value={sigPromPersona} onChange={(e) => setSigPromPersona(e.target.value)} onBlur={() => save()} />
          </div>
        </div>
      </section>

      <section className="flex justify-end">
        <form action={deleteActaAction}>
          <input type="hidden" name="id" value={acta.id} />
          <button className="btn-danger" type="submit" onClick={(e) => { if (!confirm("Segur que vols eliminar aquesta acta?")) e.preventDefault(); }}>Eliminar acta</button>
        </form>
      </section>
    </div>
  );
}
