import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { ParametersView } from "./parameters-view";
import type { Client, ClientContacte, ClientStats, ConcepteDespesaDirecta, ConcepteAltraDespesa, Tipologia, Tasca, IteTarifa } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function ParametersPage() {
  await requireUser();

  const [clients, clientStats, conceptesDirectes, conceptesAltres, tipologies, contactes, tasques, tarifaRows] = await Promise.all([
    sql`
      select c.id, c.nom, c.nif, c.carrer, c.ciutat, c.codi_postal, c.contacte, c.created_at,
        coalesce(
          json_agg(
            json_build_object(
              'id', cc.id, 'client_id', cc.client_id, 'nom', cc.nom,
              'telefon', cc.telefon, 'mail', cc.mail, 'comentari', cc.comentari, 'ordre', cc.ordre
            ) order by cc.ordre, cc.id
          ) filter (where cc.id is not null),
          '[]'
        ) as contactes
      from public.clients c
      left join public.client_contactes cc on cc.client_id = c.id
      group by c.id
      order by c.nom
    ` as unknown as Promise<Client[]>,
    sql`
      select client_id,
             count(*)::int as n,
             count(*) filter (where estat = 'obert')::int as oberts,
             coalesce(sum(pressupost), 0)::text as pressupost_total,
             coalesce(sum(pressupost) filter (where estat = 'obert'), 0)::text as pressupost_obert
      from public.expedients
      where client_id is not null
      group by client_id
    ` as unknown as Promise<ClientStats[]>,
    sql`select id, nom, preu_hora_default::text as preu_hora_default, actiu, ordre from public.concepte_despesa_directa order by ordre, nom` as unknown as Promise<ConcepteDespesaDirecta[]>,
    sql`select id, nom, preu_unitat_default::text as preu_unitat_default, actiu, ordre from public.concepte_altra_despesa order by ordre, nom` as unknown as Promise<ConcepteAltraDespesa[]>,
    sql`select id, nom, ordre, created_at from public.tipologies order by ordre, nom` as unknown as Promise<Tipologia[]>,
    sql`
      select cc.id, cc.client_id, cc.nom, cc.telefon, cc.mail, cc.comentari, cc.ordre, c.nom as client_nom
      from public.client_contactes cc
      left join public.clients c on c.id = cc.client_id
      order by lower(nullif(cc.nom, '')) asc nulls last, cc.id
    ` as unknown as Promise<ClientContacte[]>,
    sql`select id, nom from public.tasca order by nom` as unknown as Promise<Tasca[]>,
    sql`select preu_1::text as preu_1, preu_2::text as preu_2, preu_3::text as preu_3, increment::text as increment from public.ite_tarifa where id = 1` as unknown as Promise<IteTarifa[]>,
  ]);
  const iteTarifa: IteTarifa = tarifaRows[0] ?? { preu_1: "650", preu_2: "750", preu_3: "850", increment: "15" };

  return (
    <>
      <AppNav current="parameters" />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Base de Dades</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          Gestiona clients i catàlegs de despeses.
        </p>
        <ParametersView
          clients={clients}
          clientStats={clientStats}
          conceptesDirectes={conceptesDirectes}
          conceptesAltres={conceptesAltres}
          tipologies={tipologies}
          contactes={contactes}
          tasques={tasques}
          iteTarifa={iteTarifa}
        />
      </main>
    </>
  );
}
