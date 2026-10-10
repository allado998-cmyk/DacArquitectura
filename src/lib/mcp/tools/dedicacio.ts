import { z } from "zod";
import { sql } from "@/lib/db";
import { createDedicacioAction, deleteDedicacioAction, updateDedicacioAction } from "@/app/dedicacio/actions";
import { todayIso } from "@/lib/format";
import { id, isoDate, registerAction, shortText, type Plan } from "../core";
import { expedientLabel, lastInsertedId, listTasques, resolveExpedient } from "../data";
import { callAction } from "../shared";

interface DedicacioRow {
  id: number;
  expedient_id: number | null;
  activitat: string | null;
  num_expedient: string | null;
  projecte: string | null;
  client_nom: string | null;
  data: string;
  hores: string;
  tasca: string | null;
  comentari: string | null;
}

async function getDedicacio(idv: number): Promise<DedicacioRow | null> {
  const rows = (await sql`
    select d.id, d.expedient_id, d.activitat, e.num_expedient, e.projecte, c.nom as client_nom,
           to_char(d.data,'YYYY-MM-DD') as data, d.hores::text as hores, d.tasca, d.comentari
    from public.dedicacions d
    left join public.expedients e on e.id = d.expedient_id
    left join public.clients c on c.id = e.client_id
    where d.id = ${idv}
  `) as DedicacioRow[];
  return rows[0] ?? null;
}

function targetLabel(d: { num_expedient?: string | null; projecte?: string | null; activitat?: string | null }): string {
  return d.num_expedient ? expedientLabel({ num_expedient: d.num_expedient, projecte: d.projecte ?? null }) : `activitat «${d.activitat ?? "—"}»`;
}

// Warn (never block) when a tasca is not in the catalog; the website accepts free text too.
async function tascaWarning(tasca: string | undefined): Promise<string | null> {
  if (!tasca) return null;
  const all = await listTasques();
  if (all.some((t) => t.nom.toLowerCase() === tasca.trim().toLowerCase())) return null;
  return `La tasca «${tasca}» no és al catàleg (${all.map((t) => t.nom).join(", ")}). Es desarà igualment com a text lliure.`;
}

// Reads -----------------------------------------------------------------------

registerAction({
  kind: "read",
  name: "list_dedicacions",
  domain: "dedicacio",
  description: "Entrades d'hores dedicades, filtrables per expedient, dates, tasca o text; inclou el total.",
  schema: z.object({
    expedient_id: id.optional(),
    expedient_num: shortText.optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    tasca: shortText.optional(),
    q: shortText.optional().describe("Text a cercar al comentari, activitat o projecte"),
    limit: z.number().int().min(1).max(1000).default(200),
  }),
  async run(a) {
    const r = await resolveExpedient(a);
    if (r.error) return { error: r.error };
    const like = a.q ? `%${a.q.trim()}%` : null;
    const rows = (await sql`
      select d.id, d.expedient_id, e.num_expedient, e.projecte, d.activitat, c.nom as client_nom,
             to_char(d.data,'YYYY-MM-DD') as data, d.hores::text as hores, d.tasca, d.comentari
      from public.dedicacions d
      left join public.expedients e on e.id = d.expedient_id
      left join public.clients c on c.id = e.client_id
      where (${r.expedient?.id ?? null}::bigint is null or d.expedient_id = ${r.expedient?.id ?? null})
        and (${a.from ?? null}::date is null or d.data >= ${a.from ?? null}::date)
        and (${a.to ?? null}::date is null or d.data <= ${a.to ?? null}::date)
        and (${a.tasca ?? null}::text is null or d.tasca ilike ${a.tasca ?? null})
        and (${like}::text is null or coalesce(d.comentari,'') ilike ${like} or coalesce(d.activitat,'') ilike ${like} or coalesce(e.projecte,'') ilike ${like})
      order by d.data desc, d.id desc
      limit ${a.limit}
    `) as DedicacioRow[];
    const total = rows.reduce((s, r) => s + parseFloat(r.hores), 0);
    return { count: rows.length, hores_total: Math.round(total * 100) / 100, dedicacions: rows };
  },
});

registerAction({
  kind: "read",
  name: "hores_resum",
  domain: "dedicacio",
  description: "Resum d'hores agrupat per expedient, client, tasca o mes, en un interval de dates.",
  schema: z.object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    group_by: z.enum(["expedient", "client", "tasca", "mes"]).default("expedient"),
  }),
  async run(a) {
    const from = a.from ?? null;
    const to = a.to ?? null;
    let rows: unknown[];
    if (a.group_by === "mes") {
      rows = await sql`
        select to_char(date_trunc('month', data),'YYYY-MM') as mes, sum(hores)::text as hores, count(*)::int as entrades
        from public.dedicacions
        where (${from}::date is null or data >= ${from}::date) and (${to}::date is null or data <= ${to}::date)
        group by 1 order by 1 desc`;
    } else if (a.group_by === "tasca") {
      rows = await sql`
        select coalesce(tasca,'(sense tasca)') as tasca, sum(hores)::text as hores, count(*)::int as entrades
        from public.dedicacions
        where (${from}::date is null or data >= ${from}::date) and (${to}::date is null or data <= ${to}::date)
        group by 1 order by sum(hores) desc`;
    } else if (a.group_by === "client") {
      rows = await sql`
        select coalesce(c.nom, case when d.expedient_id is null then '(activitats internes)' else '(sense client)' end) as client,
               sum(d.hores)::text as hores, count(*)::int as entrades
        from public.dedicacions d
        left join public.expedients e on e.id = d.expedient_id
        left join public.clients c on c.id = e.client_id
        where (${from}::date is null or d.data >= ${from}::date) and (${to}::date is null or d.data <= ${to}::date)
        group by 1 order by sum(d.hores) desc`;
    } else {
      rows = await sql`
        select d.expedient_id, coalesce(e.num_expedient, '(activitat)') as num_expedient, coalesce(e.projecte, d.activitat) as projecte,
               sum(d.hores)::text as hores, count(*)::int as entrades,
               coalesce(public.calcul_planned_hores(e.calcul_id), 0)::text as planned_hores
        from public.dedicacions d
        left join public.expedients e on e.id = d.expedient_id
        where (${from}::date is null or d.data >= ${from}::date) and (${to}::date is null or d.data <= ${to}::date)
        group by d.expedient_id, e.num_expedient, e.projecte, d.activitat, e.calcul_id
        order by sum(d.hores) desc`;
    }
    return { from, to, group_by: a.group_by, rows };
  },
});

// Changes ---------------------------------------------------------------------

registerAction({
  kind: "change",
  name: "create_dedicacio",
  domain: "dedicacio",
  description: "Registra hores dedicades a un expedient (per id o número) o a una activitat interna.",
  notes: ["Cal expedient_id o expedient_num, o bé activitat (text) si no és d'un expedient.", "La data per defecte és avui."],
  schema: z.object({
    expedient_id: id.optional(),
    expedient_num: shortText.optional(),
    activitat: shortText.optional().describe('Activitat interna quan no hi ha expedient, p. ex. "Treball de web"'),
    data: isoDate.optional(),
    hores: z.number().positive().max(24),
    tasca: shortText.optional(),
    comentari: shortText.optional(),
  }),
  async plan(a): Promise<Plan> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const r = await resolveExpedient(a);
    if (r.error) errors.push(r.error);
    if (!r.expedient && !a.activitat?.trim()) errors.push("Cal un expedient (id o número) o una activitat.");
    if (r.expedient?.estat === "tancat") warnings.push("L'expedient està tancat.");
    const tw = await tascaWarning(a.tasca);
    if (tw) warnings.push(tw);
    const data = a.data ?? todayIso();
    const target = r.expedient ? expedientLabel(r.expedient) : `activitat «${a.activitat}»`;
    return {
      summary: `Registrar ${a.hores} h el ${data} a ${target}${a.tasca ? ` (${a.tasca})` : ""}.`,
      details: { expedient_id: r.expedient?.id ?? null, target, data, hores: a.hores, tasca: a.tasca ?? null, comentari: a.comentari ?? null },
      errors,
      warnings,
    };
  },
  async commit(a) {
    const r = await resolveExpedient(a);
    await callAction(() =>
      createDedicacioAction({
        expedientId: r.expedient?.id ?? null,
        activitat: r.expedient ? "" : (a.activitat ?? ""),
        data: a.data ?? todayIso(),
        hores: a.hores,
        tasca: a.tasca ?? "",
        comentari: a.comentari ?? "",
      }),
    );
    const newId = await lastInsertedId("dedicacions");
    const d = newId ? await getDedicacio(newId) : null;
    return d ? { id: d.id, target: targetLabel(d), data: d.data, hores: d.hores } : { ok: true };
  },
});

registerAction({
  kind: "change",
  name: "update_dedicacio",
  domain: "dedicacio",
  description: "Modifica una entrada de dedicació (data, hores, tasca, comentari o expedient/activitat).",
  schema: z.object({
    id,
    data: isoDate.optional(),
    hores: z.number().positive().max(24).optional(),
    tasca: shortText.optional(),
    comentari: shortText.optional(),
    expedient_id: id.nullable().optional().describe("Nou expedient; null per passar a activitat interna (cal activitat)"),
    expedient_num: shortText.optional(),
    activitat: shortText.optional(),
  }),
  async plan(a): Promise<Plan> {
    const d = await getDedicacio(a.id);
    if (!d) return { summary: "Modificar dedicació", errors: [`No hi ha cap dedicació amb id ${a.id}.`] };
    const errors: string[] = [];
    const warnings: string[] = [];
    const changes: Record<string, unknown> = {};
    if (a.data) changes.data = a.data;
    if (a.hores !== undefined) changes.hores = a.hores;
    if (a.tasca !== undefined) changes.tasca = a.tasca;
    if (a.comentari !== undefined) changes.comentari = a.comentari;
    if (a.expedient_id !== undefined || a.expedient_num) {
      if (a.expedient_id === null && !a.activitat?.trim()) errors.push("Per treure l'expedient cal indicar una activitat.");
      const r = await resolveExpedient({ expedient_id: a.expedient_id ?? null, expedient_num: a.expedient_num ?? null });
      if (r.error) errors.push(r.error);
      changes.target = r.expedient ? expedientLabel(r.expedient) : `activitat «${a.activitat}»`;
    }
    const tw = await tascaWarning(a.tasca);
    if (tw) warnings.push(tw);
    if (Object.keys(changes).length === 0) errors.push("No s'ha indicat cap canvi.");
    return { summary: `Modificar la dedicació #${d.id} (${d.data}, ${d.hores} h, ${targetLabel(d)}).`, details: { abans: d, despres: changes }, errors, warnings };
  },
  async commit(a) {
    const patch: Parameters<typeof updateDedicacioAction>[1] = {};
    if (a.data) patch.data = a.data;
    if (a.hores !== undefined) patch.hores = a.hores;
    if (a.tasca !== undefined) patch.tasca = a.tasca;
    if (a.comentari !== undefined) patch.comentari = a.comentari;
    if (a.expedient_id !== undefined || a.expedient_num) {
      const r = await resolveExpedient({ expedient_id: a.expedient_id ?? null, expedient_num: a.expedient_num ?? null });
      patch.expedientId = r.expedient?.id ?? null;
      patch.activitat = a.activitat ?? "";
    }
    await callAction(() => updateDedicacioAction(a.id, patch));
    const d = await getDedicacio(a.id);
    return d ? { id: d.id, target: targetLabel(d), data: d.data, hores: d.hores, tasca: d.tasca } : { ok: true };
  },
});

registerAction({
  kind: "change",
  name: "delete_dedicacio",
  domain: "dedicacio",
  description: "Esborra una entrada de dedicació.",
  destructive: true,
  schema: z.object({ id }),
  async plan(a): Promise<Plan> {
    const d = await getDedicacio(a.id);
    if (!d) return { summary: "Esborrar dedicació", errors: [`No hi ha cap dedicació amb id ${a.id}.`] };
    return { summary: `Esborrar la dedicació #${d.id}: ${d.data}, ${d.hores} h, ${targetLabel(d)}${d.tasca ? ` (${d.tasca})` : ""}.`, details: d };
  },
  async commit(a) {
    await callAction(() => deleteDedicacioAction(a.id));
    return { deleted_id: a.id };
  },
});
