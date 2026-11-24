// The PDFs of Càlculs › Normatives (normatives/ at the root of the repo,
// bundled with this route by next.config.ts), to a signed-in user only: the
// «Resum històric» is course material. No database.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getSession } from "@/lib/auth";
import { NORMATIVES } from "@/lib/calculs/normatives";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ fitxer: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session.user) return new Response("No has iniciat sessió.", { status: 401 });
  const { fitxer } = await params;
  const doc = NORMATIVES.find((d) => d.fitxer === fitxer);
  if (!doc) return new Response("No trobat.", { status: 404 });
  const data = await readFile(join(process.cwd(), "normatives", doc.fitxer));
  const descarregar = new URL(req.url).searchParams.has("descarregar");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${descarregar ? "attachment" : "inline"}; filename="${doc.fitxer}"`,
      "Content-Length": String(data.byteLength),
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
