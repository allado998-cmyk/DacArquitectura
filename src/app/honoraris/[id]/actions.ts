"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export interface PropostaUpdate {
  data?: string;
  projecte?: string | null;
  client_id?: number | null;
  contacte_prescriptor?: string | null;
  despeses_indirectes_pct?: number;
  benefici_pct?: number;
  total_honoraris_override?: number | null;
}

export async function updatePropostaAction(id: number, patch: PropostaUpdate) {
  await requireUser();
  if (!Number.isFinite(id)) throw new Error("id invàlid");

  await sql`
    update public.propostes set
      data = coalesce(${patch.data ?? null}::date, data),
      projecte = ${patch.projecte === undefined ? null : patch.projecte},
      client_id = ${patch.client_id === undefined ? null : patch.client_id},
      contacte_prescriptor = ${patch.contacte_prescriptor ?? null},
      despeses_indirectes_pct = coalesce(${patch.despeses_indirectes_pct ?? null}::numeric, despeses_indirectes_pct),
      benefici_pct = coalesce(${patch.benefici_pct ?? null}::numeric, benefici_pct),
      total_honoraris_override = ${patch.total_honoraris_override ?? null}
    where id = ${id}
  `;

  revalidatePath(`/honoraris/${id}`);
}

// ITE (Relació d'entitats) ---------------------------------------------------

export interface IteUpdate {
  ut_habitatges?: number;
  ut_locals_200?: number;
  ut_locals_400?: number;
  ut_locals_600?: number;
  ut_locals_800?: number;
  ut_locals_1000?: number;
  ite_descompte_pct?: number;
  ite_iva_pct?: number;
  ite_comissio_activa?: boolean;
  ite_comissio_pct?: number;
}

export async function updateIteAction(id: number, patch: IteUpdate) {
  await requireUser();
  if (!Number.isFinite(id)) throw new Error("id invàlid");
  const num = (v: number | undefined) => (v === undefined ? null : v);
  await sql`
    update public.propostes set
      ut_habitatges  = coalesce(${num(patch.ut_habitatges)}::numeric, ut_habitatges),
      ut_locals_200  = coalesce(${num(patch.ut_locals_200)}::numeric, ut_locals_200),
      ut_locals_400  = coalesce(${num(patch.ut_locals_400)}::numeric, ut_locals_400),
      ut_locals_600  = coalesce(${num(patch.ut_locals_600)}::numeric, ut_locals_600),
      ut_locals_800  = coalesce(${num(patch.ut_locals_800)}::numeric, ut_locals_800),
      ut_locals_1000 = coalesce(${num(patch.ut_locals_1000)}::numeric, ut_locals_1000),
      ite_descompte_pct = coalesce(${num(patch.ite_descompte_pct)}::numeric, ite_descompte_pct),
      ite_iva_pct = coalesce(${num(patch.ite_iva_pct)}::numeric, ite_iva_pct),
      ite_comissio_activa = coalesce(${patch.ite_comissio_activa ?? null}::boolean, ite_comissio_activa),
      ite_comissio_pct = coalesce(${num(patch.ite_comissio_pct)}::numeric, ite_comissio_pct)
    where id = ${id}
  `;
  revalidatePath(`/honoraris/${id}`);
}

// Despeses Directes lines ----------------------------------------------------

export async function addDespesaDirectaLineAction(propostaId: number, concepteId: number) {
  await requireUser();
  const rows = await sql`
    select preu_hora_default from public.concepte_despesa_directa where id = ${concepteId}
  ` as { preu_hora_default: string }[];
  const preu_hora = rows[0]?.preu_hora_default ?? "28.27";

  const inserted = await sql`
    insert into public.proposta_despesa_directa_line (proposta_id, concepte_id, hores, preu_hora, ordre)
    values (
      ${propostaId},
      ${concepteId},
      0,
      ${preu_hora},
      coalesce((select max(ordre) + 10 from public.proposta_despesa_directa_line where proposta_id = ${propostaId}), 10)
    )
    returning id
  ` as { id: number }[];

  revalidatePath(`/honoraris/${propostaId}`);
  return inserted[0]?.id;
}

export async function updateDespesaDirectaLineAction(
  propostaId: number,
  lineId: number,
  patch: { hores?: number; preu_hora?: number; concepte_id?: number }
) {
  await requireUser();
  await sql`
    update public.proposta_despesa_directa_line set
      hores = coalesce(${patch.hores ?? null}::numeric, hores),
      preu_hora = coalesce(${patch.preu_hora ?? null}::numeric, preu_hora),
      concepte_id = coalesce(${patch.concepte_id ?? null}::bigint, concepte_id)
    where id = ${lineId} and proposta_id = ${propostaId}
  `;
  revalidatePath(`/honoraris/${propostaId}`);
}

export async function deleteDespesaDirectaLineAction(propostaId: number, lineId: number) {
  await requireUser();
  await sql`delete from public.proposta_despesa_directa_line where id = ${lineId} and proposta_id = ${propostaId}`;
  revalidatePath(`/honoraris/${propostaId}`);
}

// Altres Despeses lines ------------------------------------------------------

export async function addAltraDespesaLineAction(propostaId: number, concepteId: number) {
  await requireUser();
  const rows = await sql`
    select preu_unitat_default from public.concepte_altra_despesa where id = ${concepteId}
  ` as { preu_unitat_default: string }[];
  const preu_unitat = rows[0]?.preu_unitat_default ?? "0";

  const inserted = await sql`
    insert into public.proposta_altra_despesa_line (proposta_id, concepte_id, unitats, preu_unitat, ordre)
    values (
      ${propostaId},
      ${concepteId},
      0,
      ${preu_unitat},
      coalesce((select max(ordre) + 10 from public.proposta_altra_despesa_line where proposta_id = ${propostaId}), 10)
    )
    returning id
  ` as { id: number }[];

  revalidatePath(`/honoraris/${propostaId}`);
  return inserted[0]?.id;
}

export async function updateAltraDespesaLineAction(
  propostaId: number,
  lineId: number,
  patch: { unitats?: number; preu_unitat?: number; concepte_id?: number }
) {
  await requireUser();
  await sql`
    update public.proposta_altra_despesa_line set
      unitats = coalesce(${patch.unitats ?? null}::numeric, unitats),
      preu_unitat = coalesce(${patch.preu_unitat ?? null}::numeric, preu_unitat),
      concepte_id = coalesce(${patch.concepte_id ?? null}::bigint, concepte_id)
    where id = ${lineId} and proposta_id = ${propostaId}
  `;
  revalidatePath(`/honoraris/${propostaId}`);
}

export async function deleteAltraDespesaLineAction(propostaId: number, lineId: number) {
  await requireUser();
  await sql`delete from public.proposta_altra_despesa_line where id = ${lineId} and proposta_id = ${propostaId}`;
  revalidatePath(`/honoraris/${propostaId}`);
}
