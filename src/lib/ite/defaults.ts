// What a new ITE starts with: the office's technician (David), the owner from
// the expedient's client and its contacts, and the building's address.
import { catId, catLabel, findCat, visibles, type Cataleg } from "./cataleg";
import { NULL_ID } from "./model";
import type { IteObj } from "./xml";

// David Lladó, as the portal has him (Mallorca 325 export, April 2026). The
// code-list values are the portal's ids, all present in cataleg-base.json.
export const TECNIC_DESPATX = {
  nomTecnic: "David",
  cognom1Tecnic: "Lladó",
  cognom2Tecnic: "Porta",
  identificacioTecnic: "35040453E",
  numColegiatTecnic: "22289-5",
  nomViaTecnic: "Carles III, 46-48, escala O, local",
  codiPostalTecnic: "08028",
  telefon1Tecnic: "933017940",
  telefon2Tecnic: "649439259",
  emailTecnic: "dllado@dacarquitectura.com",
  cat: {
    tipusIdentificacioTecnic: ["tipus_identificacio", "15"], // NIF
    titulacioTecnic: ["titulacio", "26"], // Arquitecte/a
    colegiProfessionalTecnic: ["colegi", "44"], // COAC
    tipusViaTecnic: ["tipus_via", "242"], // Gran Via
    municipiTecnic: ["municipi", "4120"], // Barcelona
  } as Record<string, [string, string]>,
};

export function tecnicDespatx(cataleg: Cataleg): IteObj {
  const { cat, ...text } = TECNIC_DESPATX;
  const t: IteObj = { id: NULL_ID, tecnicPrincipal: "true", ...text };
  for (const [field, [list, id]] of Object.entries(cat)) {
    const obj = findCat(cataleg, list, id);
    if (obj) t[field] = structuredClone(obj);
  }
  return t;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Street-type words (Catalan, Spanish, abbreviations, Catastro codes) → the
// Catalan name the portal's list uses.
const VIA_WORDS: [RegExp, string][] = [
  [/^(gran via|g\.? ?v\.?|gv)\b/i, "gran via"],
  [/^(c\/|c\.|cl\b|cl\.|carrer|calle|c\b)/i, "carrer"],
  [/^(av\.?|avda\.?|avinguda|avenida)\b/i, "avinguda"],
  [/^(pg\.?|pº|ps\b|passeig|paseo)/i, "passeig"],
  [/^(pl\.?|pça\.?|pza\.?|pz\b|plaça|plaza)/i, "plaça"],
  [/^(rbla\.?|rb\b|rambla)/i, "rambla"],
  [/^(rda\.?|rd\b|ronda)/i, "ronda"],
  [/^(trav\.?|trv\.?|tr\b|travessera|travesía|travesia)/i, "travessera"],
  [/^(ptge\.?|pje\.?|pj\b|passatge|pasaje)/i, "passatge"],
  [/^(ctra\.?|cr\b|carretera)/i, "carretera"],
  [/^(cm\b|camí|cami|camino)/i, "cami"],
  [/^(via)\b/i, "via"],
];

const CATASTRO_VIA: Record<string, string> = {
  CL: "carrer", AV: "avinguda", PS: "passeig", PZ: "plaça", PL: "plaça", RB: "rambla", RD: "ronda", RO: "ronda",
  TR: "travessera", PJ: "passatge", PA: "passatge", GV: "gran via", CR: "carretera", CM: "cami", VI: "via",
};

export function viaWordFromCatastro(code: string): string {
  return CATASTRO_VIA[code.toUpperCase()] ?? "";
}

// The portal's street type for a word like "carrer" (only if it is in the list).
export function tipusViaFor(cataleg: Cataleg, word: string): IteObj | undefined {
  if (!word) return undefined;
  const w = fold(word);
  return visibles(cataleg.tipus_via).find((o) => fold(catLabel(o)) === w || fold(String(o.codi ?? "")).replace(/ /g, "") === w.replace(/ /g, ""));
}

// "C/ Mallorca, 325" → { word: "carrer", nom: "Mallorca", numero: "325" }
export function parseAdreca(text: string): { word: string; nom: string; numero: string } {
  let rest = text.trim().replace(/\s+/g, " ");
  let word = "";
  for (const [re, w] of VIA_WORDS) {
    const m = re.exec(rest);
    if (m) {
      word = w;
      rest = rest.slice(m[0].length).replace(/^[\s.,/:-]+/, "");
      break;
    }
  }
  rest = rest.replace(/^(de |d'|del |de la |dels |de les )/i, (m) => (word ? "" : m));
  const num = /[,\s]+(?:n[ºo°.]?\s*)?(\d+[A-Za-z]?(?:\s*[-–]\s*\d+)?)\b(.*)$/.exec(rest);
  if (num) return { word, nom: rest.slice(0, num.index).trim(), numero: num[1].replace(/\s+/g, "") };
  return { word, nom: rest.trim(), numero: "" };
}

export function municipiFor(cataleg: Cataleg, ciutat: string): IteObj | undefined {
  const f = fold(ciutat);
  if (!f) return undefined;
  // The portal writes the article last: «Hospitalet de Llobregat, l'».
  const plain = (s: string) => fold(s.replace(/^(.*),\s*(l'|la|el|els|les|es|sa)\s*$/i, "$2 $1"));
  const list = visibles(cataleg.municipi);
  return list.find((m) => fold(String(m.nom ?? "")) === f) ?? list.find((m) => plain(String(m.nom ?? "")) === f);
}

const PROVINCIA_PER_CP: Record<string, string> = { "08": "BARCELONA", "17": "GIRONA", "25": "LLEIDA", "43": "TARRAGONA" };

// Building address in the shape of the portal's cadastre block.
export function adrecaEdificiFrom(text: string, ciutat: string, codiPostal: string, cataleg: Cataleg): IteObj {
  const a = parseAdreca(text);
  const out: IteObj = { adrecaCorrecta: "false", adrecaIncorrecta: "false" };
  const tv = tipusViaFor(cataleg, a.word);
  if (tv) out.tipusVia = catId(tv);
  if (a.nom) out.nomVia = a.nom.toUpperCase();
  if (a.numero) out.numero = a.numero.toUpperCase();
  const muni = municipiFor(cataleg, ciutat);
  if (ciutat.trim()) out.municipi = ciutat.trim().toUpperCase();
  if (muni && typeof muni.codi === "string") out.codiIne = muni.codi;
  const cp = codiPostal.trim();
  if (/^\d{5}$/.test(cp)) {
    out.codiPostal = cp;
    if (PROVINCIA_PER_CP[cp.slice(0, 2)]) out.provincia = PROVINCIA_PER_CP[cp.slice(0, 2)];
  }
  return out;
}

const LOWER = new Set(["de", "del", "dels", "la", "les", "el", "els", "i", "y", "d", "l"]);

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/(\s+|['’-])/)
    .map((w, i) => (i > 0 && LOWER.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join("");
}

const ARTICLE: Record<string, string> = {
  carrer: "del carrer", avinguda: "de l'avinguda", passeig: "del passeig", plaça: "de la plaça", rambla: "de la rambla",
  ronda: "de la ronda", travessera: "de la travessera", passatge: "del passatge", "gran via": "de la Gran Via",
  carretera: "de la carretera", cami: "del camí", via: "de la via",
};

// The portal's naming: "Inspecció Tècnica de l'Edifici del carrer Mallorca, 325 de Barcelona".
export function nomInforme(word: string, nom: string, numero: string, ciutat: string): string {
  const via = [ARTICLE[word] ?? (word ? `de ${word}` : "de"), nom ? titleCase(nom) : ""].filter(Boolean).join(" ");
  const num = numero ? `, ${numero}` : "";
  const city = ciutat ? ` de ${titleCase(ciutat)}` : "";
  return `Inspecció Tècnica de l'Edifici ${via}${num}${city}`.replace(/\s+/g, " ").trim();
}

// NIF (digits + letter), NIE (X/Y/Z…) or CIF (a letter first). Only the types
// in the portal's list are returned.
export function tipusIdentificacioFor(cataleg: Cataleg, nif: string): IteObj | undefined {
  const v = nif.trim().toUpperCase();
  if (!v) return undefined;
  const codi = /^\d/.test(v) ? "NIF" : /^[XYZ]/.test(v) ? "NIE" : "CIF";
  return (cataleg.tipus_identificacio ?? []).find((o) => o.codi === codi);
}

export interface ClientDades {
  nom: string | null;
  nif: string | null;
  carrer: string | null;
  ciutat: string | null;
  codi_postal: string | null;
}

export interface ContacteDades {
  telefon: string | null;
  mail: string | null;
}

// Section 3 (owner) from a client of the database. A community of owners
// ("comunitat de propietaris") is horizontal property, the usual case.
// "Puig Vila, Maria" or "Maria Puig Vila" → the portal's three boxes. Only a
// guess for compound names: the form shows it to be checked.
export function nomICognoms(text: string): { nom: string; cognom1: string; cognom2: string } {
  const t = text.trim().replace(/\s+/g, " ");
  const comma = t.indexOf(",");
  if (comma > 0) {
    const [c1, ...c2] = t.slice(0, comma).trim().split(" ");
    return { nom: t.slice(comma + 1).trim(), cognom1: c1 ?? "", cognom2: c2.join(" ") };
  }
  const [nom, c1, ...c2] = t.split(" ");
  return { nom: nom ?? "", cognom1: c1 ?? "", cognom2: c2.join(" ") };
}

export function propietatFromClient(c: ClientDades, contacte: ContacteDades | null, cataleg: Cataleg): IteObj {
  const p: IteObj = {};
  const nif = (c.nif ?? "").replace(/[\s.-]/g, "").toUpperCase();
  const ti = nif ? tipusIdentificacioFor(cataleg, nif) : undefined;
  // A company or a community has a company name; a person, name and surnames.
  if (c.nom?.trim()) {
    if (ti && ti.codi !== "CIF") {
      const n = nomICognoms(c.nom);
      p.nomPropietat = n.nom;
      if (n.cognom1) p.cognom1Propietat = n.cognom1;
      if (n.cognom2) p.cognom2Propietat = n.cognom2;
    } else {
      p.raoSocialPropietat = c.nom.trim();
    }
  }
  if (nif) {
    p.identificacioPropietat = nif;
    if (ti) p.tipusIdentificacioPropietat = structuredClone(ti);
  }
  const regim = (cataleg.regim_juridic ?? []).find((o) => o.codi === "PROP_HORITZONTAL");
  if (regim) p.regimJuridic = structuredClone(regim);
  if (c.carrer?.trim()) {
    const a = parseAdreca(c.carrer);
    const tv = tipusViaFor(cataleg, a.word);
    if (tv) {
      p.tipusViaPropietat = structuredClone(tv);
      p.nomViaPropietat = [a.nom, a.numero].filter(Boolean).join(" ");
    } else {
      p.nomViaPropietat = c.carrer.trim();
    }
  }
  if (c.codi_postal?.trim()) p.codiPostalPropietat = c.codi_postal.trim();
  const muni = municipiFor(cataleg, c.ciutat ?? "");
  if (muni) p.municipiPropietat = structuredClone(muni);
  if (contacte?.telefon?.trim()) p.telefon1Propietat = contacte.telefon.replace(/\s+/g, "");
  if (contacte?.mail?.trim()) p.emailPropietat = contacte.mail.trim();
  return p;
}
