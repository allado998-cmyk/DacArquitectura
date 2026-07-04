import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { ActesView } from "./actes-view";

export const dynamic = "force-dynamic";

export default async function ActesPage() {
  await requireUser();

  const [actes, expedients] = await Promise.all([
    sql`
      select a.id, a.num, a.tipus, a.expedient_id, a.acta_num,
             to_char(a.data, 'YYYY-MM-DD') as data,
             a.projecte, a.client,
             e.num_expedient as expedient_num
      from public.acta a
      left join public.expedients e on e.id = a.expedient_id
      order by a.num desc nulls last, a.id desc
    ` as unknown as Promise<
      { id: number; num: string | null; tipus: "visita" | "reunio"; expedient_id: number | null; acta_num: string | null; data: string | null; projecte: string | null; client: string | null; expedient_num: string | null }[]
    >,
    sql`
      select id, num_expedient, projecte
      from public.expedients
      order by num_expedient desc
    ` as unknown as Promise<{ id: number; num_expedient: string; projecte: string | null }[]>,
  ]);

  return (
    <>
      <AppNav current="actes" />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <ActesView actes={actes} expedients={expedients} />
      </main>
    </>
  );
}
