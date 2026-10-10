// Files added to an acta from the chat: photos, PDF documents and audio.
// ChatGPT hands the tool a short-lived download_url for an attached file;
// any other client can pass a public https link. Either way the file is
// fetched here, its type is read from its first bytes, and photos are
// re-encoded like the web editor does (max 1600 px, JPEG quality 0.72).
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type MediaKind = "foto" | "document" | "audio";

export const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_STORED_BYTES: Record<MediaKind, number> = {
  foto: 4 * 1024 * 1024,
  document: 15 * 1024 * 1024,
  audio: 15 * 1024 * 1024,
};
const TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 3;

// Addresses -------------------------------------------------------------------

export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === "::" || s === "::1") return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(s) || s.startsWith("64:ff9b:");
  }
  return true;
}

async function assertPublicHttps(u: URL): Promise<void> {
  if (u.protocol !== "https:") throw new Error("Només s'accepten enllaços https.");
  if (u.username || u.password) throw new Error("L'enllaç no pot dur credencials.");
  if (u.port && u.port !== "443") throw new Error("L'enllaç no pot indicar un port.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) throw new Error("L'enllaç ha de ser un nom de domini, no una adreça IP.");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Domini no permès.");
  }
  const addrs = await lookup(host, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) throw new Error("Domini no permès.");
}

// Download ---------------------------------------------------------------------

export interface Downloaded {
  bytes: Buffer;
  contentType: string | null;
  fileName: string | null;
}

function nameFrom(res: Response, url: URL): string | null {
  const cd = res.headers.get("content-disposition") ?? "";
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(cd);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      /* fall through */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(cd);
  if (plain) return plain[1].trim();
  const last = url.pathname.split("/").filter(Boolean).pop();
  if (last && /\.[a-z0-9]{2,5}$/i.test(last)) {
    try {
      return decodeURIComponent(last);
    } catch {
      return last;
    }
  }
  return null;
}

export async function downloadPublic(rawUrl: string, maxBytes = MAX_DOWNLOAD_BYTES): Promise<Downloaded> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("L'enllaç no és una URL vàlida.");
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublicHttps(url);
      const res = await fetch(url, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "user-agent": "DacArquitectura-MCP/1.0", accept: "*/*" },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) throw new Error(`Redirecció sense destí (${res.status}).`);
        url = new URL(loc, url);
        continue;
      }
      if (!res.ok) throw new Error(`No s'ha pogut baixar el fitxer (HTTP ${res.status}).`);
      const declared = Number(res.headers.get("content-length") ?? 0);
      if (declared > maxBytes) throw new Error(`El fitxer és massa gran (${mb(declared)}; màxim ${mb(maxBytes)}).`);
      if (!res.body) throw new Error("Resposta buida.");
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          throw new Error(`El fitxer és massa gran (més de ${mb(maxBytes)}).`);
        }
        chunks.push(value);
      }
      if (total === 0) throw new Error("El fitxer és buit.");
      return { bytes: Buffer.concat(chunks), contentType: res.headers.get("content-type"), fileName: nameFrom(res, url) };
    }
    throw new Error("Massa redireccions.");
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw new Error("La baixada ha trigat massa.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Type sniffing ------------------------------------------------------------------

export interface Sniffed {
  kind: MediaKind;
  mime: string;
  ext: string;
}

function ascii(b: Uint8Array, start: number, len: number): string {
  return String.fromCharCode(...b.subarray(start, start + len));
}

export function sniff(b: Uint8Array): Sniffed | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: "foto", mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && ascii(b, 1, 3) === "PNG") return { kind: "foto", mime: "image/png", ext: "png" };
  if (ascii(b, 0, 4) === "GIF8") return { kind: "foto", mime: "image/gif", ext: "gif" };
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return { kind: "foto", mime: "image/webp", ext: "webp" };
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WAVE") return { kind: "audio", mime: "audio/wav", ext: "wav" };
  if (ascii(b, 0, 5) === "%PDF-") return { kind: "document", mime: "application/pdf", ext: "pdf" };
  if (ascii(b, 0, 4) === "OggS") return { kind: "audio", mime: "audio/ogg", ext: "ogg" };
  if (ascii(b, 0, 4) === "fLaC") return { kind: "audio", mime: "audio/flac", ext: "flac" };
  if (ascii(b, 0, 3) === "ID3") return { kind: "audio", mime: "audio/mpeg", ext: "mp3" };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: "audio", mime: "audio/webm", ext: "webm" };
  if (b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return { kind: "audio", mime: "audio/aac", ext: "aac" };
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return { kind: "audio", mime: "audio/mpeg", ext: "mp3" };
  if (ascii(b, 4, 4) === "ftyp") {
    const brand = ascii(b, 8, 4);
    if (["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(brand)) return { kind: "foto", mime: "image/heic", ext: "heic" };
    if (brand === "avif" || brand === "avis") return { kind: "foto", mime: "image/avif", ext: "avif" };
    if (brand === "M4A " || brand === "M4B ") return { kind: "audio", mime: "audio/mp4", ext: "m4a" };
    // Generic MP4 container: voice memos and phone recordings use it too.
    return { kind: "audio", mime: "audio/mp4", ext: "m4a" };
  }
  return null;
}

// Photo processing ---------------------------------------------------------------

export interface PreparedFile {
  kind: MediaKind;
  name: string;
  dataUrl: string;
  originalBytes: number;
  storedBytes: number;
  width?: number;
  height?: number;
}

export async function compressPhoto(bytes: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const sharp = (await import("sharp")).default;
  try {
    const { data, info } = await sharp(bytes, { limitInputPixels: 60_000_000, failOn: "error" })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 72 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/heif|heic|compression format/i.test(msg)) {
      throw new Error("Aquest format (HEIC) no es pot convertir aquí. Envia la foto com a JPEG o PNG.");
    }
    throw new Error(`No s'ha pogut llegir la imatge: ${msg}`);
  }
}

export function mb(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

function cleanName(name: string | null | undefined, fallback: string, ext: string): string {
  let n = (name ?? "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").trim().slice(0, 120);
  if (!n) n = fallback;
  if (!/\.[a-z0-9]{2,5}$/i.test(n)) n = `${n}.${ext}`;
  return n;
}

// Download, check and convert. Results are cached briefly so the preview and
// the confirmed call do not download and convert the same file twice.
const cache = new Map<string, { at: number; value: PreparedFile }>();
const CACHE_MS = 15 * 60 * 1000;

export async function prepareFile(
  url: string,
  opts: { expected?: MediaKind; name?: string | null; mimeHint?: string | null },
): Promise<PreparedFile> {
  const key = `${url}\n${opts.expected ?? ""}\n${opts.name ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const dl = await downloadPublic(url);
  const s = sniff(dl.bytes);
  if (!s) {
    throw new Error(
      `Tipus de fitxer no reconegut${dl.contentType ? ` (${dl.contentType})` : ""}. S'accepten fotos (JPEG, PNG, WebP, GIF, AVIF), PDF i àudio (MP3, M4A, OGG, WAV, WebM, AAC, FLAC).`,
    );
  }
  if (opts.expected && opts.expected !== s.kind) {
    const label: Record<MediaKind, string> = { foto: "una foto", document: "un PDF", audio: "un àudio" };
    throw new Error(`S'esperava ${label[opts.expected]} però el fitxer és ${label[s.kind]} (${s.mime}).`);
  }

  let value: PreparedFile;
  if (s.kind === "foto") {
    const out = await compressPhoto(dl.bytes);
    value = {
      kind: "foto",
      name: cleanName(opts.name ?? dl.fileName, "foto", "jpg").replace(/\.[a-z0-9]{2,5}$/i, ".jpg"),
      dataUrl: `data:image/jpeg;base64,${out.data.toString("base64")}`,
      originalBytes: dl.bytes.length,
      storedBytes: out.data.length,
      width: out.width,
      height: out.height,
    };
  } else {
    value = {
      kind: s.kind,
      name: cleanName(opts.name ?? dl.fileName, s.kind === "document" ? "document" : "audio", s.ext),
      dataUrl: `data:${s.mime};base64,${dl.bytes.toString("base64")}`,
      originalBytes: dl.bytes.length,
      storedBytes: dl.bytes.length,
    };
  }
  if (value.storedBytes > MAX_STORED_BYTES[value.kind]) {
    throw new Error(`El fitxer és massa gran per desar-lo (${mb(value.storedBytes)}; màxim ${mb(MAX_STORED_BYTES[value.kind])}).`);
  }

  for (const [k, v] of cache) if (Date.now() - v.at > CACHE_MS) cache.delete(k);
  if (cache.size >= 12) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), value });
  return value;
}
