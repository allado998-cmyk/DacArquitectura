import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { ExpedientsView } from "./expedients-view";
import type { Expedient, Client, Dedicacio, Tipologia } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function ExpedientsPage() {
  await requireUser();

  const [expedients, clients, dedicacions, tipologies] = await Promise.all([
    sql`
      select e.id, e.num_expedient, e.projecte, e.client_id,
             c.nom as client_nom,
             e.ciutat, e.estat, e.categoria,
             e.tipologia_id, t.nom as tipologia_nom,
             e.tipus,
             e.pressupost::text as pressupost,
             to_char(e.data_tancament, 'YYYY-MM-DD') as data_tancament,
             e.created_at, e.updated_at
      from public.expedients e
      left join public.clients c on c.id = e.client_id
      left join public.tipologies t on t.id = e.tipologia_id
      order by e.num_expedient desc
    ` as unknown as Promise<Expedient[]>,
    sql`select id, nom, nif, carrer, ciutat, codi_postal, contacte, created_at from public.clients order by nom` as unknown as Promise<Client[]>,
    sql`
      select id, expedient_id, to_char(data, 'YYYY-MM-DD') as data,
             hores::text as hores, tasca, comentari
      from public.dedicacions
      where expedient_id is not null
      order by data desc, id desc
    ` as unknown as Promise<Dedicacio[]>,
    sql`select id, nom, ordre, created_at from public.tipologies order by ordre, nom` as unknown as Promise<Tipologia[]>,
  ]);

  return (
    <>
      <AppNav current="expedients" />
      <main className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Expedients</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          Registre d&apos;expedients del despatx.
        </p>
        <ExpedientsView expedients={expedients} clients={clients} dedicacions={dedicacions} tipologies={tipologies} />
      </main>
    </>
  );
}
