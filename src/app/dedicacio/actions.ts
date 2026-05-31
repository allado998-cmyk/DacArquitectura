"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export interface DedicacioInput {
  expedientId: number;
  data: string; // YYYY-MM-DD
  hores: number;
  tasca: string;
  comentari: string;
}

export async function createDedicacioAction(input: DedicacioInput) {
  await requireUser();

  if (!input.expedientId || !Number.isFinite(input.expedientId)) return;
  const hores = Number.isFinite(input.hores) ? input.hores : 0;
  if (hores <= 0) return;
  const data = /^\d{4}-\d{2}-\d{2}$/.test(input.data) ? input.data : null;
  if (!data) return;

  await sql`
    insert into public.dedicacions (expedient_id, data, hores, tasca, comentari)
    values (
      ${input.expedientId},
      ${data},
      ${hores},
      ${input.tasca.trim() || null},
      ${input.comentari.trim() || null}
    )
  `;
  revalidatePath("/dedicacio");
}

export async function deleteDedicacioAction(id: number) {
  await requireUser();
  await sql`delete from public.dedicacions where id = ${id}`;
  revalidatePath("/dedicacio");
}
