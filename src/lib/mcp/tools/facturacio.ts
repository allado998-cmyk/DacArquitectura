import { z } from "zod";
import { sql } from "@/lib/db";
import {
  addConcepteAction,
  addSuplitAction,
  createFacturaAction,
  deleteConcepteAction,
  deleteSuplitAction,
  nextFacturaNum,
  setPagadaAction,
  updateConcepteAction,
  updateFacturaAction,
  updateSuplitAction,
  type FacturaPatch,
} from "@/app/facturacio/actions";
import { todayIso } from "@/lib/format";
import { id, isoDate, money, num, registerAction, round2, shortText, type Plan } from "../core";
import { expedientLabel, lastInsertedId, resolveClient, resolveExpedient } from "../data";
import { callAction } from "../shared";
import type { Factura } from "@/types/db";

const FACTURA_COLS = `
  f.id, f.num, f.estat, to_char(f.data,'YYYY-MM-DD') as data, f.client_id, c.nom as client_nom, c.nif,
  f.expedient_id, e.num_expedient as expedient_num, e.projecte as expedient_projecte,
  f.concepte, f.lang, f.preu::text as preu, coalesce(f.iva_pct,21)::text as iva_pct, f.pagada,
  coalesce((select sum(import) from public.factura_suplit where factura_id = f.id),0)::text as suplits_total`;

async function getFactura(ref: { id?: number | null; num?: string | null }): Promise<Factura | null> {
  const where = ref.id ? "f.id = $1" : "f.num = $1";
  const param = ref.id ?? ref.num?.trim();
  if (!param) return null;
  const rows = (await sql.query(
    `select ${FACTURA_COLS} from public.factura f
     left join public.clients c on c.id = f.client_id
     left join public.expedients e on e.id = f.expedient_id
     where ${where} order by f.id desc limit 1`,
    [param],
  )) as Factura[];
  return rows[0] ?? null;
}

function withTotals(f: Factura) {
  const base = num(f.preu);
  const iva = round2((base * num(f.iva_pct, 21)) / 100);
  const suplits = num(f.suplits_total);
  return { ...f, base, iva, suplits, total: round2(base + iva + suplits) };
}

function facturaLabel(f: Factura): string {
  return `${f.num ?? "(propera)"}${f.client_nom ? ` — ${f.client_nom}` : ""}${f.concepte ? ` — ${f.concepte}` : ""}`;
}

// Reads -----------------------------------------------------------------------

registerAction({
  kind: "read",
  name: "list_factures",
  domain: "facturacio",
  description: "Factures amb base, IVA, suplerts i total; filtres per estat (propera|emesa), pagada, client, expedient, any o text.",
  schema: z.object({
    estat: z.enum(["propera", "emesa"]).optional(),
    pagada: z.boolean().optional(),
    client_id: id.optional(),
    expedient_id: id.optional(),
    any: z.number().int().min(2000).max(2100).optional(),
    q: shortText.optional(),
    limit: z.number().int().min(1).max(500).default(200),
  }),
  async run(a) {
    const like = a.q ? `%${a.q.trim()}%` : null;
    const rows = (await sql.query(
      `select ${FACTURA_COLS} from public.factura f
       left join public.clients c on c.id = f.client_id
       left join public.expedients e on e.id = f.expedient_id
       where ($1::text is null or f.estat = $1)
         and ($2::boolean is null or f.pagada = $2)
         and ($3::bigint is null or f.client_id = $3)
         and ($4::bigint is null or f.expedient_id = $4)
         and ($5::int is null or extract(year from f.data) = $5)
         and ($6::text is null or coalesce(f.num,'') ilike $6 or coalesce(f.concepte,'') ilike $6 or coalesce(c.nom,'') ilike $6 or coalesce(e.projecte,'') ilike $6)
       order by (f.estat = 'propera') desc, f.num desc nulls last, f.id desc
       limit $7`,
      [a.estat ?? null, a.pagada ?? null, a.client_id ?? null, a.expedient_id ?? null, a.any ?? null, like, a.limit],
    )) as Factura[];
    const factures = rows.map(withTotals);
    const sum = (sel: (f: ReturnType<typeof withTotals>) => number) => round2(factures.reduce((s, f) => s + sel(f), 0));
    return {
      count: factures.length,
      totals: { base: sum((f) => f.base), total: sum((f) => f.total), pendent_cobrar: sum((f) => (f.estat === "emesa" && !f.pagada ? f.total : 0)) },
      factures,
    };
  },
});

registerAction({
  kind: "read",
  name: "get_factura",
  domain: "facturacio",
  description: "Detall d'una factura (per id o número) amb les línies de concepte i els suplerts.",
  schema: z.object({ id: id.optional(), num: shortText.optional() }).refine((v) => v.id || v.num, "Cal id o num"),
  async run(a) {
    const f = await getFactura({ id: a.id ?? null, num: a.num ?? null });
    if (!f) return { error: "Factura no trobada." };
    const [conceptes, suplits] = await Promise.all([
      sql`select id, descripcio, import::text as import from public.factura_concepte where factura_id = ${f.id} order by ordre, id`,
      sql`select id, descripcio, import::text as import from public.factura_suplit where factura_id = ${f.id} order by ordre, id`,
    ]);
    return { factura: withTotals(f), conceptes, suplits };
  },
});

registerAction({
  kind: "read",
  name: "facturacio_resum",
  domain: "facturacio",
  description: "Resum de facturació per mes d'un any: emès, cobrat, pendent; més les properes facturacions.",
  schema: z.object({ any: z.number().int().min(2000).max(2100).optional() }),
  async run(a) {
    const any = a.any ?? new Date().getFullYear();
    const [mesos, properes] = await Promise.all([
      sql`
        select to_char(date_trunc('month', data),'YYYY-MM') as mes, count(*)::int as factures,
               sum(preu)::text as base, sum(preu * (1 + coalesce(iva_pct,21)/100.0))::text as total,
               sum(case when pagada then preu * (1 + coalesce(iva_pct,21)/100.0) else 0 end)::text as cobrat,
               sum(case when not pagada then preu * (1 + coalesce(iva_pct,21)/100.0) else 0 end)::text as pendent
        from public.factura where estat = 'emesa' and extract(year from data) = ${any}
        group by 1 order by 1`,
      sql`
        select f.id, c.nom as client_nom, e.num_expedient, f.concepte, f.preu::text as base
        from public.factura f left join public.clients c on c.id = f.client_id left join public.expedients e on e.id = f.expedient_id
        where f.estat = 'propera' order by f.id`,
    ]);
    return { any, mesos, properes_facturacions: properes };
  },
});

// Changes ---------------------------------------------------------------------

const facturaFields = z.object({
  estat: z.enum(["propera", "emesa"]).optional(),
  num: shortText.nullable().optional().describe("Número YY-NNN; si s'emet sense número s'assigna el següent"),
  client_id: id.nullable().optional(),
  data: isoDate.nullable().optional(),
  expedient_id: id.nullable().optional(),
  expedient_num: shortText.optional(),
  concepte: shortText.nullable().optional(),
  lang: z.enum(["ca", "es"]).optional(),
  preu: money.optional().describe("Base imposable (€) si no hi ha línies de concepte"),
  iva_pct: z.number().min(0).max(100).optional(),
});
type FacturaFields = z.infer<typeof facturaFields>;

async function buildPatch(current: Factura | null, a: FacturaFields): Promise<{ patch: FacturaPatch; errors: string[]; warnings: string[]; resolved: Record<string, unknown> }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const resolved: Record<string, unknown> = {};
  const cr = await resolveClient(a.client_id ?? undefined);
  if (cr.error) errors.push(cr.error);
  if (cr.client) resolved.client = cr.client.nom;
  const er = await resolveExpedient({ expedient_id: a.expedient_id ?? null, expedient_num: a.expedient_num ?? null });
  if (er.error) errors.push(er.error);
  if (er.expedient) resolved.expedient = expedientLabel(er.expedient);

  const estat = a.estat ?? current?.estat ?? "propera";
  let numv = a.num === undefined ? (current?.num ?? "") : (a.num ?? "");
  let data = a.data === undefined ? (current?.data ?? "") : (a.data ?? "");
  if (estat === "emesa") {
    if (!numv) {
      numv = await nextFacturaNum();
      warnings.push(`S'assignarà el número ${numv}.`);
    }
    if (!data) {
      data = todayIso();
      warnings.push(`Sense data: s'hi posarà avui (${data}).`);
    }
    if (/^\d{2}-\d{3}$/.test(numv)) {
      const dup = (await sql`select id from public.factura where num = ${numv} and id <> ${current?.id ?? 0}`) as { id: number }[];
      if (dup.length) errors.push(`Ja existeix una factura amb el número ${numv}.`);
    }
  }
  const expedientId = a.expedient_id !== undefined || a.expedient_num ? (er.expedient?.id ?? null) : (current?.expedient_id ?? null);
  const clientId = a.client_id !== undefined ? (a.client_id ?? null) : (current?.client_id ?? null);
  if (!clientId && er.expedient?.client_id && a.client_id === undefined) {
    resolved.client_from_expedient = er.expedient.client_nom;
    warnings.push(`El client s'agafarà de l'expedient: ${er.expedient.client_nom}.`);
  }
  const patch: FacturaPatch = {
    estat,
    num: numv,
    client_id: clientId ?? er.expedient?.client_id ?? null,
    data,
    expedient_id: expedientId,
    concepte: a.concepte === undefined ? (current?.concepte ?? "") : (a.concepte ?? ""),
    lang: a.lang ?? current?.lang ?? "ca",
    preu: a.preu ?? num(current?.preu),
    iva_pct: a.iva_pct ?? num(current?.iva_pct, 21),
  };
  resolved.patch = patch;
  return { patch, errors, warnings, resolved };
}

registerAction({
  kind: "change",
  name: "create_factura",
  domain: "facturacio",
  description: "Crea una factura (per defecte com a «propera facturació»; estat=emesa li assigna número i data).",
  notes: ["La base és preu; si després s'afegeixen línies de concepte, la base passa a ser la seva suma.", "lang (ca|es) és l'idioma del document generat."],
  schema: facturaFields,
  async plan(a): Promise<Plan> {
    const { patch, errors, warnings, resolved } = await buildPatch(null, a);
    return {
      summary: `Crear una factura ${patch.estat === "emesa" ? `emesa ${patch.num}` : "propera"} de ${round2(patch.preu)} € base${resolved.client ? ` a ${resolved.client}` : ""}${resolved.expedient ? ` (${resolved.expedient})` : ""}.`,
      details: resolved,
      errors,
      warnings,
    };
  },
  async commit(a) {
    const r = await callAction(() => createFacturaAction());
    const newId = r.value ?? (await lastInsertedId("factura"));
    if (!newId) throw new Error("No s'ha pogut crear la factura.");
    const { patch } = await buildPatch(await getFactura({ id: newId }), a);
    await callAction(() => updateFacturaAction(newId, patch));
    const f = await getFactura({ id: newId });
    return f ? withTotals(f) : { id: newId };
  },
});

registerAction({
  kind: "change",
  name: "update_factura",
  domain: "facturacio",
  description: "Modifica una factura (estat, número, client, data, expedient, concepte, idioma, base, IVA). Només els camps indicats.",
  schema: facturaFields.extend({ id }),
  async plan(a): Promise<Plan> {
    const f = await getFactura({ id: a.id });
    if (!f) return { summary: "Modificar factura", errors: [`No hi ha cap factura amb id ${a.id}.`] };
    const { id: _id, ...fields } = a;
    void _id;
    if (Object.values(fields).every((v) => v === undefined)) return { summary: "Modificar factura", errors: ["No s'ha indicat cap canvi."] };
    const { errors, warnings, resolved } = await buildPatch(f, fields);
    if (f.pagada && fields.preu !== undefined) warnings.push("La factura ja consta com a pagada.");
    return { summary: `Modificar la factura ${facturaLabel(f)}: ${Object.keys(fields).filter((k) => fields[k as keyof FacturaFields] !== undefined).join(", ")}.`, details: { abans: withTotals(f), despres: resolved }, errors, warnings };
  },
  async commit(a) {
    const f = await getFactura({ id: a.id });
    if (!f) throw new Error("Factura no trobada.");
    const { id: _id, ...fields } = a;
    void _id;
    const { patch } = await buildPatch(f, fields);
    await callAction(() => updateFacturaAction(a.id, patch));
    const saved = await getFactura({ id: a.id });
    return saved ? withTotals(saved) : { id: a.id };
  },
});

registerAction({
  kind: "change",
  name: "set_factura_pagada",
  domain: "facturacio",
  description: "Marca una factura com a pagada o no pagada.",
  schema: z.object({ id, pagada: z.boolean() }),
  async plan(a): Promise<Plan> {
    const f = await getFactura({ id: a.id });
    if (!f) return { summary: "Marcar pagada", errors: [`No hi ha cap factura amb id ${a.id}.`] };
    const warnings = f.pagada === a.pagada ? ["Ja estava en aquest estat."] : [];
    return { summary: `Marcar la factura ${facturaLabel(f)} com a ${a.pagada ? "pagada" : "NO pagada"}.`, details: withTotals(f), warnings };
  },
  async commit(a) {
    await callAction(() => setPagadaAction(a.id, a.pagada));
    return { id: a.id, pagada: a.pagada };
  },
});

const liniaTipus = z.enum(["concepte", "suplit"]);

registerAction({
  kind: "change",
  name: "add_factura_linia",
  domain: "facturacio",
  description: "Afegeix una línia a una factura: concepte (desglossa la base) o suplit (despesa repercutida).",
  schema: z.object({ factura_id: id, tipus: liniaTipus, descripcio: shortText, import: money }),
  async plan(a): Promise<Plan> {
    const f = await getFactura({ id: a.factura_id });
    if (!f) return { summary: "Afegir línia", errors: [`No hi ha cap factura amb id ${a.factura_id}.`] };
    const warnings = a.tipus === "concepte" ? ["Amb línies de concepte, la base de la factura passa a ser la suma de les línies."] : [];
    return { summary: `Afegir ${a.tipus} «${a.descripcio}» de ${a.import} € a la factura ${facturaLabel(f)}.`, details: a, warnings };
  },
  async commit(a) {
    if (a.tipus === "concepte") {
      await callAction(() => addConcepteAction(a.factura_id));
      const newId = await lastInsertedId("factura_concepte");
      if (newId) await callAction(() => updateConcepteAction(newId, a.descripcio, a.import));
      const f = await getFactura({ id: a.factura_id });
      return { id: newId, factura: f ? withTotals(f) : null };
    }
    await callAction(() => addSuplitAction(a.factura_id));
    const newId = await lastInsertedId("factura_suplit");
    if (newId) await callAction(() => updateSuplitAction(newId, a.descripcio, a.import));
    const f = await getFactura({ id: a.factura_id });
    return { id: newId, factura: f ? withTotals(f) : null };
  },
});

registerAction({
  kind: "change",
  name: "update_factura_linia",
  domain: "facturacio",
  description: "Modifica una línia de concepte o suplit d'una factura.",
  schema: z.object({ tipus: liniaTipus, id, descripcio: shortText.optional(), import: money.optional() }),
  async plan(a): Promise<Plan> {
    const table = a.tipus === "concepte" ? "factura_concepte" : "factura_suplit";
    const rows = (await sql.query(`select id, factura_id, descripcio, import::text as import from public.${table} where id = $1`, [a.id])) as { id: number; factura_id: number; descripcio: string | null; import: string }[];
    const l = rows[0];
    if (!l) return { summary: "Modificar línia", errors: [`No hi ha cap ${a.tipus} amb id ${a.id}.`] };
    const errors = a.descripcio === undefined && a.import === undefined ? ["No s'ha indicat cap canvi."] : [];
    return { summary: `Modificar el ${a.tipus} «${l.descripcio ?? ""}» (${l.import} €) de la factura #${l.factura_id}.`, details: { abans: l, despres: { descripcio: a.descripcio, import: a.import } }, errors };
  },
  async commit(a) {
    const table = a.tipus === "concepte" ? "factura_concepte" : "factura_suplit";
    const rows = (await sql.query(`select factura_id, descripcio, import::text as import from public.${table} where id = $1`, [a.id])) as { factura_id: number; descripcio: string | null; import: string }[];
    const l = rows[0];
    if (!l) throw new Error("Línia no trobada.");
    const desc = a.descripcio ?? l.descripcio ?? "";
    const imp = a.import ?? num(l.import);
    if (a.tipus === "concepte") await callAction(() => updateConcepteAction(a.id, desc, imp));
    else await callAction(() => updateSuplitAction(a.id, desc, imp));
    const f = await getFactura({ id: l.factura_id });
    return { id: a.id, descripcio: desc, import: imp, factura: f ? withTotals(f) : null };
  },
});

registerAction({
  kind: "change",
  name: "delete_factura_linia",
  domain: "facturacio",
  description: "Esborra una línia de concepte o suplit d'una factura.",
  destructive: true,
  schema: z.object({ tipus: liniaTipus, id }),
  async plan(a): Promise<Plan> {
    const table = a.tipus === "concepte" ? "factura_concepte" : "factura_suplit";
    const rows = (await sql.query(`select id, factura_id, descripcio, import::text as import from public.${table} where id = $1`, [a.id])) as { id: number; factura_id: number; descripcio: string | null; import: string }[];
    const l = rows[0];
    if (!l) return { summary: "Esborrar línia", errors: [`No hi ha cap ${a.tipus} amb id ${a.id}.`] };
    return { summary: `Esborrar el ${a.tipus} «${l.descripcio ?? ""}» (${l.import} €) de la factura #${l.factura_id}.`, details: l };
  },
  async commit(a) {
    if (a.tipus === "concepte") await callAction(() => deleteConcepteAction(a.id));
    else await callAction(() => deleteSuplitAction(a.id));
    return { deleted_id: a.id };
  },
});
