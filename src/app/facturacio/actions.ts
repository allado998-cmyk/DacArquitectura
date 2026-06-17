"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function nextFacturaNum(): Promise<string> {
  const yy = String(new Date().getFullYear()).slice(-2);
  const rows = (await sql`
    select num from public.factura where num like ${yy + "-%"} order by num desc limit 1
  `) as { num: string }[];
  let next = 1;
  const m = rows[0]?.num ? /-(\d{3})$/.exec(rows[0].num) : null;
  if (m) next = parseInt(m[1], 10) + 1;
  return `${yy}-${String(next).padStart(3, "0")}`;
}

export async function createFacturaAction(): Promise<number> {
  await requireUser();
  // New factures start as "Propera facturació": no number nor date yet. The
  // caller opens the edit popup straight away so it can be filled in.
  const rows = (await sql`insert into public.factura (estat) values ('propera') returning id`) as { id: number }[];
  revalidatePath("/facturacio");
  return rows[0]?.id ?? 0;
}

export async function deleteFacturaAction(id: number) {
  await requireUser();
  await sql`delete from public.factura where id = ${id}`;
  revalidatePath("/facturacio");
}

export async function setPagadaAction(id: number, pagada: boolean) {
  await requireUser();
  await sql`update public.factura set pagada = ${pagada} where id = ${id}`;
  revalidatePath("/facturacio");
}

export interface FacturaPatch {
  estat: string; // propera | emesa
  num: string;
  client_id: number | null;
  data: string;
  expedient_id: number | null;
  concepte: string;
  lang: string; // ca | es
  preu: number;
  iva_pct: number;
}

export async function updateFacturaAction(id: number, patch: FacturaPatch) {
  await requireUser();
  const clientId = patch.client_id && Number.isFinite(patch.client_id) ? patch.client_id : null;
  const expedientId = patch.expedient_id && Number.isFinite(patch.expedient_id) ? patch.expedient_id : null;
  const data = /^\d{4}-\d{2}-\d{2}$/.test(patch.data) ? patch.data : null;
  const preu = Number.isFinite(patch.preu) ? patch.preu : 0;
  const ivaPct = Number.isFinite(patch.iva_pct) && patch.iva_pct >= 0 ? patch.iva_pct : 21;
  const num = patch.num.trim() || null;
  const concepte = patch.concepte.trim() || null;
  const lang = patch.lang === "ca" ? "ca" : "es";
  // "emesa" requires both a number and a date; otherwise it stays "propera".
  const estat = patch.estat === "emesa" && num && data ? "emesa" : "propera";
  // If the factura is broken down into concept lines, its base is their sum;
  // otherwise the manual preu from the form wins.
  const concRows = (await sql`select coalesce(sum(import), 0)::float8 as s, count(*)::int as n from public.factura_concepte where factura_id = ${id}`) as { s: number; n: number }[];
  const effectivePreu = concRows[0]?.n > 0 ? concRows[0].s : preu;
  await sql`
    update public.factura set
      estat = ${estat},
      num = ${num},
      client_id = ${clientId},
      data = ${data}::date,
      expedient_id = ${expedientId},
      concepte = ${concepte},
      lang = ${lang},
      preu = ${effectivePreu},
      iva_pct = ${ivaPct}
    where id = ${id}
  `;
  revalidatePath("/facturacio");
}

// Base concepte breakdown -----------------------------------------------------
// When a factura has concept lines, its base `preu` is the sum of them.

async function recomputePreuFromConceptes(facturaId: number) {
  await sql`
    update public.factura f
    set preu = coalesce((select sum(import) from public.factura_concepte where factura_id = ${facturaId}), f.preu)
    where f.id = ${facturaId}
      and exists (select 1 from public.factura_concepte where factura_id = ${facturaId})
  `;
}

export async function addConcepteAction(facturaId: number) {
  await requireUser();
  await sql`
    insert into public.factura_concepte (factura_id, ordre)
    values (${facturaId}, coalesce((select max(ordre) + 10 from public.factura_concepte where factura_id = ${facturaId}), 10))
  `;
  await recomputePreuFromConceptes(facturaId);
  revalidatePath("/facturacio");
}

export async function updateConcepteAction(id: number, descripcio: string, importe: number) {
  await requireUser();
  const rows = (await sql`
    update public.factura_concepte
    set descripcio = ${descripcio.trim() || null}, import = ${Number.isFinite(importe) ? importe : 0}
    where id = ${id}
    returning factura_id
  `) as { factura_id: number }[];
  if (rows[0]) await recomputePreuFromConceptes(rows[0].factura_id);
  revalidatePath("/facturacio");
}

export async function deleteConcepteAction(id: number) {
  await requireUser();
  const rows = (await sql`delete from public.factura_concepte where id = ${id} returning factura_id`) as { factura_id: number }[];
  if (rows[0]) await recomputePreuFromConceptes(rows[0].factura_id);
  revalidatePath("/facturacio");
}

// Suplits ---------------------------------------------------------------------

export async function addSuplitAction(facturaId: number) {
  await requireUser();
  await sql`
    insert into public.factura_suplit (factura_id, ordre)
    values (${facturaId}, coalesce((select max(ordre) + 10 from public.factura_suplit where factura_id = ${facturaId}), 10))
  `;
  revalidatePath("/facturacio");
}

export async function updateSuplitAction(id: number, descripcio: string, importe: number) {
  await requireUser();
  await sql`
    update public.factura_suplit
    set descripcio = ${descripcio.trim() || null}, import = ${Number.isFinite(importe) ? importe : 0}
    where id = ${id}
  `;
  revalidatePath("/facturacio");
}

export async function deleteSuplitAction(id: number) {
  await requireUser();
  await sql`delete from public.factura_suplit where id = ${id}`;
  revalidatePath("/facturacio");
}
