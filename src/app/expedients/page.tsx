import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { ExpedientsView } from "./expedients-view";
import type { Expedient } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function ExpedientsPage() {
  await requireUser();

  const expedients = (await sql`
    select id, num_expedient, projecte, client, ciutat, estat, categoria,
           visibilitat, pressupost::text as pressupost, created_at, updated_at
    from public.expedients
    order by num_expedient desc
  `) as unknown as Expedient[];

  return (
    <>
      <AppNav current="expedients" />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Expedients</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          Registre d&apos;expedients del despatx.
        </p>
        <ExpedientsView expedients={expedients} />
      </main>
    </>
  );
}
