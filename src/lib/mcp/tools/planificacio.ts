import { z } from "zod";
import { sql } from "@/lib/db";
import { addFitaAction, deleteFitaAction } from "@/app/planificacio/actions";
import { todayIso } from "@/lib/format";
import { id, isoDate, registerAction, shortText, type Plan } from "../core";
import { expedientLabel, lastInsertedId, resolveExpedient } from "../data";
import { callAction } from "../shared";

interface FitaTipus {
  id: number;
  nom: string;
  forma: string;
  color: string;
}

async function fitaTipusAll(): Promise<FitaTipus[]> {
  return (await sql`select id, nom, forma, color from public.fita_tipus order by nom`) as FitaTipus[];
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Reads -----------------------------------------------------------------------

registerAction({
  kind: "read",
  name: "planificacio",
  domain: "planificacio",
  description: "Vista de planificació: expedients oberts amb dates i hores (previstes vs reals), visites d'obra i fites properes.",
  schema: z.object({
    setmanes_enrere: z.number().int().min(0).max(52).default(2),
    setmanes_endavant: z.number().int().min(0).max(104).default(6),
  }),
  async run(a) {
    const today = todayIso();
    const from = addDays(today, -7 * a.setmanes_enrere);
    const to = addDays(today, 7 * a.setmanes_endavant);
    const [items, visites, fites] = await Promise.all([
      sql`
        select e.id, e.num_expedient, e.projecte, e.categoria, c.nom as client_nom, e.ciutat, e.tipus, e.direccio_obres,
               t.nom as tipologia_nom, e.pressupost::text as pressupost,
               to_char(e.data_inici,'YYYY-MM-DD') as data_inici, to_char(e.data_final,'YYYY-MM-DD') as data_final,
               coalesce(public.calcul_planned_hores(e.calcul_id),0)::text as planned_hores,
               coalesce((select sum(hores) from public.dedicacions where expedient_id = e.id),0)::text as actual_hores
        from public.expedients e
        left join public.clients c on c.id = e.client_id
        left join public.tipologies t on t.id = e.tipologia_id
        where e.estat = 'obert' and e.num_expedient not like '00-%'
        order by e.data_inici nulls last, e.num_expedient`,
      sql`
        select d.id as dedicacio_id, e.num_expedient, e.projecte, to_char(d.data,'YYYY-MM-DD') as data, d.hores::text as hores, d.comentari, e.ciutat
        from public.dedicacions d join public.expedients e on e.id = d.expedient_id
        where e.estat = 'obert' and d.tasca ilike 'Visita direcció d''obres' and d.data between ${from}::date and ${to}::date
        order by d.data`,
      sql`
        select f.id, e.num_expedient, e.projecte, to_char(f.data,'YYYY-MM-DD') as data, t.nom as tipus
        from public.expedient_fita f join public.fita_tipus t on t.id = f.tipus_id join public.expedients e on e.id = f.expedient_id
        where e.estat = 'obert' and f.data between ${from}::date and ${to}::date
        order by f.data`,
    ]);
    return { avui: today, finestra: { from, to }, expedients_oberts: items, visites_obra: visites, fites };
  },
});

registerAction({
  kind: "read",
  name: "list_fites",
  domain: "planificacio",
  description: "Fites (milestones) d'un expedient o de tots, amb el catàleg de tipus de fita.",
  schema: z.object({ expedient_id: id.optional(), expedient_num: shortText.optional(), from: isoDate.optional(), to: isoDate.optional() }),
  async run(a) {
    const r = await resolveExpedient(a);
    if (r.error) return { error: r.error };
    const fites = await sql`
      select f.id, f.expedient_id, e.num_expedient, e.projecte, to_char(f.data,'YYYY-MM-DD') as data, t.id as tipus_id, t.nom as tipus
      from public.expedient_fita f join public.fita_tipus t on t.id = f.tipus_id join public.expedients e on e.id = f.expedient_id
      where (${r.expedient?.id ?? null}::bigint is null or f.expedient_id = ${r.expedient?.id ?? null})
        and (${a.from ?? null}::date is null or f.data >= ${a.from ?? null}::date)
        and (${a.to ?? null}::date is null or f.data <= ${a.to ?? null}::date)
      order by f.data, f.id`;
    return { fites, tipus: await fitaTipusAll() };
  },
});

// Changes ---------------------------------------------------------------------

registerAction({
  kind: "change",
  name: "add_fita",
  domain: "planificacio",
  description: "Afegeix una fita a un expedient en una data, d'un tipus existent (tipus_id) o nou (nom).",
  notes: ["Consulta els tipus amb list_fites. Si nom no existeix, es crea un tipus nou amb forma i color opcionals."],
  schema: z.object({
    expedient_id: id.optional(),
    expedient_num: shortText.optional(),
    data: isoDate,
    tipus_id: id.optional(),
    nom: shortText.optional().describe('Nom del tipus, p. ex. "Lliurament projecte"'),
    forma: z.enum(["diamond", "circle", "square", "triangle", "star"]).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  }),
  async plan(a): Promise<Plan> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const r = await resolveExpedient(a);
    if (r.error) errors.push(r.error);
    if (!r.expedient && !r.error) errors.push("Cal expedient_id o expedient_num.");
    const tipus = await fitaTipusAll();
    let tipusNom: string | null = null;
    if (a.tipus_id) {
      const t = tipus.find((x) => x.id === a.tipus_id);
      if (!t) errors.push(`No hi ha cap tipus de fita amb id ${a.tipus_id}. Disponibles: ${tipus.map((t) => `${t.id}=${t.nom}`).join(", ")}`);
      else tipusNom = t.nom;
    } else if (a.nom?.trim()) {
      const existing = tipus.find((x) => x.nom.toLowerCase() === a.nom!.trim().toLowerCase());
      tipusNom = existing?.nom ?? a.nom.trim();
      if (!existing) warnings.push(`Es crearà el tipus de fita nou «${tipusNom}».`);
    } else {
      errors.push("Cal tipus_id o nom.");
    }
    return {
      summary: `Afegir la fita «${tipusNom ?? "?"}» el ${a.data} a ${expedientLabel(r.expedient)}.`,
      details: { expedient_id: r.expedient?.id ?? null, data: a.data, tipus: tipusNom },
      errors,
      warnings,
    };
  },
  async commit(a) {
    const r = await resolveExpedient(a);
    if (!r.expedient) throw new Error("Expedient no trobat.");
    const tipus = await fitaTipusAll();
    const existing = a.nom ? tipus.find((x) => x.nom.toLowerCase() === a.nom!.trim().toLowerCase()) : undefined;
    await callAction(() =>
      addFitaAction({
        expedientId: r.expedient!.id,
        tipusId: a.tipus_id ?? existing?.id ?? null,
        novaNom: a.nom ?? "",
        forma: a.forma ?? "diamond",
        color: a.color ?? "#facc15",
        data: a.data,
      }),
    );
    const newId = await lastInsertedId("expedient_fita");
    return { id: newId, expedient: expedientLabel(r.expedient), data: a.data };
  },
});

registerAction({
  kind: "change",
  name: "delete_fita",
  domain: "planificacio",
  description: "Esborra una fita d'un expedient.",
  destructive: true,
  schema: z.object({ id }),
  async plan(a): Promise<Plan> {
    const rows = (await sql`
      select f.id, e.num_expedient, e.projecte, to_char(f.data,'YYYY-MM-DD') as data, t.nom as tipus
      from public.expedient_fita f join public.fita_tipus t on t.id = f.tipus_id join public.expedients e on e.id = f.expedient_id
      where f.id = ${a.id}`) as { id: number; num_expedient: string; projecte: string | null; data: string; tipus: string }[];
    const f = rows[0];
    if (!f) return { summary: "Esborrar fita", errors: [`No hi ha cap fita amb id ${a.id}.`] };
    return { summary: `Esborrar la fita «${f.tipus}» del ${f.data} a ${expedientLabel(f)}.`, details: f };
  },
  async commit(a) {
    await callAction(() => deleteFitaAction(a.id));
    return { deleted_id: a.id };
  },
});
