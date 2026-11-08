// Calculation types: «Suma d'inèrcies» (equivalent section of combined
// profiles and plates), ports of David's
//   Suma d'Inercies entre Perfils.xls            → tipus "inercies-perfils"
//   Suma d'Inercies entre Pletines.xls           → tipus "inercies-pletines"
//   Suma d'Inercies entre Perfils i Pletina.xls  → tipus "inercies-perfil-pletina"
// Registered in index.ts through INERCIES (group "Inèrcies").
//
// All three stack two pieces: piece 1 on top, piece 2 under it. With A1, A2
// their areas, I1, I2 their own inertias and X the distance between their
// centroids (Steiner):
//   d  = A2 · X / (A1 + A2)                      centroid of piece 1 → new centroid
//   IT = (I1 + A1 · d²) + (I2 + A2 · (X − d)²)
//   y  = new centroid → «fibra traccionada» (the bottom of piece 2)
//   WT = IT / y
// Units as in the sheets: cm, cm², cm⁴, cm³. The report titles of Perfils and
// Perfil i pletina are the sheets' own title bars; Pletines has none. A drawing
// of the stacked section (inercies-figura.ts) replaces the sheets' missing one.
//
// Perfils: an existing rolled profile + a reinforcement profile under it,
// X = h1/2 + (h2 − h3) and y = (h1/2 − d) + h2. The sheet's typed h, A and I
// match the catalogue, so they come from it (still editable); h3, the
// reinforcement's centroid measured from its outer fibre, defaults to h2 / 2 as
// in the sheet. The sheet printed «Necessari: UPN-180 · 1350 cm4 · 150 cm3»
// beside the results; here that profile is picked, its Ix and Wx come from the
// catalogue (editable) and IT, WT are checked against them. Rows 1–24 of the
// sheet (a plate on its own and an IPE + plate) are hidden leftovers: not ported.
//
// Pletines: a horizontal plate on top of a vertical one (a T). Each plate on its
// own (I = b·h³/12, W = I / (0,5·h)), then together with X = (h1 + h2)/2 and
// y = X − d + h2/2. The sheet has no checks.
//
// Perfil i pletina: an existing profile + a plate under it, X = (h1 + h2)/2,
// y = X − d + h2/2, with «Necessari» as in Perfils.
//
// Differences from the sheets, on purpose:
// - Perfil i pletina: the sheet's IT multiplies d² by h1 (cell D21, the
//   profile's height) instead of A1 (D20, its area), though its own formula
//   text says A1·d². Here it is A1·d². The example has A1 = h1 = 10, so the
//   sheet's result does not change.
// - Pletines: the sheet labels d «distància de la pletina vertical al nou
//   c.d.g.», but d = A2·X/(A1 + A2) is measured from the horizontal plate (IT
//   multiplies it by A1); labelled so here.
// - Units the sheets mistype: y is in cm (sheets: cm4), and I2 of Pletines in
//   cm⁴ (sheet: cm).
// - The «Tipus de perfil» lines are written from the inputs; the sheets kept
//   stale text (e.g. «300 x 60 mm» for a 300 × 10 mm plate).
// - A new Perfil i pletina starts as an IPE 200 + pletina 100 × 10 mm (named in
//   the hidden rows of the Perfils sheet); the sheet's example is a placeholder
//   («Perfil A DETERMINAR»: A1 = h1 = 10 cm, I1 = 83,33 cm⁴).
//
// Kept as in the sheets, for David to confirm: WT uses the distance to the
// tension fibre only. When the top of piece 1 is farther from the new centroid
// (h1/2 + d > y, e.g. the Perfil i pletina example: 9,4 cm against 1,6 cm),
// the modulus at that fibre, IT / (h1/2 + d), is the smaller one.

import type { CalcType } from "./index";
import { type CalcResult, type Row, type Section, check, div, num } from "./common";
import { seccioFigure, type Peca } from "./inercies-figura";
import { perfilProps, type PerfilProps } from "./perfils";

type Dades = Record<string, unknown>;

// ---- shared ----

// Catalogue mm → the sheets' cm.
const cm = (mm: number | null | undefined) => (mm == null ? null : mm / 10);

// The typed value, or `auto` (catalogue / formula) while the input is left empty.
function orAuto(d: Dades, key: string, auto: number | null): number {
  return d[key] == null || d[key] === "" ? auto ?? 0 : num(d[key]);
}

// cm → mm text ("300", "12,5") for the plate descriptions.
const mmText = (c: number) => String(Math.round(c * 100) / 10).replace(".", ",");
const pletinaText = (b: number, h: number) => `Pletina ${mmText(b)} × ${mmText(h)} mm`;

// Steiner for two pieces whose centroids are X apart (see the header).
export function sumaInercies(A1: number, A2: number, X: number, I1: number, I2: number): { d: number | null; IT: number | null } {
  const d = div(A2 * X, A1 + A2);
  const IT = d == null ? null : I1 + A1 * d ** 2 + (I2 + A2 * (X - d) ** 2);
  return { d, IT };
}

function pecaPerfil(name: string, p: PerfilProps | null, h: number): Peca {
  return { label: name || "Perfil", shape: p?.family === "upn" ? "U" : "I", h, b: cm(p?.b), tw: cm(p?.tw), tf: cm(p?.tf) };
}

const IT_FORMULA = "IT = (I1 + A1 · d²) + (I2 + A2 · (X − d)²)";

// «Resultat final» of Perfils and Perfil i pletina: IT and WT against the
// profile the composite has to equal («Necessari»).
function resultatFinal(d: Dades, IT: number | null, WT: number | null): Section {
  const nom = String(d.perfilNec ?? "");
  const pn = perfilProps(nom);
  const Inec = orAuto(d, "Inec", pn?.Ix ?? null);
  const Wnec = orAuto(d, "Wnec", pn?.Wx ?? null);
  return {
    key: "resultat",
    title: "Resultat final",
    enabled: true,
    blocks: [
      {
        title: "Necessari",
        rows: [
          { label: "Perfil necessari", value: nom, input: { type: "profile", key: "perfilNec" }, hint: "El perfil al qual ha d'equivaler la secció composta" },
          { label: "Moment d'inèrcia necessari", sym: "I nec", value: Inec, unit: "cm⁴", input: { type: "num", key: "Inec", decimals: 2, auto: pn?.Ix ?? null } },
          { label: "Mòdul resistent necessari", sym: "W nec", value: Wnec, unit: "cm³", input: { type: "num", key: "Wnec", decimals: 2, auto: pn?.Wx ?? null } },
        ],
      },
      {
        title: "Resultats",
        rows: [
          { label: "Moment d'inèrcia total", formula: IT_FORMULA, sym: "IT", value: IT, unit: "cm⁴", check: check(IT, ">", Inec, "cm⁴") },
          { label: "Mòdul resistent total", formula: "WT = IT / y", sym: "WT", value: WT, unit: "cm³", check: check(WT, ">", Wnec, "cm³") },
        ],
      },
    ],
  };
}

// ---- Suma d'inèrcies entre perfils ----

export interface InerciesPerfilsDades {
  perfil1: string; // existing rolled profile (catalogue)
  perfil2: string; // reinforcement profile, under it
  h1: number | null; // cm; null → catalogue
  h2: number | null; // cm; null → catalogue
  h3: number | null; // cm, reinforcement centroid from its outer fibre; null → h2 / 2
  A1: number | null; // cm²; null → catalogue
  A2: number | null;
  I1: number | null; // cm⁴; null → catalogue Ix
  I2: number | null;
  perfilNec: string; // the profile the composite has to equal
  Inec: number | null; // cm⁴; null → catalogue Ix of perfilNec
  Wnec: number | null; // cm³; null → catalogue Wx of perfilNec
}

export function inerciesPerfilsDefaults(): InerciesPerfilsDades {
  // David's example: an IPN 140 reinforced with an IPN 120, to equal a UPN 180.
  return { perfil1: "IPN 140", perfil2: "IPN 120", h1: null, h2: null, h3: null, A1: null, A2: null, I1: null, I2: null, perfilNec: "UPN 180", Inec: null, Wnec: null };
}

export function computeInerciesPerfils(raw: Dades): CalcResult {
  const d = { ...inerciesPerfilsDefaults(), ...raw } as unknown as Dades;
  const n1 = String(d.perfil1 ?? "");
  const n2 = String(d.perfil2 ?? "");
  const p1 = perfilProps(n1);
  const p2 = perfilProps(n2);

  const h1 = orAuto(d, "h1", cm(p1?.h));
  const h2 = orAuto(d, "h2", cm(p2?.h));
  const h3 = orAuto(d, "h3", h2 / 2);
  const A1 = orAuto(d, "A1", p1?.A ?? null);
  const A2 = orAuto(d, "A2", p2?.A ?? null);
  const I1 = orAuto(d, "I1", p1?.Ix ?? null);
  const I2 = orAuto(d, "I2", p2?.Ix ?? null);
  const X = h1 / 2 + (h2 - h3);
  const { d: dist, IT } = sumaInercies(A1, A2, X, I1, I2);
  const y = dist == null ? null : h1 / 2 - dist + h2;
  const WT = div(IT, y);

  const rows: Row[] = [
    { label: "Tipus de perfil a augmentar", value: `${n1 || "—"} + ${n2 || "—"}` },
    { label: "Perfil laminat", value: n1, input: { type: "profile", key: "perfil1" } },
    { label: "Perfil de reforç", value: n2, input: { type: "profile", key: "perfil2" }, hint: "A sota del perfil laminat" },
    { label: "Alçària del perfil laminat", sym: "h1", value: h1, unit: "cm", input: { type: "num", key: "h1", decimals: 2, auto: cm(p1?.h) } },
    { label: "Alçària del perfil de reforç", sym: "h2", value: h2, unit: "cm", input: { type: "num", key: "h2", decimals: 2, auto: cm(p2?.h) } },
    {
      label: "Centre de gravetat perfil de reforç",
      sym: "h3",
      value: h3,
      unit: "cm",
      input: { type: "num", key: "h3", decimals: 2, auto: h2 / 2 },
      hint: "Des de la fibra exterior del perfil de reforç (h2 / 2 si és simètric)",
    },
    { label: "Àrea del perfil laminat", sym: "A1", value: A1, unit: "cm²", input: { type: "num", key: "A1", decimals: 2, auto: p1?.A ?? null } },
    { label: "Àrea del perfil de reforç", sym: "A2", value: A2, unit: "cm²", input: { type: "num", key: "A2", decimals: 2, auto: p2?.A ?? null } },
    { label: "Distància entre els centres de gravetat", formula: "X = h1 / 2 + (h2 − h3)", sym: "X", value: X, unit: "cm" },
    { label: "Distància del perfil al nou c.d.g.", formula: "d = A2 · X / (A1 + A2)", sym: "d", value: dist, unit: "cm" },
    { label: "Moment d'inèrcia perfil laminat", sym: "I1", value: I1, unit: "cm⁴", input: { type: "num", key: "I1", decimals: 2, auto: p1?.Ix ?? null } },
    { label: "Moment d'inèrcia del perfil de reforç", sym: "I2", value: I2, unit: "cm⁴", input: { type: "num", key: "I2", decimals: 2, auto: p2?.Ix ?? null } },
    { label: "Distància nou c.d.g. a fibra traccionada", formula: "y = (h1 / 2 − d) + h2", sym: "y", value: y, unit: "cm" },
  ];

  const calcul: Section = {
    key: "calcul",
    title: "Càlcul del moment d'inèrcia d'un perfil existent + perfil de reforç",
    enabled: true,
    blocks: [{ rows }],
    figure: seccioFigure({ top: pecaPerfil(n1, p1, h1), bottom: pecaPerfil(n2, p2, h2), X, d: dist, y, IT, WT }),
  };

  return { sections: [calcul, resultatFinal(d, IT, WT)] };
}

// ---- Suma d'inèrcies entre pletines ----

export interface InerciesPletinesDades {
  b1: number; // cm, horizontal plate (on top)
  h1: number;
  b2: number; // cm, vertical plate (under it)
  h2: number;
}

export function inerciesPletinesDefaults(): InerciesPletinesDades {
  // David's example: a 300 × 10 mm plate on a 10 × 230 mm one.
  return { b1: 30, h1: 1, b2: 1, h2: 23 };
}

function pletina(b: number, h: number) {
  const A = b * h;
  const I = (b * h ** 3) / 12;
  return { A, I, W: div(I, 0.5 * h) };
}

function pletinaSection(key: string, nom: "horitzontal" | "vertical", bKey: string, hKey: string, b: number, h: number): Section {
  const { A, I, W } = pletina(b, h);
  return {
    key,
    title: `Càlcul del moment d'inèrcia i mòdul resistent per a una pletina ${nom}`,
    enabled: true,
    blocks: [
      {
        rows: [
          { label: "Tipus de perfil a comprovar", value: pletinaText(b, h) },
          { label: `Ample de la pletina ${nom}`, sym: "b", value: b, unit: "cm", input: { type: "num", key: bKey, decimals: 2 } },
          { label: `Alçària de la pletina ${nom}`, sym: "h", value: h, unit: "cm", input: { type: "num", key: hKey, decimals: 2 } },
          { label: `Àrea de la pletina ${nom}`, formula: "A = b · h", sym: "A", value: A, unit: "cm²" },
        ],
      },
      {
        title: "Resultats",
        rows: [
          { label: "Moment d'inèrcia", formula: "I = b · h³ / 12", sym: "I", value: I, unit: "cm⁴" },
          { label: "Mòdul resistent", formula: "W = I / (0,5 · h)", sym: "W", value: W, unit: "cm³" },
        ],
      },
    ],
  };
}

export function computeInerciesPletines(raw: Dades): CalcResult {
  const d = { ...inerciesPletinesDefaults(), ...raw } as unknown as Dades;
  const b1 = num(d.b1);
  const h1 = num(d.h1);
  const b2 = num(d.b2);
  const h2 = num(d.h2);
  const p1 = pletina(b1, h1);
  const p2 = pletina(b2, h2);
  const X = (h1 + h2) / 2;
  const { d: dist, IT } = sumaInercies(p1.A, p2.A, X, p1.I, p2.I);
  const y = dist == null ? null : X - dist + h2 / 2;
  const WT = div(IT, y);
  const t1 = pletinaText(b1, h1);
  const t2 = pletinaText(b2, h2);

  const seccio: Section = {
    key: "seccio",
    title: "Càlcul del moment d'inèrcia d'un perfil pletina horitzontal + vertical",
    enabled: true,
    blocks: [
      {
        rows: [
          { label: "Tipus de perfil a comprovar", value: `Pletines ${mmText(b1)} × ${mmText(h1)} mm + ${mmText(b2)} × ${mmText(h2)} mm` },
          { label: "Ample de la pletina horitzontal", sym: "b1", value: b1, unit: "cm" },
          { label: "Alçària de la pletina horitzontal", sym: "h1", value: h1, unit: "cm" },
          { label: "Àrea de la pletina horitzontal", formula: "A1 = b1 · h1", sym: "A1", value: p1.A, unit: "cm²" },
          { label: "Ample de la pletina vertical", sym: "b2", value: b2, unit: "cm" },
          { label: "Alçària de la pletina vertical", sym: "h2", value: h2, unit: "cm" },
          { label: "Àrea de la pletina vertical", formula: "A2 = b2 · h2", sym: "A2", value: p2.A, unit: "cm²" },
          { label: "Distància entre els centres de gravetat", formula: "X = (h1 + h2) / 2", sym: "X", value: X, unit: "cm" },
          { label: "Distància de la pletina horitzontal al nou c.d.g.", formula: "d = A2 · X / (A1 + A2)", sym: "d", value: dist, unit: "cm" },
          { label: "Moment d'inèrcia pletina horitzontal", sym: "I1", value: p1.I, unit: "cm⁴" },
          { label: "Moment d'inèrcia pletina vertical", sym: "I2", value: p2.I, unit: "cm⁴" },
          { label: "Distància nou c.d.g. a fibra traccionada", formula: "y = X − d + h2 / 2", sym: "y", value: y, unit: "cm" },
        ],
      },
      {
        title: "Resultats",
        rows: [
          { label: "Moment d'inèrcia total", formula: IT_FORMULA, sym: "IT", value: IT, unit: "cm⁴" },
          { label: "Mòdul resistent total", formula: "WT = IT / y", sym: "WT", value: WT, unit: "cm³" },
        ],
      },
    ],
    figure: seccioFigure({
      top: { label: t1, shape: "rect", h: h1, b: b1 },
      bottom: { label: t2, shape: "rect", h: h2, b: b2 },
      X,
      d: dist,
      y,
      IT,
      WT,
    }),
  };

  return {
    sections: [pletinaSection("horitzontal", "horitzontal", "b1", "h1", b1, h1), pletinaSection("vertical", "vertical", "b2", "h2", b2, h2), seccio],
  };
}

// ---- Suma d'inèrcies entre perfils i pletina ----

export interface InerciesPerfilPletinaDades {
  b2: number; // cm, plate under the profile
  h2: number;
  perfil1: string; // existing rolled profile (catalogue)
  A1: number | null; // cm²; null → catalogue
  h1: number | null; // cm; null → catalogue
  I1: number | null; // cm⁴; null → catalogue Ix
  perfilNec: string;
  Inec: number | null;
  Wnec: number | null;
}

export function inerciesPerfilPletinaDefaults(): InerciesPerfilPletinaDades {
  return { b2: 10, h2: 1, perfil1: "IPE 200", A1: null, h1: null, I1: null, perfilNec: "UPN 180", Inec: null, Wnec: null };
}

export function computeInerciesPerfilPletina(raw: Dades): CalcResult {
  const d = { ...inerciesPerfilPletinaDefaults(), ...raw } as unknown as Dades;
  const n1 = String(d.perfil1 ?? "");
  const p1 = perfilProps(n1);
  const b2 = num(d.b2);
  const h2 = num(d.h2);
  const A1 = orAuto(d, "A1", p1?.A ?? null);
  const h1 = orAuto(d, "h1", cm(p1?.h));
  const I1 = orAuto(d, "I1", p1?.Ix ?? null);
  const { A: A2, I: I2 } = pletina(b2, h2);
  const X = (h1 + h2) / 2;
  const { d: dist, IT } = sumaInercies(A1, A2, X, I1, I2);
  const y = dist == null ? null : X - dist + h2 / 2;
  const WT = div(IT, y);
  const tp = pletinaText(b2, h2);

  const rows: Row[] = [
    { label: "Tipus de perfil a augmentar", value: `${n1 || "—"} + ${tp.replace("Pletina", "pletina")}` },
    { label: "Ample de la pletina", sym: "b2", value: b2, unit: "cm", input: { type: "num", key: "b2", decimals: 2 }, hint: "A sota del perfil laminat" },
    { label: "Alçària de la pletina", sym: "h2", value: h2, unit: "cm", input: { type: "num", key: "h2", decimals: 2 } },
    { label: "Perfil laminat", value: n1, input: { type: "profile", key: "perfil1" } },
    { label: "Àrea del perfil laminat", sym: "A1", value: A1, unit: "cm²", input: { type: "num", key: "A1", decimals: 2, auto: p1?.A ?? null } },
    { label: "Alçària del perfil laminat", sym: "h1", value: h1, unit: "cm", input: { type: "num", key: "h1", decimals: 2, auto: cm(p1?.h) } },
    { label: "Àrea de la pletina suplementada", formula: "A2 = b2 · h2", sym: "A2", value: A2, unit: "cm²" },
    { label: "Distància entre els centres de gravetat", formula: "X = (h1 + h2) / 2", sym: "X", value: X, unit: "cm" },
    { label: "Distància del perfil al nou c.d.g.", formula: "d = A2 · X / (A1 + A2)", sym: "d", value: dist, unit: "cm" },
    { label: "Moment d'inèrcia perfil", sym: "I1", value: I1, unit: "cm⁴", input: { type: "num", key: "I1", decimals: 2, auto: p1?.Ix ?? null } },
    { label: "Moment d'inèrcia pletina suplementada", formula: "I2 = b2 · h2³ / 12", sym: "I2", value: I2, unit: "cm⁴" },
    { label: "Distància nou c.d.g. a fibra traccionada", formula: "y = X − d + h2 / 2", sym: "y", value: y, unit: "cm" },
  ];

  const calcul: Section = {
    key: "calcul",
    title: "Càlcul del moment d'inèrcia d'un perfil existent + pletina de reforç",
    enabled: true,
    blocks: [{ rows }],
    figure: seccioFigure({ top: pecaPerfil(n1, p1, h1), bottom: { label: tp, shape: "rect", h: h2, b: b2 }, X, d: dist, y, IT, WT }),
  };

  return { sections: [calcul, resultatFinal(d, IT, WT)] };
}

// ---- registration ----

export const INERCIES: CalcType[] = [
  {
    tipus: "inercies-perfils",
    group: "Inèrcies",
    tab: "Suma d'inèrcies entre perfils",
    reportTitle: "Suma d'inèrcies perfil equivalent entre biguetes",
    fileTitle: "Suma d'Inèrcies entre Perfils",
    situacioLabel: "Sostre planta",
    desc: "Moment d'inèrcia i mòdul resistent d'un perfil existent reforçat amb un altre perfil a sota (teorema de Steiner), comparats amb els del perfil necessari.",
    defaults: () => inerciesPerfilsDefaults() as unknown as Record<string, unknown>,
    compute: (d) => computeInerciesPerfils(d),
  },
  {
    tipus: "inercies-pletines",
    group: "Inèrcies",
    tab: "Suma d'inèrcies entre pletines",
    reportTitle: "Suma d'inèrcies entre pletines",
    fileTitle: "Suma d'Inèrcies entre Pletines",
    situacioLabel: "Situació",
    desc: "Moment d'inèrcia i mòdul resistent d'una pletina horitzontal, d'una pletina vertical i de la secció en T que formen juntes (teorema de Steiner).",
    defaults: () => inerciesPletinesDefaults() as unknown as Record<string, unknown>,
    compute: (d) => computeInerciesPletines(d),
  },
  {
    tipus: "inercies-perfil-pletina",
    group: "Inèrcies",
    tab: "Suma d'inèrcies entre perfils i pletina",
    reportTitle: "Suma d'inèrcies perfil equivalent entre biguetes i pletines",
    fileTitle: "Suma d'Inèrcies entre Perfils i Pletina",
    situacioLabel: "Sostre planta",
    desc: "Moment d'inèrcia i mòdul resistent d'un perfil existent reforçat amb una pletina a sota (teorema de Steiner), comparats amb els del perfil necessari.",
    defaults: () => inerciesPerfilPletinaDefaults() as unknown as Record<string, unknown>,
    compute: (d) => computeInerciesPerfilPletina(d),
  },
];
