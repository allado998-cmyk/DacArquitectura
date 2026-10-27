import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { CalculsView, type CalculRow } from "./calculs-view";

export const dynamic = "force-dynamic";

export default async function CalculsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireUser();
  const { tab } = await searchParams;

  const [calculs, expedients] = await Promise.all([
    sql`
      select c.id, c.num, c.tipus, c.expedient_id, c.referencia, c.projecte, c.client,
             c.situacio, c.element, to_char(c.data, 'YYYY-MM-DD') as data, c.versio, c.dades,
             e.num_expedient as expedient_num
      from public.calcul_estructural c
      left join public.expedients e on e.id = c.expedient_id
      order by c.num desc nulls last, c.id desc
    ` as unknown as Promise<CalculRow[]>,
    sql`
      select id, num_expedient, projecte
      from public.expedients
      order by num_expedient desc
    ` as unknown as Promise<{ id: number; num_expedient: string; projecte: string | null }[]>,
  ]);

  return (
    <>
      <AppNav current="calculs" />
      <main className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Càlculs</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">Justificacions de càlcul d&apos;estintolaments i taules de perfils.</p>
        <CalculsView calculs={calculs} expedients={expedients} initialTab={tab} />
      </main>
    </>
  );
}
