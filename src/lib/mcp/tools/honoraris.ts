import { z } from "zod";
import { sql } from "@/lib/db";
import { createIteAction, createPropostaAction } from "@/app/honoraris/actions";
import {
  addAltraDespesaLineAction,
  addDespesaDirectaLineAction,
  deleteAltraDespesaLineAction,
  deleteDespesaDirectaLineAction,
  updateAltraDespesaLineAction,
  updateDespesaDirectaLineAction,
  updateIteAction,
  updatePropostaAction,
} from "@/app/honoraris/[id]/actions";
import { id, isoDate, money, num, registerAction, round2, shortText, type Plan } from "../core";
import { resolveClient } from "../data";
import { callAction, idFromRedirect } from "../shared";

// Same total formula as the Honoraris list page (ITE and regular càlculs).
const TOTAL_SQL = `
  (case
    when p.es_ite then
      coalesce(p.total_honoraris_override, ip.preu) * (1 + case when p.ite_comissio_activa then coalesce(p.ite_comissio_pct, 0) / 100.0 else 0 end)
    else
      coalesce(p.total_honoraris_override,
        case when (100 - coalesce(p.despeses_indirectes_pct, 0) - coalesce(p.benefici_pct, 0)) > 0
          then (b.base * 100.0) / (100 - coalesce(p.despeses_indirectes_pct, 0) - coalesce(p.benefici_pct, 0))
          else b.base end)
  end)::text as total,
  b.base::text as base_directa_i_altres`;

const TOTAL_JOINS = `
  cross join lateral (
    select coalesce((select sum(hores * preu_hora) from public.proposta_despesa_directa_line where proposta_id = p.id), 0)
         + coalesce((select sum(adl.unitats * adl.preu_unitat) from public.proposta_altra_despesa_line adl
                     join public.concepte_altra_despesa ca on ca.id = adl.concepte_id
                     where adl.proposta_id = p.id and ca.nom not ilike 'Responsabilitat Civil'), 0) as base
  ) b
  cross join lateral (
    select (p.ut_habitatges + p.ut_locals_200 + p.ut_locals_400 * 2 + p.ut_locals_600 * 3 + p.ut_locals_800 * 4 + p.ut_locals_1000 * 5) as ent
  ) e
  cross join lateral (
    select coalesce((select preu_1 from public.ite_tarifa where id = 1), 650) as t1,
           coalesce((select preu_2 from public.ite_tarifa where id = 1), 750) as t2,
           coalesce((select preu_3 from public.ite_tarifa where id = 1), 850) as t3,
           coalesce((select increment from public.ite_tarifa where id = 1), 15) as inc
  ) tf
  cross join lateral (
    select case when e.ent < 6 then tf.t1 when e.ent < 11 then tf.t2 else tf.t3 + tf.inc * (e.ent - 10) end as preu
  ) ip`;

interface CalculRow {
  id: number;
  num_proposta: string;
  data: string;
  projecte: string | null;
  es_ite: boolean;
  contacte_prescriptor: string | null;
  client_id: number | null;
  client_nom: string | null;
  despeses_indirectes_pct: string;
  benefici_pct: string;
  total_honoraris_override: string | null;
  total: string;
  base_directa_i_altres: string;
}

async function getCalcul(idv: number): Promise<CalculRow | null> {
  const rows = (await sql.query(
    `select p.id, p.num_proposta, to_char(p.data,'YYYY-MM-DD') as data, p.projecte, p.es_ite, p.contacte_prescriptor,
            p.client_id, c.nom as client_nom, p.despeses_indirectes_pct::text as despeses_indirectes_pct, p.benefici_pct::text as benefici_pct,
            p.total_honoraris_override::text as total_honoraris_override, ${TOTAL_SQL}
     from public.propostes p left join public.clients c on c.id = p.client_id ${TOTAL_JOINS}
     where p.id = $1`,
    [idv],
  )) as CalculRow[];
  return rows[0] ?? null;
}

function calculLabel(c: CalculRow): string {
  return `${c.num_proposta}${c.es_ite ? " (ITE)" : ""} — ${c.projecte ?? "sense títol"}${c.client_nom ? ` (${c.client_nom})` : ""}`;
}

// Reads -----------------------------------------------------------------------

registerAction({
  kind: "read",
  name: "list_calculs",
  domain: "honoraris",
  description: "Càlculs d'honoraris (YY-NNN) amb client, prescriptor, si és ITE i total.",
  schema: z.object({ q: shortText.optional(), any: z.number().int().min(2000).max(2100).optional(), limit: z.number().int().min(1).max(500).default(200) }),
  async run(a) {
    const like = a.q ? `%${a.q.trim()}%` : null;
    const rows = await sql.query(
      `select p.id, p.num_proposta, to_char(p.data,'YYYY-MM-DD') as data, p.projecte, p.es_ite, p.contacte_prescriptor, c.nom as client_nom, ${TOTAL_SQL}
       from public.propostes p left join public.clients c on c.id = p.client_id ${TOTAL_JOINS}
       where ($1::text is null or p.num_proposta ilike $1 or coalesce(p.projecte,'') ilike $1 or coalesce(c.nom,'') ilike $1 or coalesce(p.contacte_prescriptor,'') ilike $1)
         and ($2::int is null or extract(year from p.data) = $2)
       order by p.num_proposta desc nulls last, p.id desc limit $3`,
      [like, a.any ?? null, a.limit],
    );
    return { count: (rows as unknown[]).length, calculs: rows };
  },
});

registerAction({
  kind: "read",
  name: "get_calcul",
  domain: "honoraris",
  description: "Detall d'un càlcul d'honoraris: capçalera, línies de despesa directa (hores) i altres despeses, percentatges i total; dades ITE si escau.",
  schema: z.object({ id }),
  async run(a) {
    const c = await getCalcul(a.id);
    if (!c) return { error: `No hi ha cap càlcul amb id ${a.id}.` };
    const [directa, altra, ite] = await Promise.all([
      sql`select l.id, l.concepte_id, k.nom as concepte, l.hores::text as hores, l.preu_hora::text as preu_hora, (l.hores*l.preu_hora)::text as import
          from public.proposta_despesa_directa_line l join public.concepte_despesa_directa k on k.id = l.concepte_id where l.proposta_id = ${a.id} order by l.ordre, l.id`,
      sql`select l.id, l.concepte_id, k.nom as concepte, l.unitats::text as unitats, l.preu_unitat::text as preu_unitat, (l.unitats*l.preu_unitat)::text as import
          from public.proposta_altra_despesa_line l join public.concepte_altra_despesa k on k.id = l.concepte_id where l.proposta_id = ${a.id} order by l.ordre, l.id`,
      c.es_ite
        ? sql`select ut_habitatges::text as ut_habitatges, ut_locals_200::text as ut_locals_200, ut_locals_400::text as ut_locals_400, ut_locals_600::text as ut_locals_600,
                     ut_locals_800::text as ut_locals_800, ut_locals_1000::text as ut_locals_1000, ite_descompte_pct::text as ite_descompte_pct, ite_iva_pct::text as ite_iva_pct,
                     ite_comissio_activa, ite_comissio_pct::text as ite_comissio_pct from public.propostes where id = ${a.id}`
        : Promise.resolve([]),
    ]);
    return { calcul: c, despesa_directa: directa, altres_despeses: altra, ite: (ite as unknown[])[0] ?? null };
  },
});

// Changes ---------------------------------------------------------------------

const headerFields = z.object({
  data: isoDate.optional(),
  projecte: shortText.nullable().optional(),
  client_id: id.nullable().optional(),
  contacte_prescriptor: shortText.nullable().optional(),
  despeses_indirectes_pct: z.number().min(0).max(99).optional(),
  benefici_pct: z.number().min(0).max(99).optional(),
  total_honoraris_override: money.nullable().optional().describe("Total fixat a mà; null torna al calculat"),
});
type Header = z.infer<typeof headerFields>;

async function headerPlan(a: Header): Promise<{ errors: string[]; resolved: Record<string, unknown> }> {
  const errors: string[] = [];
  const resolved: Record<string, unknown> = {};
  const cr = await resolveClient(a.client_id ?? undefined);
  if (cr.error) errors.push(cr.error);
  if (cr.client) resolved.client = cr.client.nom;
  if ((a.despeses_indirectes_pct ?? 0) + (a.benefici_pct ?? 0) >= 100) errors.push("despeses_indirectes_pct + benefici_pct ha de ser menor que 100.");
  return { errors, resolved };
}

async function applyHeader(calculId: number, c: CalculRow, a: Header) {
  // updatePropostaAction replaces projecte/client/prescriptor/override with what it
  // receives, so merge the current values in for the fields not given.
  await callAction(() =>
    updatePropostaAction(calculId, {
      data: a.data,
      projecte: a.projecte === undefined ? c.projecte : a.projecte,
      client_id: a.client_id === undefined ? c.client_id : a.client_id,
      contacte_prescriptor: a.contacte_prescriptor === undefined ? c.contacte_prescriptor : a.contacte_prescriptor,
      despeses_indirectes_pct: a.despeses_indirectes_pct,
      benefici_pct: a.benefici_pct,
      total_honoraris_override: a.total_honoraris_override === undefined ? (c.total_honoraris_override == null ? null : num(c.total_honoraris_override)) : a.total_honoraris_override,
    }),
  );
}

registerAction({
  kind: "change",
  name: "create_calcul",
  domain: "honoraris",
  description: "Crea un càlcul d'honoraris nou (normal o ITE) amb la capçalera indicada.",
  notes: ["Un càlcul normal arrenca amb la línia «Responsabilitat Civil» per defecte. Afegeix hores amb add_calcul_linia."],
  schema: headerFields.extend({ es_ite: z.boolean().default(false) }),
  async plan(a): Promise<Plan> {
    const { errors, resolved } = await headerPlan(a);
    return { summary: `Crear un càlcul d'honoraris${a.es_ite ? " ITE" : ""} «${a.projecte ?? "sense títol"}»${resolved.client ? ` per a ${resolved.client}` : ""}.`, details: { ...a, ...resolved }, errors };
  },
  async commit(a) {
    const r = await callAction(() => (a.es_ite ? createIteAction() : createPropostaAction()));
    const newId = idFromRedirect(r.redirectedTo);
    if (!newId) throw new Error("No s'ha pogut crear el càlcul.");
    const c = await getCalcul(newId);
    if (!c) throw new Error("Càlcul no trobat després de crear-lo.");
    const { es_ite: _ite, ...header } = a;
    void _ite;
    if (Object.values(header).some((v) => v !== undefined)) await applyHeader(newId, c, header);
    const saved = await getCalcul(newId);
    return saved ? { id: saved.id, num_proposta: saved.num_proposta, label: calculLabel(saved), total: round2(num(saved.total)), url: `/honoraris/${saved.id}` } : { id: newId };
  },
});

registerAction({
  kind: "change",
  name: "update_calcul",
  domain: "honoraris",
  description: "Modifica la capçalera d'un càlcul d'honoraris (data, projecte, client, prescriptor, percentatges, total fixat).",
  schema: headerFields.extend({ id }),
  async plan(a): Promise<Plan> {
    const c = await getCalcul(a.id);
    if (!c) return { summary: "Modificar càlcul", errors: [`No hi ha cap càlcul amb id ${a.id}.`] };
    const { id: _id, ...header } = a;
    void _id;
    const changes = Object.fromEntries(Object.entries(header).filter(([, v]) => v !== undefined));
    const { errors, resolved } = await headerPlan(header);
    if (Object.keys(changes).length === 0) errors.push("No s'ha indicat cap canvi.");
    return { summary: `Modificar el càlcul ${calculLabel(c)}: ${Object.keys(changes).join(", ")}.`, details: { abans: c, despres: { ...changes, ...resolved } }, errors };
  },
  async commit(a) {
    const c = await getCalcul(a.id);
    if (!c) throw new Error("Càlcul no trobat.");
    const { id: _id, ...header } = a;
    void _id;
    await applyHeader(a.id, c, header);
    const saved = await getCalcul(a.id);
    return saved ? { id: saved.id, label: calculLabel(saved), total: round2(num(saved.total)) } : { id: a.id };
  },
});

registerAction({
  kind: "change",
  name: "update_calcul_ite",
  domain: "honoraris",
  description: "Modifica les unitats i percentatges d'un càlcul ITE (habitatges, locals per trams, descompte, IVA, comissió).",
  schema: z.object({
    id,
    ut_habitatges: z.number().min(0).optional(),
    ut_locals_200: z.number().min(0).optional(),
    ut_locals_400: z.number().min(0).optional(),
    ut_locals_600: z.number().min(0).optional(),
    ut_locals_800: z.number().min(0).optional(),
    ut_locals_1000: z.number().min(0).optional(),
    ite_descompte_pct: z.number().min(0).max(100).optional(),
    ite_iva_pct: z.number().min(0).max(100).optional(),
    ite_comissio_activa: z.boolean().optional(),
    ite_comissio_pct: z.number().min(0).max(100).optional(),
  }),
  async plan(a): Promise<Plan> {
    const c = await getCalcul(a.id);
    if (!c) return { summary: "Modificar ITE", errors: [`No hi ha cap càlcul amb id ${a.id}.`] };
    const errors: string[] = [];
    if (!c.es_ite) errors.push("Aquest càlcul no és un càlcul ITE.");
    const { id: _id, ...patch } = a;
    void _id;
    const changes = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (Object.keys(changes).length === 0) errors.push("No s'ha indicat cap canvi.");
    return { summary: `Modificar el càlcul ITE ${calculLabel(c)}: ${Object.keys(changes).join(", ")}.`, details: changes, errors };
  },
  async commit(a) {
    const { id: calculId, ...patch } = a;
    await callAction(() => updateIteAction(calculId, patch));
    const saved = await getCalcul(calculId);
    return saved ? { id: saved.id, total: round2(num(saved.total)) } : { id: calculId };
  },
});

const liniaTipus = z.enum(["directa", "altra"]);

async function findConcepte(tipus: "directa" | "altra", ref: { concepte_id?: number; concepte_nom?: string }): Promise<{ id: number; nom: string; preu: string } | null> {
  const table = tipus === "directa" ? "concepte_despesa_directa" : "concepte_altra_despesa";
  const preuCol = tipus === "directa" ? "preu_hora_default" : "preu_unitat_default";
  if (ref.concepte_id) {
    const rows = (await sql.query(`select id, nom, ${preuCol}::text as preu from public.${table} where id = $1`, [ref.concepte_id])) as { id: number; nom: string; preu: string }[];
    return rows[0] ?? null;
  }
  if (ref.concepte_nom?.trim()) {
    const rows = (await sql.query(`select id, nom, ${preuCol}::text as preu from public.${table} where nom ilike $1 order by (lower(nom) = lower($2)) desc, ordre limit 1`, [`%${ref.concepte_nom.trim()}%`, ref.concepte_nom.trim()])) as { id: number; nom: string; preu: string }[];
    return rows[0] ?? null;
  }
  return null;
}

registerAction({
  kind: "change",
  name: "add_calcul_linia",
  domain: "honoraris",
  description: "Afegeix una línia a un càlcul: despesa directa (concepte + hores) o altra despesa (concepte + unitats), amb preu opcional.",
  notes: ["Els conceptes són els del catàleg (vegeu catalegs); es poden indicar per id o per nom."],
  schema: z.object({ calcul_id: id, tipus: liniaTipus, concepte_id: id.optional(), concepte_nom: shortText.optional(), quantitat: z.number().min(0).describe("Hores (directa) o unitats (altra)"), preu: money.optional() }),
  async plan(a): Promise<Plan> {
    const c = await getCalcul(a.calcul_id);
    if (!c) return { summary: "Afegir línia", errors: [`No hi ha cap càlcul amb id ${a.calcul_id}.`] };
    const errors: string[] = [];
    const k = await findConcepte(a.tipus, a);
    if (!k) errors.push("Concepte no trobat al catàleg (indica concepte_id o concepte_nom vàlids; vegeu catalegs).");
    if (c.es_ite) errors.push("Un càlcul ITE no té línies de despesa.");
    const preu = a.preu ?? num(k?.preu);
    return {
      summary: `Afegir ${a.tipus === "directa" ? `${a.quantitat} h de «${k?.nom ?? "?"}» a ${preu} €/h` : `${a.quantitat} × «${k?.nom ?? "?"}» a ${preu} €`} (${round2(a.quantitat * preu)} €) al càlcul ${calculLabel(c)}.`,
      details: { concepte: k, quantitat: a.quantitat, preu },
      errors,
    };
  },
  async commit(a) {
    const k = await findConcepte(a.tipus, a);
    if (!k) throw new Error("Concepte no trobat.");
    if (a.tipus === "directa") {
      const r = await callAction(() => addDespesaDirectaLineAction(a.calcul_id, k.id));
      const lineId = r.value;
      if (lineId) await callAction(() => updateDespesaDirectaLineAction(a.calcul_id, lineId, { hores: a.quantitat, preu_hora: a.preu }));
      const saved = await getCalcul(a.calcul_id);
      return { id: lineId, total: saved ? round2(num(saved.total)) : null };
    }
    const r = await callAction(() => addAltraDespesaLineAction(a.calcul_id, k.id));
    const lineId = r.value;
    if (lineId) await callAction(() => updateAltraDespesaLineAction(a.calcul_id, lineId, { unitats: a.quantitat, preu_unitat: a.preu }));
    const saved = await getCalcul(a.calcul_id);
    return { id: lineId, total: saved ? round2(num(saved.total)) : null };
  },
});

registerAction({
  kind: "change",
  name: "update_calcul_linia",
  domain: "honoraris",
  description: "Modifica la quantitat (hores/unitats) o el preu d'una línia d'un càlcul.",
  schema: z.object({ calcul_id: id, tipus: liniaTipus, id, quantitat: z.number().min(0).optional(), preu: money.optional() }),
  async plan(a): Promise<Plan> {
    const table = a.tipus === "directa" ? "proposta_despesa_directa_line" : "proposta_altra_despesa_line";
    const qcol = a.tipus === "directa" ? "hores" : "unitats";
    const pcol = a.tipus === "directa" ? "preu_hora" : "preu_unitat";
    const rows = (await sql.query(`select id, ${qcol}::text as quantitat, ${pcol}::text as preu from public.${table} where id = $1 and proposta_id = $2`, [a.id, a.calcul_id])) as { id: number; quantitat: string; preu: string }[];
    if (!rows[0]) return { summary: "Modificar línia", errors: ["Línia no trobada en aquest càlcul."] };
    const errors = a.quantitat === undefined && a.preu === undefined ? ["No s'ha indicat cap canvi."] : [];
    return { summary: `Modificar la línia #${a.id} (${rows[0].quantitat} × ${rows[0].preu} €).`, details: { abans: rows[0], despres: { quantitat: a.quantitat, preu: a.preu } }, errors };
  },
  async commit(a) {
    if (a.tipus === "directa") await callAction(() => updateDespesaDirectaLineAction(a.calcul_id, a.id, { hores: a.quantitat, preu_hora: a.preu }));
    else await callAction(() => updateAltraDespesaLineAction(a.calcul_id, a.id, { unitats: a.quantitat, preu_unitat: a.preu }));
    const saved = await getCalcul(a.calcul_id);
    return { id: a.id, total: saved ? round2(num(saved.total)) : null };
  },
});

registerAction({
  kind: "change",
  name: "delete_calcul_linia",
  domain: "honoraris",
  description: "Esborra una línia d'un càlcul d'honoraris.",
  destructive: true,
  schema: z.object({ calcul_id: id, tipus: liniaTipus, id }),
  async plan(a): Promise<Plan> {
    const table = a.tipus === "directa" ? "proposta_despesa_directa_line" : "proposta_altra_despesa_line";
    const rows = (await sql.query(`select id from public.${table} where id = $1 and proposta_id = $2`, [a.id, a.calcul_id])) as { id: number }[];
    if (!rows[0]) return { summary: "Esborrar línia", errors: ["Línia no trobada en aquest càlcul."] };
    return { summary: `Esborrar la línia #${a.id} (${a.tipus}) del càlcul #${a.calcul_id}.` };
  },
  async commit(a) {
    if (a.tipus === "directa") await callAction(() => deleteDespesaDirectaLineAction(a.calcul_id, a.id));
    else await callAction(() => deleteAltraDespesaLineAction(a.calcul_id, a.id));
    return { deleted_id: a.id };
  },
});
