import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { createIteAction, createPropostaAction } from "./actions";
import { HonorarisListView, type PropostaListRow } from "./honoraris-list-view";

export const dynamic = "force-dynamic";

export default async function HonorarisListPage() {
  await requireUser();

  const rows = (await sql`
    select p.id,
           p.num_proposta,
           to_char(p.data, 'YYYY-MM-DD') as data,
           p.projecte,
           p.es_ite,
           c.nom as client_nom,
           (case
             when p.es_ite then
               coalesce(p.total_honoraris_override, ip.preu) * (1 + case when p.ite_comissio_activa then coalesce(p.ite_comissio_pct, 0) / 100.0 else 0 end)
             else
               coalesce(
                 p.total_honoraris_override,
                 case
                   when (100 - coalesce(p.despeses_indirectes_pct, 0) - coalesce(p.benefici_pct, 0)) > 0
                     then (b.base * 100.0) / (100 - coalesce(p.despeses_indirectes_pct, 0) - coalesce(p.benefici_pct, 0))
                   else b.base
                 end
               )
           end)::text as total
    from public.propostes p
    left join public.clients c on c.id = p.client_id
    cross join lateral (
      select
        coalesce((select sum(hores * preu_hora) from public.proposta_despesa_directa_line where proposta_id = p.id), 0)
        + coalesce((
            select sum(adl.unitats * adl.preu_unitat)
            from public.proposta_altra_despesa_line adl
            join public.concepte_altra_despesa ca on ca.id = adl.concepte_id
            where adl.proposta_id = p.id and ca.nom not ilike 'Responsabilitat Civil'
          ), 0) as base
    ) b
    cross join lateral (
      select (p.ut_habitatges + p.ut_locals_200 + p.ut_locals_400 * 2 + p.ut_locals_600 * 3 + p.ut_locals_800 * 4 + p.ut_locals_1000 * 5) as ent
    ) e
    cross join lateral (
      select coalesce((select preu_1 from public.ite_tarifa where id = 1), 650) as t1,
             coalesce((select preu_2 from public.ite_tarifa where id = 1), 750) as t2,
             coalesce((select preu_3 from public.ite_tarifa where id = 1), 850) as t3,
             coalesce((select increment from public.ite_tarifa where id = 1), 15) as inc
    ) tf
    cross join lateral (
      select case when e.ent < 6 then tf.t1 when e.ent < 11 then tf.t2 else tf.t3 + tf.inc * (e.ent - 10) end as preu
    ) ip
    order by p.num_proposta desc nulls last, p.id desc
  `) as unknown as PropostaListRow[];

  return (
    <>
      <AppNav current="honoraris" />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Honoraris</h1>
            <p className="text-sm text-[var(--color-muted)]">Càlcul d&apos;honoraris.</p>
          </div>
          <div className="flex items-center gap-2">
            <form action={createPropostaAction}>
              <button className="btn-primary" type="submit">Nou càlcul</button>
            </form>
            <form action={createIteAction}>
              <button className="btn-primary" type="submit" style={{ backgroundColor: "#16a34a", borderColor: "#16a34a" }}>Nou càlcul ITE</button>
            </form>
          </div>
        </div>

        <HonorarisListView rows={rows} />
      </main>
    </>
  );
}
