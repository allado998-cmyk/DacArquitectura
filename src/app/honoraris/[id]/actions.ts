"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export interface PropostaUpdate {
  data?: string;
  projecte_id?: number | null;
  client_id?: number | null;
  contacte_prescriptor?: string | null;
  despeses_indirectes?: number;
  benefici?: number;
  total_honoraris_override?: number | null;
}

export async function updatePropostaAction(id: number, patch: PropostaUpdate) {
  await requireUser();
  if (!Number.isFinite(id)) throw new Error("id invàlid");

  await sql`
    update public.propostes set
      data = coalesce(${patch.data ?? null}::date, data),
      projecte_id = ${patch.projecte_id === undefined ? null : patch.projecte_id},
      client_id = ${patch.client_id === undefined ? null : patch.client_id},
      contacte_prescriptor = ${patch.contacte_prescriptor ?? null},
      despeses_indirectes = coalesce(${patch.despeses_indirectes ?? null}::numeric, despeses_indirectes),
      benefici = coalesce(${patch.benefici ?? null}::numeric, benefici),
      total_honoraris_override = ${patch.total_honoraris_override ?? null}
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
