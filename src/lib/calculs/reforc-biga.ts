// Reforç de biga d'acer amb xapa de compressió: an existing steel joist that
// fails under its loads, reinforced with a reinforced-concrete compression
// layer connected to its top flange by welded bar connectors («caliquenyos»),
// so that both work as one composite section. Ports of two of David's sheets
// that share every formula:
//   OK-REFORÇ BIGA D'ACER AMB XAPA COMPRESSIÓ-reforç.xls             → computeReforcBigaAcer
//     (n IPE / IPN / HEA / HEB / HEM / UPN, from the catalogue)
//   OK-REFORÇ BIGA D'ACER ALA ESTRETA AMB XAPA COMPRESSIÓ-reforç.xls → computeReforcBigaAcerAla
//     (old narrow-flange joists: Torras or IPN, or typed in from the Torras
//     catalogue image, as in computeBiguetaAcerAla)
//
// Sections, in the order of the sheets:
//   1. Estat de càrregues inicial: the joist table of bigueta-carregues.ts,
//      without the profile self-weight line (the sheets have none).
//   2. Entrada de dades perfil existent: geometry, profile and steel, as in
//      bigueta-acer.ts.
//   3. Comprovació perfil existent: bigueta-acer.ts's checks under the initial
//      loads. Informative: the existing joist is expected to fail (that is why
//      it is reinforced), so its OK! / NO! don't count in the verdict.
//   4. Determinació secció mixta acer + formigó, the concrete transformed into
//      steel with the ratio of the moduli:
//        Et = E2 / E1 · B2' = B2 · Et · A2' = H2 · B2'
//        x = (H1 + H2) / 2 (between the centroids of joist and layer)
//        d = A2' · x / (A1 + A2') (joist centroid → new centroid)
//        IT = (I1 + A1 · d²) + (I2 + A2' · (x − d)²), I2 = B2' · H2³ / 12
//        y = H1 / 2 + d (to the bottom fibre), WT = IT / y
//        Aap = Aa (the web alone still takes the shear)
//      B2, the width of the layer working with one joist, is the load width
//      (intereix) limited to L / 4.
//   5. Estat de càrregues final: the same lines, each defaulting to its
//      initial value, plus the layer's self-weight γ · H2.
//   6. Comprovació perfil mixte: the same checks with IT, WT, Aap and the final loads.
//   7. Càlcul connectors: longitudinal shear between layer and joist and the
//      connectors that take it:
//        Me = A2' · (x − d) (static moment of the layer about the new centroid)
//        R = V · Me / (B · IT), V = Q ELU · L / 2
//        Prd,b = fs,k · (π · D² / 4) · n · Lr / (γt · √3 · lb), lb = fs,k · D / 14
//          (the bars' shear strength, reduced by real length / anchorage length)
//        Prd,s = fvw,d · G · B, fvw,d = fu / (√3 · βw · γM2) (the weld)
//      Each end quarter (L / 4) takes 0,75 · V on average and the central half
//      2 · 0,25 · V: n = R · 0,75 · B · (L / 4) / Prd and n = 2 · R · 0,25 ·
//      B · (L / 4) / Prd, rounded up, spaced (L / 4) / (n + 1) and (L / 2) / (n + 1).
//   8. Resum general de dades: existing vs reinforced, and the reinforcement.
//
// Notes on the sheets:
// - Standard sheet: its 'Dades Perfils' gives IPN 120 a web height h1 of
//   92,4 mm (Aa = 471,24 mm²); the catalogue of perfils.ts has 92 mm
//   (469,2 mm², −0,43 %). This changes, in the example, Q max V, τ, the
//   combined formula and γV of both checks (all still OK!) and the shear
//   values of the summary (their % increase is the same).
// - Narrow-flange sheet: as in computeBiguetaAcerAla, the web area is
//   labelled «Aa = e × h1» but typed as 120 × 5,1 (the full height of an IPN
//   120, whose h1 is 92 mm). The app keeps h1 and e as inputs from the chosen
//   profile; typing h1 = 120 gives the sheet's example.
// - Both sheets type the joist's H1, B1 and A1 (120, 58, 14,2 cm² for the
//   IPN 120 of both examples); here they come from the chosen profile (Torras
//   image or catalogue: h, n × b, n × A) and can be typed. B1 is shown only:
//   no formula uses it.
// - The standard sheet types the wall area of the initial table as 0
//   (the narrow-flange one 0,15 × 5): with no wall load (0 kN/m³) either
//   gives 0; the defaults keep 0,15 × 5 m, as the joist checks.
// - The standard sheet types different final loads (1 kN/m² of «paviments i
//   cel ras» instead of 2, 5 kN/m² of use instead of 2): they are in this
//   type's defaults (finCp, finUs), and the line keeps its initial label.
// - Text slips fixed in the labels: «A1 + A2 / 2» for x, «ÀREA DE LA XAPA DE
//   REFORÇ» for the concrete layer, «TENSIÓ ADMISSIBLE» for the acting
//   stresses of the summary, «ACER ESTÀNDARD» in the narrow-flange titles,
//   «DIAMATRE TIRAFONS» for the connector bars. The conversion column uses
//   9,81 (the sheets multiply by 10 or 100).
//
// Differences from the spreadsheets, on purpose:
// - Safety factors: the sheets divide Q max Mf and Q max V (E.L.U.
//   capacities) by the unfactored load F28 / F112 while labelling them ELU;
//   comprovacioSection divides them by Q ELU, as the joist checks. Example,
//   existing / reinforced: standard γMf 1,630 → 1,170 / 2,474 → 1,739, γV
//   7,09 → 5,07 / 4,77 → 3,34; narrow flange γMf 0,378 → 0,265 / 0,574 →
//   0,405, γV 2,26 → 1,58 / 2,00 → 1,41. Every OK! / NO! stays the same.
// - π instead of 3,14 in Prd,b (+0,05 %). Standard example: the weld governs,
//   no change; narrow flange: the bars govern, connectors needed 17,366 →
//   17,357 per end quarter and 11,577 → 11,572 in the centre (still 18 and 12).
// - B2 = mín(amplada ; L / 4) in both types (the narrow-flange sheet's rule;
//   the standard sheet takes the load width alone): the same 820 mm in the
//   standard example, where L / 4 = 875 mm.
// - The connectors adopted are the needed ones rounded up (the sheets type
//   3 / 2 and 18 / 12, which are those), and the bars per connector of the
//   summary are the input of the connectors (the sheets retype 2).
// - The rasant R is printed in N/mm² (the sheets: kN/mm², 0,0025 in the
//   standard example).
// - The final table shows the coefficients of the initial one, read-only
//   (the sheets retype the same 1,35 / 1,5). Its loads, the load width and
//   the wall area are inputs that default to the initial values (the wall
//   area as one figure, instead of thickness × height).
// - The layer's self-weight, 17,5 / 100 · H2 / 10 kN/m² in the sheets, is
//   γ · H2 with γ = 17,5 kN/m³ an input. fu, βw and γM2 of the weld (410,
//   0,85, 1,25 written into the sheets' formula) are inputs too.
//
// Kept as in the sheets, for David to confirm: Prd,b grows with Lr / lb
// without a cap, so bars longer than the anchorage length would resist more
// than their shear strength (in both examples Lr < lb). B2 takes the initial
// load width, as the sheets.

import { type CalcResult, type LoadGroup, type LoadLine, type Row, type Section, G, NMM2_TO_KGCM2, div, num, verdict } from "./common";
import { perfilOptions, perfilProps } from "./perfils";
import { type CarreguesDades, AJUDA_BIGUETES, carreguesDefaults, estatCarregues, kgMl } from "./bigueta-carregues";
import { ALA_PERFILS, MANUAL, acerRows, alaPerfil, comprovacioSection, geometriaRows } from "./bigueta-acer";

// ---- inputs ----

interface ReforcComu extends CarreguesDades {
  L: number; // mm
  limitL: number; // L / x
  E: number; // N/mm², E0 = E1
  sk: number; // N/mm²
  gk: number;
  // composite section (null → from the profile)
  H1: number | null; // mm, joist height
  B1: number | null; // mm, joist width
  A1: number | null; // cm², joist area
  H2: number; // mm, compression layer thickness
  B2: number | null; // mm, null → mín(amplada, L / 4)
  E2: number; // N/mm²
  densitatCapa: number; // kN/m³
  // final loads (null → the initial value). Not f*: those are the fire
  // coefficients of CarreguesFocDades.
  finParetPes: number | null; // kN/m³
  finParetArea: number | null; // m²
  finAmplada: number | null; // m
  finPp: number | null; // kN/m²
  finCp: number | null;
  finEnvans: number | null;
  finUs: number | null;
  finNeu: number | null;
  finVent: number | null;
  // connectors
  dBarra: number; // mm
  fsk: number; // N/mm²
  gT: number; // γt
  nBarres: number; // bars per connector
  golaG: number; // mm, weld throat
  longB: number; // mm, weld length
  longBarra: number; // mm, real length of each bar
  fu: number; // N/mm²
  betaW: number;
  gM2: number;
  armat: string; // reinforcement of the layer, free text
}

export interface ReforcBigaAcerDades extends ReforcComu {
  nPerfils: number;
  perfil: string;
}

export interface ReforcBigaAcerAlaDades extends ReforcComu {
  perfil: string; // a Torras or IPN profile, or MANUAL
  Ix: number | null; // cm⁴; null → from the profile
  Wx: number | null; // cm³
  h1: number | null; // mm, web height for the shear area
  e: number | null; // mm, web thickness
}

const SENSE_CANVIS = { finParetPes: null, finParetArea: null, finAmplada: null, finPp: null, finCp: null, finEnvans: null, finUs: null, finNeu: null, finVent: null };
const PERFIL_AUTO = { H1: null, B1: null, A1: null };

// Defaults: the example of each sheet.
export function reforcBigaAcerDefaults(): ReforcBigaAcerDades {
  return {
    ...carreguesDefaults({ amplada: 0.82, pp: 2, cp: 2, envans: 1, us: 2 }),
    L: 3500,
    limitL: 500,
    nPerfils: 1,
    perfil: "IPN 120",
    E: 210000,
    sk: 275,
    gk: 1.05,
    ...PERFIL_AUTO,
    H2: 80,
    B2: null,
    E2: 16000,
    densitatCapa: 17.5,
    ...SENSE_CANVIS,
    finCp: 1, // «paviments i cel ras»
    finUs: 5,
    dBarra: 12,
    fsk: 500,
    gT: 1.05,
    nBarres: 2,
    golaG: 3,
    longB: 55,
    longBarra: 300,
    fu: 410,
    betaW: 0.85,
    gM2: 1.25,
    armat: "# DN 6 MM. C / 10 CM.",
  };
}

export function reforcBigaAcerAlaDefaults(): ReforcBigaAcerAlaDades {
  return {
    ...carreguesDefaults({ amplada: 2.64, pp: 1.79, cp: 1.5, envans: 0, us: 2 }),
    neu: 0.4,
    vent: 1,
    L: 3700,
    limitL: 500,
    perfil: "IPN 120",
    Ix: null,
    Wx: null,
    h1: null,
    e: null,
    E: 210000,
    sk: 240,
    gk: 1.15,
    ...PERFIL_AUTO,
    H2: 50,
    B2: null,
    E2: 16000,
    densitatCapa: 17.5,
    ...SENSE_CANVIS,
    dBarra: 12,
    fsk: 500,
    gT: 1.15,
    nBarres: 2,
    golaG: 5,
    longB: 50,
    longBarra: 120,
    fu: 410,
    betaW: 0.85,
    gM2: 1.25,
    armat: "# DN 6 MM. C / 10 CM.",
  };
}

// ---- shared ----

// Typed value, else the automatic one (null when there is none).
const pick = (v: number | null | undefined, auto: number | null | undefined) => (v != null ? num(v) : auto ?? null);
const pct = (a: number | null, b: number | null) => (a == null || b == null || b === 0 ? null : (a / b) * 100);
const incr = (a: number | null, b: number | null) => (a == null || b == null || a === 0 ? null : ((b - a) / a) * 100);
const kg = (kN: number | null) => (kN == null ? null : (kN * 1000) / G);
const cm = (mm: number | null, per = 10) => (mm == null ? null : mm / per); // mm → cm (or mm² → cm² with 100…)
const kgCm2 = (nmm2: number | null) => (nmm2 == null ? null : nmm2 * NMM2_TO_KGCM2);

interface Base {
  L: number;
  x: number;
  fAdm: number | null;
  E: number;
  sd: number | null;
  td: number | null;
}

function base(d: ReforcComu): Base {
  const L = num(d.L);
  const x = num(d.limitL);
  const sd = div(num(d.sk), num(d.gk));
  return { L, x, fAdm: div(L, x), E: num(d.E), sd, td: sd == null ? null : sd / Math.sqrt(3) };
}

// What each type tells the shared part about the existing joist.
interface Existent {
  section: Section; // «Entrada de dades perfil existent…»
  comprovacioTitle: string;
  Ix: number | null; // mm⁴
  Wx: number | null; // mm³
  Aa: number | null; // mm²
  // Automatic H1 (mm), B1 (mm), A1 (cm²); undefined: no catalogue value (manual).
  auto: { h: number | null; b: number | null; A: number | null } | undefined;
  times: string; // "2 × " for two profiles, else ""
  nom: string; // printed in the summary
}

const AUTO_NOTE = "Igual que a l'estat inicial; escriu-hi per canviar-lo.";
const AUTO_RESET = "Tornar al valor de l'estat inicial";

// «Estat de càrregues final reforçat»: the lines of the initial table, each
// load an input that defaults to its initial value, plus the layer's weight.
function estatFinal(d: ReforcComu, capa: number) {
  const area0 = num(d.paretGruix) * num(d.paretAlcada);
  const w0 = num(d.amplada);
  const area = pick(d.finParetArea, area0) ?? 0;
  const w = pick(d.finAmplada, w0) ?? 0;
  const gG = num(d.gG);
  const ln = (label: string, initial: number, key: keyof typeof SENSE_CANVIS | null, qUnit: string, width: number, widthUnit: string, gamma: number, extra: Partial<LoadLine> = {}): LoadLine => {
    const q = key ? pick(d[key], initial) ?? 0 : initial;
    const unf = q * width;
    const keyed = key ? { qKey: key, qAuto: initial, qAutoNote: AUTO_NOTE, qAutoReset: AUTO_RESET } : {};
    return { label, q, qUnit, width, widthUnit, unf, gamma, fac: unf * gamma, ...keyed, ...extra };
  };
  const lParet = ln("Pes propi de les parets de càrrega superiors", num(d.paretPes), "finParetPes", "kN/m³", area, "m²", num(d.gParet), { widthKey: "finParetArea", widthAuto: area0 });
  const lPp = ln("Pes propi estructural", num(d.pp), "finPp", "kN/m²", w, "m", gG, { widthKey: "finAmplada", widthAuto: w0 });
  const lCapa = ln("Pes propi de la capa de compressió", capa, null, "kN/m²", w, "m", gG);
  const lCp = ln("Càrregues permanents de paviments i morter", num(d.cp), "finCp", "kN/m²", w, "m", gG);
  const lEnvans = ln("Càrregues permanents d'envans", num(d.envans), "finEnvans", "kN/m²", w, "m", gG);
  const lUs = ln("Sobrecàrrega d'ús", num(d.us), "finUs", "kN/m²", w, "m", num(d.gUs));
  const lNeu = ln("Sobrecàrrega de neu", num(d.neu), "finNeu", "kN/m²", w, "m", num(d.gNeu));
  const lVent = ln("Sobrecàrrega de vent", num(d.vent), "finVent", "kN/m²", w, "m", num(d.gVent));

  const floor = [lPp, lCapa, lCp, lEnvans, lUs, lNeu, lVent];
  const sum = (ls: LoadLine[], k: "q" | "unf" | "fac") => ls.reduce((a, l) => a + (l[k] ?? 0), 0);
  const groups: LoadGroup[] = [
    { title: "Accions permanents · parets de càrrega superiors", lines: [{ line: lParet }] },
    {
      title: "Càrregues del sostre",
      lines: [
        { heading: "Accions permanents" },
        { line: lPp },
        { line: lCapa },
        { line: lCp },
        { line: lEnvans },
        { heading: "Accions variables" },
        { line: lUs },
        { line: lNeu },
        { line: lVent },
      ],
      total: { label: "Total càrregues del sostre", q: sum(floor, "q"), unf: sum(floor, "unf"), fac: sum(floor, "fac") },
    },
  ];
  const all = [lParet, ...floor];
  return { groups, qEls: sum(all, "unf"), qElu: sum(all, "fac"), floorQ: sum(floor, "q") };
}

// The checks of the composite section print IT, WT and Aap in their formulas.
function mixedFormulas(s: Section): Section {
  const sub = (f?: string) => f?.replace(/\bIx\b/g, "IT").replace(/\bWx\b/g, "WT").replace(/\bAa\b/g, "Aap");
  return { ...s, blocks: s.blocks.map((b) => ({ ...b, rows: b.rows.map((r) => ({ ...r, formula: sub(r.formula) })) })) };
}

function symValue(s: Section, sym: string): number | null {
  for (const b of s.blocks) for (const r of b.rows) if (r.sym === sym) return typeof r.value === "number" ? r.value : null;
  return null;
}

// Every section after «Entrada de dades perfil existent».
function reforc(d: ReforcComu, g: Base, p: Existent): CalcResult {
  const { L } = g;

  // 1. initial loads, no profile line
  const ini = estatCarregues(d);
  const iniFloorQ = ini.groups.find((x) => x.total)?.total?.q ?? 0;
  const carregues: Section = { key: "carregues", title: "Estat de càrregues inicial", enabled: true, blocks: [], loads: { groups: ini.groups, totalUnf: ini.qEls, totalFac: ini.qElu } };

  // 3. existing joist, informative
  const existent: Section = {
    ...comprovacioSection(p.comprovacioTitle, { ...g, Ix: p.Ix, Wx: p.Wx, Aa: p.Aa, qEls: ini.qEls, qElu: ini.qElu }),
    informative: true,
    notes: ["Comprovació del perfil existent sense el reforç: informativa, no compta al resultat del càlcul."],
  };

  // 4. composite section (mm)
  const H1 = pick(d.H1, p.auto?.h);
  const B1 = pick(d.B1, p.auto?.b);
  const A1cm = pick(d.A1, p.auto?.A);
  const A1 = A1cm == null ? null : A1cm * 100; // mm²
  const E1 = g.E;
  const H2 = num(d.H2);
  const B2auto = Math.min(num(d.amplada) * 1000, L / 4);
  const B2 = pick(d.B2, B2auto) ?? 0;
  const A2 = H2 * B2;
  const E2 = num(d.E2);
  const gammaCapa = num(d.densitatCapa);
  const capa = (gammaCapa * H2) / 1000; // kN/m²
  const Et = div(E2, E1);
  const B2e = Et == null ? null : B2 * Et;
  const A2e = B2e == null ? null : H2 * B2e;
  const xg = H1 == null ? null : (H1 + H2) / 2;
  const dg = A2e != null && xg != null && A1 != null ? div(A2e * xg, A1 + A2e) : null;
  const I1 = p.Ix;
  const I2 = B2e == null ? null : (B2e * Math.pow(H2, 3)) / 12;
  const y = H1 != null && dg != null ? H1 / 2 + dg : null;
  const IT = I1 != null && A1 != null && dg != null && I2 != null && A2e != null && xg != null ? I1 + A1 * dg * dg + I2 + A2e * Math.pow(xg - dg, 2) : null;
  const WT = div(IT, y);
  const Aap = p.Aa;
  const autoIn = (v: number | null | undefined) => (p.auto ? v ?? null : undefined);
  const nTimes = p.times;

  const mixta: Section = {
    key: "mixta",
    title: "Determinació secció mixta acer + formigó",
    enabled: true,
    blocks: [
      {
        title: "Bigueta existent",
        rows: [
          { label: "Alçària de la bigueta", sym: "H1", value: H1, unit: "mm", decimals: 1, input: { type: "num", key: "H1", decimals: 1, auto: autoIn(p.auto?.h) }, alt: { value: cm(H1), unit: "cm" } },
          { label: "Base de la bigueta", formula: nTimes ? `B1 = ${nTimes}b` : undefined, sym: "B1", value: B1, unit: "mm", decimals: 1, input: { type: "num", key: "B1", decimals: 1, auto: autoIn(p.auto?.b) }, alt: { value: cm(B1), unit: "cm" } },
          { label: "Àrea de la bigueta", formula: nTimes ? `A1 = ${nTimes}A` : undefined, sym: "A1", value: A1cm, unit: "cm²", input: { type: "num", key: "A1", decimals: 2, auto: autoIn(p.auto?.A) }, alt: { value: A1, unit: "mm²" } },
          { label: "Mòdul d'elasticitat de la bigueta", formula: "E1 = E0", sym: "E1", value: E1, unit: "N/mm²", decimals: 0, alt: { value: E1 * NMM2_TO_KGCM2, unit: "kg/cm²", decimals: 0 } },
        ],
      },
      {
        title: "Capa de compressió de formigó armat",
        rows: [
          { label: "Gruix de la capa de compressió", sym: "H2", value: H2, unit: "mm", decimals: 1, input: { type: "num", key: "H2", decimals: 1 }, alt: { value: H2 / 10, unit: "cm" } },
          { label: "Amplària de la capa de compressió", formula: "B2 = mín(amplària · 1000 ; L / 4)", sym: "B2", value: B2, unit: "mm", decimals: 1, input: { type: "num", key: "B2", decimals: 1, auto: B2auto }, alt: { value: B2 / 10, unit: "cm" }, hint: "Amplària de càrrega (intereix) de l'estat inicial, limitada a L / 4" },
          { label: "Àrea de la capa de compressió", formula: "A2 = H2 · B2", sym: "A2", value: A2, unit: "mm²", alt: { value: A2 / 100, unit: "cm²" } },
          { label: "Mòdul d'elasticitat de la capa de compressió", sym: "E2", value: E2, unit: "N/mm²", decimals: 0, input: { type: "num", key: "E2", decimals: 0 }, alt: { value: E2 * NMM2_TO_KGCM2, unit: "kg/cm²", decimals: 0 } },
          { label: "Pes específic de la capa de compressió", sym: "γ", value: gammaCapa, unit: "kN/m³", input: { type: "num", key: "densitatCapa", decimals: 2 } },
          { label: "Pes propi de la capa de compressió", formula: "q = γ · H2", sym: "q", value: capa, unit: "kN/m²", decimals: 3, hint: "Entra a l'estat de càrregues final" },
          { label: "Relació entre mòduls d'elasticitat", formula: "Et = E2 / E1", sym: "Et", value: Et, decimals: 4 },
          { label: "Amplària equivalent en acer de la capa de compressió", formula: "B2' = B2 · Et", sym: "B2'", value: B2e, unit: "mm", alt: { value: cm(B2e), unit: "cm" } },
          { label: "Àrea equivalent en acer de la capa de compressió", formula: "A2' = H2 · B2'", sym: "A2'", value: A2e, unit: "mm²", alt: { value: cm(A2e, 100), unit: "cm²" } },
        ],
      },
      {
        title: "Centres de gravetat",
        rows: [
          { label: "Distància entre els centres de gravetat", formula: "x = (H1 + H2) / 2", sym: "x", value: xg, unit: "mm", alt: { value: cm(xg), unit: "cm" } },
          { label: "Distància del perfil al nou c.d.g.", formula: "d = A2' · x / (A1 + A2')", sym: "d", value: dg, unit: "mm", alt: { value: cm(dg), unit: "cm" } },
          { label: "Distància nou c.d.g. a fibra traccionada", formula: "y = H1 / 2 + d", sym: "y", value: y, unit: "mm", alt: { value: cm(y), unit: "cm" } },
        ],
      },
      {
        title: "Moments d'inèrcia",
        rows: [
          { label: "Moment d'inèrcia de la bigueta existent", formula: "I1 = Ix", sym: "I1", value: I1, unit: "mm⁴", decimals: 0, alt: { value: cm(I1, 1e4), unit: "cm⁴" } },
          { label: "Moment d'inèrcia de la capa de compressió", formula: "I2 = B2' · H2³ / 12", sym: "I2", value: I2, unit: "mm⁴", decimals: 0, alt: { value: cm(I2, 1e4), unit: "cm⁴" } },
        ],
      },
      {
        title: "Resum resultats secció mixta acer + formigó",
        rows: [
          { label: "Moment d'inèrcia total", formula: "IT = (I1 + A1 · d²) + (I2 + A2' · (x − d)²)", sym: "IT", value: IT, unit: "mm⁴", decimals: 0, alt: { value: cm(IT, 1e4), unit: "cm⁴" } },
          { label: "Mòdul resistent total", formula: "WT = IT / y", sym: "WT", value: WT, unit: "mm³", decimals: 0, alt: { value: cm(WT, 1e3), unit: "cm³" } },
          { label: "Àrea de l'ànima resultant", formula: "Aap = Aa", sym: "Aap", value: Aap, unit: "mm²", alt: { value: cm(Aap, 100), unit: "cm²" } },
        ],
      },
    ],
  };

  // 5. final loads
  const fin = estatFinal(d, capa);
  const dFloor = fin.floorQ - iniFloorQ;
  const dEls = fin.qEls - ini.qEls;
  const dElu = fin.qElu - ini.qElu;
  const carreguesFinal: Section = {
    key: "carreguesFinal",
    title: "Estat de càrregues final reforçat acer + formigó",
    enabled: true,
    loads: { groups: fin.groups, totalUnf: fin.qEls, totalFac: fin.qElu },
    blocks: [
      {
        title: "Increment de càrrega",
        rows: [
          { label: "Increment de càrrega del sostre", formula: "Δq = q final − q inicial", sym: "Δq", value: dFloor, unit: "kN/m²" },
          { label: "Percentatge d'increment", formula: "Δq / q inicial · 100", value: pct(dFloor, iniFloorQ), unit: "%" },
          { label: "Increment de càrrega sense majorar", formula: "ΔQ ELS = Q ELS final − Q ELS inicial", sym: "ΔQ ELS", value: dEls, unit: "kN/ml", alt: { value: kgMl(dEls), unit: "kg/ml" } },
          { label: "Increment de càrrega majorada", formula: "ΔQ ELU = Q ELU final − Q ELU inicial", sym: "ΔQ ELU", value: dElu, unit: "kN/ml", alt: { value: kgMl(dElu), unit: "kg/ml" } },
        ],
      },
    ],
  };

  // 6. composite check
  const mixte = mixedFormulas(comprovacioSection("Comprovació perfil mixte acer + formigó", { ...g, Ix: IT, Wx: WT, Aa: Aap, qEls: fin.qEls, qElu: fin.qElu }, "comprovacio-mixte"));

  // 7. connectors
  const D = num(d.dBarra);
  const fsk = num(d.fsk);
  const gT = num(d.gT);
  const nb = num(d.nBarres);
  const Gw = num(d.golaG);
  const B = num(d.longB);
  const Lr = num(d.longBarra);
  const fu = num(d.fu);
  const betaW = num(d.betaW);
  const gM2 = num(d.gM2);
  const lb = (fsk * D) / 14;
  const Me = A2e != null && xg != null && dg != null ? A2e * (xg - dg) : null; // mm³
  const V = (fin.qElu * L) / 2 / 1000; // kN
  const R = Me == null || IT == null ? null : div(V * Me, B * IT); // kN/mm²
  const RN = R == null ? null : R * 1000; // N/mm²
  const prdB = div((fsk * ((Math.PI * D * D) / 4) * Lr * nb) / 1000, gT * Math.sqrt(3) * lb); // kN
  const fvwd = div(fu, Math.sqrt(3) * betaW * gM2);
  const prdS = fvwd == null ? null : (fvwd * Gw * B) / 1000; // kN
  const prd = prdB != null && prdS != null ? Math.min(prdB, prdS) : null;
  const nCap = R == null ? null : div(R * 0.75 * B * (L / 4), prd);
  const nCen = R == null ? null : div(2 * R * 0.25 * B * (L / 4), prd);
  const adopt = (n: number | null) => (n == null ? null : Math.max(0, Math.ceil(n - 1e-9)));
  const aCap = adopt(nCap);
  const aCen = adopt(nCen);
  const sCap = aCap == null ? null : L / 4 / (aCap + 1); // mm
  const sCen = aCen == null ? null : L / 2 / (aCen + 1);
  const nTotal = nCap != null && nCen != null ? 2 * nCap + nCen : null;
  const aTotal = aCap != null && aCen != null ? 2 * aCap + aCen : null;
  const longTotal = B + Lr * nb;

  const connectors: Section = {
    key: "connectors",
    title: "Càlcul dels connectors",
    enabled: true,
    blocks: [
      {
        title: "Dades dels connectors",
        rows: [
          { label: "Diàmetre de les barres", sym: "D", value: D, unit: "mm", decimals: 0, input: { type: "num", key: "dBarra", decimals: 0 }, alt: { value: D / 10, unit: "cm" }, hint: "Barres d'acer corrugat soldades a l'ala superior («caliquenyos»)" },
          { label: "Límit elàstic de les barres", sym: "fs,k", value: fsk, unit: "N/mm²", decimals: 0, input: { type: "num", key: "fsk", decimals: 0 }, alt: { value: kgCm2(fsk), unit: "kg/cm²" }, hint: "B 500 S: 500 N/mm²" },
          { label: "Coeficient parcial de seguretat de les barres", sym: "γt", value: num(d.gT), input: { type: "num", key: "gT", decimals: 2 } },
          { label: "Nombre de barres per connector", sym: "n", value: nb, unit: "ut", decimals: 0, input: { type: "num", key: "nBarres", decimals: 0, integer: true }, hint: "Una a cada banda de la biga" },
          { label: "Longitud real de cada barra", sym: "Lr", value: Lr, unit: "mm", decimals: 0, input: { type: "num", key: "longBarra", decimals: 0 }, alt: { value: Lr / 10, unit: "cm" } },
          { label: "Longitud d'ancoratge", formula: "lb = fs,k · D / 14", sym: "lb", value: lb, unit: "mm", alt: { value: lb / 10, unit: "cm" } },
          { label: "Resistència de cada connector (barres)", formula: "Prd,b = fs,k · (π · D² / 4) · n · Lr / (γt · √3 · lb)", sym: "Prd,b", value: prdB, unit: "kN", alt: { value: kg(prdB), unit: "kg" } },
        ],
      },
      {
        title: "Soldadura del connector",
        rows: [
          { label: "Gola de la soldadura", sym: "G", value: Gw, unit: "mm", decimals: 1, input: { type: "num", key: "golaG", decimals: 1 } },
          { label: "Longitud de la soldadura", sym: "B", value: B, unit: "mm", decimals: 0, input: { type: "num", key: "longB", decimals: 0 }, alt: { value: B / 10, unit: "cm" } },
          { label: "Resistència a tracció de l'acer", sym: "fu", value: fu, unit: "N/mm²", decimals: 0, input: { type: "num", key: "fu", decimals: 0 }, hint: "CTE DB SE-A taula 4.1 (S275: 410 N/mm²)" },
          { label: "Coeficient de correlació", sym: "βw", value: betaW, input: { type: "num", key: "betaW", decimals: 2 }, hint: "S235: 0,80 · S275: 0,85 · S355: 0,90" },
          { label: "Coeficient parcial de seguretat", sym: "γM2", value: gM2, input: { type: "num", key: "gM2", decimals: 2 } },
          { label: "Resistència de càlcul de la soldadura", formula: "fvw,d = fu / (√3 · βw · γM2)", sym: "fvw,d", value: fvwd, unit: "N/mm²", alt: { value: kgCm2(fvwd), unit: "kg/cm²" } },
          { label: "Resistència de cada connector (soldadura)", formula: "Prd,s = fvw,d · G · B", sym: "Prd,s", value: prdS, unit: "kN", alt: { value: kg(prdS), unit: "kg" } },
        ],
      },
      {
        title: "Esforç rasant",
        rows: [
          { label: "Resistència de càlcul del connector", formula: "Prd = mín(Prd,b ; Prd,s)", sym: "Prd", value: prd, unit: "kN", alt: { value: kg(prd), unit: "kg" } },
          { label: "Moment estàtic de la capa de compressió", formula: "Me = A2' · (x − d)", sym: "Me", value: Me, unit: "mm³", decimals: 0, alt: { value: cm(Me, 1e3), unit: "cm³" } },
          { label: "Esforç tallant a cada extrem", formula: "V = Q ELU · L / 2", sym: "V", value: V, unit: "kN", alt: { value: kg(V), unit: "kg" } },
          { label: "Tensió rasant", formula: "R = V · Me / (B · IT)", sym: "R", value: RN, unit: "N/mm²", decimals: 3, alt: { value: kgCm2(RN), unit: "kg/cm²" } },
        ],
      },
      {
        title: "Nombre i disposició de connectors",
        rows: [
          { label: "Longitud de cada interval extrem (L/4)", sym: "L / 4", value: L / 4, unit: "mm", alt: { value: L / 40, unit: "cm" } },
          { label: "Connectors necessaris a cada interval extrem", formula: "n = R · 0,75 · B · (L / 4) / Prd", value: nCap, unit: "ut" },
          { label: "Connectors adoptats a cada interval extrem", value: aCap, unit: "ut", decimals: 0 },
          { label: "Separació a cada interval extrem", formula: "s = (L / 4) / (n + 1)", sym: "s", value: sCap, unit: "mm", alt: { value: cm(sCap), unit: "cm" } },
          { label: "Longitud de l'interval central (L/2)", sym: "L / 2", value: L / 2, unit: "mm", alt: { value: L / 20, unit: "cm" } },
          { label: "Connectors necessaris a l'interval central", formula: "n = 2 · R · 0,25 · B · (L / 4) / Prd", value: nCen, unit: "ut" },
          { label: "Connectors adoptats a l'interval central", value: aCen, unit: "ut", decimals: 0 },
          { label: "Separació a l'interval central", formula: "s = (L / 2) / (n + 1)", sym: "s", value: sCen, unit: "mm", alt: { value: cm(sCen), unit: "cm" } },
          { label: "Total connectors necessaris", value: nTotal, unit: "ut" },
          { label: "Total connectors per bigueta", value: aTotal, unit: "ut", decimals: 0 },
        ],
      },
    ],
  };

  // 8. summary
  const fdE = symValue(existent, "f D");
  const fdM = symValue(mixte, "f D");
  const sE = symValue(existent, "σ max ELU");
  const sM = symValue(mixte, "σ max ELU");
  const tE = symValue(existent, "τ max ELU");
  const tM = symValue(mixte, "τ max ELU");
  const PCT = "Percentatge d'increment";
  const pctRow = (a: number | null, b: number | null): Row => ({ label: PCT, value: incr(a, b), unit: "%" });
  const resum: Section = {
    key: "resum",
    title: "Resum general de dades",
    enabled: true,
    blocks: [
      {
        title: "Estat de càrregues existent i reforçat",
        rows: [
          { label: "Càrregues sense majorar inicials", sym: "Q ELS", value: ini.qEls, unit: "kN/ml", alt: { value: kgMl(ini.qEls), unit: "kg/ml" } },
          { label: "Càrregues sense majorar perfil mixte reforçat", sym: "Q ELS", value: fin.qEls, unit: "kN/ml", alt: { value: kgMl(fin.qEls), unit: "kg/ml" } },
          { label: "Increment de càrrega", value: dEls, unit: "kN/ml" },
          pctRow(ini.qEls, fin.qEls),
          { label: "Càrregues majorades inicials", sym: "Q ELU", value: ini.qElu, unit: "kN/ml", alt: { value: kgMl(ini.qElu), unit: "kg/ml" } },
          { label: "Càrregues majorades perfil mixte reforçat", sym: "Q ELU", value: fin.qElu, unit: "kN/ml", alt: { value: kgMl(fin.qElu), unit: "kg/ml" } },
          { label: "Increment de càrrega", value: dElu, unit: "kN/ml" },
          pctRow(ini.qElu, fin.qElu),
        ],
      },
      {
        title: "Dades perfil existent i reforçat",
        rows: [
          { label: "Moment d'inèrcia perfil existent", sym: "Ix", value: p.Ix, unit: "mm⁴", decimals: 0, alt: { value: cm(p.Ix, 1e4), unit: "cm⁴" } },
          { label: "Moment d'inèrcia perfil mixte reforçat", sym: "IT", value: IT, unit: "mm⁴", decimals: 0, alt: { value: cm(IT, 1e4), unit: "cm⁴" } },
          pctRow(p.Ix, IT),
          { label: "Mòdul resistent perfil existent", sym: "Wx", value: p.Wx, unit: "mm³", decimals: 0, alt: { value: cm(p.Wx, 1e3), unit: "cm³" } },
          { label: "Mòdul resistent perfil mixte reforçat", sym: "WT", value: WT, unit: "mm³", decimals: 0, alt: { value: cm(WT, 1e3), unit: "cm³" } },
          pctRow(p.Wx, WT),
          { label: "Àrea resistent perfil existent", sym: "Aa", value: p.Aa, unit: "mm²", alt: { value: cm(p.Aa, 100), unit: "cm²" } },
          { label: "Àrea resistent perfil mixte reforçat", sym: "Aap", value: Aap, unit: "mm²", alt: { value: cm(Aap, 100), unit: "cm²" } },
          pctRow(p.Aa, Aap),
        ],
      },
      {
        title: "Comprovació del perfil existent i reforçat",
        rows: [
          { label: "Deformació perfil existent", sym: "f D", value: fdE, unit: "mm", alt: { value: cm(fdE), unit: "cm" } },
          { label: "Deformació perfil mixte reforçat", sym: "f D", value: fdM, unit: "mm", alt: { value: cm(fdM), unit: "cm" } },
          pctRow(fdE, fdM),
          { label: "Tensió per moment flector perfil existent", sym: "σ max ELU", value: sE, unit: "N/mm²" },
          { label: "Tensió per moment flector perfil mixte reforçat", sym: "σ max ELU", value: sM, unit: "N/mm²" },
          pctRow(sE, sM),
          { label: "Tensió per esforç tallant perfil existent", sym: "τ max ELU", value: tE, unit: "N/mm²" },
          { label: "Tensió per esforç tallant perfil mixte reforçat", sym: "τ max ELU", value: tM, unit: "N/mm²" },
          pctRow(tE, tM),
        ],
      },
      {
        title: "Dades del reforç amb capa de compressió",
        rows: [
          { label: "Perfil existent", value: p.nom },
          { label: "Gruix de la capa de compressió", sym: "H2", value: H2, unit: "mm", decimals: 1, alt: { value: H2 / 10, unit: "cm" } },
          { label: "Armat de la capa de compressió", value: String(d.armat ?? ""), input: { type: "text", key: "armat", placeholder: "# DN 6 MM. C / 10 CM." } },
          { label: "Diàmetre de les barres dels connectors", sym: "D", value: D, unit: "mm", decimals: 0, alt: { value: D / 10, unit: "cm" } },
          { label: "Nombre de barres per connector", sym: "n", value: nb, unit: "ut", decimals: 0 },
          { label: "Longitud de cada barra", sym: "Lr", value: Lr, unit: "mm", decimals: 0, alt: { value: Lr / 10, unit: "cm" } },
          { label: "Longitud total de cada connector", formula: "B + n · Lr", value: longTotal, unit: "mm", decimals: 0, alt: { value: longTotal / 10, unit: "cm" } },
          { label: "Nombre de connectors per bigueta", value: aTotal, unit: "ut", decimals: 0 },
          { label: "Separació dels connectors a cada interval extrem (L/4)", sym: "s", value: sCap, unit: "mm", alt: { value: cm(sCap), unit: "cm" } },
          { label: "Separació dels connectors a l'interval central (L/2)", sym: "s", value: sCen, unit: "mm", alt: { value: cm(sCen), unit: "cm" } },
        ],
      },
    ],
  };

  return { sections: [carregues, p.section, existent, mixta, carreguesFinal, mixte, connectors, resum] };
}

// Every counted check passes (the existing joist's are informative).
const passes = (r: CalcResult) => {
  const v = verdict(r);
  return v.total > 0 && v.failed === 0;
};

// ---- reforç de biga d'acer estàndard ----

export function computeReforcBigaAcer(raw: Partial<ReforcBigaAcerDades>): CalcResult {
  const d = { ...reforcBigaAcerDefaults(), ...raw } as ReforcBigaAcerDades;
  const g = base(d);
  const n = num(d.nPerfils);
  const p = perfilProps(d.perfil);
  const Ix = p?.Ix != null ? n * p.Ix * 1e4 : null; // mm⁴
  const Wx = p?.Wx != null ? n * p.Wx * 1e3 : null; // mm³
  const Aa = p?.h1 != null && p?.tw != null ? n * p.h1 * p.tw : null; // mm²
  const times = n !== 1 ? `${n} × ` : "";

  const section: Section = {
    key: "perfil",
    title: "Entrada de dades perfil existent d'acer estàndard",
    enabled: true,
    blocks: [
      { title: "Dades geomètriques", rows: geometriaRows(g.L, g.x, g.fAdm) },
      {
        title: "Dades del perfil",
        rows: [
          { label: "Nombre de perfils", value: n, unit: "ut", decimals: 0, input: { type: "num", key: "nPerfils", decimals: 0, integer: true } },
          { label: "Nom del perfil", value: d.perfil, input: { type: "profile", key: "perfil", byType: true }, hint: "Perfil laminat estàndard · ✓: el perfil reforçat compleix" },
        ],
      },
      {
        title: "Característiques del perfil",
        rows: [
          ...acerRows(d, g.sd, g.td),
          { label: "Moment d'inèrcia", formula: times ? `${times}Ix` : undefined, sym: "Ix", value: Ix, unit: "mm⁴", decimals: 0, alt: { value: cm(Ix, 1e4), unit: "cm⁴" } },
          { label: "Mòdul resistent", formula: times ? `${times}Wx` : undefined, sym: "Wx", value: Wx, unit: "mm³", decimals: 0, alt: { value: cm(Wx, 1e3), unit: "cm³" } },
          { label: "Àrea de l'ànima", formula: `Aa = ${times}e × h1`, sym: "Aa", value: Aa, unit: "mm²", alt: { value: cm(Aa, 100), unit: "cm²" } },
        ],
      },
    ],
  };

  const auto = { h: p?.h ?? null, b: p?.b != null ? n * p.b : null, A: p?.A != null ? n * p.A : null };
  return reforc(d, g, { section, comprovacioTitle: "Comprovació perfil existent d'acer estàndard", Ix, Wx, Aa, auto, times, nom: d.perfil ? `${times}${d.perfil}` : "—" });
}

// The catalogue profiles whose reinforced section passes every check, each
// with its own catalogue H1, B1 and A1.
export function reforcBigaAcerPerfilsValids(raw: Partial<ReforcBigaAcerDades>): Set<string> {
  const ok = new Set<string>();
  for (const g of perfilOptions()) for (const name of g.names) if (passes(computeReforcBigaAcer({ ...raw, ...PERFIL_AUTO, perfil: name }))) ok.add(name);
  return ok;
}

// ---- reforç de biga d'acer d'ala estreta ----

export function computeReforcBigaAcerAla(raw: Partial<ReforcBigaAcerAlaDades>, markOptions = true): CalcResult {
  const d = { ...reforcBigaAcerAlaDefaults(), ...raw } as ReforcBigaAcerAlaDades;
  const g = base(d);
  const cat = alaPerfil(d.perfil);
  const IxCm = pick(d.Ix, cat?.Ix);
  const WxCm = pick(d.Wx, cat?.Wx);
  const h1 = pick(d.h1, cat?.h1);
  const e = pick(d.e, cat?.e);
  const Ix = IxCm == null ? null : IxCm * 1e4; // mm⁴
  const Wx = WxCm == null ? null : WxCm * 1e3; // mm³
  const Aa = h1 == null || e == null ? null : h1 * e; // mm²
  const auto = (v: number | null | undefined) => (cat ? v ?? null : undefined);

  // The picker marks the profiles whose reinforced section passes with their own catalogue values.
  const options = [...ALA_PERFILS.map((x) => x.name), MANUAL].map((name) => {
    if (name === MANUAL) return { value: MANUAL, label: "Altres · dades escrites a mà" };
    const ok = markOptions && passes(computeReforcBigaAcerAla({ ...raw, ...PERFIL_AUTO, perfil: name, Ix: null, Wx: null, h1: null, e: null }, false));
    return { value: name, label: ok ? `${name}  ✓` : name };
  });

  const section: Section = {
    key: "perfil",
    title: "Entrada de dades perfil existent d'acer d'ala estreta",
    enabled: true,
    blocks: [
      { title: "Dades geomètriques", rows: geometriaRows(g.L, g.x, g.fAdm) },
      {
        title: "Dades del perfil",
        rows: [
          {
            label: "Nom del perfil",
            value: d.perfil === MANUAL ? "Dades escrites a mà" : d.perfil,
            input: { type: "select", key: "perfil", options },
            hint: "Ix, Wx, l'ànima i les dimensions surten del catàleg (Torras o IPN) i es poden escriure a mà. ✓: el perfil reforçat compleix amb els valors del catàleg.",
            aux: [AJUDA_BIGUETES.torras],
          },
        ],
      },
      {
        title: "Característiques del perfil",
        rows: [
          ...acerRows(d, g.sd, g.td),
          { label: "Moment d'inèrcia", sym: "Ix", value: IxCm, unit: "cm⁴", input: { type: "num", key: "Ix", decimals: 2, auto: auto(cat?.Ix) }, alt: { value: Ix, unit: "mm⁴", decimals: 0 } },
          { label: "Mòdul resistent", sym: "Wx", value: WxCm, unit: "cm³", input: { type: "num", key: "Wx", decimals: 2, auto: auto(cat?.Wx) }, alt: { value: Wx, unit: "mm³", decimals: 0 } },
          { label: "Alçària de l'ànima", sym: "h1", value: h1, unit: "mm", input: { type: "num", key: "h1", decimals: 1, auto: auto(cat?.h1) } },
          { label: "Gruix de l'ànima", sym: "e", value: e, unit: "mm", input: { type: "num", key: "e", decimals: 1, auto: auto(cat?.e) } },
          { label: "Àrea de l'ànima", formula: "Aa = e × h1", sym: "Aa", value: Aa, unit: "mm²", alt: { value: cm(Aa, 100), unit: "cm²" } },
        ],
      },
    ],
  };

  return reforc(d, g, {
    section,
    comprovacioTitle: "Comprovació perfil existent d'acer d'ala estreta",
    Ix,
    Wx,
    Aa,
    auto: cat ? { h: cat.h, b: cat.b, A: cat.A } : undefined,
    times: "",
    nom: d.perfil === MANUAL ? "Dades escrites a mà" : d.perfil || "—",
  });
}
