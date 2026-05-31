"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

const ESTATS = ["obert", "tancat"];
const CATEGORIES = ["re", "co", "ed", "rec", "do"];
const VISIBILITATS = ["public", "privat"];

// Generate the next "YY-NNNN" number for the current year.
async function nextNumExpedient(): Promise<string> {
  const yy = String(new Date().getFullYear()).slice(-2);
  const rows = (await sql`
    select num_expedient
    from public.expedients
    where num_expedient like ${yy + "-%"}
    order by num_expedient desc
    limit 1
  `) as { num_expedient: string }[];

  let next = 1;
  const last = rows[0]?.num_expedient;
  if (last) {
    const m = /-(\d{4})$/.exec(last);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `${yy}-${String(next).padStart(4, "0")}`;
}

export async function createExpedientAction() {
  await requireUser();
  const num = await nextNumExpedient();
  await sql`
    insert into public.expedients (num_expedient)
    values (${num})
  `;
  revalidatePath("/expedients");
}

export interface ExpedientPatch {
  num_expedient: string;
  projecte: string;
  client: string;
  ciutat: string;
  estat: string;
  categoria: string; // "" means none
  visibilitat: string;
  pressupost: number;
}

export async function updateExpedientAction(id: number, data: ExpedientPatch) {
  await requireUser();

  const num = data.num_expedient.trim();
  if (!num) return;

  const estat = ESTATS.includes(data.estat) ? data.estat : "obert";
  const categoria = CATEGORIES.includes(data.categoria) ? data.categoria : null;
  const visibilitat = VISIBILITATS.includes(data.visibilitat) ? data.visibilitat : "privat";
  const pressupost = Number.isFinite(data.pressupost) ? data.pressupost : 0;

  await sql`
    update public.expedients set
      num_expedient = ${num},
      projecte = ${data.projecte.trim() || null},
      client = ${data.client.trim() || null},
      ciutat = ${data.ciutat.trim() || null},
      estat = ${estat},
      categoria = ${categoria},
      visibilitat = ${visibilitat},
      pressupost = ${pressupost}
    where id = ${id}
  `;
  revalidatePath("/expedients");
}

export async function deleteExpedientAction(id: number) {
  await requireUser();
  await sql`delete from public.expedients where id = ${id}`;
  revalidatePath("/expedients");
}
