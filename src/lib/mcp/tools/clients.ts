import { z } from "zod";
import { sql } from "@/lib/db";
import {
  createClientFullAction,
  createContacteAction,
  createTascaAction,
  createTipologiaAction,
  setContacteClientAction,
  updateClientAction,
  updateClientContacteAction,
} from "@/app/parameters/actions";
import { CATEGORIES } from "@/lib/expedients";
import { id, registerAction, shortText, type Plan } from "../core";
import { findClient, lastInsertedId, listTasques, resolveClient, searchClients } from "../data";
import { callAction } from "../shared";
import type { ClientContacte } from "@/types/db";

async function getContacte(idv: number): Promise<(ClientContacte & { client_nom: string | null }) | null> {
  const rows = (await sql`
    select k.id, k.client_id, k.nom, k.telefon, k.mail, k.comentari, k.ordre, c.nom as client_nom
    from public.client_contactes k left join public.clients c on c.id = k.client_id where k.id = ${idv}
  `) as (ClientContacte & { client_nom: string | null })[];
  return rows[0] ?? null;
}

// Reads -----------------------------------------------------------------------

registerAction({
  kind: "read",
  name: "list_clients",
  domain: "clients",
  description: "Clients (promotors) amb nombre d'expedients; filtre per text.",
  schema: z.object({ q: shortText.optional(), limit: z.number().int().min(1).max(500).default(200) }),
  async run(a) {
    const like = a.q ? `%${a.q.trim()}%` : null;
    const rows = await sql`
      select c.id, c.nom, c.nif, c.carrer, c.ciutat, c.codi_postal,
             (select count(*) from public.expedients e where e.client_id = c.id)::int as expedients,
             (select count(*) from public.expedients e where e.client_id = c.id and e.estat = 'obert')::int as expedients_oberts
      from public.clients c
      where ${like}::text is null or c.nom ilike ${like} or coalesce(c.nif,'') ilike ${like} or coalesce(c.ciutat,'') ilike ${like}
      order by c.nom limit ${a.limit}`;
    return { count: (rows as unknown[]).length, clients: rows };
  },
});

registerAction({
  kind: "read",
  name: "get_client",
  domain: "clients",
  description: "Fitxa d'un client: dades fiscals, contactes, expedients, factures i propostes.",
  schema: z.object({ id }),
  async run(a) {
    const client = await findClient(a.id);
    if (!client) return { error: `No hi ha cap client amb id ${a.id}.` };
    const [contactes, expedients, factures, propostes] = await Promise.all([
      sql`select id, nom, telefon, mail, comentari from public.client_contactes where client_id = ${a.id} order by ordre, id`,
      sql`select id, num_expedient, projecte, estat, categoria, ciutat, pressupost::text as pressupost from public.expedients where client_id = ${a.id} order by num_expedient desc`,
      sql`select id, num, estat, to_char(data,'YYYY-MM-DD') as data, preu::text as base, pagada from public.factura where client_id = ${a.id} order by data desc nulls last, id desc`,
      sql`select id, num, to_char(data,'YYYY-MM-DD') as data, descripcio, estat from public.proposta_doc where client_id = ${a.id} order by num desc`,
    ]);
    return { client, contactes, expedients, factures, propostes };
  },
});

registerAction({
  kind: "read",
  name: "list_contactes",
  domain: "clients",
  description: "Agenda de contactes (persones) amb telèfon i correu; filtre per text o client.",
  schema: z.object({ q: shortText.optional(), client_id: id.optional(), limit: z.number().int().min(1).max(500).default(200) }),
  async run(a) {
    const like = a.q ? `%${a.q.trim()}%` : null;
    const rows = await sql`
      select k.id, k.nom, k.telefon, k.mail, k.comentari, k.client_id, c.nom as client_nom
      from public.client_contactes k left join public.clients c on c.id = k.client_id
      where (${like}::text is null or coalesce(k.nom,'') ilike ${like} or coalesce(k.mail,'') ilike ${like}
             or coalesce(k.telefon,'') ilike ${like} or coalesce(c.nom,'') ilike ${like} or coalesce(k.comentari,'') ilike ${like})
        and (${a.client_id ?? null}::bigint is null or k.client_id = ${a.client_id ?? null})
      order by c.nom nulls last, k.ordre, k.id limit ${a.limit}`;
    return { count: (rows as unknown[]).length, contactes: rows };
  },
});

registerAction({
  kind: "read",
  name: "catalegs",
  domain: "clients",
  description: "Catàlegs: categories, tipologies, tasques de dedicació, tipus de fita, conceptes d'honoraris i tarifa ITE.",
  schema: z.object({}),
  async run() {
    const [tipologies, tasques, fitaTipus, directa, altra, ite] = await Promise.all([
      sql`select id, nom from public.tipologies order by ordre, nom`,
      listTasques(),
      sql`select id, nom, forma, color from public.fita_tipus order by nom`,
      sql`select id, nom, preu_hora_default::text as preu_hora, actiu from public.concepte_despesa_directa order by ordre, nom`,
      sql`select id, nom, preu_unitat_default::text as preu_unitat, actiu from public.concepte_altra_despesa order by ordre, nom`,
      sql`select preu_1::text as preu_1, preu_2::text as preu_2, preu_3::text as preu_3, increment::text as increment from public.ite_tarifa where id = 1`,
    ]);
    return {
      categories: CATEGORIES.map((c) => ({ code: c.code, label: c.label })),
      tipus_expedient: ["privat", "public"],
      estats_expedient: ["obert", "tancat"],
      tipologies,
      tasques,
      fita_tipus: fitaTipus,
      conceptes_despesa_directa: directa,
      conceptes_altra_despesa: altra,
      ite_tarifa: (ite as unknown[])[0] ?? null,
    };
  },
});

// Changes ---------------------------------------------------------------------

const clientFields = z.object({
  nom: shortText.optional(),
  nif: shortText.nullable().optional(),
  carrer: shortText.nullable().optional(),
  ciutat: shortText.nullable().optional(),
  codi_postal: shortText.nullable().optional(),
});

registerAction({
  kind: "change",
  name: "create_client",
  domain: "clients",
  description: "Crea un client (promotor) amb nom i, opcionalment, NIF i adreça.",
  schema: clientFields.extend({ nom: shortText.min(1) }),
  async plan(a): Promise<Plan> {
    const warnings: string[] = [];
    const dupes = await searchClients(a.nom, 5);
    const same = dupes.filter((c) => c.nom.toLowerCase() === a.nom.trim().toLowerCase());
    if (same.length) warnings.push(`Ja hi ha un client amb aquest nom (id ${same.map((c) => c.id).join(", ")}). Potser cal update_client en lloc de crear-ne un.`);
    return { summary: `Crear el client «${a.nom.trim()}»${a.nif ? ` (${a.nif})` : ""}.`, details: a, warnings };
  },
  async commit(a) {
    await callAction(() => createClientFullAction({ nom: a.nom, nif: a.nif ?? "", carrer: a.carrer ?? "", ciutat: a.ciutat ?? "", codi_postal: a.codi_postal ?? "" }));
    const newId = await lastInsertedId("clients");
    return { id: newId, nom: a.nom.trim() };
  },
});

registerAction({
  kind: "change",
  name: "update_client",
  domain: "clients",
  description: "Modifica les dades d'un client. Només canvia els camps indicats; null buida un camp.",
  schema: clientFields.extend({ id }),
  async plan(a): Promise<Plan> {
    const c = await findClient(a.id);
    if (!c) return { summary: "Modificar client", errors: [`No hi ha cap client amb id ${a.id}.`] };
    const { id: _id, ...patch } = a;
    void _id;
    const changes = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const errors: string[] = [];
    if (Object.keys(changes).length === 0) errors.push("No s'ha indicat cap canvi.");
    if (patch.nom !== undefined && !patch.nom.trim()) errors.push("El nom no pot quedar buit.");
    return { summary: `Modificar el client «${c.nom}»: ${Object.keys(changes).join(", ")}.`, details: { abans: c, despres: changes }, errors };
  },
  async commit(a) {
    const c = await findClient(a.id);
    if (!c) throw new Error("Client no trobat.");
    const v = (k: "nif" | "carrer" | "ciutat" | "codi_postal") => (a[k] === undefined ? (c[k] ?? "") : (a[k] ?? ""));
    await callAction(() => updateClientAction(a.id, { nom: a.nom ?? c.nom, nif: v("nif"), carrer: v("carrer"), ciutat: v("ciutat"), codi_postal: v("codi_postal") }));
    return await findClient(a.id);
  },
});

const contacteFields = z.object({
  nom: shortText.nullable().optional(),
  telefon: shortText.nullable().optional(),
  mail: shortText.nullable().optional(),
  comentari: shortText.nullable().optional(),
  client_id: id.nullable().optional().describe("Client al qual pertany; null si és un contacte solt"),
});

registerAction({
  kind: "change",
  name: "create_contacte",
  domain: "clients",
  description: "Afegeix una persona de contacte (telèfon, correu), opcionalment lligada a un client.",
  schema: contacteFields,
  async plan(a): Promise<Plan> {
    const errors: string[] = [];
    if (!a.nom?.trim() && !a.telefon?.trim() && !a.mail?.trim()) errors.push("Cal almenys nom, telèfon o correu.");
    const r = await resolveClient(a.client_id);
    if (r.error) errors.push(r.error);
    return { summary: `Crear el contacte «${a.nom ?? a.mail ?? a.telefon}»${r.client ? ` del client ${r.client.nom}` : ""}.`, details: { ...a, client: r.client?.nom ?? null }, errors };
  },
  async commit(a) {
    await callAction(() => createContacteAction({ nom: a.nom ?? "", telefon: a.telefon ?? "", mail: a.mail ?? "", comentari: a.comentari ?? "", clientId: a.client_id ?? null }));
    const newId = await lastInsertedId("client_contactes");
    return newId ? await getContacte(newId) : { ok: true };
  },
});

registerAction({
  kind: "change",
  name: "update_contacte",
  domain: "clients",
  description: "Modifica un contacte (nom, telèfon, correu, comentari o client). Només canvia els camps indicats.",
  schema: contacteFields.extend({ id }),
  async plan(a): Promise<Plan> {
    const k = await getContacte(a.id);
    if (!k) return { summary: "Modificar contacte", errors: [`No hi ha cap contacte amb id ${a.id}.`] };
    const errors: string[] = [];
    const { id: _id, ...patch } = a;
    void _id;
    const changes: Record<string, unknown> = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (Object.keys(changes).length === 0) errors.push("No s'ha indicat cap canvi.");
    if (a.client_id) {
      const r = await resolveClient(a.client_id);
      if (r.error) errors.push(r.error);
      else changes.client = r.client?.nom;
    }
    return { summary: `Modificar el contacte «${k.nom ?? k.mail ?? k.id}»: ${Object.keys(changes).join(", ")}.`, details: { abans: k, despres: changes }, errors };
  },
  async commit(a) {
    const k = await getContacte(a.id);
    if (!k) throw new Error("Contacte no trobat.");
    const v = (f: "nom" | "telefon" | "mail" | "comentari") => (a[f] === undefined ? (k[f] ?? "") : (a[f] ?? ""));
    await callAction(() => updateClientContacteAction(a.id, { nom: v("nom"), telefon: v("telefon"), mail: v("mail"), comentari: v("comentari") }));
    if (a.client_id !== undefined) await callAction(() => setContacteClientAction(a.id, a.client_id ?? null));
    return await getContacte(a.id);
  },
});

registerAction({
  kind: "change",
  name: "create_tasca",
  domain: "clients",
  description: "Afegeix una tasca al catàleg de dedicació (p. ex. «Visita direcció d'obres»).",
  schema: z.object({ nom: shortText.min(1) }),
  async plan(a): Promise<Plan> {
    const all = await listTasques();
    const errors: string[] = [];
    if (all.some((t) => t.nom.toLowerCase() === a.nom.trim().toLowerCase())) errors.push("Aquesta tasca ja existeix.");
    return { summary: `Crear la tasca «${a.nom.trim()}».`, errors };
  },
  async commit(a) {
    await callAction(() => createTascaAction(a.nom));
    return { nom: a.nom.trim() };
  },
});

registerAction({
  kind: "change",
  name: "create_tipologia",
  domain: "clients",
  description: "Afegeix una tipologia d'expedient al catàleg.",
  schema: z.object({ nom: shortText.min(1) }),
  async plan(a): Promise<Plan> {
    const rows = (await sql`select id from public.tipologies where lower(nom) = lower(${a.nom.trim()})`) as { id: number }[];
    return { summary: `Crear la tipologia «${a.nom.trim()}».`, errors: rows.length ? ["Aquesta tipologia ja existeix."] : [] };
  },
  async commit(a) {
    await callAction(() => createTipologiaAction(a.nom));
    const rows = (await sql`select id, nom from public.tipologies where lower(nom) = lower(${a.nom.trim()})`) as { id: number; nom: string }[];
    return rows[0] ?? { nom: a.nom.trim() };
  },
});
