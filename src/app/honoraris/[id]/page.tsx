import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { HonorarisView } from "./honoraris-view";
import { IteView } from "./ite-view";
import type {
  Client,
  ConcepteDespesaDirecta,
  ConcepteAltraDespesa,
  Proposta,
  PropostaDespesaDirectaLine,
  PropostaAltraDespesaLine,
  IteTarifa,
} from "@/types/db";

export const dynamic = "force-dynamic";

export default async function HonorarisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const propostaRows = (await sql`
    select id, num_proposta,
           to_char(data, 'YYYY-MM-DD') as data,
           projecte, client_id, contacte_prescriptor,
           preu_hora_default::text as preu_hora_default,
           despeses_indirectes_pct::text as despeses_indirectes_pct,
           benefici_pct::text as benefici_pct,
           total_honoraris_override::text as total_honoraris_override,
           es_ite,
           ut_habitatges::text as ut_habitatges,
           ut_locals_200::text as ut_locals_200,
           ut_locals_400::text as ut_locals_400,
           ut_locals_600::text as ut_locals_600,
           ut_locals_800::text as ut_locals_800,
           ut_locals_1000::text as ut_locals_1000,
           ite_descompte_pct::text as ite_descompte_pct,
           ite_iva_pct::text as ite_iva_pct,
           ite_comissio_activa,
           ite_comissio_pct::text as ite_comissio_pct,
           created_at, updated_at
    from public.propostes where id = ${id}
  `) as unknown as Proposta[];
  if (propostaRows.length === 0) notFound();
  const proposta = propostaRows[0];

  if (proposta.es_ite) {
    const [clients, tarifaRows, iteRateRows] = await Promise.all([
      sql`select id, nom, contacte, created_at from public.clients order by nom` as unknown as Promise<Client[]>,
      sql`select preu_1::text as preu_1, preu_2::text as preu_2, preu_3::text as preu_3, increment::text as increment from public.ite_tarifa where id = 1` as unknown as Promise<IteTarifa[]>,
      sql`select preu_hora_default::text as v from public.concepte_despesa_directa where nom ilike 'ITE' order by id limit 1` as unknown as Promise<{ v: string }[]>,
    ]);
    const tarifa: IteTarifa = tarifaRows[0] ?? { preu_1: "650", preu_2: "750", preu_3: "850", increment: "15" };
    const preuHoraIte = iteRateRows[0]?.v ?? "0";
    return (
      <>
        <AppNav current="honoraris" />
        <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
          <IteView proposta={proposta} clients={clients} tarifa={tarifa} preuHoraIte={preuHoraIte} />
        </main>
      </>
    );
  }

  const [clients, conceptesDirectes, conceptesAltres, linesDirectes, linesAltres] = await Promise.all([
    sql`select id, nom, contacte, created_at from public.clients order by nom` as unknown as Promise<Client[]>,
    sql`select id, nom, preu_hora_default::text as preu_hora_default, actiu, ordre from public.concepte_despesa_directa where actiu = true order by ordre, nom` as unknown as Promise<ConcepteDespesaDirecta[]>,
    sql`select id, nom, preu_unitat_default::text as preu_unitat_default, actiu, ordre from public.concepte_altra_despesa where actiu = true order by ordre, nom` as unknown as Promise<ConcepteAltraDespesa[]>,
    sql`
      select l.id, l.proposta_id, l.concepte_id, c.nom as concepte_nom,
             l.hores::text as hores, l.preu_hora::text as preu_hora, l.ordre
      from public.proposta_despesa_directa_line l
      join public.concepte_despesa_directa c on c.id = l.concepte_id
      where l.proposta_id = ${id}
      order by l.ordre, l.id
    ` as unknown as Promise<PropostaDespesaDirectaLine[]>,
    sql`
      select l.id, l.proposta_id, l.concepte_id, c.nom as concepte_nom,
             l.unitats::text as unitats, l.preu_unitat::text as preu_unitat, l.ordre
      from public.proposta_altra_despesa_line l
      join public.concepte_altra_despesa c on c.id = l.concepte_id
      where l.proposta_id = ${id}
      order by l.ordre, l.id
    ` as unknown as Promise<PropostaAltraDespesaLine[]>,
  ]);

  return (
    <>
      <AppNav current="honoraris" />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <HonorarisView
          proposta={proposta}
          clients={clients}
          conceptesDirectes={conceptesDirectes}
          conceptesAltres={conceptesAltres}
          initialLinesDirectes={linesDirectes}
          initialLinesAltres={linesAltres}
        />
      </main>
    </>
  );
}
