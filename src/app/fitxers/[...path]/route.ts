// Serves a file from the private store to a logged-in user, only from their own
// area ("dac" or "demo"). Nothing here touches the database, so opening photos
// or attachments never wakes Neon.
import { type NextRequest } from "next/server";
import { get } from "@vercel/blob";
import { getSession } from "@/lib/auth";
import { pathnameOfRef } from "@/lib/fitxers-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Shown in the browser; anything else (HTML, SVG, Office files…) is downloaded,
// so an uploaded file can never run as a page of the app.
const INLINE = /^(image\/(jpeg|png|webp|gif|avif)|application\/pdf|audio\/[\w.+-]+|video\/[\w.+-]+|text\/plain)$/;

export async function GET(req: NextRequest): Promise<Response> {
  const session = await getSession();
  if (!session.user) return new Response("No has iniciat sessió.", { status: 401 });

  const pathname = pathnameOfRef(req.nextUrl.pathname);
  const area = session.user === "demo" ? "demo" : "dac";
  if (!pathname || !pathname.startsWith(`${area}/`) || pathname.includes("..")) {
    return new Response("No trobat.", { status: 404 });
  }

  const result = await get(pathname, {
    access: "private",
    ifNoneMatch: req.headers.get("if-none-match") ?? undefined,
  }).catch(() => null);
  if (!result) return new Response("No trobat.", { status: 404 });
  if (result.statusCode === 304) {
    return new Response(null, { status: 304, headers: { ETag: result.blob.etag, "Cache-Control": "private, no-cache" } });
  }
  if (result.statusCode !== 200 || !result.stream) return new Response("No trobat.", { status: 404 });

  const type = (result.blob.contentType || "application/octet-stream").split(";")[0].trim().toLowerCase();
  const name = pathname.slice(pathname.lastIndexOf("/") + 1);
  const download = req.nextUrl.searchParams.has("descarregar") || !INLINE.test(type);
  return new Response(result.stream, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(name)}`,
      "X-Content-Type-Options": "nosniff",
      ETag: result.blob.etag,
      "Cache-Control": "private, no-cache",
      ...(result.blob.size != null ? { "Content-Length": String(result.blob.size) } : {}),
    },
  });
}
