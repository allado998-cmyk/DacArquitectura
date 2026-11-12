// Browser only: reading the portal's export into the app, the photo package
// for uploading at the portal, and the report as a PDF. All run on the user's
// machine (zip, photos, printing), so no function time and no 4.5 MB request
// limit.
import { addIteFitxerAction, importIteAction, saveIteAction } from "@/app/ite/actions";
import { rasterizePdf, srcAsDataUrl } from "@/lib/acta-doc";
import { fitJpeg } from "@/lib/compress-image";
import { uploadFitxer } from "@/lib/fitxers-client";
import { refFor } from "@/lib/fitxers-shared";
import type { Cataleg } from "./cataleg";
import { fotoPaquet, PORTAL_FOTO_MAX_BYTES, PORTAL_FOTO_MAX_PX } from "./fotos";
import { buildInformeHtml, escHtml } from "./informe";
import { cleanImported, getAt, mediaSlots } from "./model";
import { parseIteXml, isObj, type IteObj } from "./xml";
import { buildZip, readZip, type ZipEntry } from "./zip";

export interface ImportResult {
  id: number;
  nom: string;
  fotos: number;
  fotosFalten: number;
  catalegNous: number;
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T, i: number) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

// The portal's zip (or just its XML) → a new report in the app, with its photos.
export async function importPortalFile(file: File, onProgress: (msg: string) => void): Promise<ImportResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  let entries: ZipEntry[] = [];
  let text: string;
  if (isZip) {
    entries = readZip(bytes);
    const xmlEntry = entries.find((e) => /\/dades\/[^/]+\/[^/]+\.xml$/i.test(e.name)) ?? entries.find((e) => /\.xml$/i.test(e.name));
    if (!xmlEntry) throw new Error("El zip no conté cap informe (fitxer .xml).");
    text = new TextDecoder().decode(await xmlEntry.read());
  } else {
    text = new TextDecoder().decode(bytes);
  }
  onProgress("Llegint l'informe…");
  const parsed = parseIteXml(text);
  // Cleaned here already, so the account's password hash never leaves the
  // browser; the server cleans again (same result, same photo positions).
  const doc = cleanImported(parsed.doc);
  const { id, catalegNous } = await importIteAction(doc);

  const slots = mediaSlots(doc);
  const byRel = new Map<string, ZipEntry>();
  for (const e of entries) {
    const m = /^ITE\/informes\/imatges\/[^/]+\/(.+)$/.exec(e.name);
    if (m) byRel.set(m[1], e);
  }
  let done = 0;
  let falten = 0;
  await mapLimit(slots, 4, async (slot) => {
    const m = getAt(doc, slot.path);
    if (!isObj(m) || typeof m.path !== "string") return;
    const rel = m.path.replace(/^\{IMAGEROOTDIR\}\/replaceFitxerId_[^/]+\//, "");
    const entry = byRel.get(rel);
    if (!entry) { falten++; return; }
    const data = await entry.read();
    const name = rel.slice(rel.lastIndexOf("/") + 1);
    const type = typeof m.mimeType === "string" ? m.mimeType : "image/jpeg";
    const up = await uploadFitxer("ite", id, new Blob([data as BlobPart], { type }), name);
    const ref = await addIteFitxerAction(id, refFor(up.pathname, up.bytes), name);
    if (ref) m.path = ref;
    else falten++;
    done++;
    onProgress(`Pujant fotos ${done}/${slots.length}…`);
  });
  if (slots.length) await saveIteAction(id, doc);
  return { id, nom: typeof doc.nom === "string" ? doc.nom : "", fotos: done, fotosFalten: falten, catalegNous };
}

function download(bytes: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// The report as a PDF (informe.ts): a print window with the document, its
// photos loaded from the file store, and the browser's «Desa com a PDF».
export async function openItePdf(doc: IteObj, cataleg: Cataleg): Promise<void> {
  // Opened within the click, so popup blockers let it through.
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) throw new Error("El navegador ha bloquejat la finestra nova: permet les finestres emergents per a aquesta web.");
  w.document.write("<!DOCTYPE html><html><body style='font-family:sans-serif;padding:24px;color:#555;'>Preparant l'informe…</body></html>");
  const origin = window.location.origin;
  const src = (p: string) => (p.startsWith("/fitxers/") ? origin + p : p.startsWith("data:") ? p : "");
  const pdf = getAt(doc, "recomanacionsPdf");
  const pdfSrc = isObj(pdf) && typeof pdf.path === "string" ? src(pdf.path) : "";
  const annex = pdfSrc ? await rasterizePdf(await srcAsDataUrl(pdfSrc)) : [];
  const title = typeof doc.nom === "string" && doc.nom.trim() ? doc.nom.trim() : "Informe ITE";
  const body = buildInformeHtml(doc, cataleg, { logoUrl: `${origin}/logo.jpg`, src, annex });
  w.document.open();
  // The title is what the browser proposes as the file name.
  w.document.write(`<!DOCTYPE html><html lang="ca"><head><meta charset="utf-8"><title>${escHtml(title)}</title>
    <style>@page { size: A4 portrait; margin: 1.3cm; } *{-webkit-print-color-adjust:exact;print-color-adjust:exact;} body{margin:0;}</style>
    </head><body>${body}</body></html>`);
  w.document.close();
  // The photos come from the file store: print once they have loaded (or failed).
  const pending = Array.from(w.document.images).filter((img) => !img.complete);
  await Promise.race([
    Promise.all(pending.map((img) => new Promise((done) => { img.addEventListener("load", done, { once: true }); img.addEventListener("error", done, { once: true }); }))),
    new Promise((done) => setTimeout(done, 30_000)),
  ]);
  w.focus();
  w.print();
}

// All the report's photos and PDF, named by where they go in the portal
// (D03-2.jpg = deficiency 3, photo 2) with an index.txt of captions, for
// uploading them at the portal by hand or with Claude's computer use. Every
// photo goes in as a JPEG the portal is known to take (fotos.ts).
export async function exportFotosZip(
  doc: IteObj,
  cataleg: Cataleg,
  onProgress: (msg: string) => void,
): Promise<{ name: string; fotos: number; falten: number; maxKb: number; senseComprimir: string[] }> {
  const paquet = fotoPaquet(doc, cataleg);
  const photos: { name: string; data: Uint8Array }[] = new Array(paquet.fitxers.length);
  const senseComprimir: string[] = [];
  let done = 0;
  let maxBytes = 0;
  await mapLimit(paquet.fitxers, 3, async (f, i) => {
    const res = await fetch(f.src, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`No s'ha pogut llegir una foto (${res.status}). Torna-ho a provar.`);
    const blob = await res.blob();
    let name = f.zipPath;
    let out: Blob = blob;
    if (!/\.pdf$/i.test(f.fitxer)) {
      const fit = await fitJpeg(blob, PORTAL_FOTO_MAX_BYTES, PORTAL_FOTO_MAX_PX);
      if (fit) {
        out = fit;
        maxBytes = Math.max(maxBytes, fit.size);
      } else {
        // A format this browser cannot draw (e.g. HEIC): as it is, with its own extension.
        const ext = /\/(\w+)/.exec(blob.type)?.[1]?.replace("jpeg", "jpg") ?? "bin";
        name = name.replace(/\.jpg$/, `.${ext}`);
        senseComprimir.push(name);
      }
    }
    photos[i] = { name, data: new Uint8Array(await out.arrayBuffer()) };
    done++;
    onProgress(`Preparant fotos ${done}/${paquet.fitxers.length}…`);
  });
  onProgress("Fent el zip…");
  const index = senseComprimir.length
    ? `${paquet.index}\nNo s'han pogut convertir a JPEG (format que el navegador no llegeix; potser el portal no les accepta): ${senseComprimir.join(", ")}\n`
    : paquet.index;
  const zipBytes = await buildZip([{ name: "index.txt", data: new TextEncoder().encode(index) }, ...photos]);
  const name = `${paquet.nom}.zip`;
  download(zipBytes, name, "application/zip");
  return { name, fotos: photos.length, falten: paquet.falten.length, maxKb: Math.ceil(maxBytes / 1024), senseComprimir };
}
