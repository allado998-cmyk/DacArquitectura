// ITE reports (Inspecció Tècnica de l'Edifici) from the chat: read them, fill
// any field of the form, manage floors, envelope elements, deficiencies and
// sustainability measures, pull the building data from the Cadastre, and
// sort the visit's photos: the user uploads them through a link (chat images
// never reach the plugin), the assistant looks at them in small size and puts
// each one in its place with a caption. The portal's photo zip is made on the
// web page.
import { z } from "zod";
import { sql } from "@/lib/db";
import { consultaCadastreAction, createIteFromDocAction, removeIteFitxersAction, saveIteAction } from "@/app/ite/actions";
import { applyCadastre } from "@/lib/ite/cadastre";
import { visibles } from "@/lib/ite/cataleg";
import { applyIteEdit, iteAsText, iteCamps, removedMedia, type IteEdit } from "@/lib/ite/edit";
import { codiLloc, fotoPaquet, llocsFotos, PEU_MAX, pendentsDe, posarFoto, type FotoCarpeta } from "@/lib/ite/fotos";
import { getAt, setAt, validateIte, valoracioFavorable } from "@/lib/ite/model";
import { esborrarPendents, fotosCarpeta, miniatura } from "@/lib/ite/pendents";
import { SECTIONS } from "@/lib/ite/schema";
import { loadCataleg, loadIte, newDocFor, type IteRow } from "@/lib/ite/server";
import { actaUploadUrl, createIteUploadToken, UPLOAD_LINK_TTL_S } from "@/lib/upload-link";
import { id, idOrNull, longText, registerAction, shortText, type Plan, type ToolImage } from "../core";
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

// The photos waiting for a place, or null if the file store cannot be read.
async function pendentsOf(ite: IteRow): Promise<FotoCarpeta[] | null> {
  try {
    return pendentsDe(await fotosCarpeta(ite.id), ite.dades);
  } catch (e) {
    console.error("ite: pending photos", e);
    return null;
  }
}

const FOTOS_COM =
  "Fotos: l'usuari les puja amb l'enllaç d'ite_enllac_fotos (les del xat no arriben a les eines); tu les mires amb ite_fotos_pendents i les col·loques amb ite_colocar_fotos, amb un peu per a cada una. Per al portal, el zip «Descarregar fotos» de la web (secció Portal i PDF) les dona amb aquests noms (D01-1.jpg…) i comprimides.";

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
             to_char(i.updated_at, 'YYYY-MM-DD') as actualitzat
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
  description: "Un informe ITE: els camps omplerts per seccions, les plantes, l'envolupant, les deficiències i les mesures (amb índex), i la revisió (el que el portal demana per deixar tancar l'informe).",
  notes: ["seccio limita la resposta a una secció: " + SECCIONS.join(", ")],
  schema: z.object({ id, seccio: z.enum(SECCIONS).optional() }),
  async run(a, ctx) {
    const ite = await loadIte(a.id);
    if (!ite) return { error: `No hi ha cap informe ITE amb id ${a.id}.` };
    const cataleg = await loadCataleg();
    const check = validateIte(ite.dades, cataleg);
    const paquet = fotoPaquet(ite.dades, cataleg);
    const pendents = await pendentsOf(ite);
    return {
      id: ite.id,
      nom: ite.nom,
      url: link(ctx.origin, ite.id),
      expedient_id: ite.expedient_id,
      client_id: ite.client_id,
      valoracio_final: valoracioFavorable(ite.dades) ? "FAVORABLE" : "DESFAVORABLE",
      informe: iteAsText(ite.dades, cataleg, a.seccio),
      fotos: {
        total: paquet.fitxers.length,
        sense_fitxer: paquet.falten.length,
        per_classificar: pendents?.length ?? null,
        zip: `${paquet.nom}.zip`,
        com: FOTOS_COM,
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
    "Les opcions de les llistes són les del formulari del portal; als valors de llista es pot donar el text (p. ex. el nom del municipi).",
    "obligatori: el portal no deixa tancar l'informe sense aquest camp (get_ite → revisio diu què falta).",
  ],
  schema: z.object({ seccio: z.enum(SECCIONS).optional() }),
  async run(a) {
    const cataleg = await loadCataleg();
    const out: Record<string, unknown> = { seccions: iteCamps(cataleg, a.seccio) };
    if (!a.seccio || a.seccio === "deficiencies" || a.seccio === "envolupant") {
      out.tipus_deficiencia = visibles(cataleg.tipus_deficiencia).map((o) => ({ valor: o.codi, text: o.descMultidioma ?? o.descripcio }));
      out.gravetat = visibles(cataleg.gravetat).map((o) => ({ valor: o.valor, text: o.descMultidioma }));
      out.tipus_envolupant = visibles(cataleg.tipus_envolupant).map((o) => ({ valor: o.codi, text: o.descMultidioma ?? o.descripcio }));
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
  notes: ["Accepta els mateixos camps i llistes que update_ite.", FOTOS_COM],
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
    FOTOS_COM,
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

// Photos ------------------------------------------------------------------------------

registerAction({
  kind: "read",
  name: "ite_enllac_fotos",
  domain: "ite",
  description:
    "Enllaç privat (24 h) perquè l'usuari pugi les fotos de la visita a un informe ITE des del mòbil o l'ordinador. Queden «per classificar»: després les mires amb ite_fotos_pendents i les col·loques amb ite_colocar_fotos.",
  notes: [
    "Les fotos adjuntes al xat no arriben a les eines: dona a l'usuari aquest enllaç tal qual. No cal que iniciï sessió; només permet afegir fotos a aquest informe.",
    'Si tens una eina de codi amb xarxa cap a aquest domini, també pots pujar tu les fotos adjuntes al xat (/mnt/user-data/uploads): redueix cada una a 1600 px en JPEG i fes POST de JSON {"kind":"foto","name":"<nom del fitxer>","dataUrl":"data:image/jpeg;base64,…"} a l\'enllaç + "/upload". Si la xarxa ho bloqueja, dona l\'enllaç a l\'usuari.',
  ],
  schema: z.object({ id }),
  async run(a, ctx) {
    const ite = await loadIte(a.id);
    if (!ite) return { error: `No hi ha cap informe ITE amb id ${a.id}.` };
    const origin = ctx.origin ?? process.env.APP_URL;
    if (!origin) return { error: "No es pot generar l'enllaç: falta l'adreça pública del lloc (APP_URL)." };
    const token = await createIteUploadToken(ctx.user, ite.id);
    const pendents = await pendentsOf(ite);
    return {
      informe: ite.nom,
      enllac: actaUploadUrl(origin, token),
      caduca_en_hores: UPLOAD_LINK_TTL_S / 3600,
      per_classificar_ara: pendents?.length ?? null,
      per_a_l_assistent: "Dona aquest enllaç a l'usuari tal qual. Quan digui que ja les ha pujades, mira-les amb ite_fotos_pendents i col·loca-les amb ite_colocar_fotos.",
    };
  },
});

registerAction({
  kind: "read",
  name: "ite_fotos_pendents",
  domain: "ite",
  description:
    "Les fotos d'un informe ITE que encara no tenen lloc («per classificar»), en petit perquè les vegis, i els llocs on poden anar: CROQUIS, E01… (envolupant), COMPTADORS-AIGUA, QUADRE-ELECTRIC i D01… (deficiències).",
  notes: [
    "Fins a 8 fotos per crida (quantes, màxim 10); continua amb desde = seguent fins que seguent sigui null.",
    "Decideix on va cada foto pel que s'hi veu i escriu-ne el peu (màxim 200 caràcters, com al portal): què és i on és. Després, ite_colocar_fotos amb totes alhora.",
    "Si una foto mostra una deficiència que l'informe no té, proposa-la a l'usuari i, si hi està d'acord, crea-la amb update_ite abans de col·locar-hi la foto. Les fotos repetides o que no serveixen es poden descartar.",
  ],
  schema: z.object({
    id,
    desde: z.number().int().min(0).optional().describe("Primera foto (0 = la primera)"),
    quantes: z.number().int().min(1).max(10).optional(),
  }),
  async run(a) {
    const ite = await loadIte(a.id);
    if (!ite) return { error: `No hi ha cap informe ITE amb id ${a.id}.` };
    const cataleg = await loadCataleg();
    const pendents = pendentsDe(await fotosCarpeta(ite.id), ite.dades);
    const llocs = llocsFotos(ite.dades, cataleg).map((l) => ({ lloc: l.codi, titol: l.titol, fotos: l.fotos }));
    if (!pendents.length) {
      return { informe: ite.nom, total: 0, llocs, per_a_l_assistent: "No hi ha fotos per classificar. Perquè l'usuari en pugi, fes servir ite_enllac_fotos." };
    }
    const desde = Math.min(a.desde ?? 0, pendents.length);
    const page = pendents.slice(desde, desde + (a.quantes ?? 8));
    const minis = await Promise.all(page.map((f) => miniatura(f.ref)));
    const imatges: ToolImage[] = [];
    const fotos = page.map((f, k) => {
      const data = minis[k];
      if (data) imatges.push({ etiqueta: `Foto ${f.id} (${f.nom}):`, data, mimeType: "image/jpeg" });
      return { foto: f.id, nom: f.nom, kb: Math.round(f.bytes / 1024), ...(data ? {} : { avis: "No s'ha pogut llegir la imatge." }) };
    });
    const fins = desde + page.length;
    return { informe: ite.nom, total: pendents.length, desde, fins, seguent: fins < pendents.length ? fins : null, fotos, llocs, imatges };
  },
});

const colocacio = z.object({
  foto: z.string().min(4).max(60).describe("id de la foto (ite_fotos_pendents)"),
  lloc: z.string().min(2).max(30).describe("CROQUIS, E01…, COMPTADORS-AIGUA, QUADRE-ELECTRIC o D01…"),
  peu: z.string().max(PEU_MAX).optional().describe("Peu de foto per al portal (màx. 200 caràcters). Obligatori a l'envolupant i a les deficiències."),
});

const colocarSchema = z.object({
  id,
  fotos: z.array(colocacio).max(100).optional(),
  descartar: z.array(z.string().min(4).max(60)).max(100).optional().describe("ids de fotos per classificar que s'esborren (repetides, mogudes, sense interès)"),
});

// Checks the placements and applies them to a copy of the report.
async function planColocar(a: z.infer<typeof colocarSchema>) {
  const ite = await loadIte(a.id);
  if (!ite) return { ite: null, errors: [`No hi ha cap informe ITE amb id ${a.id}.`] } as const;
  const cataleg = await loadCataleg();
  const pendents = pendentsDe(await fotosCarpeta(ite.id), ite.dades);
  const byId = new Map(pendents.map((f) => [f.id, f]));
  const llocs = llocsFotos(ite.dades, cataleg);
  const byCodi = new Map(llocs.map((l) => [l.codi, l]));
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  const singles = new Set<string>();
  const perLloc = new Map<string, number>();
  const detall: string[] = [];
  let doc = ite.dades;
  for (const c of a.fotos ?? []) {
    const f = byId.get(c.foto);
    if (!f) { errors.push(`La foto ${c.foto} no és entre les fotos per classificar (mira ite_fotos_pendents).`); continue; }
    if (seen.has(c.foto)) { errors.push(`La foto ${c.foto} surt dues vegades.`); continue; }
    seen.add(c.foto);
    const codi = codiLloc(c.lloc);
    const lloc = byCodi.get(codi);
    if (!lloc) { errors.push(`Lloc desconegut: «${c.lloc}». Els llocs d'aquest informe són ${llocs.map((l) => l.codi).join(", ")}.`); continue; }
    const peu = (c.peu ?? "").replace(/\s+/g, " ").trim();
    if (!lloc.unica && !peu) errors.push(`Falta el peu de la foto ${c.foto} (${codi}): el portal el demana.`);
    if (lloc.unica) {
      if (singles.has(codi)) { errors.push(`${codi} només admet una foto.`); continue; }
      singles.add(codi);
      if (lloc.fotos) warnings.push(`${codi} ja té una foto: la nova la substitueix i l'anterior torna a «per classificar».`);
    }
    doc = posarFoto(doc, lloc, f, peu);
    perLloc.set(codi, (perLloc.get(codi) ?? 0) + 1);
    detall.push(`${f.id} (${f.nom}) → ${codi}${peu ? `: ${peu}` : ""}`);
  }
  const descartar: FotoCarpeta[] = [];
  for (const idf of a.descartar ?? []) {
    const f = byId.get(idf);
    if (!f) { errors.push(`La foto ${idf} no és entre les fotos per classificar.`); continue; }
    if (seen.has(idf)) { errors.push(`La foto ${idf} no es pot col·locar i esborrar alhora.`); continue; }
    seen.add(idf);
    descartar.push(f);
  }
  if (!a.fotos?.length && !a.descartar?.length) errors.push("No hi ha res a fer: passa fotos per col·locar o per descartar.");
  if (descartar.length) warnings.push(`S'esborraran per sempre ${descartar.length} fotos: ${descartar.map((f) => f.nom).join(", ")}.`);
  return { ite, doc, perLloc, detall, descartar, errors, warnings, resta: pendents.length - seen.size } as const;
}

registerAction({
  kind: "change",
  name: "ite_colocar_fotos",
  domain: "ite",
  description:
    "Posa fotos «per classificar» d'un informe ITE al seu lloc (element de l'envolupant, deficiència, croquis, comptadors o quadre elèctric) amb el peu de foto, i n'esborra les que es descartin.",
  notes: [
    "Fotos i llocs: els de ite_fotos_pendents. Cada foto, una sola vegada.",
    "Envolupant i deficiències: s'afegeixen darrere de les que ja tenen. Croquis, comptadors i quadre: una sola foto; si ja n'hi havia, l'anterior torna a «per classificar».",
    "descartar esborra fotos per classificar per sempre: només les que l'usuari no vulgui.",
  ],
  schema: colocarSchema,
  async plan(a): Promise<Plan> {
    const p = await planColocar(a);
    if (!p.ite) return { summary: "Col·locar fotos", errors: [...p.errors] };
    const llocs = [...p.perLloc].map(([codi, n]) => (n > 1 ? `${codi} ×${n}` : codi)).join(", ");
    const parts = [
      p.detall.length ? `col·locar ${p.detall.length} ${p.detall.length === 1 ? "foto" : "fotos"} (${llocs})` : "",
      p.descartar.length ? `esborrar-ne ${p.descartar.length}` : "",
    ].filter(Boolean);
    return {
      summary: `A «${p.ite.nom}»: ${parts.join(" i ") || "res"}. En quedaran ${p.resta} per classificar.`,
      details: { colocacions: p.detall, esborrar: p.descartar.map((f) => `${f.id} (${f.nom})`) },
      errors: [...p.errors],
      warnings: [...p.warnings],
    };
  },
  async commit(a, _plan, ctx) {
    const p = await planColocar(a);
    if (!p.ite || p.errors.length) throw new Error(p.errors.join(" "));
    if (p.detall.length) await callAction(() => saveIteAction(a.id, p.doc));
    const esborrades = p.descartar.length ? await esborrarPendents(a.id, p.doc, p.descartar.map((f) => f.id)) : 0;
    return { id: a.id, col_locades: p.detall.length, esborrades, per_classificar: p.resta, url: link(ctx.origin, a.id) };
  },
});
