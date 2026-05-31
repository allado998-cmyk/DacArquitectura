"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

const ESTATS = ["pendent", "acceptada", "rebutjada"];

async function nextNum(): Promise<string> {
  const rows = (await sql`
    select num from public.proposta_doc where num like 'PH-%' order by num desc limit 1
  `) as { num: string }[];
  let next = 1;
  const m = rows[0]?.num ? /-(\d{4})$/.exec(rows[0].num) : null;
  if (m) next = parseInt(m[1], 10) + 1;
  return `PH-${String(next).padStart(4, "0")}`;
}

export async function createPropostaDocAction() {
  await requireUser();
  const num = await nextNum();
  const rows = (await sql`
    insert into public.proposta_doc (num) values (${num}) returning id
  `) as { id: number }[];
  const id = rows[0]?.id;
  if (!id) throw new Error("No s'ha pogut crear la proposta.");

  // Seed a default payment line.
  await sql`
    insert into public.proposta_doc_pagament (doc_id, descripcio, ordre)
    values (${id}, 'En finalitzar el servei', 10)
  `;

  redirect(`/propostes/${id}`);
}

export async function deletePropostaDocAction(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  await sql`delete from public.proposta_doc where id = ${id}`;
  redirect("/propostes");
}

export interface DocPatch {
  data?: string;
  descripcio?: string | null;
  adreca?: string | null;
  ciutat?: string | null;
  estat?: string;
}

export async function updatePropostaDocAction(id: number, patch: DocPatch) {
  await requireUser();
  const estat = patch.estat && ESTATS.includes(patch.estat) ? patch.estat : null;
  await sql`
    update public.proposta_doc set
      data = coalesce(${patch.data ?? null}::date, data),
      descripcio = ${patch.descripcio ?? null},
      adreca = ${patch.adreca ?? null},
      ciutat = ${patch.ciutat ?? null},
      estat = coalesce(${estat}, estat)
    where id = ${id}
  `;
  revalidatePath(`/propostes/${id}`);
  revalidatePath("/propostes");
}

export async function setEstatAction(id: number, estat: string) {
  await requireUser();
  if (!ESTATS.includes(estat)) return;
  await sql`update public.proposta_doc set estat = ${estat} where id = ${id}`;
  revalidatePath(`/propostes/${id}`);
  revalidatePath("/propostes");
}

// Serveis --------------------------------------------------------------------

export async function addServeiAction(docId: number) {
  await requireUser();
  await sql`
    insert into public.proposta_doc_servei (doc_id, ordre)
    values (${docId}, coalesce((select max(ordre) + 10 from public.proposta_doc_servei where doc_id = ${docId}), 10))
  `;
  revalidatePath(`/propostes/${docId}`);
}

export async function updateServeiAction(docId: number, id: number, descripcio: string, preu: number) {
  await requireUser();
  await sql`
    update public.proposta_doc_servei
    set descripcio = ${descripcio.trim() || null}, preu = ${Number.isFinite(preu) ? preu : 0}
    where id = ${id} and doc_id = ${docId}
  `;
  revalidatePath(`/propostes/${docId}`);
}

export async function deleteServeiAction(docId: number, id: number) {
  await requireUser();
  await sql`delete from public.proposta_doc_servei where id = ${id} and doc_id = ${docId}`;
  revalidatePath(`/propostes/${docId}`);
}

// Inclusions / Exclusions (text lines) --------------------------------------

type Taula = "inclusio" | "exclusio";
function tableName(t: Taula) {
  return t === "inclusio" ? "proposta_doc_inclusio" : "proposta_doc_exclusio";
}

export async function addLiniaAction(docId: number, taula: Taula) {
  await requireUser();
  if (taula === "inclusio") {
    await sql`insert into public.proposta_doc_inclusio (doc_id, ordre) values (${docId}, coalesce((select max(ordre)+10 from public.proposta_doc_inclusio where doc_id=${docId}),10))`;
  } else {
    await sql`insert into public.proposta_doc_exclusio (doc_id, ordre) values (${docId}, coalesce((select max(ordre)+10 from public.proposta_doc_exclusio where doc_id=${docId}),10))`;
  }
  revalidatePath(`/propostes/${docId}`);
}

export async function updateLiniaAction(docId: number, taula: Taula, id: number, text: string) {
  await requireUser();
  const value = text.trim() || null;
  if (taula === "inclusio") {
    await sql`update public.proposta_doc_inclusio set text = ${value} where id = ${id} and doc_id = ${docId}`;
  } else {
    await sql`update public.proposta_doc_exclusio set text = ${value} where id = ${id} and doc_id = ${docId}`;
  }
  revalidatePath(`/propostes/${docId}`);
}

export async function deleteLiniaAction(docId: number, taula: Taula, id: number) {
  await requireUser();
  if (taula === "inclusio") {
    await sql`delete from public.proposta_doc_inclusio where id = ${id} and doc_id = ${docId}`;
  } else {
    await sql`delete from public.proposta_doc_exclusio where id = ${id} and doc_id = ${docId}`;
  }
  revalidatePath(`/propostes/${docId}`);
  void tableName; // (kept for clarity)
}

// Pagaments ------------------------------------------------------------------

export async function addPagamentAction(docId: number) {
  await requireUser();
  await sql`
    insert into public.proposta_doc_pagament (doc_id, ordre)
    values (${docId}, coalesce((select max(ordre) + 10 from public.proposta_doc_pagament where doc_id = ${docId}), 10))
  `;
  revalidatePath(`/propostes/${docId}`);
}

export async function updatePagamentAction(docId: number, id: number, descripcio: string, importe: number | null) {
  await requireUser();
  await sql`
    update public.proposta_doc_pagament
    set descripcio = ${descripcio.trim() || null}, import = ${importe != null && Number.isFinite(importe) ? importe : null}
    where id = ${id} and doc_id = ${docId}
  `;
  revalidatePath(`/propostes/${docId}`);
}

export async function deletePagamentAction(docId: number, id: number) {
  await requireUser();
  await sql`delete from public.proposta_doc_pagament where id = ${id} and doc_id = ${docId}`;
  revalidatePath(`/propostes/${docId}`);
}
