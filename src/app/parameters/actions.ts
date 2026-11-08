"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import type { TarifaCertificat } from "@/types/db";

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

// Create a client with every field filled in (from the form popup), plus the
// contacts typed in the same form, kept in that order. Blank contacts are skipped.
export async function createClientFullAction(data: ClientPatch, contactes: ContactePatch[] = []) {
  await requireUser();
  const nom = data.nom.trim();
  if (!nom) return;
  const rows = (await sql`
    insert into public.clients (nom, nif, carrer, ciutat, codi_postal)
    values (
      ${nom},
      ${data.nif.trim() || null},
      ${data.carrer.trim() || null},
      ${data.ciutat.trim() || null},
      ${data.codi_postal.trim() || null}
    )
    returning id
  `) as { id: number }[];
  const clientId = rows[0]?.id;
  const values = (Array.isArray(contactes) ? contactes : []).map(contacteValues).filter((v): v is NonNullable<typeof v> => v !== null);
  for (const [i, k] of values.entries()) {
    await sql`
      insert into public.client_contactes (client_id, nom, telefon, mail, telefons_extra, mails_extra, comentari, professio, ordre)
      values (${clientId}, ${k.nom}, ${k.telefon.main}, ${k.mail.main}, ${k.telefon.extras}::text[], ${k.mail.extras}::text[], ${k.comentari}, ${k.professio}, ${(i + 1) * 10})
    `;
  }
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

export interface ContactePatch {
  nom: string;
  telefon: string;
  mail: string;
  telefonsExtra: string[];
  mailsExtra: string[];
  comentari?: string;
  professio?: string; // left out = keep what is stored
}

// Trims, drops blanks and repeats. If the main value is blank, the next one
// becomes the main one, so the tables never show "—" for a contact that has one.
function mainAndExtras(main: string, extras: string[]) {
  const [first = null, ...rest] = [...new Set([main, ...extras].map((v) => v.trim()).filter(Boolean))];
  return { main: first, extras: rest };
}

// A new contact's columns, cleaned up; null when every field is blank.
function contacteValues(data: ContactePatch) {
  const nom = data.nom.trim();
  const telefon = mainAndExtras(data.telefon, data.telefonsExtra);
  const mail = mainAndExtras(data.mail, data.mailsExtra);
  const comentari = (data.comentari ?? "").trim();
  const professio = (data.professio ?? "").trim();
  if (!nom && !telefon.main && !mail.main && !comentari && !professio) return null;
  return { nom: nom || null, telefon, mail, comentari: comentari || null, professio: professio || null };
}

export async function updateClientContacteAction(id: number, data: ContactePatch) {
  await requireUser();
  const telefon = mainAndExtras(data.telefon, data.telefonsExtra);
  const mail = mainAndExtras(data.mail, data.mailsExtra);
  await sql`
    update public.client_contactes set
      nom = ${data.nom.trim() || null},
      telefon = ${telefon.main},
      mail = ${mail.main},
      telefons_extra = ${telefon.extras}::text[],
      mails_extra = ${mail.extras}::text[],
      comentari = ${(data.comentari ?? "").trim() || null},
      professio = case when ${data.professio === undefined}::boolean then professio else ${(data.professio ?? "").trim() || null} end
    where id = ${id}
  `;
  revalidatePath("/parameters");
}

export async function deleteClientContacteAction(id: number) {
  await requireUser();
  await sql`delete from public.client_contactes where id = ${id}`;
  revalidatePath("/parameters");
}

// Saves the order of a client's contacts (ids in the new order).
export async function reorderClientContactesAction(clientId: number, ids: number[]) {
  await requireUser();
  if (!Number.isFinite(clientId) || !Array.isArray(ids)) return;
  for (let i = 0; i < ids.length; i++) {
    if (!Number.isFinite(ids[i])) continue;
    await sql`update public.client_contactes set ordre = ${(i + 1) * 10} where id = ${ids[i]} and client_id = ${clientId}`;
  }
  revalidatePath("/parameters");
}

// Standalone contact (no client required).
export async function createContacteAction(data: ContactePatch & { clientId?: number | null }) {
  await requireUser();
  const k = contacteValues(data);
  if (!k) return;
  const cid = data.clientId && Number.isFinite(data.clientId) ? data.clientId : null;
  await sql`
    insert into public.client_contactes (client_id, nom, telefon, mail, telefons_extra, mails_extra, comentari, professio, ordre)
    values (
      ${cid}, ${k.nom}, ${k.telefon.main}, ${k.mail.main}, ${k.telefon.extras}::text[], ${k.mail.extras}::text[], ${k.comentari}, ${k.professio},
      coalesce((select max(ordre) + 10 from public.client_contactes where client_id = ${cid}), 10)
    )
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

export async function updateTascaAction(id: number, nom: string) {
  await requireUser();
  const trimmed = nom.trim();
  if (!trimmed) return;
  try {
    await sql`update public.tasca set nom = ${trimmed} where id = ${id}`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/duplicate|unique/i.test(msg)) throw e; // ignore rename to an existing name
  }
  revalidatePath("/parameters");
  revalidatePath("/dedicacio");
}

export async function deleteTascaAction(id: number) {
  await requireUser();
  await sql`delete from public.tasca where id = ${id}`;
  revalidatePath("/parameters");
  revalidatePath("/dedicacio");
}

// ITE tariff (price tiers) --------------------------------------------------

export async function updateIteTarifaAction(patch: { preu_1?: number; preu_2?: number; preu_3?: number; increment?: number; any?: number }) {
  await requireUser();
  await sql`
    insert into public.ite_tarifa (id) values (1) on conflict (id) do nothing
  `;
  const num = (v: number | undefined) => (v === undefined ? null : v);
  await sql`
    update public.ite_tarifa set
      preu_1 = coalesce(${num(patch.preu_1)}::numeric, preu_1),
      preu_2 = coalesce(${num(patch.preu_2)}::numeric, preu_2),
      preu_3 = coalesce(${num(patch.preu_3)}::numeric, preu_3),
      increment = coalesce(${num(patch.increment)}::numeric, increment),
      any_tarifa = coalesce(${anyTarifa(patch.any)}::int, any_tarifa),
      updated_at = now()
    where id = 1
  `;
  revalidatePath("/parameters");
  revalidatePath("/honoraris");
}

// Tarifes mínimes: benzina, hora, certificats CHB / CEE / CCA -----------------
// Inputs only (public.tarifa_minima, id = 1); results come from @/lib/tarifes.
// A value left out, or not a valid one, keeps what is stored.

const anyTarifa = (v: number | undefined) => (Number.isInteger(v) && v! >= 1900 && v! <= 2200 ? v! : null);
const positiu = (v: number | undefined) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

async function ensureTarifaMinima() {
  await sql`insert into public.tarifa_minima (id) values (1) on conflict (id) do nothing`;
}

export async function updateTarifaBenzinaAction(patch: { any?: number; preu_litre?: number; consum_100km?: number; desgast_km?: number }) {
  await requireUser();
  await ensureTarifaMinima();
  await sql`
    update public.tarifa_minima set
      benzina_any = coalesce(${anyTarifa(patch.any)}::int, benzina_any),
      preu_litre = coalesce(${positiu(patch.preu_litre)}::numeric, preu_litre),
      consum_100km = coalesce(${positiu(patch.consum_100km)}::numeric, consum_100km),
      desgast_km = coalesce(${positiu(patch.desgast_km)}::numeric, desgast_km),
      updated_at = now()
    where id = 1
  `;
  revalidatePath("/parameters");
}

export async function updateTarifaHoraAction(patch: { any?: number; sou?: number; lloguer?: number; lloguer_iva?: number; dies_mes?: number; hores_dia?: number }) {
  await requireUser();
  await ensureTarifaMinima();
  await sql`
    update public.tarifa_minima set
      hora_any = coalesce(${anyTarifa(patch.any)}::int, hora_any),
      sou = coalesce(${positiu(patch.sou)}::numeric, sou),
      lloguer = coalesce(${positiu(patch.lloguer)}::numeric, lloguer),
      lloguer_iva = coalesce(${positiu(patch.lloguer_iva)}::numeric, lloguer_iva),
      dies_mes = coalesce(${positiu(patch.dies_mes)}::numeric, dies_mes),
      hores_dia = coalesce(${positiu(patch.hores_dia)}::numeric, hores_dia),
      updated_at = now()
    where id = 1
  `;
  revalidatePath("/parameters");
}

export interface TarifaCertificatPatch {
  id: number | null; // null = a new line
  grup: "individual" | "composta";
  concepte: string;
  preu: number;
  dificultat: boolean;
}

// Saves «Tarifes CHB, CEE i CCA» as a whole: the year, the (*) percentages and
// every line, in the order given. Lines left out are deleted, lines without an
// id are added. Returns the stored lines, so the page picks up the new ids.
export async function saveTarifesCertificatsAction(data: {
  any?: number;
  dificultat_min?: number;
  dificultat_max?: number;
  linies: TarifaCertificatPatch[];
}): Promise<TarifaCertificat[]> {
  await requireUser();
  const linies = (Array.isArray(data.linies) ? data.linies : [])
    .map((l) => ({
      id: Number.isInteger(l?.id) ? l.id : null,
      grup: l?.grup === "composta" ? "composta" : "individual",
      concepte: String(l?.concepte ?? "").trim(),
      preu: positiu(l?.preu) ?? 0,
      dificultat: l?.dificultat === true,
    }))
    .filter((l) => l.concepte)
    .map((l, i) => ({ ...l, ordre: (i + 1) * 10 }));
  await ensureTarifaMinima();
  await sql`
    update public.tarifa_minima set
      certificats_any = coalesce(${anyTarifa(data.any)}::int, certificats_any),
      dificultat_min = coalesce(${positiu(data.dificultat_min)}::numeric, dificultat_min),
      dificultat_max = coalesce(${positiu(data.dificultat_max)}::numeric, dificultat_max),
      updated_at = now()
    where id = 1
  `;
  // One statement, so the lines never end up half saved.
  await sql`
    with input as (
      select * from jsonb_to_recordset(${JSON.stringify(linies)}::jsonb)
        as x(id bigint, grup text, concepte text, preu numeric, dificultat boolean, ordre int)
    ), esborrades as (
      delete from public.tarifa_certificat t
      where not exists (select 1 from input i where i.id = t.id)
    ), canviades as (
      update public.tarifa_certificat t
      set grup = i.grup, concepte = i.concepte, preu = i.preu, dificultat = i.dificultat, ordre = i.ordre
      from input i where i.id = t.id
    )
    insert into public.tarifa_certificat (grup, concepte, preu, dificultat, ordre)
    select i.grup, i.concepte, i.preu, i.dificultat, i.ordre from input i
    where i.id is null or not exists (select 1 from public.tarifa_certificat t where t.id = i.id)
  `;
  revalidatePath("/parameters");
  return (await sql`
    select id, grup, concepte, preu::text as preu, dificultat from public.tarifa_certificat order by ordre, id
  `) as TarifaCertificat[];
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
