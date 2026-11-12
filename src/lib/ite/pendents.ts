// Photos of an ITE report that are not in their place yet («per classificar»).
// The upload link, the editor's «Afegir fotos» and the plugin put photos in
// the report's folder of the file store first; Claude (through the plugin) or
// the user then places each one with its caption. There is no list to keep in
// step: a photo is pending while it is in the folder and the report does not
// point at it. So a photo taken out of its place is pending again, and an
// editor left open with an older copy of the report can never lose one.
import { del, get, list, put } from "@vercel/blob";
import { fitxersArea, newPathname } from "@/lib/fitxers";
import { pathnameOfRef, refFor } from "@/lib/fitxers-shared";
import { pendentsDe, type FotoCarpeta } from "./fotos";
import type { IteObj } from "./xml";

const IMATGE = /\.(jpe?g|png|webp|gif|avif)$/i;

// Every photo in the report's folder, oldest upload first.
export async function fotosCarpeta(iteId: number): Promise<FotoCarpeta[]> {
  const area = await fitxersArea();
  const prefix = `${area}/ite/${iteId}/`;
  const out: FotoCarpeta[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    for (const b of page.blobs) {
      const parts = b.pathname.split("/"); // area, "ite", id, key, name
      if (parts.length !== 5 || !IMATGE.test(parts[4])) continue;
      out.push({ id: parts[3], ref: refFor(b.pathname, b.size), nom: parts[4], bytes: b.size, pujada: new Date(b.uploadedAt).toISOString() });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out.sort((a, b) => a.pujada.localeCompare(b.pujada) || a.nom.localeCompare(b.nom, "ca", { numeric: true }));
}

export async function fotosPendents(iteId: number, doc: IteObj): Promise<FotoCarpeta[]> {
  return pendentsDe(await fotosCarpeta(iteId), doc);
}

// Stores a photo (already a JPEG of a sensible size) in the report's folder,
// where it waits for a place.
export async function desaFotoPendent(iteId: number, bytes: Buffer, name: string): Promise<FotoCarpeta> {
  const base = name.replace(/\.[A-Za-z0-9]{1,5}$/, "").trim() || "foto";
  const pathname = await newPathname(`ite/${iteId}`, `${base}.jpg`, "foto.jpg");
  await put(pathname, bytes, { access: "private", contentType: "image/jpeg", addRandomSuffix: false });
  const parts = pathname.split("/");
  return { id: parts[3], ref: refFor(pathname, bytes.length), nom: parts[4], bytes: bytes.length, pujada: new Date().toISOString() };
}

// A small JPEG of a stored photo for the assistant to look at (≈ 260 image
// tokens at 512 px), or null if it cannot be read.
export async function miniatura(ref: string, max = 512): Promise<string | null> {
  const pathname = pathnameOfRef(ref);
  if (!pathname) return null;
  const r = await get(pathname, { access: "private" }).catch(() => null);
  if (!r || r.statusCode !== 200 || !r.stream) return null;
  try {
    const bytes = Buffer.from(await new Response(r.stream).arrayBuffer());
    const sharp = (await import("sharp")).default;
    const out = await sharp(bytes, { limitInputPixels: 60_000_000, failOn: "none" })
      .rotate()
      .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 60 })
      .toBuffer();
    return out.toString("base64");
  } catch {
    return null;
  }
}

// Deletes pending photos by id. Photos the report uses are never touched.
export async function esborrarPendents(iteId: number, doc: IteObj, ids: string[]): Promise<number> {
  const want = new Set(ids);
  const gone = (await fotosPendents(iteId, doc)).filter((f) => want.has(f.id));
  const pathnames = gone.map((f) => pathnameOfRef(f.ref)).filter((p): p is string => !!p);
  if (pathnames.length) await del(pathnames);
  return pathnames.length;
}
