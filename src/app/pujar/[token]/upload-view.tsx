"use client";

import { useState } from "react";

export interface UploadActa {
  num: string;
  motiu: string;
  data: string | null;
  projecte: string | null;
  expedient: string | null;
  demo: boolean;
  counts: { fotos: number; documents: number; audios: number };
}

type Kind = "foto" | "document" | "audio";

interface Item {
  id: number;
  name: string;
  kind: Kind;
  preview?: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

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

// Same downscale as the acta editor: max 1600 px, JPEG 0.72.
async function compressImage(file: File, maxDim = 1600, quality = 0.72): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  try {
    const img = await loadImage(dataUrl);
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (Math.max(w, h) > maxDim) {
      const s = maxDim / Math.max(w, h);
      w = Math.round(w * s);
      h = Math.round(h * s);
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    // Formats the browser cannot draw (e.g. HEIC on some desktops) go as is;
    // the server converts what it can.
    return dataUrl;
  }
}

let nextId = 1;

export function UploadView({ token, acta }: { token: string; acta: UploadActa }) {
  const [items, setItems] = useState<Item[]>([]);
  const [counts, setCounts] = useState(acta.counts);
  const [busy, setBusy] = useState(false);

  const update = (id: number, patch: Partial<Item>) => setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  async function onFiles(files: FileList | null, kind: Kind) {
    if (!files || files.length === 0) return;
    const queued = Array.from(files).map((f) => ({ file: f, item: { id: nextId++, name: f.name, kind, status: "pending" as const } }));
    setItems((prev) => [...queued.map((q) => q.item), ...prev]);
    setBusy(true);
    // One at a time, so a big batch from a phone never floods the connection.
    for (const { file, item } of queued) {
      update(item.id, { status: "uploading" });
      try {
        const dataUrl = kind === "foto" ? await compressImage(file) : await readFileAsDataUrl(file);
        if (kind === "foto") update(item.id, { preview: dataUrl });
        const res = await fetch(`/pujar/${token}/upload`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind, name: file.name, dataUrl }),
        });
        const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; counts?: UploadActa["counts"] } | null;
        if (!res.ok || !json?.ok) throw new Error(json?.error ?? `Error ${res.status}`);
        if (json.counts) setCounts(json.counts);
        update(item.id, { status: "done" });
      } catch (e) {
        update(item.id, { status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    }
    setBusy(false);
  }

  const done = items.filter((i) => i.status === "done").length;

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="DAC arquitectura" className="h-8 w-auto" />
        {acta.demo && (
          <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">Demo</span>
        )}
      </div>

      <section className="card mb-5">
        <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Pujar a l&apos;acta</p>
        <h1 className="text-xl font-semibold">{acta.num}</h1>
        <p className="text-sm">
          {acta.motiu}
          {acta.data ? ` · ${acta.data}` : ""}
          {acta.expedient ? ` · ${acta.expedient}` : ""}
        </p>
        {acta.projecte && <p className="mt-1 text-sm text-[var(--color-muted)]">{acta.projecte}</p>}
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          Ara té {counts.fotos} {counts.fotos === 1 ? "foto" : "fotos"}, {counts.documents} {counts.documents === 1 ? "document" : "documents"} i {counts.audios}{" "}
          {counts.audios === 1 ? "àudio" : "àudios"}.
        </p>
      </section>

      <label className={`btn-primary mb-3 flex w-full cursor-pointer items-center justify-center py-4 text-base ${busy ? "opacity-60" : ""}`}>
        Fer o triar fotos
        <input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={(e) => { void onFiles(e.target.files, "foto"); e.target.value = ""; }} />
      </label>
      <div className="mb-6 grid grid-cols-2 gap-3">
        <label className={`btn flex cursor-pointer items-center justify-center ${busy ? "opacity-60" : ""}`}>
          Afegir PDF
          <input type="file" accept="application/pdf" multiple className="hidden" disabled={busy} onChange={(e) => { void onFiles(e.target.files, "document"); e.target.value = ""; }} />
        </label>
        <label className={`btn flex cursor-pointer items-center justify-center ${busy ? "opacity-60" : ""}`}>
          Afegir àudio
          <input type="file" accept="audio/*" multiple className="hidden" disabled={busy} onChange={(e) => { void onFiles(e.target.files, "audio"); e.target.value = ""; }} />
        </label>
      </div>

      {items.length > 0 && (
        <section className="space-y-2">
          <p className="text-sm font-medium">
            {busy ? "Pujant…" : `Fet: ${done} de ${items.length} ${items.length === 1 ? "fitxer pujat" : "fitxers pujats"}.`}
          </p>
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 rounded-lg border border-[var(--color-line)] bg-white p-2">
                {it.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.preview} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-[var(--color-accent-soft)] text-xs uppercase">{it.kind === "document" ? "PDF" : it.kind === "audio" ? "Àudio" : "Foto"}</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{it.name}</div>
                  <div className={`text-xs ${it.status === "error" ? "text-red-700" : "text-[var(--color-muted)]"}`}>
                    {it.status === "pending" && "En cua"}
                    {it.status === "uploading" && "Pujant…"}
                    {it.status === "done" && "Afegit a l'acta"}
                    {it.status === "error" && it.error}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {!busy && done > 0 && <p className="pt-2 text-sm text-[var(--color-muted)]">Ja pots tornar al xat. Les fotos surten al final del PDF de l&apos;acta.</p>}
        </section>
      )}
    </main>
  );
}
