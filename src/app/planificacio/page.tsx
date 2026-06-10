import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { todayIso } from "@/lib/format";
import { PlanificacioView, type PlanItem } from "./planificacio-view";

export const dynamic = "force-dynamic";

export default async function PlanificacioPage() {
  await requireUser();

  const items = (await sql`
    select e.id, e.num_expedient, e.projecte, e.categoria, c.nom as client_nom,
           to_char(e.data_inici, 'YYYY-MM-DD') as data_inici,
           to_char(e.data_final, 'YYYY-MM-DD') as data_final
    from public.expedients e
    left join public.clients c on c.id = e.client_id
    where e.estat = 'obert' and e.num_expedient not like '00-%'
    order by e.data_inici nulls last, e.num_expedient
  `) as unknown as PlanItem[];

  return (
    <>
      <AppNav current="planificacio" />
      <main className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Planificació</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          Expedients oberts — 2 setmanes enrere i 4 endavant.
        </p>
        <PlanificacioView items={items} today={todayIso()} />
      </main>
    </>
  );
}
