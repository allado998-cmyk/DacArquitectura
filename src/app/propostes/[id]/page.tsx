import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { PropostaEditView } from "./proposta-edit-view";
import type { PropostaDoc, PropostaDocServei, PropostaDocLinia, PropostaDocPagament } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function PropostaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const docRows = (await sql`
    select id, num, to_char(data, 'YYYY-MM-DD') as data, descripcio, adreca, ciutat, estat, created_at, updated_at
    from public.proposta_doc where id = ${id}
  `) as unknown as PropostaDoc[];
  if (docRows.length === 0) notFound();

  const [serveis, inclusions, exclusions, pagaments] = await Promise.all([
    sql`select id, doc_id, descripcio, preu::text as preu, ordre from public.proposta_doc_servei where doc_id = ${id} order by ordre, id` as unknown as Promise<PropostaDocServei[]>,
    sql`select id, doc_id, text, ordre from public.proposta_doc_inclusio where doc_id = ${id} order by ordre, id` as unknown as Promise<PropostaDocLinia[]>,
    sql`select id, doc_id, text, ordre from public.proposta_doc_exclusio where doc_id = ${id} order by ordre, id` as unknown as Promise<PropostaDocLinia[]>,
    sql`select id, doc_id, descripcio, import::text as import, ordre from public.proposta_doc_pagament where doc_id = ${id} order by ordre, id` as unknown as Promise<PropostaDocPagament[]>,
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
        />
      </main>
    </>
  );
}
