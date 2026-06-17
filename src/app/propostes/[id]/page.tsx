import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { PropostaEditView, type CalculOption } from "./proposta-edit-view";
import type { PropostaDoc, PropostaDocServei, PropostaDocLinia, PropostaDocPagament, Client } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function PropostaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const docRows = (await sql`
    select id, num, to_char(data, 'YYYY-MM-DD') as data, descripcio, adreca, ciutat, codi_postal,
           client_id, calcul_id, estat,
           coalesce(hidden_inclusions, '{}') as hidden_inclusions,
           coalesce(hidden_exclusions, '{}') as hidden_exclusions,
           created_at, updated_at
    from public.proposta_doc where id = ${id}
  `) as unknown as PropostaDoc[];
  if (docRows.length === 0) notFound();

  const [serveis, inclusions, exclusions, pagaments, clients, calculs] = await Promise.all([
    sql`select id, doc_id, descripcio, preu::text as preu, ordre from public.proposta_doc_servei where doc_id = ${id} order by ordre, id` as unknown as Promise<PropostaDocServei[]>,
    sql`select id, doc_id, text, ordre from public.proposta_doc_inclusio where doc_id = ${id} order by ordre, id` as unknown as Promise<PropostaDocLinia[]>,
    sql`select id, doc_id, text, ordre from public.proposta_doc_exclusio where doc_id = ${id} order by ordre, id` as unknown as Promise<PropostaDocLinia[]>,
    sql`select id, doc_id, descripcio, import::text as import, ordre from public.proposta_doc_pagament where doc_id = ${id} order by ordre, id` as unknown as Promise<PropostaDocPagament[]>,
    sql`select id, nom, nif, carrer, ciutat, codi_postal, contacte, created_at from public.clients order by nom` as unknown as Promise<Client[]>,
    sql`
      select p.id, p.num_proposta, p.projecte, c.nom as client_nom,
        coalesce(
          p.total_honoraris_override,
          case when (100 - coalesce(p.despeses_indirectes_pct,0) - coalesce(p.benefici_pct,0)) > 0
            then (b.base * 100.0) / (100 - coalesce(p.despeses_indirectes_pct,0) - coalesce(p.benefici_pct,0))
            else b.base end
        )::text as total
      from public.propostes p
      left join public.clients c on c.id = p.client_id
      cross join lateral (
        select
          coalesce((select sum(hores*preu_hora) from public.proposta_despesa_directa_line where proposta_id = p.id),0)
          + coalesce((select sum(adl.unitats*adl.preu_unitat) from public.proposta_altra_despesa_line adl
              join public.concepte_altra_despesa ca on ca.id = adl.concepte_id
              where adl.proposta_id = p.id and ca.nom not ilike 'Responsabilitat Civil'),0) as base
      ) b
      order by p.num_proposta desc nulls last, p.id desc
    ` as unknown as Promise<CalculOption[]>,
  ]);

  return (
    <>
      <AppNav current="propostes" />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        <PropostaEditView
          doc={docRows[0]}
          serveis={serveis}
          inclusions={inclusions}
          exclusions={exclusions}
          pagaments={pagaments}
          clients={clients}
          calculs={calculs}
        />
      </main>
    </>
  );
}
