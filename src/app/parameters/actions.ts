"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

// Projectes -----------------------------------------------------------------

export async function createProjecteAction(nom: string) {
  await requireUser();
  const trimmed = nom.trim();
  if (!trimmed) return;
  await sql`insert into public.projectes (nom) values (${trimmed})`;
  revalidatePath("/parameters");
}

export async function updateProjecteAction(id: number, nom: string) {
  await requireUser();
  const trimmed = nom.trim();
  if (!trimmed) return;
  await sql`update public.projectes set nom = ${trimmed} where id = ${id}`;
  revalidatePath("/parameters");
}

export async function deleteProjecteAction(id: number) {
  await requireUser();
  await sql`delete from public.projectes where id = ${id}`;
  revalidatePath("/parameters");
}

// Clients -------------------------------------------------------------------

export async function createClientAction(nom: string, contacte: string) {
  await requireUser();
  const trimmed = nom.trim();
  if (!trimmed) return;
  await sql`insert into public.clients (nom, contacte) values (${trimmed}, ${contacte.trim() || null})`;
  revalidatePath("/parameters");
}

export async function updateClientAction(id: number, nom: string, contacte: string) {
  await requireUser();
  const trimmed = nom.trim();
  if (!trimmed) return;
  await sql`update public.clients set nom = ${trimmed}, contacte = ${contacte.trim() || null} where id = ${id}`;
  revalidatePath("/parameters");
}

export async function deleteClientAction(id: number) {
  await requireUser();
  await sql`delete from public.clients where id = ${id}`;
  revalidatePath("/parameters");
}

// Concepte Despesa Directa --------------------------------------------------

export async function createConcepteDirectaAction(nom: string, preu: number) {
  await requireUser();
  const trimmed = nom.trim();
  if (!trimmed) return;
  const preuOk = Number.isFinite(preu) ? preu : 28.27;
  await sql`
    insert into public.concepte_despesa_directa (nom, preu_hora_default, ordre)
    values (${trimmed}, ${preuOk}, coalesce((select max(ordre) + 10 from public.concepte_despesa_directa), 10))
    on conflict (nom) do nothing
  `;
  revalidatePath("/parameters");
}

export async function updateConcepteDirectaAction(id: number, nom: string, preu: number, actiu: boolean) {
  await requireUser();
  const trimmed = nom.trim();
  if (!trimmed) return;
  const preuOk = Number.isFinite(preu) ? preu : 28.27;
  await sql`
    update public.concepte_despesa_directa
    set nom = ${trimmed}, preu_hora_default = ${preuOk}, actiu = ${actiu}
    where id = ${id}
  `;
  revalidatePath("/parameters");
}

export async function deleteConcepteDirectaAction(id: number) {
  await requireUser();
  // Restrict if used; surface gracefully.
  try {
    await sql`delete from public.concepte_despesa_directa where id = ${id}`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("violates foreign key")) {
      // Soft-deactivate instead.
      await sql`update public.concepte_despesa_directa set actiu = false where id = ${id}`;
    } else {
      throw e;
    }
  }
  revalidatePath("/parameters");
}

// Concepte Altra Despesa ----------------------------------------------------

export async function createConcepteAltraAction(nom: string, preu: number) {
  await requireUser();
  const trimmed = nom.trim();
  if (!trimmed) return;
  await sql`
    insert into public.concepte_altra_despesa (nom, preu_unitat_default, ordre)
    values (${trimmed}, ${preu}, coalesce((select max(ordre) + 10 from public.concepte_altra_despesa), 10))
    on conflict (nom) do nothing
  `;
  revalidatePath("/parameters");
}

export async function updateConcepteAltraAction(id: number, nom: string, preu: number, actiu: boolean) {
  await requireUser();
  const trimmed = nom.trim();
  if (!trimmed) return;
  await sql`
    update public.concepte_altra_despesa
    set nom = ${trimmed}, preu_unitat_default = ${preu}, actiu = ${actiu}
    where id = ${id}
  `;
  revalidatePath("/parameters");
}

export async function deleteConcepteAltraAction(id: number) {
  await requireUser();
  try {
    await sql`delete from public.concepte_altra_despesa where id = ${id}`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("violates foreign key")) {
      await sql`update public.concepte_altra_despesa set actiu = false where id = ${id}`;
    } else {
      throw e;
    }
  }
  revalidatePath("/parameters");
}
