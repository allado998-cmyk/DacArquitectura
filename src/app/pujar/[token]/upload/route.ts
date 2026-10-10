// Receives one file from the upload page. The sealed token in the URL is the
// only credential: it names the user and the acta, and expires after 24 h.
import { runAsActingUser } from "@/lib/acting-user";
import { readActaUploadToken } from "@/lib/upload-link";
import { addActaAudioAction, addActaDocAction, addActaFotoAction } from "@/app/actes/actions";
import { compressPhoto, mb, sniff, type MediaKind } from "@/lib/mcp/media";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel refuses request bodies over 4.5 MB; stay under it with a clear message.
const MAX_BODY_CHARS = 4_300_000;

function fail(error: string, status = 400): Response {
  return Response.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  const link = await readActaUploadToken(decodeURIComponent(token));
  if (!link) return fail("L'enllaç ha caducat o no és vàlid. Demana'n un de nou al xat.", 403);

  const text = await req.text();
  if (text.length > MAX_BODY_CHARS) return fail(`El fitxer és massa gran per pujar-lo d'aquesta manera (màxim uns ${mb(MAX_BODY_CHARS * 0.75)}).`, 413);
  let body: { kind?: unknown; name?: unknown; dataUrl?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return fail("Petició invàlida.");
  }
  const m = /^data:([\w.+/-]+);base64,([A-Za-z0-9+/=]+)$/.exec(typeof body.dataUrl === "string" ? body.dataUrl : "");
  if (!m) return fail("Fitxer invàlid.");
  const bytes = Buffer.from(m[2], "base64");
  const s = sniff(bytes);
  if (!s) return fail("Tipus de fitxer no admès. Puja fotos, PDF o àudio.");
  const expected = body.kind === "foto" || body.kind === "document" || body.kind === "audio" ? (body.kind as MediaKind) : s.kind;
  if (expected !== s.kind) return fail(`Aquest fitxer no és ${expected === "foto" ? "una foto" : expected === "document" ? "un PDF" : "un àudio"}.`);

  const rawName = typeof body.name === "string" ? body.name : "";
  const name = rawName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").trim().slice(0, 120) || (s.kind === "document" ? "document.pdf" : `audio.${s.ext}`);

  let dataUrl = `data:${s.mime};base64,${m[2]}`;
  if (s.kind === "foto" && (s.mime !== "image/jpeg" || bytes.length > 1_200_000)) {
    // The page already shrinks photos; this covers browsers where it could not.
    try {
      const out = await compressPhoto(bytes);
      dataUrl = `data:image/jpeg;base64,${out.data.toString("base64")}`;
    } catch (e) {
      return fail(e instanceof Error ? e.message : "No s'ha pogut llegir la imatge.");
    }
  }

  return runAsActingUser(link.user, async () => {
    const exists = (await sql`select id from public.acta where id = ${link.actaId}`) as { id: number }[];
    if (!exists.length) return fail("Aquesta acta ja no existeix.", 404);
    if (s.kind === "foto") await addActaFotoAction(link.actaId, dataUrl);
    else if (s.kind === "document") await addActaDocAction(link.actaId, { name: /\.pdf$/i.test(name) ? name : `${name}.pdf`, dataUrl });
    else await addActaAudioAction(link.actaId, { name, dataUrl });
    const rows = (await sql`
      select jsonb_array_length(coalesce(fotografies,'[]'::jsonb)) as fotos,
             jsonb_array_length(coalesce(documents,'[]'::jsonb)) as documents,
             jsonb_array_length(coalesce(audios,'[]'::jsonb)) as audios
      from public.acta where id = ${link.actaId}`) as { fotos: number; documents: number; audios: number }[];
    return Response.json({ ok: true, kind: s.kind, counts: rows[0] }, { headers: { "Cache-Control": "no-store" } });
  });
}
