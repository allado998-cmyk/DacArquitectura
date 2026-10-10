import { z } from "zod";
import { sql } from "@/lib/db";
import {
  addLiniaAction,
  addPagamentAction,
  addServeiAction,
  createPropostaDocAction,
  deleteServeiAction,
  updateLiniaAction,
  updatePagamentAction,
  updatePropostaDocAction,
  updateServeiAction,
  type DocPatch,
} from "@/app/propostes/actions";
import { id, isoDate, money, num, registerAction, round2, shortText, type Plan } from "../core";
import { lastInsertedId, resolveClient } from "../data";
import { callAction, idFromRedirect } from "../shared";
import type { PropostaDoc } from "@/types/db";

type DocRow = PropostaDoc & { client_nom: string | null; total: string };

async function getDoc(ref: { id?: number | null; num?: string | null }): Promise<DocRow | null> {
  const where = ref.id ? "d.id = $1" : "d.num = $1";
  const param = ref.id ?? ref.num?.trim();
  if (!param) return null;
  const rows = (await sql.query(
    `select d.id, d.num, to_char(d.data,'YYYY-MM-DD') as data, d.descripcio, d.adreca, d.ciutat, d.codi_postal,
            d.client_id, c.nom as client_nom, d.calcul_id, d.estat, d.hidden_inclusions, d.hidden_exclusions,
            coalesce((select sum(preu) from public.proposta_doc_servei where doc_id = d.id),0)::text as total
     from public.proposta_doc d left join public.clients c on c.id = d.client_id
     where ${where} order by d.id desc limit 1`,
    [param],
  )) as DocRow[];
  return rows[0] ?? null;
}

function docLabel(d: DocRow): string {
  return `${d.num}${d.descripcio ? ` — ${d.descripcio}` : ""}${d.client_nom ? ` (${d.client_nom})` : ""}`;
}

// Reads -----------------------------------------------------------------------

registerAction({
  kind: "read",
  name: "list_propostes",
  domain: "propostes",
  description: "Propostes d'honoraris (document PH-YY-NNN) amb estat (pendent|acceptada|rebutjada), client i import.",
  schema: z.object({ estat: z.enum(["pendent", "acceptada", "rebutjada"]).optional(), q: shortText.optional(), limit: z.number().int().min(1).max(500).default(200) }),
  async run(a) {
    const like = a.q ? `%${a.q.trim()}%` : null;
    const rows = await sql`
      select d.id, d.num, to_char(d.data,'YYYY-MM-DD') as data, d.descripcio, d.adreca, d.ciutat, d.client_id, c.nom as client_nom, d.calcul_id, d.estat,
             coalesce((select sum(preu) from public.proposta_doc_servei where doc_id = d.id),0)::text as total
      from public.proposta_doc d left join public.clients c on c.id = d.client_id
      where (${a.estat ?? null}::text is null or d.estat = ${a.estat ?? null})
        and (${like}::text is null or d.num ilike ${like} or coalesce(d.descripcio,'') ilike ${like} or coalesce(c.nom,'') ilike ${like} or coalesce(d.adreca,'') ilike ${like})
      order by d.num desc nulls last, d.id desc limit ${a.limit}`;
    return { count: (rows as unknown[]).length, propostes: rows };
  },
});

registerAction({
  kind: "read",
  name: "get_proposta",
  domain: "propostes",
  description: "Detall d'una proposta d'honoraris: capçalera, serveis, inclusions, exclusions i pagaments.",
  schema: z.object({ id: id.optional(), num: shortText.optional() }).refine((v) => v.id || v.num, "Cal id o num"),
  async run(a) {
    const d = await getDoc({ id: a.id ?? null, num: a.num ?? null });
    if (!d) return { error: "Proposta no trobada." };
    const [serveis, inclusions, exclusions, pagaments] = await Promise.all([
      sql`select id, descripcio, preu::text as preu from public.proposta_doc_servei where doc_id = ${d.id} order by ordre, id`,
      sql`select id, text from public.proposta_doc_inclusio where doc_id = ${d.id} order by ordre, id`,
      sql`select id, text from public.proposta_doc_exclusio where doc_id = ${d.id} order by ordre, id`,
      sql`select id, descripcio, import::text as import from public.proposta_doc_pagament where doc_id = ${d.id} order by ordre, id`,
    ]);
    return { proposta: d, serveis, inclusions_propies: inclusions, exclusions_propies: exclusions, pagaments };
  },
});

// Changes ---------------------------------------------------------------------

const docFields = z.object({
  data: isoDate.optional(),
  descripcio: shortText.nullable().optional(),
  adreca: shortText.nullable().optional(),
  ciutat: shortText.nullable().optional(),
  codi_postal: shortText.nullable().optional(),
  client_id: id.nullable().optional(),
  calcul_id: id.nullable().optional().describe("Càlcul d'honoraris lligat (vegeu list_calculs)"),
  estat: z.enum(["pendent", "acceptada", "rebutjada"]).optional(),
});

async function checkRefs(a: z.infer<typeof docFields>): Promise<{ errors: string[]; resolved: Record<string, unknown> }> {
  const errors: string[] = [];
  const resolved: Record<string, unknown> = {};
  const cr = await resolveClient(a.client_id ?? undefined);
  if (cr.error) errors.push(cr.error);
  if (cr.client) resolved.client = cr.client.nom;
  if (a.calcul_id) {
    const rows = (await sql`select id, num_proposta, projecte from public.propostes where id = ${a.calcul_id}`) as { id: number; num_proposta: string; projecte: string | null }[];
    if (!rows[0]) errors.push(`No hi ha cap càlcul d'honoraris amb id ${a.calcul_id}.`);
    else resolved.calcul = `${rows[0].num_proposta} — ${rows[0].projecte ?? ""}`;
  }
  return { errors, resolved };
}

registerAction({
  kind: "change",
  name: "create_proposta",
  domain: "propostes",
  description: "Crea una proposta d'honoraris (document) amb capçalera i, opcionalment, línies de serveis.",
  notes: ["El número PH-YY-NNN s'assigna sol. Es crea una línia de pagament per defecte «En finalitzar el servei»."],
  schema: docFields.extend({ serveis: z.array(z.object({ descripcio: shortText, preu: money })).max(30).optional() }),
  async plan(a): Promise<Plan> {
    const { errors, resolved } = await checkRefs(a);
    const total = round2((a.serveis ?? []).reduce((s, x) => s + x.preu, 0));
    return { summary: `Crear la proposta «${a.descripcio ?? "sense descripció"}»${resolved.client ? ` per a ${resolved.client}` : ""}${a.serveis?.length ? ` amb ${a.serveis.length} serveis (${total} €)` : ""}.`, details: { ...a, ...resolved }, errors };
  },
  async commit(a) {
    const r = await callAction(() => createPropostaDocAction());
    const newId = idFromRedirect(r.redirectedTo) ?? (await lastInsertedId("proposta_doc"));
    if (!newId) throw new Error("No s'ha pogut crear la proposta.");
    const { serveis, ...patch } = a;
    const docPatch: DocPatch = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) (docPatch as Record<string, unknown>)[k] = v;
    if (Object.keys(docPatch).length) await callAction(() => updatePropostaDocAction(newId, docPatch));
    for (const s of serveis ?? []) {
      await callAction(() => addServeiAction(newId));
      const lineId = await lastInsertedId("proposta_doc_servei");
      if (lineId) await callAction(() => updateServeiAction(newId, lineId, s.descripcio, s.preu));
    }
    const d = await getDoc({ id: newId });
    return d ? { id: d.id, num: d.num, label: docLabel(d), total: num(d.total), url: `/propostes/${d.id}` } : { id: newId };
  },
});

registerAction({
  kind: "change",
  name: "update_proposta",
  domain: "propostes",
  description: "Modifica la capçalera o l'estat d'una proposta d'honoraris. Només els camps indicats.",
  schema: docFields.extend({ id }),
  async plan(a): Promise<Plan> {
    const d = await getDoc({ id: a.id });
    if (!d) return { summary: "Modificar proposta", errors: [`No hi ha cap proposta amb id ${a.id}.`] };
    const { id: _id, ...patch } = a;
    void _id;
    const changes = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const { errors, resolved } = await checkRefs(patch);
    if (Object.keys(changes).length === 0) errors.push("No s'ha indicat cap canvi.");
    return { summary: `Modificar la proposta ${docLabel(d)}: ${Object.keys(changes).join(", ")}.`, details: { abans: d, despres: { ...changes, ...resolved } }, errors };
  },
  async commit(a) {
    const { id: docId, ...patch } = a;
    const docPatch: DocPatch = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) (docPatch as Record<string, unknown>)[k] = v;
    await callAction(() => updatePropostaDocAction(docId, docPatch));
    const d = await getDoc({ id: docId });
    return d ? { id: d.id, num: d.num, estat: d.estat, label: docLabel(d), total: num(d.total) } : { id: docId };
  },
});

registerAction({
  kind: "change",
  name: "add_proposta_servei",
  domain: "propostes",
  description: "Afegeix una línia de servei (descripció i preu) a una proposta.",
  schema: z.object({ proposta_id: id, descripcio: shortText, preu: money }),
  async plan(a): Promise<Plan> {
    const d = await getDoc({ id: a.proposta_id });
    if (!d) return { summary: "Afegir servei", errors: [`No hi ha cap proposta amb id ${a.proposta_id}.`] };
    return { summary: `Afegir el servei «${a.descripcio}» (${a.preu} €) a la proposta ${docLabel(d)}.`, details: a };
  },
  async commit(a) {
    await callAction(() => addServeiAction(a.proposta_id));
    const lineId = await lastInsertedId("proposta_doc_servei");
    if (lineId) await callAction(() => updateServeiAction(a.proposta_id, lineId, a.descripcio, a.preu));
    const d = await getDoc({ id: a.proposta_id });
    return { id: lineId, total: d ? num(d.total) : null };
  },
});

registerAction({
  kind: "change",
  name: "update_proposta_servei",
  domain: "propostes",
  description: "Modifica una línia de servei d'una proposta.",
  schema: z.object({ proposta_id: id, id, descripcio: shortText.optional(), preu: money.optional() }),
  async plan(a): Promise<Plan> {
    const rows = (await sql`select id, descripcio, preu::text as preu from public.proposta_doc_servei where id = ${a.id} and doc_id = ${a.proposta_id}`) as { id: number; descripcio: string | null; preu: string }[];
    if (!rows[0]) return { summary: "Modificar servei", errors: ["Línia de servei no trobada en aquesta proposta."] };
    const errors = a.descripcio === undefined && a.preu === undefined ? ["No s'ha indicat cap canvi."] : [];
    return { summary: `Modificar el servei «${rows[0].descripcio ?? ""}» (${rows[0].preu} €).`, details: { abans: rows[0], despres: { descripcio: a.descripcio, preu: a.preu } }, errors };
  },
  async commit(a) {
    const rows = (await sql`select descripcio, preu::text as preu from public.proposta_doc_servei where id = ${a.id} and doc_id = ${a.proposta_id}`) as { descripcio: string | null; preu: string }[];
    const l = rows[0];
    if (!l) throw new Error("Línia no trobada.");
    await callAction(() => updateServeiAction(a.proposta_id, a.id, a.descripcio ?? l.descripcio ?? "", a.preu ?? num(l.preu)));
    const d = await getDoc({ id: a.proposta_id });
    return { id: a.id, total: d ? num(d.total) : null };
  },
});

registerAction({
  kind: "change",
  name: "delete_proposta_servei",
  domain: "propostes",
  description: "Esborra una línia de servei d'una proposta.",
  destructive: true,
  schema: z.object({ proposta_id: id, id }),
  async plan(a): Promise<Plan> {
    const rows = (await sql`select id, descripcio, preu::text as preu from public.proposta_doc_servei where id = ${a.id} and doc_id = ${a.proposta_id}`) as { id: number; descripcio: string | null; preu: string }[];
    if (!rows[0]) return { summary: "Esborrar servei", errors: ["Línia de servei no trobada en aquesta proposta."] };
    return { summary: `Esborrar el servei «${rows[0].descripcio ?? ""}» (${rows[0].preu} €) de la proposta #${a.proposta_id}.`, details: rows[0] };
  },
  async commit(a) {
    await callAction(() => deleteServeiAction(a.proposta_id, a.id));
    return { deleted_id: a.id };
  },
});

registerAction({
  kind: "change",
  name: "add_proposta_linia",
  domain: "propostes",
  description: "Afegeix una inclusió o exclusió pròpia (text) a una proposta.",
  schema: z.object({ proposta_id: id, taula: z.enum(["inclusio", "exclusio"]), text: shortText.min(1) }),
  async plan(a): Promise<Plan> {
    const d = await getDoc({ id: a.proposta_id });
    if (!d) return { summary: "Afegir línia", errors: [`No hi ha cap proposta amb id ${a.proposta_id}.`] };
    return { summary: `Afegir la ${a.taula === "inclusio" ? "inclusió" : "exclusió"} «${a.text}» a la proposta ${docLabel(d)}.`, details: a };
  },
  async commit(a) {
    await callAction(() => addLiniaAction(a.proposta_id, a.taula));
    const table = a.taula === "inclusio" ? "proposta_doc_inclusio" : "proposta_doc_exclusio";
    const lineId = await lastInsertedId(table);
    if (lineId) await callAction(() => updateLiniaAction(a.proposta_id, a.taula, lineId, a.text));
    return { id: lineId, taula: a.taula, text: a.text };
  },
});

registerAction({
  kind: "change",
  name: "add_proposta_pagament",
  domain: "propostes",
  description: "Afegeix una condició de pagament (descripció i import opcional) a una proposta.",
  schema: z.object({ proposta_id: id, descripcio: shortText.min(1), import: money.nullable().optional() }),
  async plan(a): Promise<Plan> {
    const d = await getDoc({ id: a.proposta_id });
    if (!d) return { summary: "Afegir pagament", errors: [`No hi ha cap proposta amb id ${a.proposta_id}.`] };
    return { summary: `Afegir el pagament «${a.descripcio}»${a.import != null ? ` (${a.import} €)` : ""} a la proposta ${docLabel(d)}.`, details: a };
  },
  async commit(a) {
    await callAction(() => addPagamentAction(a.proposta_id));
    const lineId = await lastInsertedId("proposta_doc_pagament");
    if (lineId) await callAction(() => updatePagamentAction(a.proposta_id, lineId, a.descripcio, a.import ?? null));
    return { id: lineId };
  },
});
