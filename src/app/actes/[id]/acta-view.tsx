"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { updateActaAction, deleteActaAction, createActaContacteAction, addActaFotoAction, removeActaFotoAction, addActaDocAction, removeActaDocAction, type ActaPatch } from "../actions";
import { openActaPdf, downloadActaWord, actaTitle, ACTA_REASONS, TEMA_CATS, temaCat, type ActaLang } from "@/lib/acta-doc";
import type { Acta, ActaAssistent, ActaDoc, ActaSignatura, ActaTema } from "@/types/db";

type ExpedientOpt = { id: number; num_expedient: string; projecte: string | null };
type Contacte = { nom: string | null; telefon: string | null; mail: string | null; client_nom?: string | null };

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
// Downscale/re-encode so a whole album of phone photos stays a few MB, not tens.
async function compressImage(file: File, maxDim = 1600, quality = 0.72): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  if (!file.type.startsWith("image/")) return dataUrl;
  try {
    const img = await loadImage(dataUrl);
    let w = img.naturalWidth, h = img.naturalHeight;
    if (Math.max(w, h) > maxDim) { const s = maxDim / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return dataUrl;
  }
}
function temaResponsables(t: ActaTema): string[] {
  if (t.responsables) return t.responsables;
  return t.responsable ? t.responsable.split(" & ").map((s) => s.trim()).filter(Boolean) : [];
}

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
  const [fotos, setFotos] = useState<string[]>(acta.fotografies ?? []);
  const [docs, setDocs] = useState<ActaDoc[]>(acta.documents ?? []);
  const [docLang, setDocLang] = useState<ActaLang>("ca");

  const [contactList, setContactList] = useState<Contacte[]>(contactes);
  const [newContact, setNewContact] = useState(false);
  const [ncNom, setNcNom] = useState("");
  const [ncTel, setNcTel] = useState("");
  const [ncMail, setNcMail] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [saved, setSaved] = useState(true);
  const [, startTransition] = useTransition();

  // Names to pick a signatory / responsable from: attendees + all contacts.
  const peopleOptions = useMemo(() => {
    const s = new Set<string>();
    for (const a of assistents) if (a.nom.trim()) s.add(a.nom.trim());
    for (const c of contactList) if ((c.nom ?? "").trim()) s.add((c.nom ?? "").trim());
    return Array.from(s);
  }, [assistents, contactList]);

  // Searchable contacts for the "afegir contacte" lookup.
  const filteredContacts = useMemo(() => {
    const nq = contactQuery.trim().toLowerCase();
    const base = contactList.filter((c) => (c.nom ?? "").trim());
    const list = nq ? base.filter((c) => `${c.nom ?? ""} ${c.client_nom ?? ""}`.toLowerCase().includes(nq)) : base;
    return list.slice(0, 60);
  }, [contactList, contactQuery]);

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
      signatures, fotografies: fotos, documents: docs,
      expedient_id: expedientId === "" ? null : expedientId,
    };
  }

  // Media uploads. Images are downscaled client-side, and each file is stored
  // one at a time (sequentially) so a big batch never floods the server.
  async function onUploadFotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const f of Array.from(files)) {
      try {
        const url = await compressImage(f);
        setFotos((p) => [...p, url]);
        await addActaFotoAction(acta.id, url);
      } catch { /* skip this file */ }
    }
    setUploading(false);
  }
  function removeFoto(i: number) { setFotos((p) => p.filter((_, j) => j !== i)); void removeActaFotoAction(acta.id, i); }
  async function onUploadDocs(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const f of Array.from(files)) {
      try {
        const url = await readFileAsDataUrl(f);
        const doc = { name: f.name, dataUrl: url };
        setDocs((p) => [...p, doc]);
        await addActaDocAction(acta.id, doc);
      } catch { /* skip this file */ }
    }
    setUploading(false);
  }
  function removeDoc(i: number) { setDocs((p) => p.filter((_, j) => j !== i)); void removeActaDocAction(acta.id, i); }

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
  function toggleTemaResponsable(i: number, nom: string) {
    setTms(temes.map((t, j) => {
      if (j !== i) return t;
      const cur = temaResponsables(t);
      const next = cur.includes(nom) ? cur.filter((x) => x !== nom) : [...cur, nom];
      return { ...t, responsables: next, responsable: next.join(" & ") };
    }));
  }
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
          <div className="flex overflow-hidden rounded-md border border-[var(--color-line)] text-xs font-semibold">
            <button className={`px-2.5 py-1.5 ${docLang === "ca" ? "bg-[var(--color-accent)] text-white" : "hover:bg-[var(--color-paper)]"}`} onClick={() => setDocLang("ca")}>CA</button>
            <button className={`px-2.5 py-1.5 ${docLang === "es" ? "bg-[var(--color-accent)] text-white" : "hover:bg-[var(--color-paper)]"}`} onClick={() => setDocLang("es")}>ES</button>
          </div>
          <button className="btn" disabled={generating} onClick={async () => { setGenerating(true); try { await openActaPdf(liveActa(), docLang); } finally { setGenerating(false); } }}>{generating ? "Generant…" : "PDF"}</button>
          <button className="btn" disabled={generating} onClick={async () => { setGenerating(true); try { await downloadActaWord(liveActa(), docLang); } finally { setGenerating(false); } }}>Word</button>
        </div>
      </div>

      {/* Tipus + expedient */}
      <section className="card">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Motiu de l&apos;acta</label>
            <select className="input" value={tipus} onChange={(e) => { const v = e.target.value; setTipus(v); save({ tipus: v }); }}>
              {ACTA_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              {!ACTA_REASONS.some((r) => r.value === tipus) && <option value={tipus}>{tipus}</option>}
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
            <div className="relative">
              <input
                className="input w-64"
                placeholder="Cercar i afegir contacte…"
                value={contactQuery}
                onChange={(e) => { setContactQuery(e.target.value); setContactOpen(true); }}
                onFocus={() => setContactOpen(true)}
                onBlur={() => setTimeout(() => setContactOpen(false), 150)}
              />
              {contactOpen && (
                <div className="absolute right-0 z-20 mt-1 max-h-60 w-72 overflow-auto rounded-md border border-[var(--color-line)] bg-white shadow-lg">
                  {filteredContacts.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-[var(--color-muted)]">Cap contacte</div>
                  ) : (
                    filteredContacts.map((c, i) => (
                      <button
                        key={i}
                        className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--color-paper)]"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { addAssistent(c.nom ?? ""); setContactQuery(""); setContactOpen(false); }}
                      >
                        {c.nom}{c.client_nom ? <span className="text-[var(--color-muted)]"> — {c.client_nom}</span> : null}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
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
        <h2 className="mb-1 text-lg font-semibold">Temes</h2>
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
                      <textarea className="input min-h-[80px]" placeholder="Text del tema" value={t.text} onChange={(e) => updTema(i, { text: e.target.value })} onBlur={commitTemes} />
                      <div className="mt-2">
                        <span className="label">Responsables</span>
                        {(() => {
                          const selected = temaResponsables(t);
                          const names = Array.from(new Set([...assistents.map((a) => a.nom.trim()).filter(Boolean), ...selected]));
                          if (names.length === 0) return <p className="text-xs text-[var(--color-muted)]">Afegeix assistents per assignar-ne un o més.</p>;
                          return (
                            <div className="flex flex-wrap gap-1.5">
                              {names.map((nom) => {
                                const sel = selected.includes(nom);
                                return (
                                  <button
                                    key={nom}
                                    type="button"
                                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${sel ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white" : "border-[var(--color-line)] hover:bg-[var(--color-paper)]"}`}
                                    onClick={() => toggleTemaResponsable(i, nom)}
                                  >
                                    {nom}
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()}
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

      {/* Fotografies */}
      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Fotografies</h2>
          <div className="flex items-center gap-2">
            {uploading && <span className="text-xs text-[var(--color-muted)]">Pujant…</span>}
            <label className="btn cursor-pointer">
              + Afegir imatges
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onUploadFotos(e.target.files); e.target.value = ""; }} />
            </label>
          </div>
        </div>
        {fotos.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">Cap imatge. Apareixeran una a una al final del document.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {fotos.map((src, i) => (
              <div key={i} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Foto ${i + 1}`} className="h-32 w-full rounded-lg border border-[var(--color-line)] object-cover" />
                <button className="absolute right-1 top-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-red-700 shadow hover:bg-white" onClick={() => removeFoto(i)} title="Eliminar">✕</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Documents adjunts */}
      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Documents adjunts</h2>
          <label className="btn cursor-pointer">
            + Afegir PDF
            <input type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => { onUploadDocs(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
        {docs.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">Cap document.</p>
        ) : (
          <ul className="space-y-2">
            {docs.map((d, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="text-[var(--color-muted)]">{i + 1}.</span>
                <a href={d.dataUrl} download={d.name} className="flex-1 truncate text-[var(--color-accent)] hover:underline">{d.name}</a>
                <button className="btn-ghost" onClick={() => removeDoc(i)} title="Eliminar">✕</button>
              </li>
            ))}
          </ul>
        )}
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
