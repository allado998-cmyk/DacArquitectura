import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { createPropostaAction } from "./actions";
import { HonorarisListView, type PropostaListRow } from "./honoraris-list-view";

export const dynamic = "force-dynamic";

export default async function HonorarisListPage() {
  await requireUser();

  const rows = (await sql`
    select p.id,
           p.num_proposta,
           to_char(p.data, 'YYYY-MM-DD') as data,
           p.projecte,
           c.nom as client_nom,
           coalesce(
             p.total_honoraris_override,
             case
               when (100 - coalesce(p.despeses_indirectes_pct, 0) - coalesce(p.benefici_pct, 0)) > 0
                 then (b.base * 100.0) / (100 - coalesce(p.despeses_indirectes_pct, 0) - coalesce(p.benefici_pct, 0))
               else b.base
             end
           )::text as total
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
          <form action={createPropostaAction}>
            <button className="btn-primary" type="submit">Nou càlcul</button>
          </form>
        </div>

        <HonorarisListView rows={rows} />
      </main>
    </>
  );
}
