// Vercel Cron (vercel.json): Monday, Wednesday and Friday at 05:00 UTC (6 or
// 7 in the morning in Barcelona) regenerates the PDFs of the Descàrregues page
// — the studio's from the real database and the demo account's from its own —
// and replaces the previous ones; then the studio gets the e-mail «Actualització
// dades DAC» with the new zip (src/lib/descarregues/avis.ts). Vercel calls it
// with `Authorization: Bearer <CRON_SECRET>`; anything else gets 401.
//
// To run it by hand (the first time, or after a big change) — `?avis=0` so the
// studio is not e-mailed again:
//   curl -H "Authorization: Bearer $CRON_SECRET" "https://<app>/api/cron/descarregues?avis=0"
import { timingSafeEqual } from "node:crypto";
import { runAsActingUser } from "@/lib/acting-user";
import type { AppUser } from "@/lib/auth";
import { generarDescarregues } from "@/lib/descarregues/generar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function autoritzat(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

async function generar(user: AppUser, origin: string, avis = false) {
  try {
    return await runAsActingUser(user, () => generarDescarregues({ origin, avis }));
  } catch (e) {
    console.error(`descarregues (${user}): failed`, e);
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET(req: Request): Promise<Response> {
  if (!autoritzat(req)) return new Response("No autoritzat.", { status: 401 });
  const url = new URL(req.url);
  const origin = url.origin;
  const dac = await generar("adri", origin, url.searchParams.get("avis") !== "0");
  // The demo account gets its own PDFs, from its own (fake) database, in its own area.
  const demo = process.env.DEMO_DATABASE_URL ? await generar("demo", origin) : { omes: "DEMO_DATABASE_URL no configurada" };
  console.log("descarregues", JSON.stringify({ dac, demo }));
  return Response.json({ dac, demo }, { status: "error" in dac ? 500 : 200 });
}
