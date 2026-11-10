"use client";

import { useState } from "react";
import { addIteFitxerAction } from "../actions";
import { compressImage } from "@/lib/compress-image";
import { uploadFitxer } from "@/lib/fitxers-client";
import { refFor } from "@/lib/fitxers-shared";
import { getAt, listOf, newMedia, setAt } from "@/lib/ite/model";
import { isObj, type IteObj } from "@/lib/ite/xml";
import { useDraft, useIte } from "./ite-context";

// Uploads one file to this report's folder and returns the media object.
async function uploadOne(iteId: number, file: File, descripcio: string): Promise<IteObj | null> {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const blob = isPdf ? file : await compressImage(file);
  const name = isPdf ? file.name : blob === file ? file.name : "foto.jpg";
  const up = await uploadFitxer("ite", iteId, blob, name);
  const ref = await addIteFitxerAction(iteId, refFor(up.pathname, up.bytes), name);
  if (!ref) return null;
  return newMedia(descripcio, isPdf ? "application/pdf" : "image/jpeg", ref);
}

function srcOf(m: IteObj): string {
  return typeof m.path === "string" ? m.path : "";
}

function stored(m: IteObj): boolean {
  return srcOf(m).startsWith("/fitxers/");
}

function Caption({ path }: { path: string }) {
  const { doc, update } = useIte();
  const m = getAt(doc, path);
  const value = isObj(m) && typeof m.descripcio === "string" ? m.descripcio : "";
  const d = useDraft(value, (v) => update((x) => setAt(x, `${path}.descripcio`, v.trim() || undefined)));
  return <input className="input input-sm text-xs" placeholder="Descripció de la foto" value={d.value} onFocus={d.onFocus} onChange={(e) => d.onChange(e.target.value)} onBlur={d.onBlur} />;
}

// The photos of an envelope element or a deficiency, each with its caption.
export function PhotoGallery({ path }: { path: string }) {
  const { iteId, doc, update } = useIte();
  const fotos = listOf(doc, path);
  const [busy, setBusy] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    let failed = 0;
    const list = Array.from(files);
    for (let i = 0; i < list.length; i++) {
      setBusy(`Pujant ${i + 1}/${list.length}…`);
      try {
        const m = await uploadOne(iteId, list[i], "");
        if (m) update((x) => setAt(x, path, [...listOf(x, path), m]));
        else failed++;
      } catch {
        failed++;
      }
    }
    setBusy(null);
    if (failed) alert(`No s'han pogut pujar ${failed} fitxers. Torna-ho a provar.`);
  }

  function move(i: number, dir: -1 | 1) {
    update((x) => {
      const l = listOf(x, path).slice();
      const j = i + dir;
      if (j < 0 || j >= l.length) return x;
      [l[i], l[j]] = [l[j], l[i]];
      return setAt(x, path, l);
    });
  }

  function remove(i: number) {
    if (!confirm("Treure aquesta foto?")) return;
    update((x) => setAt(x, path, listOf(x, path).filter((_, j) => j !== i)));
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="label mb-0">Fotografies ({fotos.length})</span>
        <div className="flex items-center gap-2">
          {busy && <span className="text-xs text-[var(--color-muted)]">{busy}</span>}
          <label className="btn-ghost btn-sm cursor-pointer">
            + Fotos
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
      </div>
      {fotos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {fotos.map((m, i) => (
            <div key={`${srcOf(m)}-${i}`} className="space-y-1">
              <div className="relative">
                {stored(m) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={srcOf(m)} alt={typeof m.descripcio === "string" ? m.descripcio : `Foto ${i + 1}`} loading="lazy" className="h-28 w-full rounded-md border border-[var(--color-line)] object-cover" />
                ) : (
                  <div className="flex h-28 items-center justify-center rounded-md border border-dashed border-red-300 bg-red-50 p-2 text-center text-xs text-red-700">Falta el fitxer</div>
                )}
                <div className="absolute right-1 top-1 flex gap-1">
                  <button type="button" className="rounded bg-white/90 px-1.5 text-xs shadow disabled:opacity-40" disabled={i === 0} onClick={() => move(i, -1)} title="Abans">←</button>
                  <button type="button" className="rounded bg-white/90 px-1.5 text-xs shadow disabled:opacity-40" disabled={i === fotos.length - 1} onClick={() => move(i, 1)} title="Després">→</button>
                  <button type="button" className="rounded bg-white/90 px-1.5 text-xs font-semibold text-red-700 shadow" onClick={() => remove(i)} title="Treure">✕</button>
                </div>
              </div>
              <Caption path={`${path}.${i}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// One photo (or the recommendations PDF) with a fixed caption.
export function SingleMedia({ path, label, descripcio, accept }: { path: string; label: string; descripcio: string; accept: string }) {
  const { iteId, doc, update } = useIte();
  const m = getAt(doc, path);
  const [busy, setBusy] = useState(false);
  const isPdf = accept.includes("pdf");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const media = await uploadOne(iteId, file, descripcio);
      if (media) update((x) => setAt(x, path, media));
      else alert("No s'ha pogut pujar el fitxer.");
    } catch {
      alert("No s'ha pogut pujar el fitxer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--color-line)] p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <div className="flex items-center gap-2">
          {busy && <span className="text-xs text-[var(--color-muted)]">Pujant…</span>}
          <label className="btn-ghost btn-sm cursor-pointer">
            {isObj(m) ? "Canviar" : isPdf ? "+ PDF" : "+ Foto"}
            <input type="file" accept={accept} className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {isObj(m) && (
            <button type="button" className="text-xs text-red-700 hover:underline" onClick={() => { if (confirm("Treure el fitxer?")) update((x) => setAt(x, path, undefined)); }}>Treure</button>
          )}
        </div>
      </div>
      {isObj(m) ? (
        stored(m) ? (
          isPdf ? (
            <a href={srcOf(m)} target="_blank" rel="noreferrer" className="text-sm text-[var(--color-accent)] hover:underline">Obrir el PDF</a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={srcOf(m)} alt={label} className="max-h-64 rounded-md border border-[var(--color-line)] object-contain" />
          )
        ) : (
          <p className="text-xs text-red-700">Falta el fitxer: torna&apos;l a pujar.</p>
        )
      ) : (
        <p className="text-xs text-[var(--color-muted)]">Cap fitxer.</p>
      )}
    </div>
  );
}
