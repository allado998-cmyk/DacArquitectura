// Browser only: reading the portal's export into the app, the photo package
// for uploading at the portal, and a copy of the report in the portal's own
// format. All run on the user's machine (zip, photos), so no function time
// and no 4.5 MB request limit.
import { addIteFitxerAction, importIteAction, markIteExportatAction, saveIteAction } from "@/app/ite/actions";
import { uploadFitxer } from "@/lib/fitxers-client";
import { refFor } from "@/lib/fitxers-shared";
import type { Cataleg } from "./cataleg";
import { fotoPaquet } from "./fotos";
import { buildExport, cleanImported, exportIdFor, getAt, mediaSlots } from "./model";
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

// The report in the portal's export format: ITE/informes/dades/<id>/<nom>.xml
// plus the photos under ITE/informes/imatges/<id>/… The portal refuses it on
// «Importar» (it only takes files it signed itself), so it is a copy, not a
// way in.
export async function exportPortalZip(iteId: number, doc: IteObj, cataleg: Cataleg, onProgress: (msg: string) => void): Promise<string> {
  const plan = buildExport(doc, cataleg, { exportId: exportIdFor(iteId) });
  const files = [{ name: plan.xmlPath, data: new TextEncoder().encode(plan.xml) }];
  const photos: { name: string; data: Uint8Array }[] = new Array(plan.files.length);
  let done = 0;
  await mapLimit(plan.files, 4, async (f, i) => {
    const res = await fetch(f.src, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`No s'ha pogut llegir una foto (${res.status}). Torna-ho a provar.`);
    photos[i] = { name: f.zipPath, data: new Uint8Array(await res.arrayBuffer()) };
    done++;
    onProgress(`Preparant fotos ${done}/${plan.files.length}…`);
  });
  onProgress("Comprimint…");
  const zipBytes = await buildZip([...files, ...photos]);
  const name = `${plan.fileBase}.zip`;
  download(zipBytes, name, "application/zip");
  void markIteExportatAction(iteId);
  return name;
}

// Only the XML (to look at it, or for a report without photos).
export function exportPortalXml(iteId: number, doc: IteObj, cataleg: Cataleg): string {
  const plan = buildExport(doc, cataleg, { exportId: exportIdFor(iteId) });
  const name = `${plan.fileBase}.xml`;
  download(new TextEncoder().encode(plan.xml), name, "application/xml");
  return name;
}

// All the report's photos and PDF, named by where they go in the portal
// (D03-2.jpg = deficiency 3, photo 2) with an index.txt of captions, for
// uploading them at the portal by hand or with Claude's computer use.
export async function exportFotosZip(doc: IteObj, cataleg: Cataleg, onProgress: (msg: string) => void): Promise<{ name: string; fotos: number; falten: number }> {
  const paquet = fotoPaquet(doc, cataleg);
  const photos: { name: string; data: Uint8Array }[] = new Array(paquet.fitxers.length);
  let done = 0;
  await mapLimit(paquet.fitxers, 4, async (f, i) => {
    const res = await fetch(f.src, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`No s'ha pogut llegir una foto (${res.status}). Torna-ho a provar.`);
    photos[i] = { name: f.zipPath, data: new Uint8Array(await res.arrayBuffer()) };
    done++;
    onProgress(`Preparant fotos ${done}/${paquet.fitxers.length}…`);
  });
  onProgress("Comprimint…");
  const zipBytes = await buildZip([{ name: "index.txt", data: new TextEncoder().encode(paquet.index) }, ...photos]);
  const name = `${paquet.nom}.zip`;
  download(zipBytes, name, "application/zip");
  return { name, fotos: photos.length, falten: paquet.falten.length };
}
