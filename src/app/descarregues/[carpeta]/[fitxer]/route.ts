// Downloads a file of the Descàrregues page from the private store, to a
// logged-in user and only from their own area ("dac", or "demo" for the demo
// account). No database.
import { type NextRequest } from "next/server";
import { get } from "@vercel/blob";
import { getSession } from "@/lib/auth";
import { CARPETA, ZIP, areaPrefix, diaBcn, nomDescarrega, parseFitxer } from "@/lib/descarregues/cataleg";
import { llegirManifest } from "@/lib/descarregues/magatzem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Content-Disposition: the name with accents, and a plain one for old clients.
function attachment(name: string) {
  const ascii = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ carpeta: string; fitxer: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session.user) return new Response("No has iniciat sessió.", { status: 401 });
  const area = session.user === "demo" ? "demo" : "dac";

  const { carpeta, fitxer } = await params;
  const doc = fitxer === ZIP ? null : parseFitxer(fitxer);
  if (!CARPETA.test(carpeta) || (fitxer !== ZIP && !doc)) return new Response("No trobat.", { status: 404 });

  const result = await get(`${areaPrefix(area)}${carpeta}/${fitxer}`, { access: "private" }).catch(() => null);
  if (!result || result.statusCode !== 200 || !result.stream) {
    // A link from a page opened before the last run: the same document of the current one.
    const m = await llegirManifest(area);
    if (m && m.carpeta !== carpeta && (fitxer === ZIP || m.fitxers.some((f) => f.nom === fitxer))) {
      return Response.redirect(new URL(`/descarregues/${m.carpeta}/${fitxer}`, req.url), 307);
    }
    return new Response("No trobat.", { status: 404 });
  }

  const name = doc ? nomDescarrega(doc.llista, doc.any) : `DAC Descàrregues ${diaBcn(result.blob.uploadedAt)}.zip`;
  return new Response(result.stream, {
    headers: {
      "Content-Type": doc ? "application/pdf" : "application/zip",
      "Content-Disposition": attachment(name),
      "Content-Length": String(result.blob.size),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-cache",
    },
  });
}
