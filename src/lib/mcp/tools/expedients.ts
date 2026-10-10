import { z } from "zod";
import { sql } from "@/lib/db";
import { createExpedientAction, updateExpedientAction, type ExpedientPatch } from "@/app/expedients/actions";
import { todayIso } from "@/lib/format";
import { id, isoDate, money, num, registerAction, round2, shortText, type Plan } from "../core";
import { expedientLabel, findExpedient, lastInsertedId, matchExpedients, parseExpedientRef, resolveClient, resolveExpedient, findTipologia, type ExpedientRow } from "../data";
import { callAction } from "../shared";

const CATEGORIA = z.enum(["re", "co", "ed", "rec", "do"]);
const TIPUS = z.enum(["public", "privat"]);
const ESTAT = z.enum(["obert", "tancat"]);

const CATEGORIA_LABEL: Record<string, string> = { re: "Rehabilitació", co: "Consultoria", ed: "Edificació", rec: "Reconstrucció", do: "Docència" };

// Reads -----------------------------------------------------------------------

registerAction({
  kind: "read",
  name: "list_expedients",
  domain: "expedients",
  description: "Llista d'expedients amb filtres (estat, categoria, tipus, client, text) i hores dedicades.",
  schema: z.object({
    estat: ESTAT.optional(),
    categoria: CATEGORIA.optional(),
    tipus: TIPUS.optional(),
    client_id: id.optional(),
    q: shortText.optional().describe("Text a cercar en número, projecte, client o ciutat"),
    limit: z.number().int().min(1).max(500).default(100),
  }),
  async run(a) {
    // A number in any usual form ("120", "26-120") narrows to those expedients.
    const byNumber = a.q && parseExpedientRef(a.q).kind === "number" ? (await matchExpedients(a.q, 50)).map((c) => c.id) : null;
    const like = a.q && !byNumber?.length ? `%${a.q.trim()}%` : null;
    const ids = byNumber?.length ? byNumber : null;
    const rows = (await sql`
      select e.id, e.num_expedient, e.projecte, e.client_id, c.nom as client_nom, e.ciutat, e.estat, e.categoria,
             t.nom as tipologia_nom, e.tipus, e.direccio_obres, e.web, e.pressupost::text as pressupost,
             to_char(e.data_inici,'YYYY-MM-DD') as data_inici, to_char(e.data_final,'YYYY-MM-DD') as data_final,
             to_char(e.data_tancament,'YYYY-MM-DD') as data_tancament,
             coalesce((select sum(hores) from public.dedicacions d where d.expedient_id = e.id),0)::text as hores
      from public.expedients e
      left join public.clients c on c.id = e.client_id
      left join public.tipologies t on t.id = e.tipologia_id
      where (${a.estat ?? null}::text is null or e.estat = ${a.estat ?? null})
        and (${a.categoria ?? null}::text is null or e.categoria = ${a.categoria ?? null})
        and (${a.tipus ?? null}::text is null or e.tipus = ${a.tipus ?? null})
        and (${a.client_id ?? null}::bigint is null or e.client_id = ${a.client_id ?? null})
        and (${ids}::bigint[] is null or e.id = any(${ids}::bigint[]))
        and (${like}::text is null or public.dac_fold(concat_ws(' ', e.num_expedient, e.projecte, c.nom, e.ciutat)) like public.dac_fold(${like}))
      order by e.num_expedient desc
      limit ${a.limit}
    `) as Record<string, unknown>[];
    return { count: rows.length, expedients: rows };
  },
});

registerAction({
  kind: "read",
  name: "get_expedient",
  domain: "expedients",
  description: "Fitxa completa d'un expedient (per id o número): dades, dedicacions, fites, factures i actes.",
  schema: z.object({ id: id.optional(), num: shortText.optional().describe('Número ("26-0120", "120") o part del nom del projecte o client') }).refine((v) => v.id || v.num, "Cal id o num"),
  async run(a) {
    const r = await resolveExpedient({ expedient_id: a.id ?? null, expedient_num: a.num ?? null });
    if (!r.expedient) return { error: r.error ?? "Expedient no trobat." };
    const e = r.expedient;
    const [dedicacions, fites, factures, actes, hores] = await Promise.all([
      sql`select id, to_char(data,'YYYY-MM-DD') as data, hores::text as hores, tasca, comentari
          from public.dedicacions where expedient_id = ${e.id} order by data desc, id desc limit 100`,
      sql`select f.id, to_char(f.data,'YYYY-MM-DD') as data, t.nom as tipus, t.id as tipus_id
          from public.expedient_fita f join public.fita_tipus t on t.id = f.tipus_id where f.expedient_id = ${e.id} order by f.data`,
      sql`select id, num, estat, to_char(data,'YYYY-MM-DD') as data, concepte, preu::text as base, iva_pct::text as iva_pct, pagada
          from public.factura where expedient_id = ${e.id} order by data desc nulls last, id desc`,
      sql`select id, num, tipus, to_char(data,'YYYY-MM-DD') as data, lloc from public.acta where expedient_id = ${e.id} order by data desc, id desc`,
      sql`select coalesce(sum(hores),0)::text as total from public.dedicacions where expedient_id = ${e.id}`,
    ]);
    return {
      expedient: { ...e, categoria_label: e.categoria ? CATEGORIA_LABEL[e.categoria] : null },
      hores_total: (hores as { total: string }[])[0]?.total,
      dedicacions,
      fites,
      factures,
      actes,
    };
  },
});

// Changes ---------------------------------------------------------------------

const patchSchema = z.object({
  projecte: shortText.nullable().optional(),
  client_id: id.nullable().optional(),
  ciutat: shortText.nullable().optional(),
  estat: ESTAT.optional(),
  categoria: CATEGORIA.nullable().optional(),
  tipologia_id: id.nullable().optional(),
  tipus: TIPUS.optional(),
  direccio_obres: z.boolean().optional(),
  web: z.boolean().optional(),
  pressupost: money.optional().describe("Pressupost manual (€)"),
  data_inici: isoDate.nullable().optional(),
  data_final: isoDate.nullable().optional(),
  data_tancament: isoDate.nullable().optional(),
});
type Patch = z.infer<typeof patchSchema>;

function toActionPatch(e: ExpedientRow, p: Patch): ExpedientPatch {
  const has = <K extends keyof Patch>(k: K) => p[k] !== undefined;
  return {
    num_expedient: e.num_expedient,
    projecte: has("projecte") ? (p.projecte ?? "") : (e.projecte ?? ""),
    client_id: has("client_id") ? (p.client_id ?? null) : e.client_id,
    ciutat: has("ciutat") ? (p.ciutat ?? "") : (e.ciutat ?? ""),
    estat: p.estat ?? e.estat,
    categoria: has("categoria") ? (p.categoria ?? "") : (e.categoria ?? ""),
    tipologia_id: has("tipologia_id") ? (p.tipologia_id ?? null) : e.tipologia_id,
    tipus: p.tipus ?? e.tipus,
    direccio_obres: p.direccio_obres ?? e.direccio_obres,
    web: p.web ?? e.web,
    pressupost: has("pressupost") ? (p.pressupost as number) : num(e.pressupost),
    // A manual pressupost switches the origin to manual; otherwise keep the link.
    pressupost_origen: has("pressupost") ? "manual" : e.pressupost_origen,
    calcul_id: e.calcul_id,
    proposta_doc_id: e.proposta_doc_id,
    data_inici: has("data_inici") ? (p.data_inici ?? "") : (e.data_inici ?? ""),
    data_final: has("data_final") ? (p.data_final ?? "") : (e.data_final ?? ""),
    data_tancament: has("data_tancament") ? (p.data_tancament ?? "") : (e.data_tancament ?? ""),
  };
}

async function describePatch(p: Patch, base: ExpedientRow | null): Promise<{ changes: Record<string, unknown>; errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const changes: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) if (v !== undefined) changes[k] = v;

  if (p.client_id !== undefined && p.client_id !== null) {
    const r = await resolveClient(p.client_id);
    if (r.error) errors.push(r.error);
    else changes.client = r.client?.nom;
  }
  if (p.tipologia_id !== undefined && p.tipologia_id !== null) {
    const t = await findTipologia(p.tipologia_id);
    if (!t) errors.push(`No hi ha cap tipologia amb id ${p.tipologia_id}.`);
    else changes.tipologia = t.nom;
  }
  if (p.categoria) changes.categoria_label = CATEGORIA_LABEL[p.categoria];
  const inici = p.data_inici ?? base?.data_inici ?? null;
  const final = p.data_final ?? base?.data_final ?? null;
  if (inici && final && final < inici) errors.push("data_final és anterior a data_inici.");
  if (p.estat === "tancat" && !p.data_tancament && !base?.data_tancament) {
    changes.data_tancament = todayIso();
    warnings.push(`Es tanca sense data de tancament: s'hi posarà avui (${changes.data_tancament}).`);
  }
  if (p.estat === "obert" && (base?.data_tancament || p.data_tancament)) {
    warnings.push("L'expedient queda obert però conserva una data de tancament; passa data_tancament=null si cal.");
  }
  if (p.pressupost !== undefined && base && base.pressupost_origen !== "manual") {
    warnings.push(`El pressupost deixarà d'estar lligat al ${base.pressupost_origen} i passarà a manual.`);
  }
  return { changes, errors, warnings };
}

function applyDefaults(p: Patch, changes: Record<string, unknown>): Patch {
  const out = { ...p };
  if (p.estat === "tancat" && !p.data_tancament && typeof changes.data_tancament === "string") out.data_tancament = changes.data_tancament;
  return out;
}

registerAction({
  kind: "change",
  name: "create_expedient",
  domain: "expedients",
  description: "Crea un expedient nou (el número YY-NNNN s'assigna sol) amb les dades indicades.",
  notes: ["El client i la tipologia es passen per id: cerca'ls abans amb cerca o list_clients / catalegs.", "La categoria és re|co|ed|rec|do; el tipus és public|privat."],
  schema: patchSchema,
  async plan(a): Promise<Plan> {
    const { changes, errors, warnings } = await describePatch(a, null);
    return { summary: `Crear l'expedient «${a.projecte ?? "sense títol"}»${changes.client ? ` per a ${changes.client}` : ""}.`, details: changes, errors, warnings };
  },
  async commit(a, plan) {
    await callAction(() => createExpedientAction());
    const newId = await lastInsertedId("expedients");
    const e = newId ? await findExpedient({ id: newId }) : null;
    if (!e) throw new Error("No s'ha pogut crear l'expedient.");
    const patch = applyDefaults(a, (plan.details ?? {}) as Record<string, unknown>);
    await callAction(() => updateExpedientAction(e.id, toActionPatch(e, patch)));
    const saved = await findExpedient({ id: e.id });
    return { id: e.id, num_expedient: e.num_expedient, label: expedientLabel(saved), url: `/expedients` };
  },
});

registerAction({
  kind: "change",
  name: "update_expedient",
  domain: "expedients",
  description: "Modifica camps d'un expedient (estat, dates, client, categoria, pressupost…). Només canvia els camps indicats.",
  notes: ["Per tancar: estat=tancat (+ data_tancament opcional, per defecte avui).", "Per desvincular un client o tipologia passa null."],
  schema: patchSchema.extend({ id: id.optional(), num: shortText.optional() }).refine((v) => v.id || v.num, "Cal id o num"),
  async plan(a): Promise<Plan> {
    const r = await resolveExpedient({ expedient_id: a.id ?? null, expedient_num: a.num ?? null });
    if (!r.expedient) return { summary: "Modificar expedient", errors: [r.error ?? "Expedient no trobat."] };
    const e = r.expedient;
    const { id: _id, num: _num, ...patch } = a;
    void _id;
    void _num;
    const { changes, errors, warnings } = await describePatch(patch, e);
    if (Object.keys(changes).length === 0) errors.push("No s'ha indicat cap camp a canviar.");
    return { summary: `Modificar ${expedientLabel(e)}: ${Object.keys(patch).filter((k) => (patch as Record<string, unknown>)[k] !== undefined).join(", ")}.`, details: { expedient_id: e.id, abans: pickCurrent(e, patch), despres: changes }, errors, warnings };
  },
  async commit(a, plan) {
    const e = (await resolveExpedient({ expedient_id: a.id ?? null, expedient_num: a.num ?? null })).expedient;
    if (!e) throw new Error("Expedient no trobat.");
    const { id: _id, num: _num, ...patch } = a;
    void _id;
    void _num;
    const details = (plan.details ?? {}) as { despres?: Record<string, unknown> };
    await callAction(() => updateExpedientAction(e.id, toActionPatch(e, applyDefaults(patch, details.despres ?? {}))));
    const saved = await findExpedient({ id: e.id });
    return { id: e.id, label: expedientLabel(saved), estat: saved?.estat, pressupost: saved ? round2(num(saved.pressupost)) : null };
  },
});

function pickCurrent(e: ExpedientRow, patch: Patch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(patch) as (keyof Patch)[]) {
    if (patch[k] !== undefined) out[k] = (e as unknown as Record<string, unknown>)[k];
  }
  return out;
}
