"use server";

import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function createNoteAction(): Promise<number> {
  await requireUser();
  const rows = (await sql`insert into public.notes (title) values ('Nota nova') returning id`) as { id: number }[];
  return rows[0]?.id ?? 0;
}

export async function updateNoteAction(id: number, patch: { title?: string; content?: string }) {
  await requireUser();
  if (!id) return;
  if (patch.title !== undefined) {
    await sql`update public.notes set title = ${patch.title.trim() || "Sense títol"}, updated_at = now() where id = ${id}`;
  }
  if (patch.content !== undefined) {
    await sql`update public.notes set content = ${patch.content}, updated_at = now() where id = ${id}`;
  }
}

export async function deleteNoteAction(id: number) {
  await requireUser();
  await sql`delete from public.notes where id = ${id}`;
}
