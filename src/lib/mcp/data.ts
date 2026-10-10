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

export interface ExpedientCandidate {
  id: number;
  num_expedient: string;
  projecte: string | null;
  client_nom: string | null;
  estat: string;
}

// How people refer to an expedient: "26-0120", "26-120", "26 120", "260120",
// "exp. 120", "120" (numbers are a global running counter), or part of the
// project, client or city name (accent-insensitive).
export function parseExpedientRef(raw: string): { kind: "number"; yy: string | null; n: number } | { kind: "text"; text: string } {
  const s = raw.trim().replace(/^(?:n[ºo°]\.?\s*|exp(?:edient)?\.?\s*)/i, "").trim();
  let m = /^(\d{2})\s*[-/.\s]\s*(\d{1,4})$/.exec(s);
  if (m) return { kind: "number", yy: m[1], n: parseInt(m[2], 10) };
  m = /^(\d{2})(\d{3,4})$/.exec(s);
  if (m) return { kind: "number", yy: m[1], n: parseInt(m[2], 10) };
  m = /^(\d{1,4})$/.exec(s);
  if (m) return { kind: "number", yy: null, n: parseInt(m[1], 10) };
  return { kind: "text", text: raw.trim() };
}

export async function matchExpedients(raw: string, limit = 20): Promise<ExpedientCandidate[]> {
  const ref = parseExpedientRef(raw);
  if (ref.kind === "number") {
    return (await sql.query(
      `/* match_expedients:number */
       select e.id, e.num_expedient, e.projecte, c.nom as client_nom, e.estat
       from public.expedients e left join public.clients c on c.id = e.client_id
       where nullif(substring(e.num_expedient from '-(\\d+)$'), '')::int = $1
         and ($2::text is null or split_part(e.num_expedient, '-', 1) = $2)
       order by e.num_expedient desc limit $3`,
      [ref.n, ref.yy, limit],
    )) as ExpedientCandidate[];
  }
  const words = ref.text.split(/\s+/).filter((w) => w.length >= 2).slice(0, 6);
  if (!words.length) return [];
  // Every word must appear somewhere in number, project, client or city.
  const conds = words.map((_, i) => `public.dac_fold(concat_ws(' ', e.num_expedient, e.projecte, c.nom, e.ciutat)) like '%' || public.dac_fold($${i + 1}) || '%'`);
  return (await sql.query(
    `/* match_expedients:text */
     select e.id, e.num_expedient, e.projecte, c.nom as client_nom, e.estat
     from public.expedients e left join public.clients c on c.id = e.client_id
     where ${conds.join(" and ")}
     order by (e.estat = 'obert') desc, e.num_expedient desc limit ${limit}`,
    words,
  )) as ExpedientCandidate[];
}

function candidateLine(c: ExpedientCandidate): string {
  return `${c.num_expedient} — ${c.projecte ?? "sense títol"}${c.client_nom ? ` (${c.client_nom})` : ""}${c.estat === "tancat" ? " [tancat]" : ""}`;
}

// Accepts an id, a number in any usual form, a name, or nothing. Returns an
// error string (with candidates when ambiguous) so plans and reads can report it.
export async function resolveExpedient(ref: { expedient_id?: number | null; expedient_num?: string | null }): Promise<{ expedient: ExpedientRow | null; error?: string }> {
  if (ref.expedient_id) {
    const e = await findExpedient({ id: ref.expedient_id });
    return e ? { expedient: e } : { expedient: null, error: `No hi ha cap expedient amb id ${ref.expedient_id}.` };
  }
  const raw = ref.expedient_num?.trim();
  if (!raw) return { expedient: null };
  const exact = await findExpedient({ num: raw });
  if (exact) return { expedient: exact };

  const cands = await matchExpedients(raw, 12);
  if (cands.length === 1) return { expedient: await findExpedient({ id: cands[0].id }) };
  if (cands.length === 0) {
    return { expedient: null, error: `No s'ha trobat cap expedient per «${raw}». Prova amb cerca o list_expedients amb q.` };
  }
  return {
    expedient: null,
    error: `«${raw}» coincideix amb ${cands.length}${cands.length === 12 ? " o més" : ""} expedients. Pregunta a l'usuari quin és, o fes servir expedient_id: ${cands.map(candidateLine).join("; ")}`,
  };
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
