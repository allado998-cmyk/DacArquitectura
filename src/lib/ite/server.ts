// Server side of the ITE module: reads that the web actions and the plugin share.
import { sql } from "@/lib/db";
import { harvestCataleg, type CatEntry, type Cataleg } from "./cataleg";
import { buildCatalegComplet } from "./cataleg-portal";
import { adrecaEdificiFrom, nomInforme, parseAdreca, propietatFromClient, tecnicDespatx, type ClientDades, type ContacteDades } from "./defaults";
import { iteResum, newIteDoc } from "./model";
import type { IteObj } from "./xml";

export interface IteRow {
  id: number;
  expedient_id: number | null;
  client_id: number | null;
  nom: string;
  adreca: string | null;
  data_inspeccio: string | null;
  dades: IteObj;
  exportat_at: string | null;
  updated_at: string;
  // A hash of the report: an editor saves only over the version it loaded.
  versio: string;
}

export async function loadCataleg(): Promise<Cataleg> {
  const rows = (await sql`select cat, entrada from public.ite_cataleg`) as { cat: string; entrada: IteObj }[];
  return buildCatalegComplet(rows.map((r) => ({ cat: r.cat, obj: r.entrada })));
}

// Learns the code-list values of an imported report.
export async function saveCatalegOf(doc: IteObj): Promise<number> {
  const found: CatEntry[] = harvestCataleg(doc);
  if (!found.length) return 0;
  const cats = found.map((e) => e.cat);
  const ids = found.map((e) => String(e.obj.id));
  const objs = found.map((e) => JSON.stringify(e.obj));
  await sql`
    insert into public.ite_cataleg (cat, id, entrada)
    select * from unnest(${cats}::text[], ${ids}::text[], ${objs}::jsonb[])
    on conflict (cat, id) do update set entrada = excluded.entrada
  `;
  return found.length;
}

export async function loadIte(id: number): Promise<IteRow | null> {
  const rows = (await sql`
    select id, expedient_id, client_id, nom, adreca, to_char(data_inspeccio, 'YYYY-MM-DD') as data_inspeccio,
           dades, to_char(exportat_at, 'YYYY-MM-DD HH24:MI') as exportat_at, to_char(updated_at, 'YYYY-MM-DD HH24:MI') as updated_at,
           md5(dades::text) as versio
    from public.ite_informe where id = ${id}
  `) as IteRow[];
  return rows[0] ?? null;
}

// The list/link columns, copied from the report.
export function rowColumns(doc: IteObj, cataleg: Cataleg): { nom: string; adreca: string | null; data_inspeccio: string | null } {
  const r = iteResum(doc, cataleg);
  return { nom: r.nom, adreca: r.adreca || null, data_inspeccio: r.data_inspeccio };
}

export async function clientDades(clientId: number): Promise<ClientDades | null> {
  const rows = (await sql`select nom, nif, carrer, ciutat, codi_postal from public.clients where id = ${clientId}`) as ClientDades[];
  return rows[0] ?? null;
}

export async function contacteDades(clientId: number | null, contacteId: number | null): Promise<ContacteDades | null> {
  if (contacteId) {
    const rows = (await sql`select telefon, mail from public.client_contactes where id = ${contacteId}`) as ContacteDades[];
    return rows[0] ?? null;
  }
  if (!clientId) return null;
  const rows = (await sql`
    select telefon, mail from public.client_contactes
    where client_id = ${clientId} and (coalesce(telefon, '') <> '' or coalesce(mail, '') <> '')
    order by ordre, id limit 1
  `) as ContacteDades[];
  return rows[0] ?? null;
}

// A new report: the office's technician, the owner from the client (or the
// expedient's client) and the building address from the expedient.
export async function newDocFor(
  opts: { expedientId: number | null; clientId: number | null; contacteId?: number | null },
  cataleg: Cataleg,
): Promise<{ doc: IteObj; expedientId: number | null; clientId: number | null }> {
  let clientId = opts.clientId;
  let adreca: IteObj | undefined;
  let nom: string | undefined;
  if (opts.expedientId) {
    const rows = (await sql`select adreca, ciutat, client_id from public.expedients where id = ${opts.expedientId}`) as {
      adreca: string | null;
      ciutat: string | null;
      client_id: number | null;
    }[];
    const e = rows[0];
    if (e) {
      clientId = clientId ?? e.client_id;
      if (e.adreca?.trim()) {
        const client = clientId ? await clientDades(clientId) : null;
        // The client's postcode only helps when the client is the building itself (a community).
        const sameStreet = client?.carrer && parseAdreca(client.carrer).nom.toLowerCase() === parseAdreca(e.adreca).nom.toLowerCase();
        adreca = adrecaEdificiFrom(e.adreca, e.ciutat ?? "", sameStreet ? client?.codi_postal ?? "" : "", cataleg);
        const a = parseAdreca(e.adreca);
        nom = nomInforme(a.word, a.nom, a.numero, e.ciutat ?? "");
      }
    }
  }
  let propietat: IteObj | undefined;
  if (clientId) {
    const c = await clientDades(clientId);
    if (c) propietat = propietatFromClient(c, await contacteDades(clientId, opts.contacteId ?? null), cataleg);
  }
  const doc = newIteDoc({ nom, tecnic: tecnicDespatx(cataleg), propietat, adreca });
  return { doc, expedientId: opts.expedientId, clientId };
}
