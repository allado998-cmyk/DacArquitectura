import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { todayIso } from "@/lib/format";
import { PlanificacioView, type PlanItem, type Visita, type Fita, type FitaTipus } from "./planificacio-view";

export const dynamic = "force-dynamic";

export default async function PlanificacioPage() {
  await requireUser();

  const [items, visites, fites, fitaTipus] = await Promise.all([
    sql`
      select e.id, e.num_expedient, e.projecte, e.categoria, c.nom as client_nom,
             e.ciutat, e.tipus, e.direccio_obres, t.nom as tipologia_nom,
             e.pressupost::text as pressupost,
             to_char(e.data_inici, 'YYYY-MM-DD') as data_inici,
             to_char(e.data_final, 'YYYY-MM-DD') as data_final,
             to_char(e.data_tancament, 'YYYY-MM-DD') as data_tancament,
             coalesce(public.calcul_planned_hores(e.calcul_id), 0)::text as planned_hores,
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
    sql`
      select f.id, f.expedient_id, to_char(f.data, 'YYYY-MM-DD') as data, f.tipus_id, t.nom, t.forma, t.color
      from public.expedient_fita f
      join public.fita_tipus t on t.id = f.tipus_id
      join public.expedients e on e.id = f.expedient_id
      where e.estat = 'obert' and e.num_expedient not like '00-%'
    ` as unknown as Promise<Fita[]>,
    sql`select id, nom, forma, color from public.fita_tipus order by nom` as unknown as Promise<FitaTipus[]>,
  ]);

  return (
    <>
      <AppNav current="planificacio" />
      <main className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Planificació</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          Expedients oberts — 2 setmanes enrere i 6 endavant.
        </p>
        <PlanificacioView items={items} visites={visites} fites={fites} fitaTipus={fitaTipus} today={todayIso()} />
      </main>
    </>
  );
}
