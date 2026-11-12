import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { IteListView, type IteListRow } from "./ite-list-view";

export const dynamic = "force-dynamic";

export default async function ItePage() {
  await requireUser();

  const [ites, expedients, clients] = await Promise.all([
    sql`
      select i.id, i.nom, i.adreca, to_char(i.data_inspeccio, 'YYYY-MM-DD') as data_inspeccio,
             e.num_expedient as expedient_num, c.nom as client_nom,
             case when jsonb_typeof(i.dades -> 'deficiencies') = 'array' then jsonb_array_length(i.dades -> 'deficiencies') else 0 end as deficiencies,
             to_char(i.updated_at, 'YYYY-MM-DD') as updated
      from public.ite_informe i
      left join public.expedients e on e.id = i.expedient_id
      left join public.clients c on c.id = i.client_id
      order by i.updated_at desc, i.id desc
    ` as unknown as Promise<IteListRow[]>,
    sql`
      select e.id, e.num_expedient, e.projecte, e.client_id, e.adreca
      from public.expedients e
      order by e.num_expedient desc
    ` as unknown as Promise<{ id: number; num_expedient: string; projecte: string | null; client_id: number | null; adreca: string | null }[]>,
    sql`select id, nom from public.clients order by nom` as unknown as Promise<{ id: number; nom: string }[]>,
  ]);

  return (
    <>
      <AppNav current="ite" />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <IteListView ites={ites} expedients={expedients} clients={clients} />
      </main>
    </>
  );
}
