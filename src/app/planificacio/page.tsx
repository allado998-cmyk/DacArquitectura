import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { todayIso } from "@/lib/format";
import { PlanificacioView, type PlanItem, type Visita } from "./planificacio-view";

export const dynamic = "force-dynamic";

export default async function PlanificacioPage() {
  await requireUser();

  const [items, visites] = await Promise.all([
    sql`
      select e.id, e.num_expedient, e.projecte, e.categoria, c.nom as client_nom,
             e.ciutat, e.tipus, e.direccio_obres, t.nom as tipologia_nom,
             e.pressupost::text as pressupost,
             to_char(e.data_inici, 'YYYY-MM-DD') as data_inici,
             to_char(e.data_final, 'YYYY-MM-DD') as data_final,
             to_char(e.data_tancament, 'YYYY-MM-DD') as data_tancament,
             coalesce((select sum(hores) from public.proposta_despesa_directa_line where proposta_id = e.calcul_id), 0)::text as planned_hores,
             coalesce((select sum(hores) from public.dedicacions where expedient_id = e.id), 0)::text as actual_hores
      from public.expedients e
      left join public.clients c on c.id = e.client_id
      left join public.tipologies t on t.id = e.tipologia_id
      where e.estat = 'obert' and e.num_expedient not like '00-%'
      order by e.data_inici nulls last, e.num_expedient
    ` as unknown as Promise<PlanItem[]>,
    sql`
      select d.expedient_id, to_char(d.data, 'YYYY-MM-DD') as data,
             d.hores::text as hores, d.comentari, e.ciutat
      from public.dedicacions d
      join public.expedients e on e.id = d.expedient_id
      where e.estat = 'obert' and e.num_expedient not like '00-%' and d.tasca ilike 'Visita direcció d''obres'
    ` as unknown as Promise<Visita[]>,
  ]);

  return (
    <>
      <AppNav current="planificacio" />
      <main className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Planificació</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          Expedients oberts — 2 setmanes enrere i 6 endavant.
        </p>
        <PlanificacioView items={items} visites={visites} today={todayIso()} />
      </main>
    </>
  );
}
