// Vercel Cron (vercel.json): Monday, Wednesday and Friday at 05:00 UTC (6 or
// 7 in the morning in Barcelona) regenerates the PDFs of the Descàrregues page
// — the studio's from the real database and the demo account's from its own —
// and replaces the previous ones. Vercel calls it with
// `Authorization: Bearer <CRON_SECRET>`; anything else gets 401.
//
// To run it by hand (the first time, or after a big change):
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/descarregues
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

async function generar(user: AppUser, origin: string) {
  try {
    return await runAsActingUser(user, () => generarDescarregues({ origin }));
  } catch (e) {
    console.error(`descarregues (${user}): failed`, e);
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET(req: Request): Promise<Response> {
  if (!autoritzat(req)) return new Response("No autoritzat.", { status: 401 });
  const origin = new URL(req.url).origin;
  const dac = await generar("adri", origin);
  // The demo account gets its own PDFs, from its own (fake) database, in its own area.
  const demo = process.env.DEMO_DATABASE_URL ? await generar("demo", origin) : { omes: "DEMO_DATABASE_URL no configurada" };
  console.log("descarregues", JSON.stringify({ dac, demo }));
  return Response.json({ dac, demo }, { status: "error" in dac ? 500 : 200 });
}
