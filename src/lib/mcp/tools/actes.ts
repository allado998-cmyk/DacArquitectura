// Actes: everything the web editor (src/app/actes/[id]/acta-view.tsx) can
// fill in — motiu, expedient, dedicació, dades generals, assistents, temes by
// categoria with responsables, propera visita, signatures, photos, PDFs and
// audio — plus duplicating an acta. Writes go through src/app/actes/actions.ts.
import { z } from "zod";
import { sql } from "@/lib/db";
import {
  addActaAudioAction,
  addActaDocAction,
  addActaFotoAction,
  createActaAction,
  createActaFromDedicacioAction,
  duplicateActaAction,
  linkActaToDedicacioAction,
  removeActaAudioAction,
  removeActaDocAction,
  removeActaFotoAction,
  unlinkActaFromDedicacioAction,
  updateActaAction,
  type ActaPatch,
} from "@/app/actes/actions";
import { actaSignatures, temaCat } from "@/lib/acta-doc";
import { todayIso } from "@/lib/format";
import { id, isoDate, registerAction, shortText, type Plan } from "../core";
import { expedientLabel, resolveExpedient, type ExpedientRow } from "../data";
import { callAction, idFromRedirect } from "../shared";
import {
  applyListOps,
  buildTema,
  categoriaLabel,
  CATEGORIES,
  DEFAULT_ASSISTENTS,
  DEFAULT_SIGNATURES,
  DEFAULT_TEMES,
  defaultLloc,
  MOTIUS,
  motiuLabel,
  temaHasContent,
  temaResponsables,
  type Notes,
  type TemaInput,
} from "../acta-plan";
import { mb, prepareFile, type MediaKind } from "../media";
import type { Acta, ActaAssistent, ActaSignatura, ActaTema } from "@/types/db";

// Reading an acta ----------------------------------------------------------------

interface MediaInfo {
  name: string;
  chars: number;
}

interface ActaRow extends Acta {
  expedient_projecte: string | null;
  dedicacio: { id: number; data: string; hores: string; tasca: string | null } | null;
  fotos_chars: number[];
  documents_info: MediaInfo[];
  audios_info: MediaInfo[];
}

async function getActa(ref: { id?: number | null; num?: string | null }): Promise<ActaRow | null> {
  const where = ref.id ? "a.id = $1" : "a.num = $1";
  const param = ref.id ?? ref.num?.trim();
  if (!param) return null;
  const rows = (await sql.query(
    `select a.id, a.num, a.tipus, a.expedient_id, e.num_expedient as expedient_num, e.projecte as expedient_projecte,
            a.dedicacio_id, a.acta_num, to_char(a.data,'YYYY-MM-DD') as data, a.hora, a.lloc, a.projecte, a.referencia,
            a.ubicacio, a.client, a.assistents, a.temes, a.propera_visita, to_char(a.propera_data,'YYYY-MM-DD') as propera_data,
            a.propera_hora, a.signatures, a.sig_do, a.sig_de, a.sig_adj_empresa, a.sig_adj_persona, a.sig_prom_empresa, a.sig_prom_persona,
            case when d.id is null then null
                 else json_build_object('id', d.id, 'data', to_char(d.data,'YYYY-MM-DD'), 'hores', d.hores::text, 'tasca', d.tasca) end as dedicacio,
            coalesce((select json_agg(length(f #>> '{}') order by i)
                      from jsonb_array_elements(coalesce(a.fotografies,'[]'::jsonb)) with ordinality t(f, i)), '[]'::json) as fotos_chars,
            coalesce((select json_agg(json_build_object('name', x->>'name', 'chars', length(x->>'dataUrl')) order by i)
                      from jsonb_array_elements(coalesce(a.documents,'[]'::jsonb)) with ordinality t(x, i)), '[]'::json) as documents_info,
            coalesce((select json_agg(json_build_object('name', x->>'name', 'chars', length(x->>'dataUrl')) order by i)
                      from jsonb_array_elements(coalesce(a.audios,'[]'::jsonb)) with ordinality t(x, i)), '[]'::json) as audios_info
     from public.acta a
     left join public.expedients e on e.id = a.expedient_id
     left join public.dedicacions d on d.id = a.dedicacio_id
     where ${where} order by a.id desc limit 1`,
    [param],
  )) as ActaRow[];
  return rows[0] ?? null;
}

const approxBytes = (chars: number) => Math.round(chars * 0.75);

function actaLabel(a: { id: number; num: string | null; tipus: string; data: string | null; projecte?: string | null }): string {
  return `${a.num ?? `#${a.id}`} (${motiuLabel(a.tipus)}, ${a.data ?? "sense data"})${a.projecte ? ` — ${a.projecte.split("\n")[0].slice(0, 80)}` : ""}`;
}

// The shape the model reads and edits by index.
function describeActa(r: ActaRow) {
  const signatures = actaSignatures(r);
  return {
    id: r.id,
    num: r.num,
    url: `/actes/${r.id}`,
    tipus: r.tipus,
    motiu: motiuLabel(r.tipus),
    expedient: r.expedient_id ? { id: r.expedient_id, num: r.expedient_num, projecte: r.expedient_projecte } : null,
    dedicacio: r.dedicacio,
    acta_num: r.acta_num,
    data: r.data,
    hora: r.hora,
    lloc: r.lloc,
    projecte: r.projecte,
    referencia: r.referencia,
    ubicacio: r.ubicacio,
    client: r.client,
    assistents: (r.assistents ?? []).map((x, index) => ({ index, present: x.present, nom: x.nom, empresa: x.empresa })),
    temes: (r.temes ?? []).map((t, index) => ({
      index,
      categoria: temaCat(t),
      titol: t.titol ?? "",
      text: t.text ?? "",
      responsables: temaResponsables(t),
    })),
    propera_visita: { data: r.propera_data, hora: r.propera_hora, nota: r.propera_visita },
    signatures: signatures.map((s, index) => ({ index, titol: s.titol, persona: s.persona })),
    signatures_de_camps_antics: !(r.signatures?.length) && signatures.length > 0,
    fotografies: (r.fotos_chars ?? []).map((c, index) => ({ index, mida: mb(approxBytes(c)) })),
    documents: (r.documents_info ?? []).map((d, index) => ({ index, nom: d.name, mida: mb(approxBytes(d.chars)) })),
    audios: (r.audios_info ?? []).map((d, index) => ({ index, nom: d.name, mida: mb(approxBytes(d.chars)) })),
  };
}

// Editable state -------------------------------------------------------------------

interface ActaState {
  tipus: string;
  expedient_id: number | null;
  acta_num: string;
  data: string | null;
  hora: string;
  lloc: string;
  projecte: string;
  referencia: string;
  ubicacio: string;
  client: string;
  assistents: ActaAssistent[];
  temes: ActaTema[];
  propera_visita: string;
  propera_data: string | null;
  propera_hora: string;
  signatures: ActaSignatura[];
}

function stateFromRow(r: ActaRow): ActaState {
  return {
    tipus: r.tipus,
    expedient_id: r.expedient_id,
    acta_num: r.acta_num ?? "",
    data: r.data,
    hora: r.hora ?? "",
    lloc: r.lloc ?? "",
    projecte: r.projecte ?? "",
    referencia: r.referencia ?? "",
    ubicacio: r.ubicacio ?? "",
    client: r.client ?? "",
    assistents: r.assistents ?? [],
    temes: r.temes ?? [],
    propera_visita: r.propera_visita ?? "",
    propera_data: r.propera_data,
    propera_hora: r.propera_hora ?? "",
    signatures: actaSignatures(r),
  };
}

// What a new acta starts with (insertActa in src/app/actes/actions.ts).
function initialState(tipus: string, expedient: ExpedientRow | null, data: string): ActaState {
  return {
    tipus,
    expedient_id: expedient?.id ?? null,
    acta_num: "00",
    data,
    hora: "",
    lloc: defaultLloc(tipus),
    projecte: expedient?.projecte ?? "",
    referencia: expedient?.num_expedient ?? "",
    ubicacio: "",
    client: expedient?.client_nom ?? "",
    assistents: DEFAULT_ASSISTENTS,
    temes: DEFAULT_TEMES,
    propera_visita: "A concretar",
    propera_data: null,
    propera_hora: "",
    signatures: DEFAULT_SIGNATURES,
  };
}

// Readable rendering of the acta as it will be saved, for previews.
function vista(s: ActaState, expedient: string | null) {
  const temes: Record<string, { titol: string; text: string; responsables: string[] }[]> = {};
  for (const key of CATEGORIES) {
    const list = s.temes.filter((t) => temaHasContent(t) && temaCat(t) === key);
    if (list.length) temes[categoriaLabel(key)] = list.map((t) => ({ titol: t.titol, text: t.text, responsables: temaResponsables(t) }));
  }
  return {
    motiu: motiuLabel(s.tipus),
    expedient,
    acta_num: s.acta_num,
    data: s.data,
    hora: s.hora,
    lloc: s.lloc,
    projecte: s.projecte,
    referencia: s.referencia,
    ubicacio: s.ubicacio,
    client: s.client,
    assistents: s.assistents.map((x) => `[${x.present ? "X" : " "}] ${x.nom}${x.empresa ? ` — ${x.empresa}` : ""}`),
    temes,
    propera_visita: [s.propera_data, s.propera_hora, s.propera_visita].filter(Boolean).join(" · ") || null,
    signatures: s.signatures.map((x) => `${x.titol}: ${x.persona}`),
  };
}

// Input schema -----------------------------------------------------------------------

const idx = z.number().int().min(0);
const assistentIn = z.object({
  nom: shortText.min(1).describe('Nom, idealment amb inicials: "Marta Puig (MP)"'),
  empresa: shortText.optional().describe("Empresa o rol"),
  present: z.boolean().optional().describe("Per defecte true"),
});
const temaIn = z.object({
  categoria: z.enum(CATEGORIES).optional().describe("pendent (per defecte) | executat | tractat"),
  titol: shortText.optional(),
  text: z.string().max(10000).optional(),
  responsables: z.array(shortText).max(10).optional().describe("Noms o inicials d'assistents"),
});
const signaturaIn = z.object({ titol: shortText.min(1).describe("Càrrec, p. ex. «Director d'obra»"), persona: shortText.optional() });

const actaFields = z.object({
  tipus: z.enum(MOTIUS).optional().describe("Motiu: visita (d'obra) | reunio | coordinacio (de seguretat) | altres"),
  expedient_id: id.nullable().optional().describe("null per desvincular"),
  expedient_num: shortText.optional(),
  acta_num: shortText.optional().describe('"Acta nº" dins l\'expedient, p. ex. "03"'),
  data: isoDate.optional(),
  hora: shortText.optional().describe('p. ex. "10:30"'),
  lloc: shortText.optional(),
  projecte: z.string().max(2000).optional(),
  referencia: shortText.optional(),
  ubicacio: shortText.optional(),
  client: shortText.optional(),
  assistents: z.array(assistentIn).max(40).optional().describe("Substitueix tota la llista"),
  afegir_assistents: z.array(assistentIn).max(40).optional(),
  modificar_assistents: z.array(assistentIn.partial().extend({ index: idx })).max(40).optional(),
  treure_assistents: z.array(idx).max(40).optional(),
  temes: z.array(temaIn).max(80).optional().describe("Substitueix tots els temes"),
  afegir_temes: z.array(temaIn).max(80).optional(),
  modificar_temes: z.array(temaIn.extend({ index: idx })).max(80).optional(),
  treure_temes: z.array(idx).max(80).optional(),
  propera_data: isoDate.nullable().optional(),
  propera_hora: shortText.optional(),
  propera_visita: shortText.optional().describe('Nota de la propera visita, p. ex. "A concretar"'),
  signatures: z.array(signaturaIn).max(12).optional().describe("Substitueix tots els signataris"),
  afegir_signatures: z.array(signaturaIn).max(12).optional(),
  modificar_signatures: z.array(signaturaIn.partial().extend({ index: idx })).max(12).optional(),
  treure_signatures: z.array(idx).max(12).optional(),
});
type ActaFields = z.infer<typeof actaFields>;
type AssistentIn = z.infer<typeof assistentIn>;
type SignaturaIn = z.infer<typeof signaturaIn>;

const toAssistent = (x: AssistentIn): ActaAssistent => ({ present: x.present ?? true, nom: x.nom.trim(), empresa: (x.empresa ?? "").trim() });
const toSignatura = (x: SignaturaIn): ActaSignatura => ({ titol: x.titol.trim(), persona: (x.persona ?? "").trim() });

interface Touched {
  assistents: boolean;
  temes: boolean;
  signatures: boolean;
}

// Applies the requested changes on top of the current state.
function computeNext(
  cur: ActaState,
  a: ActaFields,
  exp: { changed: boolean; expedient: ExpedientRow | null },
  notes: Notes,
): { next: ActaState; changed: string[]; touched: Touched } {
  const next: ActaState = { ...cur };
  const changed: string[] = [];
  const scalars = ["tipus", "acta_num", "data", "hora", "lloc", "projecte", "referencia", "ubicacio", "client", "propera_visita", "propera_hora", "propera_data"] as const;
  for (const k of scalars) {
    const v = a[k];
    if (v !== undefined && v !== cur[k]) {
      (next as unknown as Record<string, unknown>)[k] = typeof v === "string" ? v.trim() : v;
      changed.push(k);
    }
  }

  if (exp.changed) {
    next.expedient_id = exp.expedient?.id ?? null;
    changed.push("expedient");
    // Same as choosing an expedient in the editor: referència follows it,
    // and an empty projecte / client is filled in from it.
    if (exp.expedient) {
      if (a.referencia === undefined) next.referencia = exp.expedient.num_expedient;
      if (a.projecte === undefined && !cur.projecte.trim() && exp.expedient.projecte) next.projecte = exp.expedient.projecte;
      if (a.client === undefined && !cur.client.trim() && exp.expedient.client_nom) next.client = exp.expedient.client_nom;
    }
  }

  // Attendees first: responsables are matched against the final list.
  const ass = applyListOps<ActaAssistent, Partial<AssistentIn>>(
    cur.assistents,
    { replace: a.assistents?.map(toAssistent), add: a.afegir_assistents?.map(toAssistent), modify: a.modificar_assistents, remove: a.treure_assistents },
    (c, p) => ({ present: p.present ?? c.present, nom: p.nom?.trim() ?? c.nom, empresa: p.empresa?.trim() ?? c.empresa }),
    "Assistents",
    notes,
  );
  next.assistents = ass.list;
  const people = ass.list.map((x) => x.nom);

  const temes = applyListOps<ActaTema, TemaInput>(
    cur.temes,
    {
      replace: a.temes?.map((t, i) => buildTema(null, t, people, `Tema ${i + 1}`, notes)),
      add: a.afegir_temes?.map((t, i) => buildTema(null, t, people, `Tema afegit ${i + 1}`, notes)),
      modify: a.modificar_temes,
      remove: a.treure_temes,
    },
    (c, p, i) => buildTema(c, p, people, `Tema ${i}`, notes),
    "Temes",
    notes,
  );
  // Empty placeholder temes (a new acta starts with one) are dropped.
  next.temes = temes.touched ? temes.list.filter(temaHasContent) : cur.temes;

  const sigs = applyListOps<ActaSignatura, Partial<SignaturaIn>>(
    cur.signatures,
    { replace: a.signatures?.map(toSignatura), add: a.afegir_signatures?.map(toSignatura), modify: a.modificar_signatures, remove: a.treure_signatures },
    (c, p) => ({ titol: p.titol?.trim() ?? c.titol, persona: p.persona?.trim() ?? c.persona }),
    "Signatures",
    notes,
  );
  next.signatures = sigs.list;

  if (ass.touched) changed.push("assistents");
  if (temes.touched) changed.push("temes");
  if (sigs.touched) changed.push("signatures");
  if (next.propera_data && next.data && next.propera_data < next.data) notes.warnings.push("La propera visita és anterior a la data de l'acta.");
  if (next.hora && !/^\d{1,2}[:.h]\d{2}$/.test(next.hora)) notes.warnings.push(`L'hora «${next.hora}» no té el format habitual HH:MM.`);
  if (next.propera_hora && !/^\d{1,2}[:.h]\d{2}$/.test(next.propera_hora)) notes.warnings.push(`L'hora de la propera visita «${next.propera_hora}» no té el format habitual HH:MM.`);
  return { next, changed, touched: { assistents: ass.touched, temes: temes.touched, signatures: sigs.touched } };
}

// updateActaAction overwrites every text column it receives, so always send
// the full merged state; lists only when they changed (it keeps them otherwise).
function toPatch(s: ActaState, t: Touched): ActaPatch {
  return {
    tipus: s.tipus,
    expedient_id: s.expedient_id,
    acta_num: s.acta_num,
    data: s.data ?? undefined,
    hora: s.hora,
    lloc: s.lloc,
    projecte: s.projecte,
    referencia: s.referencia,
    ubicacio: s.ubicacio,
    client: s.client,
    assistents: t.assistents ? s.assistents : undefined,
    temes: t.temes ? s.temes : undefined,
    propera_visita: s.propera_visita,
    propera_data: s.propera_data ?? "",
    propera_hora: s.propera_hora,
    signatures: t.signatures ? s.signatures : undefined,
  };
}

function hasFieldChanges(a: ActaFields): boolean {
  return Object.values(a).some((v) => v !== undefined);
}

async function expedientChange(a: ActaFields): Promise<{ changed: boolean; expedient: ExpedientRow | null; error?: string }> {
  if (a.expedient_id === undefined && !a.expedient_num) return { changed: false, expedient: null };
  const r = await resolveExpedient({ expedient_id: a.expedient_id ?? null, expedient_num: a.expedient_num ?? null });
  return { changed: true, expedient: r.expedient, error: r.error };
}

// Suggests the next "Acta nº" for an expedient from its existing actes.
async function suggestActaNum(expedientId: number, excludeId?: number): Promise<string | null> {
  const rows = (await sql`
    select acta_num from public.acta where expedient_id = ${expedientId} and id <> ${excludeId ?? 0}
  `) as { acta_num: string | null }[];
  const nums = rows.map((r) => parseInt(r.acta_num ?? "", 10)).filter((n) => Number.isFinite(n));
  if (!nums.length) return null;
  return String(Math.max(...nums) + 1).padStart(2, "0");
}

async function expedientText(idv: number | null): Promise<string | null> {
  if (!idv) return null;
  const r = await resolveExpedient({ expedient_id: idv });
  return r.expedient ? expedientLabel(r.expedient) : null;
}

async function applyFields(actaId: number, a: ActaFields, extra?: (s: ActaState) => void) {
  const row = await getActa({ id: actaId });
  if (!row) throw new Error("Acta no trobada.");
  const exp = await expedientChange(a);
  if (exp.error) throw new Error(exp.error);
  const notes: Notes = { errors: [], warnings: [] };
  const { next, touched } = computeNext(stateFromRow(row), a, exp, notes);
  extra?.(next);
  if (notes.errors.length) throw new Error(notes.errors.join(" "));
  await callAction(() => updateActaAction(actaId, toPatch(next, touched)));
}

async function savedSummary(actaId: number) {
  const saved = await getActa({ id: actaId });
  if (!saved) return { id: actaId };
  const d = describeActa(saved);
  return {
    id: d.id,
    num: d.num,
    url: d.url,
    acta: actaLabel(saved),
    assistents: d.assistents.length,
    temes: d.temes.length,
    signatures: d.signatures.length,
    fotografies: d.fotografies.length,
    documents: d.documents.length,
    audios: d.audios.length,
  };
}

// Reads ------------------------------------------------------------------------------

registerAction({
  kind: "read",
  name: "list_actes",
  domain: "actes",
  description: "Actes (visita d'obra, reunió, coordinació…) amb expedient, data i nombre de temes; filtres per expedient, motiu, dates o text.",
  schema: z.object({
    expedient_id: id.optional(),
    expedient_num: shortText.optional(),
    tipus: z.enum(MOTIUS).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    q: shortText.optional().describe("Text a cercar al número, projecte, client, lloc o temes"),
    limit: z.number().int().min(1).max(500).default(100),
  }),
  async run(a) {
    const r = await resolveExpedient(a);
    if (r.error) return { error: r.error };
    const like = a.q ? `%${a.q.trim()}%` : null;
    const rows = await sql`
      select a.id, a.num, a.tipus, a.expedient_id, e.num_expedient as expedient_num, a.dedicacio_id, a.acta_num,
             to_char(a.data,'YYYY-MM-DD') as data, a.hora, a.lloc, a.projecte, a.client,
             jsonb_array_length(coalesce(a.temes,'[]'::jsonb)) as n_temes,
             (select count(*) from jsonb_array_elements(coalesce(a.temes,'[]'::jsonb)) t
               where coalesce(t->>'estat','pendent') = 'pendent' and (coalesce(t->>'titol','') <> '' or coalesce(t->>'text','') <> ''))::int as n_pendents,
             jsonb_array_length(coalesce(a.fotografies,'[]'::jsonb)) as n_fotos,
             to_char(a.propera_data,'YYYY-MM-DD') as propera_data
      from public.acta a left join public.expedients e on e.id = a.expedient_id
      where (${r.expedient?.id ?? null}::bigint is null or a.expedient_id = ${r.expedient?.id ?? null})
        and (${a.tipus ?? null}::text is null or a.tipus = ${a.tipus ?? null})
        and (${a.from ?? null}::date is null or a.data >= ${a.from ?? null}::date)
        and (${a.to ?? null}::date is null or a.data <= ${a.to ?? null}::date)
        and (${like}::text is null or coalesce(a.num,'') ilike ${like} or coalesce(a.projecte,'') ilike ${like}
             or coalesce(a.client,'') ilike ${like} or coalesce(a.lloc,'') ilike ${like} or a.temes::text ilike ${like})
      order by a.data desc nulls last, a.id desc limit ${a.limit}`;
    return { count: (rows as unknown[]).length, actes: rows };
  },
});

registerAction({
  kind: "read",
  name: "get_acta",
  domain: "actes",
  description:
    "Contingut complet d'una acta (per id o número AC-YY-NNN): dades, assistents, temes per categoria amb responsables, propera visita, signatures i fitxers. Cada element de llista porta el seu index.",
  schema: z.object({ id: id.optional(), num: shortText.optional() }).refine((v) => v.id || v.num, "Cal id o num"),
  async run(a) {
    const row = await getActa({ id: a.id ?? null, num: a.num ?? null });
    return row ? { acta: describeActa(row) } : { error: "Acta no trobada." };
  },
});

registerAction({
  kind: "read",
  name: "acta_persones",
  domain: "actes",
  description: "Persones per omplir una acta: assistents d'actes anteriors (de l'expedient o de totes) i contactes de la Base de Dades.",
  schema: z.object({ expedient_id: id.optional(), expedient_num: shortText.optional(), q: shortText.optional() }),
  async run(a) {
    const r = await resolveExpedient(a);
    if (r.error) return { error: r.error };
    const like = a.q ? `%${a.q.trim()}%` : null;
    const [recents, contactes] = await Promise.all([
      sql`
        select x->>'nom' as nom, coalesce(x->>'empresa','') as empresa, count(*)::int as vegades, to_char(max(a.data),'YYYY-MM-DD') as darrera
        from public.acta a cross join lateral jsonb_array_elements(coalesce(a.assistents,'[]'::jsonb)) x
        where (${r.expedient?.id ?? null}::bigint is null or a.expedient_id = ${r.expedient?.id ?? null})
          and coalesce(x->>'nom','') <> ''
          and (${like}::text is null or x->>'nom' ilike ${like} or coalesce(x->>'empresa','') ilike ${like})
        group by 1, 2 order by max(a.data) desc nulls last, count(*) desc limit 40`,
      sql`
        select k.nom, k.telefon, k.mail, c.nom as client_nom
        from public.client_contactes k left join public.clients c on c.id = k.client_id
        where coalesce(k.nom,'') <> '' and (${like}::text is null or k.nom ilike ${like} or coalesce(c.nom,'') ilike ${like})
        order by k.nom limit 60`,
    ]);
    return { expedient: r.expedient ? expedientLabel(r.expedient) : null, assistents_recents: recents, contactes };
  },
});

// Changes ------------------------------------------------------------------------------

const FIELD_NOTES = [
  "tipus (motiu): visita | reunio | coordinacio | altres.",
  "Temes: categoria pendent | executat | tractat, titol, text i responsables (noms o inicials d'assistents, p. ex. \"DL\"; es resolen al nom complet).",
  "Llistes (assistents, temes, signatures): passa la llista sencera per substituir-la, o bé afegir_*, modificar_* [{index, …camps}] i treure_* [index]. Els index són els de get_acta.",
  "Fotos, PDF i àudios: eina acta_afegir_fitxer (o acció add_acta_fitxer amb url).",
];

registerAction({
  kind: "change",
  name: "create_acta",
  domain: "actes",
  description: "Crea una acta i n'omple qualsevol camp: motiu, expedient o dedicació, dades generals, assistents, temes, propera visita i signatures.",
  notes: [
    "El número AC-YY-NNN s'assigna sol. Amb expedient, projecte, referència i client s'omplen des de l'expedient.",
    "Una acta nova porta per defecte els assistents i signataris del despatx (DL i JM): afegir_assistents hi suma gent; assistents substitueix la llista.",
    "Amb dedicacio_id l'acta queda lligada a aquella dedicació (una acta per dedicació) i pren la seva data i expedient.",
    ...FIELD_NOTES,
  ],
  schema: actaFields.extend({
    dedicacio_id: id.optional().describe("Dedicació (visita o reunió registrada) a la qual lligar l'acta"),
  }),
  async plan(a): Promise<Plan> {
    const notes: Notes = { errors: [], warnings: [] };
    let ded: { id: number; expedient_id: number | null; data: string; tasca: string | null; acta_num: string | null } | null = null;
    if (a.dedicacio_id) {
      const rows = (await sql`
        select d.id, d.expedient_id, to_char(d.data,'YYYY-MM-DD') as data, d.tasca,
               (select num from public.acta where dedicacio_id = d.id order by id limit 1) as acta_num
        from public.dedicacions d where d.id = ${a.dedicacio_id}`) as { id: number; expedient_id: number | null; data: string; tasca: string | null; acta_num: string | null }[];
      ded = rows[0] ?? null;
      if (!ded) notes.errors.push(`No hi ha cap dedicació amb id ${a.dedicacio_id}.`);
      else if (ded.acta_num) notes.errors.push(`La dedicació ${a.dedicacio_id} ja té l'acta ${ded.acta_num}: modifica-la amb update_acta.`);
    }
    const exp = await expedientChange(a);
    if (exp.error) notes.errors.push(exp.error);
    let expedient = exp.expedient;
    if (!exp.changed && ded?.expedient_id) expedient = (await resolveExpedient({ expedient_id: ded.expedient_id })).expedient;
    if (exp.changed && ded && exp.expedient && ded.expedient_id && ded.expedient_id !== exp.expedient.id) {
      notes.warnings.push("L'expedient indicat no és el de la dedicació; es farà servir l'indicat.");
    }
    const tipus = a.tipus ?? (ded ? ((ded.tasca ?? "").toLowerCase().includes("visita") ? "visita" : "reunio") : "visita");
    const start = initialState(tipus, expedient, a.data ?? ded?.data ?? todayIso());
    const { next } = computeNext(start, { ...a, tipus: undefined, expedient_id: undefined, expedient_num: undefined }, { changed: false, expedient: null }, notes);
    if (expedient && a.acta_num === undefined) {
      const sug = await suggestActaNum(expedient.id);
      if (sug) notes.warnings.push(`«Acta nº» quedarà ${next.acta_num}; la següent d'aquest expedient seria la ${sug} (passa acta_num si cal).`);
    }
    if (!a.temes?.length && !a.afegir_temes?.length) notes.warnings.push("L'acta no té cap tema encara.");
    const nTemes = next.temes.filter(temaHasContent).length;
    return {
      summary: `Crear una acta de ${motiuLabel(tipus).toLowerCase()}${expedient ? ` per a ${expedientLabel(expedient)}` : ""} del ${next.data}${nTemes ? ` amb ${nTemes} temes` : ""}${ded ? `, lligada a la dedicació ${ded.id}` : ""}.`,
      details: { resultat: vista(next, expedient ? expedientLabel(expedient) : null) },
      errors: notes.errors,
      warnings: notes.warnings,
    };
  },
  async commit(a) {
    let newId: number | null = null;
    let dedData: string | null = null;
    if (a.dedicacio_id) {
      const r = await callAction(() => createActaFromDedicacioAction(a.dedicacio_id!));
      newId = idFromRedirect(r.redirectedTo);
      const rows = (await sql`select to_char(data,'YYYY-MM-DD') as data from public.dedicacions where id = ${a.dedicacio_id}`) as { data: string }[];
      dedData = rows[0]?.data ?? null;
    } else {
      const exp = await expedientChange(a);
      const r = await callAction(() => createActaAction(a.tipus ?? "visita", exp.expedient?.id ?? null));
      newId = idFromRedirect(r.redirectedTo);
    }
    if (!newId) throw new Error("No s'ha pogut crear l'acta.");
    const created = await getActa({ id: newId });
    const fields: ActaFields = { ...a };
    delete (fields as { dedicacio_id?: number }).dedicacio_id;
    if (!a.dedicacio_id) {
      // The expedient was set on creation; do not apply it twice.
      delete fields.expedient_id;
      delete fields.expedient_num;
    }
    if (fields.data === undefined && dedData) fields.data = dedData;
    await applyFields(newId, fields, (s) => {
      // A motiu different from the one the row was created with gets its default lloc.
      if (a.lloc === undefined && created && s.tipus !== created.tipus) s.lloc = defaultLloc(s.tipus);
    });
    return savedSummary(newId);
  },
});

registerAction({
  kind: "change",
  name: "update_acta",
  domain: "actes",
  description: "Omple o modifica qualsevol part d'una acta: dades, expedient, assistents, temes (afegir, modificar, treure per index), propera visita i signatures.",
  notes: ["Llegeix-la primer amb get_acta per conèixer els index.", ...FIELD_NOTES],
  schema: actaFields.extend({ id }),
  async plan(a): Promise<Plan> {
    const row = await getActa({ id: a.id });
    if (!row) return { summary: "Modificar acta", errors: [`No hi ha cap acta amb id ${a.id}.`] };
    const notes: Notes = { errors: [], warnings: [] };
    const { id: _id, ...fields } = a;
    void _id;
    if (!hasFieldChanges(fields)) notes.errors.push("No s'ha indicat cap canvi.");
    const exp = await expedientChange(fields);
    if (exp.error) notes.errors.push(exp.error);
    const { next, changed } = computeNext(stateFromRow(row), fields, exp, notes);
    return {
      summary: `Modificar l'acta ${actaLabel(row)}: ${changed.join(", ") || "cap canvi efectiu"}.`,
      details: { resultat: vista(next, (await expedientText(next.expedient_id)) ?? null) },
      errors: notes.errors,
      warnings: notes.warnings,
    };
  },
  async commit(a) {
    const { id: actaId, ...fields } = a;
    await applyFields(actaId, fields);
    return savedSummary(actaId);
  },
});

registerAction({
  kind: "change",
  name: "duplicate_acta",
  domain: "actes",
  description: "Crea una acta nova copiant-ne una altra (assistents, temes, signatures, dades; amb data d'avui) i hi aplica els canvis indicats.",
  notes: ["Les fotos, documents i àudios no es copien, ni el lligam amb la dedicació.", ...FIELD_NOTES],
  schema: actaFields.extend({ id: id.describe("Acta que es copia") }),
  async plan(a): Promise<Plan> {
    const row = await getActa({ id: a.id });
    if (!row) return { summary: "Duplicar acta", errors: [`No hi ha cap acta amb id ${a.id}.`] };
    const notes: Notes = { errors: [], warnings: [] };
    const { id: _id, ...fields } = a;
    void _id;
    const exp = await expedientChange(fields);
    if (exp.error) notes.errors.push(exp.error);
    const start = { ...stateFromRow(row), data: todayIso() };
    const { next } = computeNext(start, fields, exp, notes);
    if (next.expedient_id && fields.acta_num === undefined) {
      const sug = await suggestActaNum(next.expedient_id);
      if (sug) notes.warnings.push(`«Acta nº» es copiarà com a ${next.acta_num}; la següent d'aquest expedient seria la ${sug}.`);
    }
    return {
      summary: `Crear una acta nova a partir de ${actaLabel(row)}.`,
      details: { resultat: vista(next, (await expedientText(next.expedient_id)) ?? null) },
      errors: notes.errors,
      warnings: notes.warnings,
    };
  },
  async commit(a) {
    const { id: srcId, ...fields } = a;
    const fd = new FormData();
    fd.set("id", String(srcId));
    const r = await callAction(() => duplicateActaAction(fd));
    const newId = idFromRedirect(r.redirectedTo);
    if (!newId) throw new Error("No s'ha pogut duplicar l'acta.");
    if (hasFieldChanges(fields)) await applyFields(newId, fields);
    return savedSummary(newId);
  },
});

registerAction({
  kind: "change",
  name: "link_acta_dedicacio",
  domain: "actes",
  description: "Lliga una acta a una dedicació (visita o reunió registrada), o la deslliga amb dedicacio_id=null.",
  schema: z.object({ acta_id: id, dedicacio_id: id.nullable() }),
  async plan(a): Promise<Plan> {
    const row = await getActa({ id: a.acta_id });
    if (!row) return { summary: "Lligar acta", errors: [`No hi ha cap acta amb id ${a.acta_id}.`] };
    if (a.dedicacio_id === null) {
      if (!row.dedicacio_id) return { summary: "Deslligar acta", errors: ["L'acta no està lligada a cap dedicació."] };
      return { summary: `Deslligar l'acta ${actaLabel(row)} de la dedicació ${row.dedicacio_id}.` };
    }
    const rows = (await sql`
      select d.id, to_char(d.data,'YYYY-MM-DD') as data, d.hores::text as hores, d.tasca, e.num_expedient,
             (select num from public.acta where dedicacio_id = d.id and id <> ${a.acta_id} limit 1) as altra_acta
      from public.dedicacions d left join public.expedients e on e.id = d.expedient_id where d.id = ${a.dedicacio_id}`) as {
      id: number;
      data: string;
      hores: string;
      tasca: string | null;
      num_expedient: string | null;
      altra_acta: string | null;
    }[];
    const d = rows[0];
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!d) errors.push(`No hi ha cap dedicació amb id ${a.dedicacio_id}.`);
    else if (d.altra_acta) errors.push(`La dedicació ja té l'acta ${d.altra_acta}.`);
    if (row.dedicacio_id && row.dedicacio_id !== a.dedicacio_id) warnings.push(`L'acta deixarà d'estar lligada a la dedicació ${row.dedicacio_id}.`);
    if (d && row.expedient_id && d.num_expedient && d.num_expedient !== row.expedient_num) warnings.push("La dedicació és d'un altre expedient.");
    return {
      summary: `Lligar l'acta ${actaLabel(row)} a la dedicació ${a.dedicacio_id}${d ? ` (${d.data}, ${d.hores} h${d.tasca ? `, ${d.tasca}` : ""})` : ""}.`,
      errors,
      warnings,
    };
  },
  async commit(a) {
    if (a.dedicacio_id === null) await callAction(() => unlinkActaFromDedicacioAction(a.acta_id));
    else {
      await callAction(() => unlinkActaFromDedicacioAction(a.acta_id));
      await callAction(() => linkActaToDedicacioAction(a.acta_id, a.dedicacio_id!));
    }
    const row = await getActa({ id: a.acta_id });
    return { acta_id: a.acta_id, dedicacio_id: row?.dedicacio_id ?? null };
  },
});

// Files ------------------------------------------------------------------------------------

// ChatGPT fills an attached file as {download_url, file_id, ...}; its phone
// apps send a placeholder string instead, which is let through so the plan
// can explain the problem rather than failing validation.
export const fileParam = z.preprocess(
  (v) => (typeof v === "string" ? { download_url: "", file_id: v } : v),
  z.object({ download_url: z.string(), file_id: z.string(), mime_type: z.string().optional(), file_name: z.string().optional() }),
);

const KIND = z.enum(["foto", "document", "audio"]);
const KIND_LABEL: Record<MediaKind, string> = { foto: "foto", document: "document PDF", audio: "àudio" };

export const addFitxerSchema = z.object({
  acta_id: id,
  tipus: KIND.optional().describe("foto | document (PDF) | audio; si no s'indica es dedueix del fitxer"),
  fitxer: fileParam.optional().describe("Fitxer adjuntat al xat (ChatGPT)"),
  url: z.string().max(4000).optional().describe("Enllaç https públic al fitxer"),
  nom: shortText.optional().describe("Nom del fitxer per a documents i àudios"),
});
type AddFitxer = z.infer<typeof addFitxerSchema>;

function sourceOf(a: AddFitxer): { url: string } | { error: string } {
  if (a.fitxer && a.url) return { error: "Passa el fitxer adjunt o un enllaç, no tots dos." };
  if (a.fitxer) {
    if (!a.fitxer.download_url) {
      return {
        error: `El fitxer no ha arribat (${a.fitxer.file_id}). L'app de ChatGPT del mòbil no passa els fitxers a les eines: fes-ho des de ChatGPT web o d'escriptori, o passa un enllaç https.`,
      };
    }
    return { url: a.fitxer.download_url };
  }
  if (a.url) return { url: a.url.trim() };
  return { error: "Cal adjuntar el fitxer (fitxer) o passar-ne un enllaç https públic (url). A Claude, les fotos del xat no arriben a les eines: cal un enllaç." };
}

registerAction({
  kind: "change",
  name: "add_acta_fitxer",
  domain: "actes",
  description: "Afegeix una foto, un PDF o un àudio a una acta, des d'un fitxer adjunt a ChatGPT o d'un enllaç https públic.",
  notes: [
    "Per a fitxers adjunts al xat de ChatGPT fes servir l'eina acta_afegir_fitxer (passa el fitxer a «fitxer»). Aquí només funciona amb url.",
    "Les fotos es redueixen a 1600 px en JPEG com fa la web; apareixen al final del document. Els àudios no s'imprimeixen.",
  ],
  schema: addFitxerSchema,
  async plan(a): Promise<Plan> {
    const row = await getActa({ id: a.acta_id });
    if (!row) return { summary: "Afegir fitxer", errors: [`No hi ha cap acta amb id ${a.acta_id}.`] };
    const src = sourceOf(a);
    if ("error" in src) return { summary: "Afegir fitxer", errors: [src.error] };
    try {
      const f = await prepareFile(src.url, { expected: a.tipus, name: a.nom ?? a.fitxer?.file_name ?? null });
      const count = f.kind === "foto" ? row.fotos_chars.length : f.kind === "document" ? row.documents_info.length : row.audios_info.length;
      const size = f.kind === "foto" ? `${mb(f.originalBytes)} → ${mb(f.storedBytes)}, ${f.width}×${f.height}` : mb(f.storedBytes);
      return {
        summary: `Afegir ${f.kind === "foto" ? "una foto" : `«${f.name}»`} (${size}) a l'acta ${actaLabel(row)}; en tindrà ${count + 1} de ${KIND_LABEL[f.kind]}.`,
        details: { tipus: f.kind, nom: f.name },
      };
    } catch (e) {
      return { summary: "Afegir fitxer", errors: [e instanceof Error ? e.message : String(e)] };
    }
  },
  async commit(a) {
    const src = sourceOf(a);
    if ("error" in src) throw new Error(src.error);
    const f = await prepareFile(src.url, { expected: a.tipus, name: a.nom ?? a.fitxer?.file_name ?? null });
    if (f.kind === "foto") await callAction(() => addActaFotoAction(a.acta_id, f.dataUrl));
    else if (f.kind === "document") await callAction(() => addActaDocAction(a.acta_id, { name: f.name, dataUrl: f.dataUrl }));
    else await callAction(() => addActaAudioAction(a.acta_id, { name: f.name, dataUrl: f.dataUrl }));
    const saved = await getActa({ id: a.acta_id });
    const list = f.kind === "foto" ? saved?.fotos_chars : f.kind === "document" ? saved?.documents_info : saved?.audios_info;
    return { acta_id: a.acta_id, tipus: f.kind, nom: f.name, index: (list?.length ?? 1) - 1, total: list?.length ?? null, mida: mb(f.storedBytes) };
  },
});

registerAction({
  kind: "change",
  name: "remove_acta_fitxer",
  domain: "actes",
  description: "Treu una foto, un document o un àudio d'una acta pel seu index (vegeu get_acta).",
  destructive: true,
  schema: z.object({ acta_id: id, tipus: KIND, index: idx }),
  async plan(a): Promise<Plan> {
    const row = await getActa({ id: a.acta_id });
    if (!row) return { summary: "Treure fitxer", errors: [`No hi ha cap acta amb id ${a.acta_id}.`] };
    const d = describeActa(row);
    const list = a.tipus === "foto" ? d.fotografies : a.tipus === "document" ? d.documents : d.audios;
    const item = list[a.index] as { nom?: string; mida: string } | undefined;
    if (!item) return { summary: "Treure fitxer", errors: [`L'acta no té cap ${KIND_LABEL[a.tipus]} amb index ${a.index} (en té ${list.length}).`] };
    return { summary: `Treure ${a.tipus === "foto" ? `la foto ${a.index + 1}` : `«${item.nom}»`} (${item.mida}) de l'acta ${actaLabel(row)}.` };
  },
  async commit(a) {
    if (a.tipus === "foto") await callAction(() => removeActaFotoAction(a.acta_id, a.index));
    else if (a.tipus === "document") await callAction(() => removeActaDocAction(a.acta_id, a.index));
    else await callAction(() => removeActaAudioAction(a.acta_id, a.index));
    return savedSummary(a.acta_id);
  },
});
