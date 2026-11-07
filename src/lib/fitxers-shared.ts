// Files kept in the private Vercel Blob store (expedient attachments, acta
// photos, PDFs and audios). Shared by the browser and the server.
//
// Where a file is (its "pathname"):  <area>/<folder>/<key>/<name>
//   area    "dac" for the real account, "demo" for the demo account
//   folder  "actes/12" or "expedients/7"
//   key     random, so two files with the same name never collide
//   name    the original file name, so a download keeps it
//
// How the app links to it (a "ref"): /fitxers/<pathname>?mida=<bytes>
// The /fitxers route streams it to logged-in users only. Acta photos used to be
// stored inside the database as base64 data URIs; both forms are still read.

export const FITXERS_ROUTE = "/fitxers/";
export const FITXER_MAX_BYTES = 500 * 1024 * 1024;

export function isStoredRef(src: string | null | undefined): boolean {
  return typeof src === "string" && src.startsWith(FITXERS_ROUTE);
}

export function refFor(pathname: string, bytes: number): string {
  return `${FITXERS_ROUTE}${pathname.split("/").map(encodeURIComponent).join("/")}?mida=${Math.max(0, Math.round(bytes))}`;
}

export function pathnameOfRef(ref: string): string | null {
  if (!ref.startsWith(FITXERS_ROUTE)) return null;
  try {
    return ref.slice(FITXERS_ROUTE.length).split("?")[0].split("/").map(decodeURIComponent).join("/");
  } catch {
    return null;
  }
}

// Size in bytes of a stored file or of a base64 data URI.
export function srcBytes(src: string | null | undefined): number {
  if (!src) return 0;
  if (isStoredRef(src)) return Number(/[?&]mida=(\d+)/.exec(src)?.[1] ?? 0);
  const comma = src.indexOf(",");
  return Math.round((src.length - comma - 1) * 0.75);
}

// The name part of a pathname: safe in a URL and on any disk, accents kept.
export function safeFileName(name: string | null | undefined, fallback = "fitxer"): string {
  const clean = (name ?? "")
    .normalize("NFC")
    .replace(/[\\/:*?"<>|#%{}^~[\]`\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  if (!clean) return fallback;
  if (clean.length <= 120) return clean;
  const ext = /\.[A-Za-z0-9]{1,8}$/.exec(clean)?.[0] ?? "";
  return clean.slice(0, 120 - ext.length) + ext;
}

export function fmtMida(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2).replace(".", ",")} GB`;
}
