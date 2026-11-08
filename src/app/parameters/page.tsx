import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { ParametersView } from "./parameters-view";
import type { Client, ClientContacte, ClientStats, ConcepteDespesaDirecta, ConcepteAltraDespesa, Tipologia, Tasca, IteTarifa, TarifaCertificat, TarifaMinima } from "@/types/db";
import { TARIFA_MINIMA_DEFAULT } from "@/lib/tarifes";

export const dynamic = "force-dynamic";

export default async function ParametersPage() {
  await requireUser();

  const [clients, clientStats, conceptesDirectes, conceptesAltres, tipologies, contactes, tasques, tarifaRows, tarifesMinimes] = await Promise.all([
    sql`select id, nom, nif, carrer, ciutat, codi_postal, contacte, created_at from public.clients order by nom` as unknown as Promise<Client[]>,
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
      select cc.id, cc.client_id, cc.nom, cc.telefon, cc.mail, cc.telefons_extra, cc.mails_extra, cc.comentari, cc.professio, cc.ordre, c.nom as client_nom
      from public.client_contactes cc
      left join public.clients c on c.id = cc.client_id
      order by lower(nullif(cc.nom, '')) asc nulls last, cc.id
    ` as unknown as Promise<ClientContacte[]>,
    sql`select id, nom from public.tasca order by nom` as unknown as Promise<Tasca[]>,
    sql`select preu_1::text as preu_1, preu_2::text as preu_2, preu_3::text as preu_3, increment::text as increment, any_tarifa from public.ite_tarifa where id = 1` as unknown as Promise<IteTarifa[]>,
    // Benzina, hora and the certificats' lines, in one round trip.
    sql`
      select t.benzina_any, t.preu_litre::text as preu_litre, t.consum_100km::text as consum_100km, t.desgast_km::text as desgast_km,
             t.hora_any, t.sou::text as sou, t.lloguer::text as lloguer, t.lloguer_iva::text as lloguer_iva,
             t.dies_mes::text as dies_mes, t.hores_dia::text as hores_dia,
             t.certificats_any, t.dificultat_min::text as dificultat_min, t.dificultat_max::text as dificultat_max,
             coalesce((
               select json_agg(json_build_object('id', c.id, 'grup', c.grup, 'concepte', c.concepte, 'preu', c.preu::text, 'dificultat', c.dificultat) order by c.ordre, c.id)
               from public.tarifa_certificat c
             ), '[]'::json) as certificats
      from public.tarifa_minima t where t.id = 1
    ` as unknown as Promise<(TarifaMinima & { certificats: TarifaCertificat[] })[]>,
  ]);
  const iteTarifa: IteTarifa = tarifaRows[0] ?? { preu_1: "650", preu_2: "750", preu_3: "850", increment: "15", any_tarifa: 2026 };
  const { certificats: tarifesCertificats = [], ...tarifaMinima } = tarifesMinimes[0] ?? TARIFA_MINIMA_DEFAULT;

  return (
    <>
      <AppNav current="parameters" />
      <main className="w-full px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Base de Dades</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          Gestiona clients, catàlegs de despeses i tarifes.
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
          tarifaMinima={tarifaMinima}
          tarifesCertificats={tarifesCertificats}
        />
      </main>
    </>
  );
}
