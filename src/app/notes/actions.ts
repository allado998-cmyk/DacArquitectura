"use server";

import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function saveNoteAction(content: string) {
  await requireUser();
  await sql`
    insert into public.note (id, content, updated_at) values (1, ${content}, now())
    on conflict (id) do update set content = excluded.content, updated_at = now()
  `;
}
