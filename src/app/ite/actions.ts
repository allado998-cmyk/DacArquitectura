"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { deleteFolder, deleteStored, iteMediaRef } from "@/lib/fitxers";
import { pathnameOfRef } from "@/lib/fitxers-shared";
import { CATASTRO_URL, parseCadastre, type CadastreDades } from "@/lib/ite/cadastre";
import { cleanImported } from "@/lib/ite/model";
import { loadCataleg, newDocFor, rowColumns, saveCatalegOf } from "@/lib/ite/server";
import { isObj, type IteObj } from "@/lib/ite/xml";

const MAX_DOC_CHARS = 900_000; // under the 1 MB server-action body limit

function checkDoc(doc: unknown): IteObj {
  if (!isObj(doc)) throw new Error("Informe invàlid.");
  if (JSON.stringify(doc).length > MAX_DOC_CHARS) throw new Error("L'informe és massa gran per desar-lo.");
  return doc as IteObj;
}

async function insertIte(doc: IteObj, expedientId: number | null, clientId: number | null): Promise<number> {
  const cataleg = await loadCataleg();
  const cols = rowColumns(doc, cataleg);
  const rows = (await sql`
    insert into public.ite_informe (expedient_id, client_id, nom, adreca, data_inspeccio, dades)
    values (${expedientId}, ${clientId}, ${cols.nom}, ${cols.adreca}, ${cols.data_inspeccio}::date, ${JSON.stringify(doc)}::jsonb)
    returning id
  `) as { id: number }[];
  const id = rows[0]?.id;
  if (!id) throw new Error("No s'ha pogut crear l'informe.");
  revalidatePath("/ite");
  return id;
}

// «Nou informe»: the office's technician, owner and address pre-filled.
export async function createIteAction(input: { expedientId: number | null; clientId: number | null; contacteId?: number | null }): Promise<void> {
  await requireUser();
  const cataleg = await loadCataleg();
  const { doc, expedientId, clientId } = await newDocFor({ expedientId: input.expedientId ?? null, clientId: input.clientId ?? null, contacteId: input.contacteId ?? null }, cataleg);
  const id = await insertIte(doc, expedientId, clientId);
  redirect(`/ite/${id}`);
}

// A report already built (the plugin, or a copy). Returns its id.
export async function createIteFromDocAction(doc: IteObj, expedientId: number | null, clientId: number | null): Promise<number> {
  await requireUser();
  return insertIte(checkDoc(doc), expedientId, clientId);
}

// A report read from the portal's export. Photos are uploaded afterwards by
// the browser (they need the new id), then saved with saveIteAction.
export async function importIteAction(doc: IteObj): Promise<{ id: number; catalegNous: number }> {
  await requireUser();
  const clean = cleanImported(checkDoc(doc));
  const before = (await sql`select count(*)::int as n from public.ite_cataleg`) as { n: number }[];
  await saveCatalegOf(clean);
  const after = (await sql`select count(*)::int as n from public.ite_cataleg`) as { n: number }[];
  const id = await insertIte(clean, null, null);
  return { id, catalegNous: (after[0]?.n ?? 0) - (before[0]?.n ?? 0) };
}

export async function saveIteAction(id: number, doc: IteObj): Promise<{ updated_at: string }> {
  await requireUser();
  if (!Number.isInteger(id) || id <= 0) throw new Error("Identificador invàlid.");
  const clean = checkDoc(doc);
  const cataleg = await loadCataleg();
  const cols = rowColumns(clean, cataleg);
  const rows = (await sql`
    update public.ite_informe set
      dades = ${JSON.stringify(clean)}::jsonb,
      nom = ${cols.nom},
      adreca = ${cols.adreca},
      data_inspeccio = ${cols.data_inspeccio}::date,
      updated_at = now()
    where id = ${id}
    returning to_char(updated_at, 'YYYY-MM-DD HH24:MI') as updated_at
  `) as { updated_at: string }[];
  if (!rows[0]) throw new Error("Informe no trobat.");
  revalidatePath("/ite");
  return rows[0];
}

export async function setIteLinksAction(id: number, expedientId: number | null, clientId: number | null): Promise<void> {
  await requireUser();
  if (!Number.isInteger(id)) return;
  await sql`update public.ite_informe set expedient_id = ${expedientId}, client_id = ${clientId}, updated_at = now() where id = ${id}`;
  revalidatePath("/ite");
}

// A photo or PDF the browser uploaded to the store (or a data URI from the
// plugin): checked to be this report's, and returned as the ref to keep.
export async function addIteFitxerAction(id: number, src: string, name: string): Promise<string | null> {
  await requireUser();
  if (!Number.isInteger(id) || id <= 0 || !src) return null;
  return iteMediaRef(id, src, name);
}

// Files the report no longer uses. Only this report's folder.
export async function removeIteFitxersAction(id: number, refs: string[]): Promise<void> {
  await requireUser();
  if (!Number.isInteger(id)) return;
  const own = refs.filter((r) => {
    const p = pathnameOfRef(r);
    return !!p && /^(dac|demo)\/ite\/(\d+)\//.exec(p)?.[2] === String(id);
  });
  await deleteStored(own);
}

export async function deleteIteAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await sql`delete from public.ite_informe where id = ${id}`;
  await deleteFolder(`ite/${id}`);
  revalidatePath("/ite");
  redirect("/ite");
}

// «Obtenir dades del Cadastre». The Catastro's public service, no key.
export async function consultaCadastreAction(finca: string, full: string): Promise<{ ok: true; dades: CadastreDades } | { ok: false; error: string }> {
  await requireUser();
  const rc = `${finca}${full}`.toUpperCase().replace(/\s+/g, "");
  if (!/^[0-9A-Z]{14}$/.test(rc)) return { ok: false, error: "La referència cadastral ha de tenir 14 caràcters (7 de finca i 7 de full)." };
  try {
    const res = await fetch(`${CATASTRO_URL}?RefCat=${rc}`, { signal: AbortSignal.timeout(15000), cache: "no-store" });
    if (!res.ok) return { ok: false, error: `El Cadastre no respon (${res.status}). Torna-ho a provar.` };
    return { ok: true, dades: parseCadastre(await res.json()) };
  } catch (e) {
    return { ok: false, error: e instanceof Error && !/abort|fetch/i.test(e.message) ? e.message : "No s'ha pogut consultar el Cadastre." };
  }
}
