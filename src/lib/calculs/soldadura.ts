// Justificació: gola de soldadura i compatibilitat entre soldadures.
//
// 1. Compatibility — port of "Justificació Comprovació Compatibilitat
// Soldadures.xls". Two pieces are welded (e.g. UPN 140 and IPN 140); each has
// a flange (e1) and a web (e) thickness from the catalogue, or is a plate with
// a typed thickness. For every pair of parts (ala–ala, ala–ànima, …) the
// fillet-weld table gives the max / min throat of each part. David's rule: the
// max of the thinner part must fall within the range of the thicker one, and
// the min of the thicker part within the range of the thinner one; the throat
// to use is then between the min of the thicker and the max of the thinner.
// The sheet looked these up by hand; here they come from the tables.
//
// 2. Throat by calculation — port of "Gola_IPE270_encastada.xlsx" and
// "Gola_IPE270_articulada.xlsx" (same formulas; articulada has M = 0 at the
// joint). Simplified method, EN 1993-1-8 4.5.3.3 / CTE DB SE-A 8.6.2.2: the
// flanges carry M/(h − tf) + |N|/2, the web carries V; fvw,d = fu/(√3·βw·γM2);
// a = F/(fvw,d·L), rounded up to 0,5 mm and at least the constructive minimum.
// Flanges: option 1 welds the outer face and both inner faces (perimeter),
// option 2 only the outer face. The throat to use is the larger of the
// calculated one and the minimum compatible one (from the combinations the
// user kept for that part), and it must not exceed the maximum compatible.

import { type CalcResult, type Row, type Section, type WeldCombo, type WeldPart, check, num } from "./common";
import { golaFigure } from "./gola-figura";
import { PLATE, perfilProps, soldaduraPer, type PerfilProps } from "./perfils";

export type Unio = "encastada" | "articulada";
export const UNIONS: { value: Unio; label: string }[] = [
  { value: "encastada", label: "Unió encastada" },
  { value: "articulada", label: "Unió articulada" },
];

export interface SoldaduraDades {
  perfil1: string; // catalogue profile, or PLATE
  gruix1: number; // mm, plate thickness when perfil1 = PLATE
  perfil2: string;
  gruix2: number;
  ocultes: string[]; // keys of the combinations left out of the checks and the report
  // throat by calculation
  unio: Unio;
  factor: number; // t → kN
  vz: number; // t
  my: number; // t·m (encastada only)
  nx: number; // t, + tension / − compression
  fu: number; // MPa
  betaW: number;
  gM2: number;
  gh: number | null; // geometry of profile 1; null = from the catalogue
  gb: number | null;
  gtw: number | null;
  gtf: number | null;
  gr: number | null;
  aMinC: number; // mm, constructive minimum throat
  aRef: number; // mm, throat deducted at the weld ends for the effective length
}

export function soldaduraDefaults(): SoldaduraDades {
  return {
    // David's example: an IPE 270 on a UPN 280, flange to flange and web to web.
    perfil1: "IPE 270", gruix1: 10, perfil2: "UPN 280", gruix2: 10, ocultes: ["ala|ànima", "ànima|ala"],
    unio: "encastada", factor: 9.81, vz: 0, my: 0, nx: 0, fu: 410, betaW: 0.85, gM2: 1.25,
    gh: null, gb: null, gtw: null, gtf: null, gr: null, aMinC: 3, aRef: 3,
  };
}

function part(label: string, t: number | null): WeldPart {
  const row = t == null ? null : soldaduraPer(t);
  return { label, t, aMax: row?.aMax ?? null, aMin: row?.aMin ?? null };
}

// The parts of a piece, each with its role ("ala", "ànima" or "xapa").
function pieceParts(perfil: string, gruix: number): { role: string; part: WeldPart }[] {
  if (perfil === PLATE) return [{ role: "xapa", part: part(`Xapa ${String(gruix).replace(".", ",")} mm`, gruix) }];
  const p = perfilProps(perfil);
  return [
    { role: "ala", part: part(`${perfil} · ala`, p?.tf ?? null) },
    { role: "ànima", part: part(`${perfil} · ànima`, p?.tw ?? null) },
  ];
}

const within = (x: number, lo: number, hi: number) => x >= lo && x <= hi;

export function combine(a: WeldPart, b: WeldPart): WeldCombo {
  const label = `${a.label} amb ${b.label}`;
  if (a.t == null || b.t == null) return { label, a, b, thin: null, range: null, ok: false, note: "Falta el gruix d'alguna peça." };
  if (a.aMax == null || a.aMin == null || b.aMax == null || b.aMin == null) {
    return { label, a, b, thin: null, range: null, ok: false, note: "Gruix fora de la taula de soldadures (4,0 – 36,0 mm)." };
  }
  const thin = a.t <= b.t ? "a" : "b";
  const tn = thin === "a" ? a : b;
  const tk = thin === "a" ? b : a;
  // Both conditions, as David states them.
  const maxThinInThick = within(tn.aMax!, tk.aMin!, tk.aMax!);
  const minThickInThin = within(tk.aMin!, tn.aMin!, tn.aMax!);
  const ok = maxThinInThick && minThickInThin;
  return {
    label,
    a,
    b,
    thin,
    range: ok ? [tk.aMin!, tn.aMax!] : null,
    ok,
    note: ok ? undefined : "La gola màxima de la peça més prima no arriba a la mínima de la més gruixuda.",
  };
}

function pieceRows(n: 1 | 2, perfil: string, gruix: number): Row[] {
  const rows: Row[] = [{ label: `Perfil laminat en calent ${n}`, value: perfil, input: { type: "profile", key: `perfil${n}`, allowPlate: true } }];
  if (perfil === PLATE) {
    rows.push({ label: "Gruix de la xapa", sym: "t", value: gruix, unit: "mm", input: { type: "num", key: `gruix${n}`, decimals: 1 } });
  } else {
    const p = perfilProps(perfil);
    rows.push({ label: "Gruix de les ales", sym: "e1", value: p?.tf ?? null, unit: "mm" });
    rows.push({ label: "Gruix de l'ànima", sym: "e", value: p?.tw ?? null, unit: "mm" });
  }
  return rows;
}

// ---- throat by calculation ----

// Profiles with two flanges and a web, which the throat sheet is written for.
const I_FAMILIES = ["ipe", "ipn", "hea", "heb", "hem"];

// Root radius: IPE and HE tables give it as r1; for IPN the table's r1 is the
// toe radius (0,6·tw) and the root radius equals tw.
function rootRadius(p: PerfilProps): number | null {
  return p.family === "ipn" ? p.tw : p.r1;
}

// Excel CEILING(x; 0,5) for x ≥ 0, without floating-point noise.
export const ceilHalf = (x: number) => Math.ceil(x * 2 - 1e-9) / 2;
// Excel ROUNDDOWN: towards zero.
const roundDown = (x: number, step = 1) => Math.trunc(x / step) * step;

// The compatible range for one part of profile 1 ("ala" or "ànima"): every
// combination the user kept for that part must be met, so the ranges intersect.
function compatFor(welds: WeldCombo[], role: "ala" | "ànima") {
  const used = welds.filter((w) => w.included !== false && w.key?.startsWith(`${role}|`));
  if (!used.length) return { used, min: null, max: null, none: true };
  if (used.some((w) => !w.range)) return { used, min: null, max: null, none: false };
  return { used, min: Math.max(...used.map((w) => w.range![0])), max: Math.min(...used.map((w) => w.range![1])), none: false };
}

function golaSection(d: SoldaduraDades, welds: WeldCombo[], g2: number): Section {
  const unio: Unio = d.unio === "articulada" ? "articulada" : "encastada";
  const unioLabel = UNIONS.find((u) => u.value === unio)!.label;
  const tipus: Row = {
    label: "Tipus d'unió",
    value: unioLabel,
    input: { type: "select", key: "unio", options: UNIONS },
    hint: unio === "articulada" ? "Unió articulada: M = 0 al nus." : "Unió encastada: el nus transmet el moment.",
  };
  const base: Omit<Section, "blocks"> = { key: "gola", title: `Gola de soldadura · ${unioLabel}`, enabled: true };

  const p = d.perfil1 === PLATE ? null : perfilProps(d.perfil1);
  if (!p || !I_FAMILIES.includes(p.family)) {
    return {
      ...base,
      blocks: [{ rows: [tipus, { label: "El càlcul de gola necessita que el perfil 1 sigui un perfil en I o H (IPE, IPN, HEA, HEB o HEM).", value: null }] }],
    };
  }

  const factor = num(d.factor, 9.81);
  const vz = num(d.vz);
  const my = unio === "articulada" ? 0 : num(d.my);
  const nx = num(d.nx);
  const V = vz * factor;
  const M = my * factor;
  const N = nx * factor;
  const fu = num(d.fu, 410);
  const betaW = num(d.betaW, 0.85);
  const gM2 = num(d.gM2, 1.25);
  const fvwd = fu / (Math.sqrt(3) * betaW * gM2);

  const geo = (key: "gh" | "gb" | "gtw" | "gtf" | "gr", auto: number | null) => (d[key] == null ? auto ?? 0 : num(d[key]));
  const h = geo("gh", p.h);
  const b = geo("gb", p.b);
  const tw = geo("gtw", p.tw);
  const tf = geo("gtf", p.tf);
  const r = geo("gr", rootRadius(p));
  const aMinC = num(d.aMinC, 3);
  const aRef = num(d.aRef, 3);

  // Flanges
  const fM = h - tf > 0 ? (M * 1000) / (h - tf) : 0;
  const fN = Math.abs(N) / 2;
  const F = fM + fN;
  const lExt = b;
  const lInt = Math.max(0, roundDown((b - tw - 2 * r) / 2 - 2 * aRef));
  const lTot = lExt + 2 * lInt;
  const a1calc = fvwd > 0 && lTot > 0 ? (F * 1000) / (fvwd * lTot) : 0;
  const a1 = Math.max(ceilHalf(a1calc), aMinC);
  const a2calc = fvwd > 0 && lExt > 0 ? (F * 1000) / (fvwd * lExt) : 0;
  const a2 = Math.max(ceilHalf(a2calc), aMinC);
  // Web
  const lWeb = Math.max(0, roundDown(h - 2 * tf - 2 * r - 2 * aRef, 10));
  const awCalc = fvwd > 0 && lWeb > 0 ? (V * 1000) / (fvwd * 2 * lWeb) : 0;
  const aw = Math.max(ceilHalf(awCalc), aMinC);

  // Compatibility (from the combinations above) and the throat to use
  const ca = compatFor(welds, "ala");
  const cw = compatFor(welds, "ànima");
  const which = (c: ReturnType<typeof compatFor>) =>
    c.none
      ? "Cap combinació inclosa per a aquesta part: només compta el càlcul."
      : c.min == null
        ? `Alguna combinació inclosa no és compatible: ${c.used.filter((w) => !w.range).map((w) => w.label).join(" · ")}.`
        : c.used.map((w) => w.label).join(" · ");
  const adopt = (calc: number, c: ReturnType<typeof compatFor>) => (c.min == null ? calc : Math.max(calc, c.min));
  const final = (label: string, calc: number, c: ReturnType<typeof compatFor>): Row => {
    const a = adopt(calc, c);
    return {
      label,
      formula: "màx(a càlcul ; a mín. compatible)",
      value: a,
      unit: "mm",
      decimals: 1,
      ...(c.none ? { hint: "Sense combinació de compatibilitat inclosa." } : { check: check(a, "≤", c.max, "mm", 1) }),
    };
  };

  const peca2 = d.perfil2 === PLATE ? `xapa ${String(g2).replace(".", ",")} mm` : d.perfil2;
  const ala1 = adopt(a1, ca);
  const ala2 = adopt(a2, ca);
  const anima = adopt(aw, cw);

  return {
    ...base,
    blocks: [
      { rows: [tipus] },
      {
        title: "Esforços de càlcul (ELU)",
        rows: [
          { label: "Factor t → kN", value: factor, unit: "kN/t", decimals: 2, input: { type: "num", key: "factor", decimals: 2 } },
          { label: "Esforç tallant", sym: "Vz", value: vz, unit: "t", decimals: 3, input: { type: "num", key: "vz", decimals: 3 }, alt: { value: V, unit: "kN", decimals: 1 } },
          unio === "articulada"
            ? { label: "Moment flector", sym: "My", value: 0, unit: "t·m", decimals: 3, hint: "Unió articulada: M = 0 al nus.", alt: { value: 0, unit: "kN·m", decimals: 1 } }
            : { label: "Moment flector", sym: "My", value: my, unit: "t·m", decimals: 3, input: { type: "num", key: "my", decimals: 3 }, alt: { value: M, unit: "kN·m", decimals: 1 } },
          { label: "Axial (+ tracció / − compressió)", sym: "N", value: nx, unit: "t", decimals: 3, input: { type: "num", key: "nx", decimals: 3 }, alt: { value: N, unit: "kN", decimals: 2 } },
        ],
      },
      {
        title: "Material",
        rows: [
          { label: "Resistència a tracció de l'acer", sym: "fu", value: fu, unit: "MPa", decimals: 1, input: { type: "num", key: "fu", decimals: 1 }, hint: "CTE DB SE-A taula 4.1 (S275: 410 MPa)" },
          { label: "Coeficient de correlació", sym: "βw", value: betaW, decimals: 2, input: { type: "num", key: "betaW", decimals: 2 } },
          { label: "Coeficient parcial de seguretat", sym: "γM2", value: gM2, decimals: 2, input: { type: "num", key: "gM2", decimals: 2 } },
          { label: "Resistència de càlcul de la soldadura", formula: "fvw,d = fu / (√3 · βw · γM2)", sym: "fvw,d", value: fvwd, unit: "MPa", decimals: 1 },
        ],
      },
      {
        title: `Geometria ${d.perfil1}`,
        rows: [
          { label: "Cantell", sym: "h", value: h, unit: "mm", decimals: 1, input: { type: "num", key: "gh", decimals: 1, auto: p.h } },
          { label: "Amplada de l'ala", sym: "b", value: b, unit: "mm", decimals: 1, input: { type: "num", key: "gb", decimals: 1, auto: p.b } },
          { label: "Gruix de l'ànima", sym: "e", value: tw, unit: "mm", decimals: 1, input: { type: "num", key: "gtw", decimals: 1, auto: p.tw } },
          { label: "Gruix de les ales", sym: "e1", value: tf, unit: "mm", decimals: 1, input: { type: "num", key: "gtf", decimals: 1, auto: p.tf } },
          { label: "Radi d'arrodoniment", sym: "r", value: r, unit: "mm", decimals: 1, input: { type: "num", key: "gr", decimals: 1, auto: rootRadius(p) } },
          { label: "Gola mínima constructiva", sym: "a mín", value: aMinC, unit: "mm", decimals: 1, input: { type: "num", key: "aMinC", decimals: 1 }, hint: "CTE DB SE-A 8.6.2.1" },
          { label: "Gola de referència per descomptar extrems", sym: "a ref", value: aRef, unit: "mm", decimals: 1, input: { type: "num", key: "aRef", decimals: 1 }, hint: "Per a la longitud eficaç (L − 2a)" },
        ],
      },
      {
        title: "Ales (resisteixen M i N)",
        rows: [
          { label: "Força a l'ala per moment", formula: "M / (h − e1)", value: fM, unit: "kN", decimals: 2 },
          { label: "Força a l'ala per axial", formula: "|N| / 2", value: fN, unit: "kN", decimals: 2, hint: "Repartit entre les dues ales (conservador)" },
          { label: "Força total a l'ala", formula: "F = M / (h − e1) + |N| / 2", sym: "F", value: F, unit: "kN", decimals: 2 },
          { label: "Longitud cordó exterior", sym: "L ext", value: lExt, unit: "mm", decimals: 0 },
          { label: "Longitud eficaç cordó interior (×2 per ala)", formula: "(b − e − 2r) / 2 − 2a ref", sym: "L int", value: lInt, unit: "mm", decimals: 0, hint: "Entre arrodoniment i vora, descomptant 2a" },
          { label: "Opció 1 · longitud total (exterior + 2 interiors)", formula: "L ext + 2 · L int", sym: "L", value: lTot, unit: "mm", decimals: 0 },
          { label: "Opció 1 · gola per càlcul", formula: "a = F / (fvw,d · L)", value: a1calc, unit: "mm", decimals: 2 },
          { label: "Opció 1 · gola segons càlcul", formula: "arrodonida a 0,5 mm i ≥ a mín", value: a1, unit: "mm", decimals: 1 },
          { label: "Opció 2 · gola per càlcul (només exterior)", formula: "a = F / (fvw,d · L ext)", value: a2calc, unit: "mm", decimals: 2 },
          { label: "Opció 2 · gola segons càlcul", formula: "arrodonida a 0,5 mm i ≥ a mín", value: a2, unit: "mm", decimals: 1 },
        ],
      },
      {
        title: "Ànima (resisteix V)",
        rows: [
          { label: "Longitud eficaç cordó ànima (×2)", formula: "h − 2·e1 − 2r − 2a ref, arrodonida a 10 mm", sym: "L", value: lWeb, unit: "mm", decimals: 0 },
          { label: "Gola per càlcul", formula: "a = V / (fvw,d · 2 · L)", value: awCalc, unit: "mm", decimals: 2 },
          { label: "Gola segons càlcul", formula: "arrodonida a 0,5 mm i ≥ a mín", value: aw, unit: "mm", decimals: 1 },
        ],
      },
      {
        title: "Compatibilitat de soldadures (de les combinacions)",
        rows: [
          { label: "Ales · gola mínima compatible", value: ca.min, unit: "mm", decimals: 1, hint: which(ca) },
          { label: "Ales · gola màxima compatible", value: ca.max, unit: "mm", decimals: 1 },
          { label: "Ànima · gola mínima compatible", value: cw.min, unit: "mm", decimals: 1, hint: which(cw) },
          { label: "Ànima · gola màxima compatible", value: cw.max, unit: "mm", decimals: 1 },
        ],
      },
      {
        title: "Gola a adoptar = màx(càlcul ; mínima compatible)",
        rows: [
          final("Ales · cordó perimetral (opció 1)", a1, ca),
          final("Ales · només cordó exterior (opció 2)", a2, ca),
          final("Ànima · 2 cordons", aw, cw),
        ],
      },
    ],
    figure: golaFigure({ peca2, h, b, tw, tf, r, lExt, lInt, lTotal: lTot, aAles1: ala1, aAles2: ala2, aAnima: anima }),
  };
}

export function computeSoldadura(raw: Partial<SoldaduraDades>): CalcResult {
  // A calculation saved before combinations could be left out has none hidden;
  // only new ones start with David's pairs (soldaduraDefaults).
  const d = { ...soldaduraDefaults(), ocultes: [], ...raw } as SoldaduraDades;
  const g1 = num(d.gruix1);
  const g2 = num(d.gruix2);

  const dades: Section = {
    key: "perfils",
    title: "Dades dels perfils",
    enabled: true,
    blocks: [
      { title: "Dades del perfil 1", rows: pieceRows(1, d.perfil1, g1) },
      { title: "Dades del perfil 2", rows: pieceRows(2, d.perfil2, g2) },
    ],
  };

  // Every pair of parts; the user can leave some out (they don't weld there).
  const ocultes = Array.isArray(d.ocultes) ? d.ocultes : [];
  const welds: WeldCombo[] = [];
  for (const a of pieceParts(d.perfil1, g1))
    for (const b of pieceParts(d.perfil2, g2)) {
      const key = `${a.role}|${b.role}`;
      welds.push({ ...combine(a.part, b.part), key, included: !ocultes.includes(key) });
    }

  const combinacions: Section = {
    key: "combinacions",
    title: "Resultats combinacions compatibilitat de soldadures",
    enabled: true,
    blocks: [],
    welds,
  };

  return { sections: [dades, combinacions, golaSection(d, welds, g2)] };
}
