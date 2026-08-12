import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { ExpedientsView } from "./expedients-view";
import type { Expedient, Client, Dedicacio, Tipologia } from "@/types/db";
import type { CalculOpt, PropostaOpt, ExpedientFita } from "./expedients-view";

export const dynamic = "force-dynamic";

export default async function ExpedientsPage() {
  await requireUser();

  const [expedients, clients, dedicacions, fites, tipologies, calculs, propostes] = await Promise.all([
    sql`
      select e.id, e.num_expedient, e.projecte, e.client_id,
             c.nom as client_nom,
             e.ciutat, e.estat, e.categoria,
             e.tipologia_id, t.nom as tipologia_nom,
             e.tipus, e.direccio_obres, e.web,
             e.pressupost::text as pressupost,
             e.pressupost_origen, e.calcul_id, e.proposta_doc_id,
             coalesce(public.calcul_planned_hores(e.calcul_id), 0)::text as planned_hores,
             to_char(e.data_inici, 'YYYY-MM-DD') as data_inici,
             to_char(e.data_final, 'YYYY-MM-DD') as data_final,
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
    sql`
      select f.id, f.expedient_id, to_char(f.data, 'YYYY-MM-DD') as data,
             f.tipus_id, t.nom, t.forma, t.color
      from public.expedient_fita f
      join public.fita_tipus t on t.id = f.tipus_id
      order by f.data, f.id
    ` as unknown as Promise<ExpedientFita[]>,
    sql`select id, nom, ordre, created_at from public.tipologies order by ordre, nom` as unknown as Promise<Tipologia[]>,
    sql`
      select p.id, p.num_proposta, p.projecte,
        coalesce(p.total_honoraris_override,
          case when (100 - coalesce(p.despeses_indirectes_pct,0) - coalesce(p.benefici_pct,0)) > 0
            then (b.base * 100.0) / (100 - coalesce(p.despeses_indirectes_pct,0) - coalesce(p.benefici_pct,0))
            else b.base end)::text as total
      from public.propostes p
      cross join lateral (
        select
          coalesce((select sum(hores*preu_hora) from public.proposta_despesa_directa_line where proposta_id = p.id),0)
          + coalesce((select sum(adl.unitats*adl.preu_unitat) from public.proposta_altra_despesa_line adl
              join public.concepte_altra_despesa ca on ca.id = adl.concepte_id
              where adl.proposta_id = p.id and ca.nom not ilike 'Responsabilitat Civil'),0) as base
      ) b
      order by p.num_proposta desc nulls last, p.id desc
    ` as unknown as Promise<CalculOpt[]>,
    sql`
      select d.id, d.num, d.descripcio,
        coalesce((select sum(preu) from public.proposta_doc_servei where doc_id = d.id),0)::text as total
      from public.proposta_doc d
      order by d.num desc nulls last, d.id desc
    ` as unknown as Promise<PropostaOpt[]>,
  ]);

  return (
    <>
      <AppNav current="expedients" />
      <main className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Expedients</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          Registre d&apos;expedients del despatx.
        </p>
        <ExpedientsView
          expedients={expedients}
          clients={clients}
          dedicacions={dedicacions}
          fites={fites}
          tipologies={tipologies}
          calculs={calculs}
          propostes={propostes}
        />
      </main>
    </>
  );
}
