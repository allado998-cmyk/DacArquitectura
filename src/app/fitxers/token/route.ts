// Lets the browser upload one file straight to the private store (no 4.5 MB
// request limit, no data through our functions). Only for a logged-in user and
// only to a pathname that newPathname made for their own area.
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSession } from "@/lib/auth";
import { FITXER_MAX_BYTES } from "@/lib/fitxers-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATHNAME = /^(dac|demo)\/(actes|expedients|ite)\/\d+\/[A-Za-z0-9_-]{6,40}\/[^/]{1,160}$/;

export async function POST(request: Request): Promise<Response> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return Response.json({ error: "Petició invàlida." }, { status: 400 });
  }
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const session = await getSession();
        if (!session.user) throw new Error("No has iniciat sessió.");
        const area = session.user === "demo" ? "demo" : "dac";
        const m = PATHNAME.exec(pathname);
        if (!m || m[1] !== area) throw new Error("Ruta de fitxer no vàlida.");
        return { maximumSizeInBytes: FITXER_MAX_BYTES, addRandomSuffix: false, allowOverwrite: false };
      },
    });
    return Response.json(json);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "No s'ha pogut pujar." }, { status: 400 });
  }
}
