// ITE reports (Inspecció Tècnica de l'Edifici) from the chat: read them, fill
// any field of the form, manage floors, envelope elements, deficiencies and
// sustainability measures, and pull the building data from the Cadastre.
// Exporting the portal's zip and adding photos are done on the web page.
import { z } from "zod";
import { sql } from "@/lib/db";
import { consultaCadastreAction, createIteFromDocAction, removeIteFitxersAction, saveIteAction } from "@/app/ite/actions";
import { applyCadastre } from "@/lib/ite/cadastre";
import { applyIteEdit, iteAsText, iteCamps, removedMedia, type IteEdit } from "@/lib/ite/edit";
import { fotoPaquet } from "@/lib/ite/fotos";
import { getAt, setAt, validateIte, valoracioFavorable } from "@/lib/ite/model";
import { SECTIONS } from "@/lib/ite/schema";
import { loadCataleg, loadIte, newDocFor } from "@/lib/ite/server";
import { id, idOrNull, longText, registerAction, shortText, type Plan } from "../core";
import { resolveClient, resolveExpedient } from "../data";
import { callAction } from "../shared";

const SECCIONS = SECTIONS.map((s) => s.key) as [string, ...string[]];

const campValue = z.union([z.string().max(20000), z.number(), z.boolean(), z.null()]);
const def = {
  tipus: shortText.optional().describe("Tipus de deficiència: codi (p. ex. DEF_ENV_TERR_FILTR) o text; la llista és a ite_camps seccio=deficiencies."),
  gravetat: shortText.optional().describe("MG, G, I o LL (molt greu, greu, important, lleu)"),
  descripcio: longText.optional().describe("Descripció de la deficiència i localització"),
  observacions: longText.optional(),
};
const env = { tipus: shortText.optional().describe("Façanes, Cobertes, Patis…"), descripcio: longText.optional() };
const planta = {
  descripcio: shortText.optional().describe("p. ex. «Principal 1a»"),
  habitatges: z.number().int().min(0).max(50).optional(),
  locals: z.number().int().min(0).max(50).optional(),
  parquing: z.boolean().optional(),
  visitades: z.union([z.array(z.number().int().min(1)), z.boolean()]).optional().describe("Portes visitades (1 = la primera de la fila) o true per a totes"),
};
const mesura = { descripcio: longText.optional() };
function ops<S extends z.ZodRawShape>(shape: S) {
  return z
    .object({
      afegir: z.array(z.object(shape)).max(100).optional(),
      modificar: z.array(z.object({ ...shape, index: z.number().int().min(0) })).max(100).optional().describe("Per índex de get_ite"),
      treure: z.array(z.number().int().min(0)).max(100).optional().describe("Índexs de get_ite"),
    })
    .optional();
}
const editShape = {
  camps: z.record(z.string().max(120), campValue).optional().describe("Camp (ruta de ite_camps) → valor. Booleans true/false; tri-estat \"si\"/\"no\"/\"es_desconeix\"; números; dates YYYY-MM-DD; llistes pel codi o el text; null buida el camp."),
  deficiencies: ops(def),
  envolupants: ops(env),
  plantes: ops(planta),
  mesures: ops(mesura),
};

function editOf(a: IteEdit): IteEdit {
  return { camps: a.camps, deficiencies: a.deficiencies, envolupants: a.envolupants, plantes: a.plantes, mesures: a.mesures };
}

function hasEdit(e: IteEdit): boolean {
  return !!(e.camps && Object.keys(e.camps).length) || !!e.deficiencies || !!e.envolupants || !!e.plantes || !!e.mesures;
}

function link(origin: string | undefined, iteId: number): string {
  return `${origin ?? ""}/ite/${iteId}`;
}

// Reads -------------------------------------------------------------------------

registerAction({
  kind: "read",
  name: "list_ites",
  domain: "ite",
  description: "Informes ITE (inspecció tècnica d'edificis) de l'app: nom, adreça, expedient, data d'inspecció i nombre de deficiències.",
  schema: z.object({ q: shortText.optional() }),
  async run(a) {
    const like = a.q?.trim() ? `%${a.q.trim()}%` : null;
    const rows = await sql`
      select i.id, i.nom, i.adreca, to_char(i.data_inspeccio, 'YYYY-MM-DD') as data_inspeccio, e.num_expedient as expedient_num, c.nom as client,
             case when jsonb_typeof(i.dades -> 'deficiencies') = 'array' then jsonb_array_length(i.dades -> 'deficiencies') else 0 end as deficiencies,
             to_char(i.exportat_at, 'YYYY-MM-DD') as exportat, to_char(i.updated_at, 'YYYY-MM-DD') as actualitzat
      from public.ite_informe i
      left join public.expedients e on e.id = i.expedient_id
      left join public.clients c on c.id = i.client_id
      where ${like}::text is null or i.nom ilike ${like} or i.adreca ilike ${like} or e.num_expedient ilike ${like} or c.nom ilike ${like}
      order by i.updated_at desc limit 100`;
    return { ites: rows };
  },
});

registerAction({
  kind: "read",
  name: "get_ite",
  domain: "ite",
  description: "Un informe ITE: els camps omplerts per seccions, les plantes, l'envolupant, les deficiències i les mesures (amb índex), i la revisió abans d'exportar.",
  notes: ["seccio limita la resposta a una secció: " + SECCIONS.join(", ")],
  schema: z.object({ id, seccio: z.enum(SECCIONS).optional() }),
  async run(a, ctx) {
    const ite = await loadIte(a.id);
    if (!ite) return { error: `No hi ha cap informe ITE amb id ${a.id}.` };
    const cataleg = await loadCataleg();
    const check = validateIte(ite.dades, cataleg);
    const paquet = fotoPaquet(ite.dades, cataleg);
    return {
      id: ite.id,
      nom: ite.nom,
      url: link(ctx.origin, ite.id),
      expedient_id: ite.expedient_id,
      client_id: ite.client_id,
      exportat: ite.exportat_at,
      valoracio_final: valoracioFavorable(ite.dades) ? "FAVORABLE" : "DESFAVORABLE",
      informe: iteAsText(ite.dades, cataleg, a.seccio),
      fotos: {
        total: paquet.fitxers.length,
        sense_fitxer: paquet.falten.length,
        zip: `${paquet.nom}.zip`,
        com: "Els noms de fitxer de l'informe són els del zip «Descarregar fotos» (secció Portal de la web), que porta index.txt amb els peus. Les fotos es pugen al portal des d'aquest zip, no des del xat.",
      },
      revisio: check,
    };
  },
});

registerAction({
  kind: "read",
  name: "ite_camps",
  domain: "ite",
  description: "Els camps d'un informe ITE que es poden omplir (ruta, etiqueta del portal, tipus i opcions), per seccions.",
  notes: [
    "La ruta (camp) és la clau a camps de create_ite/update_ite.",
    "Les opcions de les llistes són les que el portal ha fet servir en informes importats; si en falta una, l'usuari ha d'importar un informe del portal que la tingui.",
  ],
  schema: z.object({ seccio: z.enum(SECCIONS).optional() }),
  async run(a) {
    const cataleg = await loadCataleg();
    const out: Record<string, unknown> = { seccions: iteCamps(cataleg, a.seccio) };
    if (!a.seccio || a.seccio === "deficiencies" || a.seccio === "envolupant") {
      out.tipus_deficiencia = (cataleg.tipus_deficiencia ?? []).map((o) => ({ valor: o.codi, text: o.descMultidioma ?? o.descripcio }));
      out.gravetat = (cataleg.gravetat ?? []).map((o) => ({ valor: o.valor, text: o.descMultidioma }));
      out.tipus_envolupant = (cataleg.tipus_envolupant ?? []).map((o) => ({ valor: o.codi, text: o.descMultidioma ?? o.descripcio }));
    }
    return out;
  },
});

// Changes ------------------------------------------------------------------------

registerAction({
  kind: "change",
  name: "create_ite",
  domain: "ite",
  description: "Crea un informe ITE amb el tècnic del despatx, la propietat des del client i l'adreça des de l'expedient; opcionalment omple camps i llistes alhora.",
  notes: ["Accepta els mateixos camps i llistes que update_ite.", "Després, a la web: fotos, revisió i «Descarregar fotos» per pujar-les al portal."],
  schema: z.object({ expedient_num: shortText.optional(), expedient_id: idOrNull.optional(), client_id: idOrNull.optional(), contacte_id: idOrNull.optional(), ...editShape }),
  async plan(a): Promise<Plan> {
    const errors: string[] = [];
    const r = await resolveExpedient({ expedient_id: a.expedient_id ?? null, expedient_num: a.expedient_num ?? null });
    if (r.error) errors.push(r.error);
    const c = await resolveClient(a.client_id ?? null);
    if (c.error) errors.push(c.error);
    if (errors.length) return { summary: "Crear informe ITE", errors };
    const cataleg = await loadCataleg();
    const base = await newDocFor({ expedientId: r.expedient?.id ?? null, clientId: c.client?.id ?? null, contacteId: a.contacte_id ?? null }, cataleg);
    const edit = editOf(a);
    const res = hasEdit(edit) ? applyIteEdit(base.doc, edit, cataleg) : { doc: base.doc, changes: [], errors: [], warnings: [] };
    return {
      summary: `Crear l'informe ITE «${String(res.doc.nom)}»${r.expedient ? ` de l'expedient ${r.expedient.num_expedient}` : ""}${res.changes.length ? ` amb ${res.changes.length} canvis` : ""}.`,
      details: { propietat: getAt(res.doc, "propietat.raoSocialPropietat") ?? null, adreca: getAt(res.doc, "edifici.referenciaCadastral.nomVia") ?? null, canvis: res.changes },
      errors: res.errors,
      warnings: res.warnings,
    };
  },
  async commit(a, _plan, ctx) {
    const r = await resolveExpedient({ expedient_id: a.expedient_id ?? null, expedient_num: a.expedient_num ?? null });
    const c = await resolveClient(a.client_id ?? null);
    const cataleg = await loadCataleg();
    const base = await newDocFor({ expedientId: r.expedient?.id ?? null, clientId: c.client?.id ?? null, contacteId: a.contacte_id ?? null }, cataleg);
    const edit = editOf(a);
    const doc = hasEdit(edit) ? applyIteEdit(base.doc, edit, cataleg).doc : base.doc;
    const res = await callAction(() => createIteFromDocAction(doc, base.expedientId, base.clientId));
    if (!res.value) throw new Error("No s'ha pogut crear l'informe.");
    return { id: res.value, nom: doc.nom, url: link(ctx.origin, res.value) };
  },
});

registerAction({
  kind: "change",
  name: "update_ite",
  domain: "ite",
  description: "Omple o canvia camps d'un informe ITE (per ruta de ite_camps) i afegeix, modifica o treu plantes, elements de l'envolupant, deficiències i mesures.",
  notes: [
    "Llegeix-lo primer amb get_ite: les llistes porten l'índex que fan servir modificar i treure. Ordre: modificar, treure, afegir.",
    "Deficiència nova: tipus i gravetat obligatoris. Gravetat: MG, G, I o LL.",
    "Les fotos s'afegeixen a la web (botó + Fotos de cada element o deficiència).",
  ],
  schema: z.object({ id, ...editShape }),
  async plan(a): Promise<Plan> {
    const ite = await loadIte(a.id);
    if (!ite) return { summary: "Modificar informe ITE", errors: [`No hi ha cap informe ITE amb id ${a.id}.`] };
    const cataleg = await loadCataleg();
    const res = applyIteEdit(ite.dades, editOf(a), cataleg);
    return { summary: `Modificar l'informe ITE «${ite.nom}»: ${res.changes.length} canvis.`, details: { canvis: res.changes }, errors: res.errors, warnings: res.warnings };
  },
  async commit(a, _plan, ctx) {
    const ite = await loadIte(a.id);
    if (!ite) throw new Error("Informe no trobat.");
    const cataleg = await loadCataleg();
    const res = applyIteEdit(ite.dades, editOf(a), cataleg);
    if (res.errors.length) throw new Error(res.errors.join(" "));
    await callAction(() => saveIteAction(a.id, res.doc));
    const gone = removedMedia(ite.dades, res.doc);
    if (gone.length) await callAction(() => removeIteFitxersAction(a.id, gone));
    return { id: a.id, canvis: res.changes, url: link(ctx.origin, a.id) };
  },
});

registerAction({
  kind: "change",
  name: "ite_cadastre",
  domain: "ite",
  description: "Omple un informe ITE amb les dades del Cadastre (adreça, any de construcció, superfície construïda i, si es demana, la taula de plantes) a partir de la referència cadastral.",
  notes: ["finca (7 caràcters) i full (7) són els 14 primers de la referència cadastral; si no es donen, es fan servir els de l'informe."],
  schema: z.object({ id, finca: z.string().max(7).optional(), full: z.string().max(7).optional(), plantes: z.boolean().optional().describe("Substitueix la taula de plantes"), nom: z.boolean().optional().describe("Posa el nom de l'informe segons l'adreça") }),
  async plan(a): Promise<Plan> {
    const ite = await loadIte(a.id);
    if (!ite) return { summary: "Dades del Cadastre", errors: [`No hi ha cap informe ITE amb id ${a.id}.`] };
    const finca = (a.finca ?? String(getAt(ite.dades, "edifici.cadasFinca") ?? "")).toUpperCase();
    const full = (a.full ?? String(getAt(ite.dades, "edifici.cadasPlanol") ?? "")).toUpperCase();
    const r = await consultaCadastreAction(finca, full);
    if (!r.ok) return { summary: "Dades del Cadastre", errors: [r.error] };
    const d = r.dades;
    return {
      summary: `Omplir «${ite.nom}» amb el Cadastre (${finca}${full}): ${d.viaWord || d.viaCodi} ${d.nomVia}, ${d.numero}, ${d.municipi}; any ${d.anyConstruccio ?? "?"}; ${d.superficieConstruida} m²${a.plantes ? `; ${d.unitats.length} files de plantes` : ""}.`,
      details: { unitats: d.unitats.map((u) => `${u.planta} ${u.porta} · ${u.us} · ${u.superficie} m²`) },
      warnings: a.plantes ? ["La taula de plantes actual se substituirà."] : [],
    };
  },
  async commit(a, _plan, ctx) {
    const ite = await loadIte(a.id);
    if (!ite) throw new Error("Informe no trobat.");
    const finca = (a.finca ?? String(getAt(ite.dades, "edifici.cadasFinca") ?? "")).toUpperCase();
    const full = (a.full ?? String(getAt(ite.dades, "edifici.cadasPlanol") ?? "")).toUpperCase();
    const r = await consultaCadastreAction(finca, full);
    if (!r.ok) throw new Error(r.error);
    const cataleg = await loadCataleg();
    let doc = applyCadastre(ite.dades, r.dades, cataleg, { adreca: true, any: true, superficie: true, plantes: !!a.plantes, nom: !!a.nom });
    doc = setAt(setAt(doc, "edifici.cadasFinca", finca), "edifici.cadasPlanol", full);
    await callAction(() => saveIteAction(a.id, doc));
    return { id: a.id, url: link(ctx.origin, a.id) };
  },
});
