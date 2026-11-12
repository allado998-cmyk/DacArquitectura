// The portal's code lists ("mestres"): orientations, envelope types, deficiency
// types and severities, street types, municipalities… Each value is an object
// with the portal's own `id` (what its database links by), a `codi` and texts,
// and the XML carries the whole object wherever it is used. Three sources:
//   - cataleg-base.json: values found in real exports, with the portal's ids;
//   - table ite_cataleg: values found in any report imported into the app;
//   - cataleg-portal.json (server only, cataleg-portal.ts): every value the
//     portal's form offers (docs/ite-portal-formulari.txt), with ids of ours
//     ("f…"). When a value also comes with its real id, the real one is offered
//     and ours is kept only to show reports that already use it.
import { isObj, type IteObj, type IteVal } from "./xml";
import BASE from "./cataleg-base.json";

// Our name for each list, by the field that holds it.
export const CATALEG_BY_FIELD: Record<string, string> = {
  fontInformacioSup: "font_superficies",
  orientacio: "orientacio",
  envolupantTipus: "tipus_envolupant",
  ascensorsUnNucli: "ascensors",
  implantacioParcela: "implantacio",
  nuclisComunicacioVertical: "nuclis",
  gravetat: "gravetat",
  tipusDeficiencia: "tipus_deficiencia",
  key: "categoria_deficiencia", // teDeficienciesTipus/entry/key
  regimJuridic: "regim_juridic",
  tipusIdentificacioPropietat: "tipus_identificacio",
  tipusIdentificacioTecnic: "tipus_identificacio",
  tipusViaPropietat: "tipus_via",
  tipusViaTecnic: "tipus_via",
  municipiPropietat: "municipi",
  municipiTecnic: "municipi",
  colegiProfessionalTecnic: "colegi",
  titulacioTecnic: "titulacio",
  titulacioTecnicDeficiencia: "titulacio",
  tipusIdentificacioRepresentant: "tipus_identificacio",
  tipusViaRepresentant: "tipus_via",
  municipiRepresentant: "municipi",
};

export const CATALEG_LABELS: Record<string, string> = {
  font_superficies: "Font d'informació de superfícies",
  orientacio: "Orientació",
  tipus_envolupant: "Tipus de sistema envolupant",
  ascensors: "Ascensors (un nucli)",
  implantacio: "Implantació en parcel·la",
  nuclis: "Nuclis de comunicació vertical",
  gravetat: "Gravetat de la deficiència",
  tipus_deficiencia: "Tipus de deficiència",
  categoria_deficiencia: "Categoria de deficiències",
  regim_juridic: "Règim jurídic de la propietat",
  tipus_identificacio: "Tipus d'identificació",
  tipus_via: "Tipus de via",
  municipi: "Municipi",
  colegi: "Col·legi professional",
  titulacio: "Titulació",
};

export interface CatEntry {
  cat: string;
  obj: IteObj;
}

const str = (v: IteVal | undefined): string => (typeof v === "string" ? v : "");

export function catId(obj: IteObj): string {
  return str(obj.id);
}

export function catLabel(obj: IteObj): string {
  return str(obj.descMultidioma) || str(obj.descripcio) || str(obj.nom) || str(obj.valor) || str(obj.codi) || catId(obj);
}

function isCatalogObject(v: IteVal | undefined): v is IteObj {
  if (!isObj(v)) return false;
  const idv = str(v.id);
  if (!idv || idv === "null") return false;
  return isObj(v.mestre) || typeof v.codiProvincia === "string";
}

// Every code-list value in a report, with the list it belongs to.
export function harvestCataleg(doc: IteObj): CatEntry[] {
  const out: CatEntry[] = [];
  const seen = new Set<string>();
  const add = (cat: string, obj: IteObj) => {
    const k = `${cat}|${catId(obj)}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ cat, obj });
  };
  const walk = (v: IteVal, field: string) => {
    if (Array.isArray(v)) { for (const x of v) walk(x, field); return; }
    if (!isObj(v)) return;
    if (isCatalogObject(v)) {
      const mestre = isObj(v.mestre) ? str(v.mestre.codi) : "";
      add(CATALEG_BY_FIELD[field] ?? (mestre ? `mestre_${mestre.toLowerCase()}` : field), v);
      return;
    }
    for (const [k, x] of Object.entries(v as IteObj)) walk(x, k);
  };
  walk(doc, "");
  return out;
}

export type Cataleg = Record<string, IteObj[]>;

function sortEntries(list: IteObj[]): IteObj[] {
  return list.sort((a, b) => {
    const oa = Number(str(a.ordre)), ob = Number(str(b.ordre));
    if (Number.isFinite(oa) && Number.isFinite(ob) && oa !== ob) return oa - ob;
    return catLabel(a).localeCompare(catLabel(b), "ca");
  });
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// A value taken from the portal's form, with an id of ours (cataleg-portal.json).
export const esDelFormulari = (obj: IteObj): boolean => str(obj.id).startsWith("f");

// The same value in two sources: same text (municipalities: same name and province).
const sameValue = (cat: string, o: IteObj) => (cat === "municipi" ? `${str(o.codiProvincia)}|${fold(str(o.nom))}` : fold(catLabel(o)));

// The values a select offers: not the form's copy of a value that also came
// with the portal's real id.
export function visibles(list: IteObj[] | undefined): IteObj[] {
  return (list ?? []).filter((o) => o.ocult !== "true");
}

// Base lists plus the ones from the portal's form and from imports (later
// entries win by id; a real id wins over ours for the same value).
export function buildCataleg(extra: CatEntry[] = []): Cataleg {
  const map = new Map<string, Map<string, IteObj>>();
  for (const e of [...(BASE as unknown as CatEntry[]), ...extra]) {
    let m = map.get(e.cat);
    if (!m) { m = new Map(); map.set(e.cat, m); }
    m.set(catId(e.obj), e.obj);
  }
  const out: Cataleg = {};
  for (const [cat, m] of map) {
    const all = [...m.values()];
    const real = new Set(all.filter((o) => !esDelFormulari(o)).map((o) => sameValue(cat, o)));
    out[cat] = sortEntries(all.map((o) => (esDelFormulari(o) && real.has(sameValue(cat, o)) ? { ...o, ocult: "true" } : o)));
  }
  return out;
}

export function findCat(cataleg: Cataleg, cat: string, idOrCodi: string): IteObj | undefined {
  const list = cataleg[cat] ?? [];
  return list.find((o) => catId(o) === idOrCodi) ?? visibles(list).find((o) => str(o.codi) === idOrCodi) ?? list.find((o) => str(o.codi) === idOrCodi);
}

// For the plugin: a value given as id, codi or (part of) its label.
export function matchCat(cataleg: Cataleg, cat: string, q: string): { obj?: IteObj; ambiguous?: IteObj[] } {
  const list = visibles(cataleg[cat]);
  const exact = findCat(cataleg, cat, q);
  if (exact) return { obj: exact };
  const fq = fold(q);
  if (!fq) return {};
  const byLabel = list.filter((o) => fold(catLabel(o)) === fq);
  if (byLabel.length === 1) return { obj: byLabel[0] };
  const partial = list.filter((o) => fold(catLabel(o)).includes(fq) || fold(str(o.codi)).includes(fq));
  if (partial.length === 1) return { obj: partial[0] };
  return partial.length ? { ambiguous: partial } : {};
}

// A deficiency type belongs to the category whose i18n key is its own minus
// the last part ("Deficiencia.envolupant.terrats.filtracions" →
// "Deficiencia.envolupant.terrats").
export function categoriaDeTipus(cataleg: Cataleg, tipus: IteObj): IteObj | undefined {
  const i18n = str(tipus.i18n);
  const parent = i18n.slice(0, i18n.lastIndexOf("."));
  return (cataleg.categoria_deficiencia ?? []).find((c) => str(c.i18n) === parent);
}
