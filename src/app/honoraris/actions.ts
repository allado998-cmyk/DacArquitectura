"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function createPropostaAction() {
  await requireUser();

  const rows = await sql`
    insert into public.propostes default values
    returning id
  ` as { id: number }[];

  const id = rows[0]?.id;
  if (!id) throw new Error("No s'ha pogut crear la proposta.");

  redirect(`/honoraris/${id}`);
}

export async function deletePropostaAction(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  await sql`delete from public.propostes where id = ${id}`;
  redirect("/honoraris");
}
