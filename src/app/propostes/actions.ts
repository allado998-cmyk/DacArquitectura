"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

const ESTATS = ["pendent", "acceptada", "rebutjada"];

async function nextNum(): Promise<string> {
  const yy = String(new Date().getFullYear()).slice(-2);
  const rows = (await sql`
    select num from public.proposta_doc where num like ${"PH-" + yy + "-%"} order by num desc limit 1
  `) as { num: string }[];
  let next = 1;
  const m = rows[0]?.num ? /-(\d{3})$/.exec(rows[0].num) : null;
  if (m) next = parseInt(m[1], 10) + 1;
  return `PH-${yy}-${String(next).padStart(3, "0")}`;
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
  codi_postal?: string | null;
  client_id?: number | null;
  calcul_id?: number | null;
  estat?: string;
}

// Only the keys present in `patch` are updated (so editing one field never
// clears the others).
export async function updatePropostaDocAction(id: number, patch: DocPatch) {
  await requireUser();
  if (patch.data !== undefined) await sql`update public.proposta_doc set data = ${patch.data}::date where id = ${id}`;
  if (patch.descripcio !== undefined) await sql`update public.proposta_doc set descripcio = ${patch.descripcio} where id = ${id}`;
  if (patch.adreca !== undefined) await sql`update public.proposta_doc set adreca = ${patch.adreca} where id = ${id}`;
  if (patch.ciutat !== undefined) await sql`update public.proposta_doc set ciutat = ${patch.ciutat} where id = ${id}`;
  if (patch.codi_postal !== undefined) await sql`update public.proposta_doc set codi_postal = ${patch.codi_postal} where id = ${id}`;
  if (patch.client_id !== undefined) await sql`update public.proposta_doc set client_id = ${patch.client_id} where id = ${id}`;
  if (patch.calcul_id !== undefined) await sql`update public.proposta_doc set calcul_id = ${patch.calcul_id} where id = ${id}`;
  if (patch.estat !== undefined && ESTATS.includes(patch.estat)) await sql`update public.proposta_doc set estat = ${patch.estat} where id = ${id}`;
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

// Hide / restore a built-in (fixed) inclusion or exclusion, by its index.
export async function toggleFixedLiniaAction(docId: number, taula: Taula, index: number, hidden: boolean) {
  await requireUser();
  if (!Number.isInteger(index) || index < 0) return;
  if (taula === "inclusio") {
    if (hidden) {
      await sql`update public.proposta_doc set hidden_inclusions = array_append(coalesce(hidden_inclusions, '{}'), ${index}) where id = ${docId} and not (${index} = any(coalesce(hidden_inclusions, '{}')))`;
    } else {
      await sql`update public.proposta_doc set hidden_inclusions = array_remove(coalesce(hidden_inclusions, '{}'), ${index}) where id = ${docId}`;
    }
  } else {
    if (hidden) {
      await sql`update public.proposta_doc set hidden_exclusions = array_append(coalesce(hidden_exclusions, '{}'), ${index}) where id = ${docId} and not (${index} = any(coalesce(hidden_exclusions, '{}')))`;
    } else {
      await sql`update public.proposta_doc set hidden_exclusions = array_remove(coalesce(hidden_exclusions, '{}'), ${index}) where id = ${docId}`;
    }
  }
  revalidatePath(`/propostes/${docId}`);
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
