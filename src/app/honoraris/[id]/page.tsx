import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { HonorarisView } from "./honoraris-view";
import type {
  Projecte,
  Client,
  ConcepteDespesaDirecta,
  ConcepteAltraDespesa,
  Proposta,
  PropostaDespesaDirectaLine,
  PropostaAltraDespesaLine,
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
    select id,
           to_char(data, 'YYYY-MM-DD') as data,
           projecte_id, client_id, contacte_prescriptor,
           preu_hora_default::text as preu_hora_default,
           despeses_indirectes::text as despeses_indirectes,
           benefici::text as benefici,
           total_honoraris_override::text as total_honoraris_override,
           created_at, updated_at
    from public.propostes where id = ${id}
  `) as unknown as Proposta[];
  if (propostaRows.length === 0) notFound();
  const proposta = propostaRows[0];

  const [projectes, clients, conceptesDirectes, conceptesAltres, linesDirectes, linesAltres] = await Promise.all([
    sql`select id, nom, created_at from public.projectes order by nom` as unknown as Promise<Projecte[]>,
    sql`select id, nom, contacte, created_at from public.clients order by nom` as unknown as Promise<Client[]>,
    sql`select id, nom, actiu, ordre from public.concepte_despesa_directa where actiu = true order by ordre, nom` as unknown as Promise<ConcepteDespesaDirecta[]>,
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
          projectes={projectes}
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
