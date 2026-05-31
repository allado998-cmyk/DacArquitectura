"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

async function nextNumProposta(): Promise<string> {
  const yy = String(new Date().getFullYear()).slice(-2);
  const rows = (await sql`
    select num_proposta
    from public.propostes
    where num_proposta like ${yy + "-%"}
    order by num_proposta desc
    limit 1
  `) as { num_proposta: string }[];

  let next = 1;
  const last = rows[0]?.num_proposta;
  if (last) {
    const m = /-(\d{4})$/.exec(last);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `${yy}-${String(next).padStart(4, "0")}`;
}

export async function createPropostaAction() {
  await requireUser();

  const num = await nextNumProposta();
  const rows = await sql`
    insert into public.propostes (num_proposta)
    values (${num})
    returning id
  ` as { id: number }[];

  const id = rows[0]?.id;
  if (!id) throw new Error("No s'ha pogut crear la proposta.");

  // Always include a "Responsabilitat Civil" altres line by default.
  const rc = (await sql`
    select id, preu_unitat_default::text as preu
    from public.concepte_altra_despesa
    where nom ilike 'Responsabilitat Civil'
    order by id limit 1
  `) as { id: number; preu: string }[];
  if (rc[0]) {
    await sql`
      insert into public.proposta_altra_despesa_line (proposta_id, concepte_id, unitats, preu_unitat, ordre)
      values (${id}, ${rc[0].id}, 0, ${rc[0].preu}, 10)
    `;
  }

  redirect(`/honoraris/${id}`);
}

export async function deletePropostaAction(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  await sql`delete from public.propostes where id = ${id}`;
  redirect("/honoraris");
}
