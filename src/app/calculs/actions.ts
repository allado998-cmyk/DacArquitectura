"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { CALC_TYPES, calcType } from "@/lib/calculs";

async function nextCalculNum(): Promise<string> {
  const yy = String(new Date().getFullYear()).slice(2);
  const rows = (await sql`select num from public.calcul_estructural where num like ${`CE-${yy}-%`}`) as { num: string }[];
  let max = 0;
  for (const r of rows) {
    const m = /-(\d+)$/.exec(r.num ?? "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `CE-${yy}-${String(max + 1).padStart(3, "0")}`;
}

// The architect signing the last calculation, so new ones start with it.
async function lastArquitecte(): Promise<string> {
  const rows = (await sql`
    select arquitecte from public.calcul_estructural
    where coalesce(arquitecte, '') <> ''
    order by updated_at desc limit 1
  `) as { arquitecte: string }[];
  return rows[0]?.arquitecte ?? "David Lladó Porta";
}

export async function createCalculAction(tipus: string, expedientId: number | null): Promise<void> {
  await requireUser();
  const t = CALC_TYPES.find((x) => x.tipus === tipus);
  if (!t) throw new Error("Tipus de càlcul desconegut.");
  const num = await nextCalculNum();
  let referencia: string | null = null, projecte: string | null = null, adreca: string | null = null, ciutat: string | null = null, client: string | null = null, clientId: number | null = null;
  if (expedientId) {
    const rows = (await sql`
      select e.num_expedient, e.projecte, e.adreca, e.ciutat, e.client_id, c.nom as client_nom
      from public.expedients e left join public.clients c on c.id = e.client_id
      where e.id = ${expedientId}
    `) as { num_expedient: string; projecte: string | null; adreca: string | null; ciutat: string | null; client_id: number | null; client_nom: string | null }[];
    const r = rows[0];
    if (r) {
      referencia = r.num_expedient;
      projecte = r.projecte;
      adreca = r.adreca;
      ciutat = r.ciutat;
      client = r.client_nom;
      clientId = r.client_id;
    }
  }
  const arquitecte = await lastArquitecte();
  const rows = (await sql`
    insert into public.calcul_estructural
      (num, tipus, expedient_id, client_id, referencia, projecte, adreca, ciutat, client, arquitecte, situacio, element, data, versio, dades)
    values (
      ${num}, ${t.tipus}, ${expedientId}, ${clientId}, ${referencia}, ${projecte}, ${adreca}, ${ciutat}, ${client}, ${arquitecte},
      null, null, current_date, '1', ${JSON.stringify(t.defaults())}::jsonb
    )
    returning id
  `) as { id: number }[];
  const id = rows[0]?.id;
  if (!id) throw new Error("No s'ha pogut crear el càlcul.");
  revalidatePath("/calculs");
  redirect(`/calculs/${id}`);
}

export async function duplicateCalculAction(formData: FormData): Promise<void> {
  await requireUser();
  const srcId = Number(formData.get("id"));
  if (!Number.isFinite(srcId)) return;
  const num = await nextCalculNum();
  const rows = (await sql`
    insert into public.calcul_estructural
      (num, tipus, expedient_id, client_id, referencia, projecte, adreca, ciutat, client, arquitecte, situacio, element, data, versio, dades)
    select ${num}, tipus, expedient_id, client_id, referencia, projecte, adreca, ciutat, client, arquitecte, situacio, element, current_date, versio, dades
    from public.calcul_estructural where id = ${srcId}
    returning id
  `) as { id: number }[];
  const id = rows[0]?.id;
  if (!id) throw new Error("No s'ha pogut duplicar el càlcul.");
  revalidatePath("/calculs");
  redirect(`/calculs/${id}`);
}

export interface CalculPatch {
  expedient_id: number | null;
  client_id: number | null;
  referencia: string;
  projecte: string;
  adreca: string;
  ciutat: string;
  client: string;
  arquitecte: string;
  situacio: string;
  element: string;
  data: string;
  versio: string;
  dades: Record<string, unknown>;
}

export async function updateCalculAction(id: number, p: CalculPatch) {
  await requireUser();
  if (!Number.isFinite(id)) return;
  await sql`
    update public.calcul_estructural set
      expedient_id = ${p.expedient_id},
      client_id = ${p.client_id},
      referencia = ${p.referencia},
      projecte = ${p.projecte},
      adreca = ${p.adreca},
      ciutat = ${p.ciutat},
      client = ${p.client},
      arquitecte = ${p.arquitecte},
      situacio = ${p.situacio},
      element = ${p.element},
      data = ${p.data ? p.data : null}::date,
      versio = ${p.versio},
      dades = ${JSON.stringify(p.dades ?? {})}::jsonb,
      updated_at = now()
    where id = ${id}
  `;
  revalidatePath("/calculs");
}

export async function deleteCalculAction(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  const rows = (await sql`delete from public.calcul_estructural where id = ${id} returning tipus`) as { tipus: string }[];
  revalidatePath("/calculs");
  redirect(`/calculs?tab=${calcType(rows[0]?.tipus ?? "paret").tipus}`);
}
