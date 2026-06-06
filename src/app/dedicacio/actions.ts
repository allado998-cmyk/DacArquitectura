"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export interface DedicacioInput {
  expedientId: number | null;
  activitat: string; // used when expedientId is null
  data: string; // YYYY-MM-DD
  hores: number;
  tasca: string;
  comentari: string;
}

export async function createDedicacioAction(input: DedicacioInput) {
  await requireUser();

  const hores = Number.isFinite(input.hores) ? input.hores : 0;
  if (hores <= 0) return;
  const data = /^\d{4}-\d{2}-\d{2}$/.test(input.data) ? input.data : null;
  if (!data) return;

  const expedientId = input.expedientId && Number.isFinite(input.expedientId) ? input.expedientId : null;
  const activitat = input.activitat.trim();
  // Need a target: either an expedient or a named activity.
  if (!expedientId && !activitat) return;

  await sql`
    insert into public.dedicacions (expedient_id, activitat, data, hores, tasca, comentari)
    values (
      ${expedientId},
      ${expedientId ? null : activitat},
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

export interface DedicacioPatch {
  data?: string;
  hores?: number;
  tasca?: string;
  comentari?: string;
}

export async function updateDedicacioAction(id: number, patch: DedicacioPatch) {
  await requireUser();
  if (patch.data !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(patch.data)) {
    await sql`update public.dedicacions set data = ${patch.data}::date where id = ${id}`;
  }
  if (patch.hores !== undefined && Number.isFinite(patch.hores) && patch.hores > 0) {
    await sql`update public.dedicacions set hores = ${patch.hores} where id = ${id}`;
  }
  if (patch.tasca !== undefined) {
    await sql`update public.dedicacions set tasca = ${patch.tasca.trim() || null} where id = ${id}`;
  }
  if (patch.comentari !== undefined) {
    await sql`update public.dedicacions set comentari = ${patch.comentari.trim() || null} where id = ${id}`;
  }
  revalidatePath("/dedicacio");
}
