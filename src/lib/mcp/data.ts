// Shared reads for the plugin's actions. All go through the `sql` proxy, so
// the demo account reads the demo database exactly like the website does.
import { sql } from "@/lib/db";
import type { Client, Expedient, Tipologia } from "@/types/db";

export type ExpedientRow = Expedient;

const EXPEDIENT_COLS = `
  e.id, e.num_expedient, e.projecte, e.client_id, c.nom as client_nom,
  e.ciutat, e.estat, e.categoria, e.tipologia_id, t.nom as tipologia_nom,
  e.tipus, e.direccio_obres, e.web,
  e.pressupost::text as pressupost, e.pressupost_origen, e.calcul_id, e.proposta_doc_id,
  to_char(e.data_inici, 'YYYY-MM-DD') as data_inici,
  to_char(e.data_final, 'YYYY-MM-DD') as data_final,
  to_char(e.data_tancament, 'YYYY-MM-DD') as data_tancament,
  e.created_at, e.updated_at`;

export async function findExpedient(ref: { id?: number | null; num?: string | null }): Promise<ExpedientRow | null> {
  if (ref.id) {
    const rows = (await sql.query(
      `select ${EXPEDIENT_COLS} from public.expedients e
       left join public.clients c on c.id = e.client_id
       left join public.tipologies t on t.id = e.tipologia_id
       where e.id = $1`,
      [ref.id],
    )) as ExpedientRow[];
    return rows[0] ?? null;
  }
  const num = ref.num?.trim();
  if (num) {
    const rows = (await sql.query(
      `select ${EXPEDIENT_COLS} from public.expedients e
       left join public.clients c on c.id = e.client_id
       left join public.tipologies t on t.id = e.tipologia_id
       where e.num_expedient = $1 order by e.id desc limit 1`,
      [num],
    )) as ExpedientRow[];
    return rows[0] ?? null;
  }
  return null;
}

// Accepts an id, a number ("26-0012") or nothing. Returns an error string when
// the reference cannot be resolved so plans can report it.
export async function resolveExpedient(ref: { expedient_id?: number | null; expedient_num?: string | null }): Promise<{ expedient: ExpedientRow | null; error?: string }> {
  if (!ref.expedient_id && !ref.expedient_num) return { expedient: null };
  const e = await findExpedient({ id: ref.expedient_id ?? null, num: ref.expedient_num ?? null });
  if (!e) return { expedient: null, error: `No s'ha trobat cap expedient amb ${ref.expedient_id ? `id ${ref.expedient_id}` : `número ${ref.expedient_num}`}.` };
  return { expedient: e };
}

export function expedientLabel(e: Pick<ExpedientRow, "num_expedient" | "projecte"> | null | undefined): string {
  if (!e) return "—";
  return `${e.num_expedient} — ${e.projecte ?? "sense títol"}`;
}

export async function listExpedientOptions(): Promise<{ id: number; num_expedient: string; projecte: string | null; estat: string }[]> {
  return (await sql`select id, num_expedient, projecte, estat from public.expedients order by num_expedient desc`) as {
    id: number;
    num_expedient: string;
    projecte: string | null;
    estat: string;
  }[];
}

export async function findClient(id: number | null | undefined): Promise<Client | null> {
  if (!id) return null;
  const rows = (await sql`
    select id, nom, nif, carrer, ciutat, codi_postal, contacte, created_at from public.clients where id = ${id}
  `) as Client[];
  return rows[0] ?? null;
}

export async function resolveClient(id: number | null | undefined): Promise<{ client: Client | null; error?: string }> {
  if (!id) return { client: null };
  const client = await findClient(id);
  return client ? { client } : { client: null, error: `No s'ha trobat cap client amb id ${id}.` };
}

export async function searchClients(q: string, limit = 20): Promise<Client[]> {
  const like = `%${q.trim()}%`;
  return (await sql`
    select id, nom, nif, carrer, ciutat, codi_postal, contacte, created_at
    from public.clients
    where nom ilike ${like} or coalesce(nif,'') ilike ${like} or coalesce(ciutat,'') ilike ${like}
    order by nom limit ${limit}
  `) as Client[];
}

export async function findTipologia(id: number | null | undefined): Promise<Tipologia | null> {
  if (!id) return null;
  const rows = (await sql`select id, nom, ordre, created_at from public.tipologies where id = ${id}`) as Tipologia[];
  return rows[0] ?? null;
}

export async function lastInsertedId(table: string): Promise<number | null> {
  // Tables are tiny and the app is single-user; the newest row is the one we
  // just created through the website's own action.
  const rows = (await sql.query(`select max(id)::int as id from public.${table}`)) as { id: number | null }[];
  return rows[0]?.id ?? null;
}

export interface TascaRow {
  id: number;
  nom: string;
}

export async function listTasques(): Promise<TascaRow[]> {
  return (await sql`select id, nom from public.tasca order by nom`) as TascaRow[];
}
