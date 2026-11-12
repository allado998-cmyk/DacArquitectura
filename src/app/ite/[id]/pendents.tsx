"use client";

// «Fotos per classificar»: the visit's photos, uploaded all at once (here,
// by dragging them in, or from a phone with the private link), waiting to be
// put in their place. Claude does it through the plugin (ite_fotos_pendents →
// ite_colocar_fotos); «Posar a…» does it by hand.
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { addIteFitxerAction, descartarFotosAction, iteUploadTokenAction } from "../actions";
import { compressImage } from "@/lib/compress-image";
import { uploadFitxer } from "@/lib/fitxers-client";
import { fmtMida, refFor } from "@/lib/fitxers-shared";
import { llocsFotos, PEU_MAX, posarFoto, type FotoCarpeta, type LlocFoto } from "@/lib/ite/fotos";
import { useIte } from "./ite-context";

const LLEGIBLE = /^image\/(jpeg|png|webp|gif)$/;

function grup(l: LlocFoto): string {
  if (l.codi === "CROQUIS") return "Descripció";
  if (l.codi.startsWith("E")) return "Envolupant";
  if (l.codi.startsWith("D")) return "Deficiències";
  return "Instal·lacions";
}

export function FotosPendentsPanel({ pendents, setFotos }: { pendents: FotoCarpeta[]; setFotos: Dispatch<SetStateAction<FotoCarpeta[]>> }) {
  const { iteId, doc, update, cataleg } = useIte();
  const llocs = useMemo(() => llocsFotos(doc, cataleg), [doc, cataleg]);
  const grups = useMemo(() => {
    const m = new Map<string, LlocFoto[]>();
    for (const l of llocs) m.set(grup(l), [...(m.get(grup(l)) ?? []), l]);
    return [...m];
  }, [llocs]);
  const nom = typeof doc.nom === "string" ? doc.nom : "";
  const [busy, setBusy] = useState<string | null>(null);
  const [enllac, setEnllac] = useState<string | null>(null);
  const [copiat, setCopiat] = useState(false);
  const [peus, setPeus] = useState<Record<string, string>>({});
  const [drag, setDrag] = useState(false);

  async function afegir(files: FileList | File[] | null) {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name));
    if (!list.length) return;
    const fallades: string[] = [];
    for (let i = 0; i < list.length; i++) {
      setBusy(`Pujant ${i + 1}/${list.length}…`);
      const f = list[i];
      try {
        const blob = await compressImage(f);
        // A format the browser cannot draw (HEIC on Windows) would not open anywhere else either.
        if (blob === f && !LLEGIBLE.test(f.type)) { fallades.push(`${f.name} (format no compatible: desa-la en JPG)`); continue; }
        const name = blob === f ? f.name : `${f.name.replace(/\.[^.]+$/, "") || "foto"}.jpg`;
        const up = await uploadFitxer("ite", iteId, blob, name);
        const ref = await addIteFitxerAction(iteId, refFor(up.pathname, up.bytes), name);
        if (!ref) { fallades.push(f.name); continue; }
        const parts = up.pathname.split("/");
        setFotos((prev) => [...prev, { id: parts[3], ref, nom: parts[4], bytes: up.bytes, pujada: new Date().toISOString() }]);
      } catch {
        fallades.push(f.name);
      }
    }
    setBusy(null);
    if (fallades.length) alert(`No s'han pogut pujar:\n${fallades.join("\n")}`);
  }

  function posar(f: FotoCarpeta, codi: string) {
    const lloc = llocs.find((l) => l.codi === codi);
    if (!lloc) return;
    if (lloc.unica && lloc.fotos && !confirm(`${lloc.titol} ja té una foto. Substituir-la? L'anterior s'esborrarà.`)) return;
    update((d) => posarFoto(d, lloc, f, peus[f.id] ?? ""));
  }

  async function descartar(f: FotoCarpeta) {
    if (!confirm(`Esborrar ${f.nom}? No es pot desfer.`)) return;
    try {
      await descartarFotosAction(iteId, [f.id]);
      setFotos((prev) => prev.filter((x) => x.id !== f.id));
    } catch {
      alert("No s'ha pogut esborrar. Torna-ho a provar.");
    }
  }

  async function ferEnllac() {
    try {
      const token = await iteUploadTokenAction(iteId);
      setEnllac(`${window.location.origin}/pujar/${encodeURIComponent(token)}`);
      setCopiat(false);
    } catch {
      alert("No s'ha pogut fer l'enllaç.");
    }
  }

  return (
    <div
      className={`space-y-4 rounded-lg ${drag ? "outline-dashed outline-2 outline-[var(--color-accent)]" : ""}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDrag(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false); }}
      onDrop={(e) => { e.preventDefault(); setDrag(false); void afegir(e.dataTransfer.files); }}
    >
      <div className="rounded-lg border border-[var(--color-line)] bg-white p-4 text-sm">
        <p>
          Puja aquí <strong>totes les fotos de la visita de cop</strong> (arrossega-les a aquesta pàgina o tria-les), o des del mòbil amb l&apos;enllaç. Després, a Claude amb el
          connector DacArquitectura: <em>«Col·loca les fotos per classificar de l&apos;informe ITE {nom ? `«${nom}»` : ""}»</em>. Les mira, posa cada una a l&apos;element o la deficiència
          que toca i n&apos;escriu el peu. També les pots posar tu amb «Posar a…».
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className={`btn-primary cursor-pointer ${busy ? "opacity-60" : ""}`}>
            + Afegir fotos
            <input type="file" accept="image/*" multiple className="hidden" disabled={!!busy} onChange={(e) => { void afegir(e.target.files); e.target.value = ""; }} />
          </label>
          <button type="button" className="btn-ghost" onClick={() => void ferEnllac()}>Enllaç per pujar-les des del mòbil</button>
          {busy && <span className="text-xs text-[var(--color-muted)]">{busy}</span>}
        </div>
        {enllac && (
          <div className="mt-3 space-y-1">
            <div className="flex gap-2">
              <input className="input input-sm flex-1 text-xs" readOnly value={enllac} onFocus={(e) => e.target.select()} />
              <button type="button" className="btn-ghost btn-sm" onClick={() => { void navigator.clipboard.writeText(enllac).then(() => setCopiat(true)); }}>{copiat ? "Copiat" : "Copiar"}</button>
            </div>
            <p className="text-xs text-[var(--color-muted)]">Envia&apos;t l&apos;enllaç al mòbil (WhatsApp, correu…) i obre&apos;l: no cal iniciar sessió. Caduca d&apos;aquí a 24 hores i només serveix per pujar fotos a aquest informe.</p>
          </div>
        )}
      </div>

      {pendents.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No hi ha fotos per classificar.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pendents.map((f) => (
            <div key={f.id} className="space-y-2 rounded-lg border border-[var(--color-line)] bg-white p-2">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.ref} alt={f.nom} loading="lazy" className="h-48 w-full rounded-md bg-[var(--color-accent-soft)] object-contain" />
                <button type="button" className="absolute right-1 top-1 rounded bg-white/90 px-1.5 text-xs font-semibold text-red-700 shadow" onClick={() => void descartar(f)} title="Esborrar">✕</button>
              </div>
              <div className="truncate text-xs text-[var(--color-muted)]" title={f.nom}>{f.nom} · {fmtMida(f.bytes)}</div>
              <input
                className="input input-sm w-full text-xs"
                placeholder="Peu de foto (què és i on és)"
                maxLength={PEU_MAX}
                value={peus[f.id] ?? ""}
                onChange={(e) => setPeus((p) => ({ ...p, [f.id]: e.target.value }))}
              />
              <select className="input input-sm w-full text-xs" value="" onChange={(e) => { if (e.target.value) posar(f, e.target.value); }}>
                <option value="">Posar a…</option>
                {grups.map(([g, ls]) => (
                  <optgroup key={g} label={g}>
                    {ls.map((l) => (
                      <option key={l.codi} value={l.codi}>{`${l.codi} · ${l.titol}`.slice(0, 90)}{l.fotos ? ` (${l.fotos})` : ""}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
