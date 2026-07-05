"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { updateActaAction, deleteActaAction, duplicateActaAction, createActaContacteAction, type ActaPatch } from "../actions";
import { openActaPdf, downloadActaWord, actaTitle, ACTA_REASONS, TEMA_CATS, temaCat } from "@/lib/acta-doc";
import type { Acta, ActaAssistent, ActaSignatura, ActaTema } from "@/types/db";

type ExpedientOpt = { id: number; num_expedient: string; projecte: string | null };
type Contacte = { nom: string | null; telefon: string | null; mail: string | null; client_nom?: string | null };

function seedSignatures(a: Acta): ActaSignatura[] {
  if (a.signatures && a.signatures.length) return a.signatures;
  const out: ActaSignatura[] = [];
  if (a.sig_do != null) out.push({ titol: "Director d'obra", persona: a.sig_do ?? "" });
  if (a.sig_de != null) out.push({ titol: "Director d'execució de l'obra", persona: a.sig_de ?? "" });
  if (a.sig_adj_empresa || a.sig_adj_persona) out.push({ titol: `Representant de l'empresa adjudicatària${a.sig_adj_empresa ? `, ${a.sig_adj_empresa}` : ""}`, persona: a.sig_adj_persona ?? "" });
  if (a.sig_prom_empresa || a.sig_prom_persona) out.push({ titol: `Representant de l'ens promotor${a.sig_prom_empresa ? `, ${a.sig_prom_empresa}` : ""}`, persona: a.sig_prom_persona ?? "" });
  if (!out.length) out.push({ titol: "Director d'obra", persona: "" });
  return out;
}

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
  const [properaData, setProperaData] = useState(acta.propera_data ?? "");
  const [properaHora, setProperaHora] = useState(acta.propera_hora ?? "");
  const [signatures, setSignatures] = useState<ActaSignatura[]>(seedSignatures(acta));

  const [contactList, setContactList] = useState<Contacte[]>(contactes);
  const [newContact, setNewContact] = useState(false);
  const [ncNom, setNcNom] = useState("");
  const [ncTel, setNcTel] = useState("");
  const [ncMail, setNcMail] = useState("");

  const [saved, setSaved] = useState(true);
  const [, startTransition] = useTransition();

  // Names to pick a signatory / responsable from: attendees + all contacts.
  const peopleOptions = useMemo(() => {
    const s = new Set<string>();
    for (const a of assistents) if (a.nom.trim()) s.add(a.nom.trim());
    for (const c of contactList) if ((c.nom ?? "").trim()) s.add((c.nom ?? "").trim());
    return Array.from(s);
  }, [assistents, contactList]);

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
      propera_data: properaData,
      propera_hora: properaHora,
      signatures,
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

  function liveActa(): Acta {
    return {
      ...acta,
      tipus, acta_num: actaNum, data, hora, lloc, projecte, referencia, ubicacio, client,
      assistents, temes, propera_visita: properaVisita, propera_data: properaData, propera_hora: properaHora,
      signatures,
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
  function addTemaCat(catKey: string) { setTms([...temes, { titol: "", text: "", responsable: "", estat: catKey }]); }
  function updTema(i: number, patch: Partial<ActaTema>) {
    setTemes((prev) => prev.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  }
  function commitTemes() { save({ temes }); }
  function setTemaResponsable(i: number, value: string) { setTms(temes.map((t, j) => (j === i ? { ...t, responsable: value } : t))); }
  function setTemaCat(i: number, catKey: string) { setTms(temes.map((t, j) => (j === i ? { ...t, estat: catKey } : t))); }
  function delTema(i: number) { setTms(temes.filter((_, j) => j !== i)); }
  function moveTemaInCat(i: number, dir: -1 | 1) {
    const cat = temaCat(temes[i]);
    let j = i + dir;
    while (j >= 0 && j < temes.length && temaCat(temes[j]) !== cat) j += dir;
    if (j < 0 || j >= temes.length) return;
    const next = [...temes];
    [next[i], next[j]] = [next[j], next[i]];
    setTms(next);
  }

  // Signatures helpers
  function setSigs(next: ActaSignatura[]) { setSignatures(next); save({ signatures: next }); }
  function addSig() { setSigs([...signatures, { titol: "", persona: "" }]); }
  function updSig(i: number, patch: Partial<ActaSignatura>) {
    setSignatures((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }
  function commitSigs() { save({ signatures }); }
  function delSig(i: number) { setSigs(signatures.filter((_, j) => j !== i)); }

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
      <datalist id="acta-people">
        {peopleOptions.map((n) => <option key={n} value={n} />)}
      </datalist>

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

      {/* Temes tractats — 3 categories */}
      <section className="card">
        <h2 className="mb-1 text-lg font-semibold">Temes tractats</h2>
        <p className="mb-4 text-xs text-[var(--color-muted)]">Cada tema pertany a una categoria. Canvia&apos;n la categoria per moure&apos;l, i ordena amb les fletxes.</p>
        <div className="space-y-6">
          {TEMA_CATS.map((cat) => {
            const entries = temes.map((t, i) => ({ t, i })).filter((e) => temaCat(e.t) === cat.key);
            return (
              <div key={cat.key}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">{cat.label}</h3>
                  <button className="btn" onClick={() => addTemaCat(cat.key)}>+ Tema</button>
                </div>
                {entries.length === 0 && <p className="text-sm text-[var(--color-muted)]">Cap tema.</p>}
                <div className="space-y-3">
                  {entries.map(({ t, i }, pos) => (
                    <div key={i} className="rounded-lg border border-[var(--color-line)] p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <select className="input w-32" value={cat.key} onChange={(e) => setTemaCat(i, e.target.value)} title="Categoria">
                          {TEMA_CATS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                        <input className="input flex-1 min-w-[140px] font-semibold" placeholder="Títol (opcional)" value={t.titol} onChange={(e) => updTema(i, { titol: e.target.value })} onBlur={commitTemes} />
                        <button className="btn-ghost" onClick={() => moveTemaInCat(i, -1)} title="Amunt" disabled={pos === 0}>↑</button>
                        <button className="btn-ghost" onClick={() => moveTemaInCat(i, 1)} title="Avall" disabled={pos === entries.length - 1}>↓</button>
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
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Propera visita */}
      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">Propera visita</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="label">Data</label>
            <input type="date" className="input" value={properaData} onChange={(e) => { setProperaData(e.target.value); save({ propera_data: e.target.value }); }} />
          </div>
          <div>
            <label className="label">Hora</label>
            <input className="input" placeholder="13:00" value={properaHora} onChange={(e) => setProperaHora(e.target.value)} onBlur={() => save()} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Nota</label>
            <input className="input" placeholder="A concretar" value={properaVisita} onChange={(e) => setProperaVisita(e.target.value)} onBlur={() => save()} />
          </div>
        </div>
      </section>

      {/* Signatures */}
      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Signatures</h2>
          <button className="btn" onClick={addSig}>+ Signatari</button>
        </div>
        <div className="space-y-3">
          {signatures.length === 0 && <p className="text-sm text-[var(--color-muted)]">Cap signatari.</p>}
          {signatures.map((s, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div>
                <label className="label">Càrrec / títol</label>
                <input className="input" placeholder="p. ex. Director d'obra" value={s.titol} onChange={(e) => updSig(i, { titol: e.target.value })} onBlur={commitSigs} />
              </div>
              <div>
                <label className="label">Persona</label>
                <input className="input" list="acta-people" placeholder="Selecciona o escriu…" value={s.persona} onChange={(e) => updSig(i, { persona: e.target.value })} onBlur={commitSigs} />
              </div>
              <button className="btn-ghost mb-1" onClick={() => delSig(i)} title="Eliminar">✕</button>
            </div>
          ))}
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
