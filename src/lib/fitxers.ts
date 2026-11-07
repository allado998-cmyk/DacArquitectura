// Server side of the private file store (see fitxers-shared.ts for the layout).
import { randomBytes } from "node:crypto";
import { del, head, list, put } from "@vercel/blob";
import { isDemoSession } from "@/lib/auth";
import { pathnameOfRef, refFor, safeFileName } from "@/lib/fitxers-shared";

export type FitxersArea = "dac" | "demo";

// The demo account's files live apart from the real ones, exactly like its
// database, so a demo can never read or delete a real file.
export async function fitxersArea(): Promise<FitxersArea> {
  return (await isDemoSession()) ? "demo" : "dac";
}

export function newKey(): string {
  return randomBytes(9).toString("base64url");
}

// "actes/12", "expedients/7"
export type FitxersFolder = `actes/${number}` | `expedients/${number}`;

export async function newPathname(folder: FitxersFolder, name: string, fallback?: string): Promise<string> {
  return `${await fitxersArea()}/${folder}/${newKey()}/${safeFileName(name, fallback)}`;
}

// A pathname in the current user's area and in this folder, shaped like the
// ones newPathname makes.
export async function ownsPathname(pathname: string, folder: FitxersFolder): Promise<boolean> {
  const area = await fitxersArea();
  return pathname.startsWith(`${area}/${folder}/`) && /^[a-z]+\/[a-z]+\/\d+\/[A-Za-z0-9_-]{6,40}\/[^/]{1,160}$/.test(pathname);
}

// A file the browser uploaded straight to the store: it must belong to this
// user and folder and really be there. Returns its real size and type.
export async function verifyUploaded(
  pathnameOrRef: string,
  folder: FitxersFolder,
): Promise<{ pathname: string; bytes: number; contentType: string } | null> {
  const pathname = pathnameOrRef.startsWith("/") ? pathnameOfRef(pathnameOrRef) : pathnameOrRef;
  if (!pathname || !(await ownsPathname(pathname, folder))) return null;
  try {
    const h = await head(pathname);
    return { pathname, bytes: h.size, contentType: h.contentType };
  } catch {
    return null;
  }
}

const DATA_URL = /^data:([\w.+/-]+)(?:;[^,;]*)*;base64,/;

// Stores a base64 data URI (from the phone upload page, the AI plugin, or an
// old acta) and returns the new file's ref.
export async function storeDataUrl(folder: FitxersFolder, dataUrl: string, name: string): Promise<string> {
  const m = DATA_URL.exec(dataUrl);
  if (!m) throw new Error("Fitxer invàlid.");
  const bytes = Buffer.from(dataUrl.slice(m[0].length), "base64");
  const pathname = await newPathname(folder, name);
  await put(pathname, bytes, { access: "private", contentType: m[1], addRandomSuffix: false });
  return refFor(pathname, bytes.length);
}

// An acta photo, PDF or audio as the app keeps it: a ref to the store. Accepts
// a data URI (stored now) or a ref the browser already uploaded (checked).
export async function actaMediaRef(actaId: number, src: string, name: string): Promise<string | null> {
  const folder: FitxersFolder = `actes/${actaId}`;
  if (src.startsWith("data:")) return storeDataUrl(folder, src, name);
  const v = await verifyUploaded(src, folder);
  return v ? refFor(v.pathname, v.bytes) : null;
}

// Best effort: a file left behind costs a fraction of a cent, a failed delete
// must never block the user.
export async function deleteStored(pathnamesOrRefs: (string | null | undefined)[]): Promise<void> {
  const pathnames = pathnamesOrRefs
    .map((p) => (p && p.startsWith("/") ? pathnameOfRef(p) : p))
    .filter((p): p is string => !!p && !p.startsWith("data:"));
  if (!pathnames.length) return;
  try {
    await del(pathnames);
  } catch (e) {
    console.error("fitxers: delete failed", e);
  }
}

// Everything under a folder, e.g. when its acta or expedient is deleted.
export async function deleteFolder(folder: FitxersFolder): Promise<void> {
  try {
    const prefix = `${await fitxersArea()}/${folder}/`;
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      if (page.blobs.length) await del(page.blobs.map((b) => b.pathname));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  } catch (e) {
    console.error("fitxers: folder delete failed", e);
  }
}
