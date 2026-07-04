"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import type { ActaAssistent, ActaTema } from "@/types/db";

async function nextActaNum(): Promise<string> {
  const rows = (await sql`select num from public.acta where num like 'ACT-%'`) as { num: string }[];
  let max = 0;
  for (const r of rows) {
    const m = /-(\d+)$/.exec(r.num ?? "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `ACT-${String(max + 1).padStart(3, "0")}`;
}

const DEFAULT_ASSISTENTS: ActaAssistent[] = [
  { present: true, nom: "David Lladó (DL)", empresa: "DO" },
  { present: true, nom: "Joan March (JM)", empresa: "DE i CSiS" },
];
const DEFAULT_TEMES: ActaTema[] = [
  { titol: "PENDENTS", text: "", responsable: "" },
  { titol: "EXECUTAT", text: "", responsable: "" },
  { titol: "ACTUAL", text: "", responsable: "" },
];

async function insertActa(tipus: "visita" | "reunio", expedientId: number | null, dedicacioId: number | null): Promise<number> {
  const num = await nextActaNum();
  let projecte: string | null = null, referencia: string | null = null, ubicacio: string | null = null, client: string | null = null;
  if (expedientId) {
    const rows = (await sql`
      select e.projecte, e.num_expedient, e.ciutat as exp_ciutat,
             c.nom as client_nom, c.carrer, c.codi_postal, c.ciutat as client_ciutat
      from public.expedients e left join public.clients c on c.id = e.client_id
      where e.id = ${expedientId}
    `) as { projecte: string | null; num_expedient: string; exp_ciutat: string | null; client_nom: string | null; carrer: string | null; codi_postal: string | null; client_ciutat: string | null }[];
    const r = rows[0];
    if (r) {
      projecte = r.projecte;
      referencia = r.num_expedient;
      client = r.client_nom;
      ubicacio = [r.carrer, [r.codi_postal, r.client_ciutat].filter(Boolean).join(" ")].filter(Boolean).join(", ") || r.exp_ciutat;
    }
  }
  const rows = (await sql`
    insert into public.acta
      (num, tipus, expedient_id, dedicacio_id, acta_num, data, hora, lloc, projecte, referencia, ubicacio, client,
       assistents, temes, propera_visita, sig_do, sig_de)
    values (
      ${num}, ${tipus}, ${expedientId}, ${dedicacioId}, '00', current_date, '', ${tipus === "visita" ? "Obra" : "Oficina"},
      ${projecte}, ${referencia}, ${ubicacio}, ${client},
      ${JSON.stringify(DEFAULT_ASSISTENTS)}::jsonb, ${JSON.stringify(DEFAULT_TEMES)}::jsonb, 'A concretar',
      'David Lladó Porta, Arquitecte', 'Joan March Raurell, Arquitecte Tècnic'
    )
    returning id
  `) as { id: number }[];
  return rows[0]?.id ?? 0;
}

export async function createActaAction(tipus: "visita" | "reunio", expedientId: number | null): Promise<void> {
  await requireUser();
  const id = await insertActa(tipus, expedientId ?? null, null);
  if (!id) throw new Error("No s'ha pogut crear l'acta.");
  redirect(`/actes/${id}`);
}

export async function createActaFromDedicacioAction(dedicacioId: number): Promise<void> {
  await requireUser();
  const rows = (await sql`select expedient_id, tasca from public.dedicacions where id = ${dedicacioId}`) as { expedient_id: number | null; tasca: string | null }[];
  const d = rows[0];
  const tipus: "visita" | "reunio" = (d?.tasca ?? "").toLowerCase().includes("visita") ? "visita" : "reunio";
  const id = await insertActa(tipus, d?.expedient_id ?? null, dedicacioId);
  if (!id) throw new Error("No s'ha pogut crear l'acta.");
  redirect(`/actes/${id}`);
}

export interface ActaPatch {
  tipus?: string;
  expedient_id?: number | null;
  acta_num?: string;
  data?: string;
  hora?: string;
  lloc?: string;
  projecte?: string;
  referencia?: string;
  ubicacio?: string;
  client?: string;
  assistents?: ActaAssistent[];
  temes?: ActaTema[];
  propera_visita?: string;
  sig_do?: string;
  sig_de?: string;
  sig_adj_empresa?: string;
  sig_adj_persona?: string;
  sig_prom_empresa?: string;
  sig_prom_persona?: string;
}

export async function updateActaAction(id: number, p: ActaPatch) {
  await requireUser();
  if (!Number.isFinite(id)) return;
  const tipus = p.tipus === "reunio" ? "reunio" : p.tipus === "visita" ? "visita" : null;
  await sql`
    update public.acta set
      tipus = coalesce(${tipus}, tipus),
      expedient_id = ${p.expedient_id === undefined ? null : p.expedient_id},
      acta_num = ${p.acta_num ?? null},
      data = coalesce(${p.data ?? null}::date, data),
      hora = ${p.hora ?? null},
      lloc = ${p.lloc ?? null},
      projecte = ${p.projecte ?? null},
      referencia = ${p.referencia ?? null},
      ubicacio = ${p.ubicacio ?? null},
      client = ${p.client ?? null},
      assistents = coalesce(${p.assistents ? JSON.stringify(p.assistents) : null}::jsonb, assistents),
      temes = coalesce(${p.temes ? JSON.stringify(p.temes) : null}::jsonb, temes),
      propera_visita = ${p.propera_visita ?? null},
      sig_do = ${p.sig_do ?? null},
      sig_de = ${p.sig_de ?? null},
      sig_adj_empresa = ${p.sig_adj_empresa ?? null},
      sig_adj_persona = ${p.sig_adj_persona ?? null},
      sig_prom_empresa = ${p.sig_prom_empresa ?? null},
      sig_prom_persona = ${p.sig_prom_persona ?? null},
      updated_at = now()
    where id = ${id}
  `;
  revalidatePath(`/actes/${id}`);
  revalidatePath("/actes");
}

export async function deleteActaAction(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  await sql`delete from public.acta where id = ${id}`;
  redirect("/actes");
}
