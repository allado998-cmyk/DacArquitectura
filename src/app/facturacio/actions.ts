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

export async function createFacturaAction() {
  await requireUser();
  // New factures start as "Propera facturació": no number nor date yet.
  await sql`insert into public.factura (estat) values ('propera')`;
  revalidatePath("/facturacio");
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
  preu: number;
}

export async function updateFacturaAction(id: number, patch: FacturaPatch) {
  await requireUser();
  const clientId = patch.client_id && Number.isFinite(patch.client_id) ? patch.client_id : null;
  const expedientId = patch.expedient_id && Number.isFinite(patch.expedient_id) ? patch.expedient_id : null;
  const data = /^\d{4}-\d{2}-\d{2}$/.test(patch.data) ? patch.data : null;
  const preu = Number.isFinite(patch.preu) ? patch.preu : 0;
  const num = patch.num.trim() || null;
  // "emesa" requires both a number and a date; otherwise it stays "propera".
  const estat = patch.estat === "emesa" && num && data ? "emesa" : "propera";
  await sql`
    update public.factura set
      estat = ${estat},
      num = ${num},
      client_id = ${clientId},
      data = ${data}::date,
      expedient_id = ${expedientId},
      preu = ${preu}
    where id = ${id}
  `;
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
