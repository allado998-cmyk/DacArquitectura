import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { DedicacioView } from "./dedicacio-view";
import { todayIso } from "@/lib/format";
import type { Dedicacio, Expedient } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function DedicacioPage() {
  await requireUser();

  const [expedients, dedicacions, tasques] = await Promise.all([
    sql`
      select e.id, e.num_expedient, e.projecte, e.client_id,
             c.nom as client_nom,
             e.ciutat, e.estat, e.categoria, e.tipus,
             e.pressupost::text as pressupost,
             to_char(e.data_tancament, 'YYYY-MM-DD') as data_tancament,
             e.created_at, e.updated_at
      from public.expedients e
      left join public.clients c on c.id = e.client_id
      order by e.num_expedient desc
    ` as unknown as Promise<Expedient[]>,
    sql`
      select d.id, d.expedient_id, e.num_expedient, e.projecte,
             e.categoria, e.client_id, c.nom as client_nom,
             to_char(d.data, 'YYYY-MM-DD') as data,
             d.hores::text as hores, d.tasca, d.comentari, d.created_at
      from public.dedicacions d
      join public.expedients e on e.id = d.expedient_id
      left join public.clients c on c.id = e.client_id
      order by d.data desc, d.id desc
    ` as unknown as Promise<Dedicacio[]>,
    sql`select nom from public.concepte_despesa_directa where actiu = true order by ordre, nom` as unknown as Promise<{ nom: string }[]>,
  ]);

  return (
    <>
      <AppNav current="dedicacio" />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Dedicació</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          Registra les hores dedicades a cada expedient.
        </p>
        <DedicacioView
          expedients={expedients}
          dedicacions={dedicacions}
          tasques={tasques.map((t) => t.nom)}
          today={todayIso()}
        />
      </main>
    </>
  );
}
