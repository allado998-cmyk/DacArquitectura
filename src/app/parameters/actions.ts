"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

// Clients -------------------------------------------------------------------

export async function createClientAction(nom: string) {
  await requireUser();
  const trimmed = nom.trim();
  if (!trimmed) return;
  await sql`insert into public.clients (nom) values (${trimmed})`;
  revalidatePath("/parameters");
}

export interface ClientPatch {
  nom: string;
  nif: string;
  carrer: string;
  ciutat: string;
  codi_postal: string;
}

// Create a client with every field filled in (from the form popup).
export async function createClientFullAction(data: ClientPatch) {
  await requireUser();
  const nom = data.nom.trim();
  if (!nom) return;
  await sql`
    insert into public.clients (nom, nif, carrer, ciutat, codi_postal)
    values (
      ${nom},
      ${data.nif.trim() || null},
      ${data.carrer.trim() || null},
      ${data.ciutat.trim() || null},
      ${data.codi_postal.trim() || null}
    )
  `;
  revalidatePath("/parameters");
}

export async function updateClientAction(id: number, data: ClientPatch) {
  await requireUser();
  const nom = data.nom.trim();
  if (!nom) return;
  await sql`
    update public.clients set
      nom = ${nom},
      nif = ${data.nif.trim() || null},
      carrer = ${data.carrer.trim() || null},
      ciutat = ${data.ciutat.trim() || null},
      codi_postal = ${data.codi_postal.trim() || null}
    where id = ${id}
  `;
  revalidatePath("/parameters");
}

export async function deleteClientAction(id: number) {
  await requireUser();
  await sql`delete from public.clients where id = ${id}`;
  revalidatePath("/parameters");
}

// Client contactes ----------------------------------------------------------

export async function addClientContacteAction(clientId: number) {
  await requireUser();
  await sql`
    insert into public.client_contactes (client_id, ordre)
    values (
      ${clientId},
      coalesce((select max(ordre) + 10 from public.client_contactes where client_id = ${clientId}), 10)
    )
  `;
  revalidatePath("/parameters");
}

export async function updateClientContacteAction(
  id: number,
  data: { nom: string; telefon: string; mail: string; comentari?: string },
) {
  await requireUser();
  await sql`
    update public.client_contactes set
      nom = ${data.nom.trim() || null},
      telefon = ${data.telefon.trim() || null},
      mail = ${data.mail.trim() || null},
      comentari = ${(data.comentari ?? "").trim() || null}
    where id = ${id}
  `;
  revalidatePath("/parameters");
}

export async function deleteClientContacteAction(id: number) {
  await requireUser();
  await sql`delete from public.client_contactes where id = ${id}`;
  revalidatePath("/parameters");
}

// Standalone contact (no client required).
export async function createContacteAction(data: { nom: string; telefon: string; mail: string; comentari?: string; clientId?: number | null }) {
  await requireUser();
  const nom = data.nom.trim();
  const telefon = data.telefon.trim();
  const mail = data.mail.trim();
  const comentari = (data.comentari ?? "").trim();
  if (!nom && !telefon && !mail && !comentari) return;
  const cid = data.clientId && Number.isFinite(data.clientId) ? data.clientId : null;
  await sql`
    insert into public.client_contactes (client_id, nom, telefon, mail, comentari)
    values (${cid}, ${nom || null}, ${telefon || null}, ${mail || null}, ${comentari || null})
  `;
  revalidatePath("/parameters");
}

export async function setContacteClientAction(id: number, clientId: number | null) {
  await requireUser();
  const cid = clientId && Number.isFinite(clientId) ? clientId : null;
  await sql`update public.client_contactes set client_id = ${cid} where id = ${id}`;
  revalidatePath("/parameters");
}

// Tipologies ----------------------------------------------------------------

export async function createTipologiaAction(nom: string) {
  await requireUser();
  const trimmed = nom.trim();
  if (!trimmed) return;
  await sql`
    insert into public.tipologies (nom, ordre)
    values (${trimmed}, coalesce((select max(ordre) + 10 from public.tipologies), 10))
    on conflict (nom) do nothing
  `;
  revalidatePath("/parameters");
}

export async function deleteTipologiaAction(id: number) {
  await requireUser();
  await sql`delete from public.tipologies where id = ${id}`;
  revalidatePath("/parameters");
}

// Tasques (dedicació lookup) ------------------------------------------------

export async function createTascaAction(nom: string) {
  await requireUser();
  const trimmed = nom.trim();
  if (!trimmed) return;
  await sql`insert into public.tasca (nom) values (${trimmed}) on conflict (nom) do nothing`;
  revalidatePath("/parameters");
  revalidatePath("/dedicacio");
}

export async function deleteTascaAction(id: number) {
  await requireUser();
  await sql`delete from public.tasca where id = ${id}`;
  revalidatePath("/parameters");
  revalidatePath("/dedicacio");
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
  try {
    await sql`delete from public.concepte_despesa_directa where id = ${id}`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("violates foreign key")) {
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
