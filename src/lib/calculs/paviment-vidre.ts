// Paviment de vidre trepitjable — port of David's OK-PAVIMENTS DE VIDRE.xlsx
// (sheets «Càlcul» and «Coeficients»). A walk-on laminated glass panel of n
// equal plies, simply supported on its 4 sides, checked as a linear plate
// (Roark's Formulas for Stress and Strain, table 11.4) under the CTE DB SE-AE
// actions, with criteria inspired by DIN 18008-5:
//   - Roark 1a, uniform load q:      σ = β · q · b² / t²   ·  w = α · q · b⁴ / (E · t³)
//   - Roark 1b, load W on a circle:  σ = 3W / (2π · t²) · [(1 + ν) · ln(2b / (π · r')) + β1]
//                                    w = αp · W · b² / (E · t³)
//     r = c / √π (the circle with the area of the c × c square), r' = Roark's
//     equivalent radius (r' = r if r ≥ 0,5 · t, else √(1,6 · r² + t²) − 0,675 · t).
//   β, α are interpolated at min(a/b, 5) and β1, αp at min(a/b, 2), linearly
//   between the rows of the tables, exactly as the sheet's INDEX/MATCH
//   formulas (see interpola).
//   No shear transfer through the interlayer: each ply takes 1/n of the load
//   (t is the thickness of one ply). The point-load stress and the uniform
//   self-weight stress are added at the centre (conservative).
//   1. E.L.U., intact laminate: qd = γG · g + γQ · q; Qd = γQ · Q (+ γG · g);
//      σ ≤ fd = kc · fk / γM.
//   2. E.L.S.: characteristic loads, w ≤ b / limit.
//   3. Post-breakage (top ply broken, accidental, γ = 1,0): n − 1 plies carry
//      g + q, and Q + g (the broken ply still weighs); σ ≤ fd,acc = kc · fk /
//      γM,acc; and at least 3 plies (DIN 18008-5).
// The sheet's «Hipòtesis i limitacions» are the notes of the last section.
// The header fields of the sheet (projecte, client, referència…) are not ported.
//
// Notes on the sheet (none of them changes the numbers of its example):
// - The calculation thickness t (9,7 mm) is typed in the sheet, with the
//   EN 572-2 tolerances in a note (8 → 7,7 · 10 → 9,7 · 12 → 11,7 ·
//   15 → 14,5). Here it defaults to that table from the nominal thickness and
//   can be typed; for other nominal thicknesses there is no default and it
//   must be typed (until then the results are "—" and the checks fail).
// - «Tipus de vidre» is informative text in the sheet, and fk (120) and γM
//   (1,5) are typed next to the notes «Trempat 120 · Termoendurit 70 · Recuit
//   45» and «DIN 18008-1: 1,5 pretensat · 1,8 recuit». Here the type is a
//   select that gives the default of fk and γM; both can still be typed.
// - Post-breakage with n − 1 < 1 resisting plies: the sheet prints 9999 MPa
//   (which fails the check). Here the stress is "—" and the check fails.
// - The «n ≥ 3» check (DIN 18008-5) is a check like the others (the sheet's
//   «OK!» formula).
// - «Avís de validesa»: the sheet's sentence for a/b > 2 is split into a short
//   value («Fora de rang (a/b > 2)») and the explanation under the label, so
//   that it fits the value column of the report.
// - «Composició»: the sheet rounds the nominal thickness to whole mm
//   (TEXT(t,"0")); here a non-integer thickness shows one decimal.
// - «Resultat global» is the verdict and the summary of the report.
// - The two stresses and the two deflections of a section have their own
//   symbols here (σ q / σ Q, w q / w Q; the sheet writes σ and w).
// - Not in the sheet, left as it is: kmod (load duration) of DIN 18008-1 for
//   annealed glass is not applied; γM,acc is typed («a confirmar segons norma
//   aplicada; 1,5 és conservador»); Roark's coefficients are for ν = 0,3 while
//   ν (0,23) only enters the point-load stress.

import { type CalcResult, type Row, type Section, check, div, fmt, num } from "./common";
import { AJUDA } from "./ajuda";

export interface PavimentVidreDades {
  L1: number; // m
  L2: number; // m
  n: number; // plies
  tNom: number; // mm, nominal thickness of one ply
  t: number | null; // mm, calculation thickness; null → nominal minus the EN 572-2 tolerance
  vidre: string; // VIDRES value
  fk: number | null; // MPa; null → from the glass type
  kc: number;
  gM: number | null; // γM; null → from the glass type
  gMAcc: number; // γM,acc
  E: number; // MPa
  nu: number; // ν
  q: number; // kN/m²
  Q: number; // kN
  c: number; // mm, side of the square loaded area
  gG: number;
  gQ: number;
  limitB: number; // w adm = b / limitB
}

// Defaults: the example of the sheet.
export function pavimentVidreDefaults(): PavimentVidreDades {
  return {
    L1: 1.5,
    L2: 1.5,
    n: 3,
    tNom: 10,
    t: null,
    vidre: "trempat",
    fk: null,
    kc: 1,
    gM: null,
    gMAcc: 1.5,
    E: 70000,
    nu: 0.23,
    q: 2,
    Q: 2,
    c: 50,
    gG: 1.35,
    gQ: 1.5,
    limitB: 200,
  };
}

// Glass types: characteristic bending strength (MPa) and γM (DIN 18008-1:
// 1,5 prestressed, 1,8 annealed).
export const VIDRES = [
  { value: "trempat", label: "Trempat (ESG / templat)", fk: 120, gM: 1.5 },
  { value: "termoendurit", label: "Termoendurit (TVG)", fk: 70, gM: 1.5 },
  { value: "recuit", label: "Recuit (float)", fk: 45, gM: 1.8 },
];

// EN 572-2: nominal thickness → nominal minus the tolerance (mm).
export const GRUIX_CALCUL: Record<number, number> = { 8: 7.7, 10: 9.7, 12: 11.7, 15: 14.5 };

// Glass unit weight (kN/m³).
const PES_VIDRE = 25;

// Roark, table 11.4 (the sheet's «Coeficients»): rectangular plate simply
// supported on 4 sides, ν = 0,3. a = long side, b = short side.
// Case 1a, uniform load: [a/b, β, α].
export const ROARK_UNIFORME: readonly (readonly [number, number, number])[] = [
  [1, 0.2874, 0.0444],
  [1.2, 0.3762, 0.0616],
  [1.4, 0.453, 0.077],
  [1.6, 0.5172, 0.0906],
  [1.8, 0.5688, 0.1017],
  [2, 0.6102, 0.111],
  [3, 0.7134, 0.1335],
  [4, 0.741, 0.14],
  [5, 0.7476, 0.1417],
];
// Case 1b, load on a central circle of radius r: [a/b, β1, αp].
export const ROARK_PUNTUAL: readonly (readonly [number, number, number])[] = [
  [1, 0.435, 0.1267],
  [1.2, 0.565, 0.1478],
  [1.4, 0.65, 0.1621],
  [1.6, 0.71, 0.1715],
  [1.8, 0.745, 0.177],
  [2, 0.77, 0.1805],
];
// The sheet looks the tables up at min(a/b, last row).
const MAX_UNIFORME = 5;
const MAX_PUNTUAL = 2;

// Column col of a table at x, as the sheet's INDEX/MATCH: MATCH(x, a/b, 1) is
// the last row with a/b ≤ x, limited to the second-to-last one, and the value
// is interpolated linearly on that segment (so x beyond the last row would
// extrapolate it; the sheet caps x first). x below the first row is #N/A in
// Excel: null here.
export function interpola(taula: readonly (readonly number[])[], col: number, x: number | null): number | null {
  if (x == null || !Number.isFinite(x) || taula.length < 2 || x < taula[0][0]) return null;
  let i = 0;
  while (i < taula.length - 2 && taula[i + 1][0] <= x) i++;
  const [x0, x1] = [taula[i][0], taula[i + 1][0]];
  const [y0, y1] = [taula[i][col], taula[i + 1][col]];
  return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
}

// A finite number, or null (a division by zero, a missing operand…: "—").
const fin = (v: number | null): number | null => (v != null && Number.isFinite(v) ? v : null);
const sum = (a: number | null, b: number | null): number | null => (a == null || b == null ? null : a + b);

const tableHint = (taula: readonly (readonly number[])[], col: number, sym: string) =>
  `Roark, taula 11.4 (ν = 0,3), a/b → ${sym}: ${taula.map((r) => `${fmt(r[0], Number.isInteger(r[0]) ? 0 : 1)} → ${fmt(r[col], 4)}`).join(" · ")}`;

export function computePavimentVidre(raw: Partial<PavimentVidreDades>): CalcResult {
  const d = { ...pavimentVidreDefaults(), ...raw } as PavimentVidreDades;

  // ---- Geometria ----
  const L1 = num(d.L1);
  const L2 = num(d.L2);
  const a = Math.max(L1, L2); // m
  const b = Math.min(L1, L2); // m, the span of the calculation
  const ab = div(a, b);
  const bmm = b * 1000;

  // ---- Composició ----
  const n = num(d.n);
  const tNom = num(d.tNom);
  const tAuto = GRUIX_CALCUL[tNom] as number | undefined;
  const t = d.t != null ? num(d.t) : tAuto ?? null; // mm
  const g = (PES_VIDRE * n * tNom) / 1000; // kN/m², with the nominal thickness (as the sheet)
  const composicio = `${fmt(n, 0)} × ${fmt(tNom, Number.isInteger(tNom) ? 0 : 1)} mm`;

  // ---- Material ----
  const vidre = VIDRES.find((v) => v.value === d.vidre) ?? null;
  const fkAuto = vidre?.fk ?? null;
  const gMAuto = vidre?.gM ?? null;
  const fk = d.fk != null ? num(d.fk) : fkAuto;
  const gM = d.gM != null ? num(d.gM) : gMAuto;
  const kc = num(d.kc);
  const gMAcc = num(d.gMAcc);
  const fd = fk == null ? null : div(kc * fk, gM);
  const fdAcc = fk == null ? null : div(kc * fk, gMAcc);
  const E = num(d.E);
  const nu = num(d.nu);

  // ---- Accions ----
  const q = num(d.q);
  const Q = num(d.Q);
  const c = num(d.c);
  const gG = num(d.gG);
  const gQ = num(d.gQ);
  const limitB = num(d.limitB);

  // ---- Coeficients de placa ----
  const xU = ab == null ? null : Math.min(ab, MAX_UNIFORME);
  const xP = ab == null ? null : Math.min(ab, MAX_PUNTUAL);
  const beta = interpola(ROARK_UNIFORME, 1, xU);
  const alpha = interpola(ROARK_UNIFORME, 2, xU);
  const beta1 = interpola(ROARK_PUNTUAL, 1, xP);
  const alphaP = interpola(ROARK_PUNTUAL, 2, xP);
  const r = c / Math.sqrt(Math.PI); // mm
  const rp = t == null ? null : r >= 0.5 * t ? r : Math.sqrt(1.6 * r * r + t * t) - 0.675 * t;
  const foraRang = ab != null && ab > MAX_PUNTUAL;

  // Per ply, for np plies; q in kN/m² (= 10⁻³ N/mm²), W in kN, b and t in mm → MPa, mm.
  const sigmaUnif = (qq: number, np: number) => (beta == null || t == null ? null : fin((beta * qq * 1e-3 * bmm * bmm) / (np * t * t)));
  const sigmaPunt = (W: number, np: number) =>
    beta1 == null || t == null || rp == null ? null : fin(((3 * W * 1000) / (2 * Math.PI * np * t * t)) * ((1 + nu) * Math.log((2 * bmm) / (Math.PI * rp)) + beta1));
  const wUnif = (qq: number, np: number) => (alpha == null || t == null ? null : fin((alpha * qq * 1e-3 * Math.pow(bmm, 4)) / (E * np * Math.pow(t, 3))));
  const wPunt = (W: number, np: number) => (alphaP == null || t == null ? null : fin((alphaP * W * 1000 * bmm * bmm) / (E * np * Math.pow(t, 3))));

  // ---- E.L.U. · laminat intacte ----
  const qd = gG * g + gQ * q;
  const sQd = sigmaUnif(qd, n);
  const Qd = gQ * Q;
  const sQpd = sum(sigmaPunt(Qd, n), sigmaUnif(gG * g, n));

  // ---- E.L.S. · fletxa ----
  const wAdm = div(bmm, limitB);
  const wq = wUnif(g + q, n);
  const wQ = sum(wPunt(Q, n), wUnif(g, n));

  // ---- Post-trencament ----
  const nr = n - 1;
  const sAcc = nr < 1 ? null : sigmaUnif(g + q, nr);
  const sPAcc = nr < 1 ? null : sum(sigmaPunt(Q, nr), sigmaUnif(g, nr));

  const sobrecarregues = [AJUDA.sobrecarregues];

  const dades: Section = {
    key: "dades",
    title: "Entrada de dades del paviment de vidre",
    enabled: true,
    blocks: [
      {
        title: "Dades geomètriques",
        rows: [
          { label: "Costat 1 del vidre", sym: "L1", value: L1, unit: "m", decimals: 3, input: { type: "num", key: "L1", decimals: 3 } },
          { label: "Costat 2 del vidre", sym: "L2", value: L2, unit: "m", decimals: 3, input: { type: "num", key: "L2", decimals: 3 } },
          { label: "Costat llarg", formula: "a = màx(L1, L2)", sym: "a", value: a, unit: "m", decimals: 3 },
          { label: "Costat curt (llum de càlcul)", formula: "b = mín(L1, L2)", sym: "b", value: b, unit: "m", decimals: 3 },
          { label: "Relació de costats", formula: "a / b", sym: "a/b", value: ab, decimals: 3 },
        ],
      },
      {
        title: "Composició del vidre (làmines iguals)",
        rows: [
          { label: "Nombre de làmines", sym: "n", value: n, unit: "ut", decimals: 0, input: { type: "num", key: "n", decimals: 0, integer: true }, hint: "Mínim recomanat per a vidre trepitjable: 3 (làmina superior de sacrifici)" },
          { label: "Gruix nominal per làmina", sym: "t,nom", value: tNom, unit: "mm", decimals: Number.isInteger(tNom) ? 0 : 1, input: { type: "num", key: "tNom", decimals: 1 } },
          {
            label: "Gruix mínim de càlcul per làmina",
            sym: "t",
            value: t,
            unit: "mm",
            decimals: 1,
            input: { type: "num", key: "t", decimals: 1, auto: tAuto },
            hint:
              (tAuto == null ? "Per a aquest gruix nominal no hi ha valor de taula: escriu el gruix de càlcul. " : "") +
              "Gruix nominal menys tolerància (EN 572-2): 8 → 7,7 · 10 → 9,7 · 12 → 11,7 · 15 → 14,5",
          },
          { label: "Composició", formula: "n × t,nom", value: composicio },
          { label: "Pes propi del vidre", formula: "g = 25 kN/m³ · n · t,nom", sym: "g", value: g, unit: "kN/m²", decimals: 3 },
        ],
      },
      {
        title: "Material",
        rows: [
          {
            label: "Tipus de vidre",
            value: vidre?.label ?? null,
            input: { type: "select", key: "vidre", options: VIDRES.map((v) => ({ value: v.value, label: v.label })) },
            hint: "Dona els valors per defecte de fk i γM.",
          },
          { label: "Resistència característica a flexió", sym: "fk", value: fk, unit: "MPa", decimals: 1, input: { type: "num", key: "fk", decimals: 1, auto: fkAuto }, hint: "Trempat 120 · Termoendurit 70 · Recuit (float) 45" },
          { label: "Coeficient de tipus de construcció", sym: "kc", value: kc, decimals: 2, input: { type: "num", key: "kc", decimals: 2 }, hint: "DIN 18008-1: 1,0 per a vidre pretensat" },
          { label: "Coeficient parcial de seguretat del material", sym: "γM", value: gM, decimals: 2, input: { type: "num", key: "gM", decimals: 2, auto: gMAuto }, hint: "DIN 18008-1: 1,5 pretensat · 1,8 recuit" },
          { label: "Resistència de càlcul del material a flexió", formula: "fd = kc · fk / γM", sym: "fd", value: fd, unit: "MPa" },
          {
            label: "Coeficient parcial de seguretat del material en situació accidental (post-trencament)",
            sym: "γM,acc",
            value: gMAcc,
            decimals: 2,
            input: { type: "num", key: "gMAcc", decimals: 2 },
            hint: "A confirmar segons norma aplicada; 1,5 és conservador",
          },
          { label: "Resistència de càlcul a flexió en situació accidental", formula: "fd,acc = kc · fk / γM,acc", sym: "fd,acc", value: fdAcc, unit: "MPa" },
          { label: "Mòdul d'elasticitat", sym: "E", value: E, unit: "MPa", decimals: 0, input: { type: "num", key: "E", decimals: 0 } },
          { label: "Coeficient de Poisson", sym: "ν", value: nu, decimals: 2, input: { type: "num", key: "nu", decimals: 2 }, hint: "Els coeficients de Roark són per a ν = 0,3" },
        ],
      },
      {
        title: "Accions",
        rows: [
          { label: "Sobrecàrrega d'ús uniforme", sym: "q", value: q, unit: "kN/m²", input: { type: "num", key: "q", decimals: 2 }, hint: "CTE DB SE-AE taula 3.1 (A1 habitatge: 2 kN/m²)", aux: sobrecarregues },
          { label: "Càrrega concentrada", sym: "Q", value: Q, unit: "kN", input: { type: "num", key: "Q", decimals: 2 }, hint: "CTE DB SE-AE taula 3.1 (A1 habitatge: 2 kN)", aux: sobrecarregues },
          {
            label: "Costat de l'àrea quadrada de càrrega",
            sym: "c",
            value: c,
            unit: "mm",
            decimals: 0,
            input: { type: "num", key: "c", decimals: 0 },
            hint: "Comprovar el valor aplicable al CTE / normativa de projecte (CTE DB SE-AE 3.1.1: 50 mm de costat; 200 mm en zones de trànsit i aparcament)",
          },
          { label: "Coeficient de majoració de les accions permanents", sym: "γG", value: gG, decimals: 2, input: { type: "num", key: "gG", decimals: 2 } },
          { label: "Coeficient de majoració de les accions variables", sym: "γQ", value: gQ, decimals: 2, input: { type: "num", key: "gQ", decimals: 2 } },
          { label: "Límit de fletxa", sym: "b /", value: limitB, decimals: 0, input: { type: "num", key: "limitB", decimals: 0 }, hint: "Fletxa admissible = b / valor" },
        ],
      },
    ],
  };

  const coefRow = (label: string, sym: string, value: number | null, x: number | null, max: number, taula: typeof ROARK_UNIFORME, col: number): Row => ({
    label,
    formula: `mín(a/b; ${max}) = ${fmt(x, 3)}`,
    sym,
    value,
    decimals: 4,
    hint: tableHint(taula, col, sym),
  });

  const coeficients: Section = {
    key: "coeficients",
    title: "Coeficients de placa (taules de Roark)",
    enabled: true,
    blocks: [
      {
        title: "Càrrega uniforme · Roark cas 1a (a/b ≤ 5)",
        rows: [
          coefRow("Coeficient de tensió", "β", beta, xU, MAX_UNIFORME, ROARK_UNIFORME, 1),
          coefRow("Coeficient de fletxa", "α", alpha, xU, MAX_UNIFORME, ROARK_UNIFORME, 2),
        ],
      },
      {
        title: "Càrrega puntual centrada · Roark cas 1b (a/b ≤ 2)",
        rows: [
          coefRow("Coeficient de tensió", "β1", beta1, xP, MAX_PUNTUAL, ROARK_PUNTUAL, 1),
          coefRow("Coeficient de fletxa", "αp", alphaP, xP, MAX_PUNTUAL, ROARK_PUNTUAL, 2),
          { label: "Radi equivalent de l'àrea de càrrega", formula: "r = c / √π", sym: "r", value: r, unit: "mm", hint: "Cercle de la mateixa àrea que el quadrat c × c" },
          {
            label: "Radi corregit",
            formula: t != null && r < 0.5 * t ? "r' = √(1,6 · r² + t²) − 0,675 · t   (r < 0,5 · t)" : "r' = r   (r ≥ 0,5 · t)",
            sym: "r'",
            value: rp,
            unit: "mm",
          },
          {
            label: "Avís de validesa",
            formula: foraRang ? "Coeficients de càrrega puntual presos per a a/b = 2 (verificar)" : undefined,
            value: ab == null ? null : foraRang ? "Fora de rang (a/b > 2)" : "Dins del rang de taules",
          },
        ],
      },
    ],
    notes: [
      "Coeficients de Roark's Formulas for Stress and Strain, taula 11.4 (placa rectangular simplement recolzada als 4 costats, ν = 0,3), interpolats linealment segons a/b. Verificar els valors amb l'edició de Roark disponible.",
    ],
  };

  const elu: Section = {
    key: "elu",
    title: "E.L.U. · laminat intacte (sense col·laboració entre làmines)",
    enabled: true,
    blocks: [
      {
        rows: [
          { label: "Càrrega uniforme de càlcul", formula: "qd = γG · g + γQ · q", sym: "qd", value: qd, unit: "kN/m²", decimals: 3 },
          { label: "Tensió per làmina · càrrega uniforme", formula: "σ q = β · qd · b² / (n · t²)", sym: "σ q", value: sQd, unit: "MPa", check: check(sQd, "≤", fd, "MPa") },
          { label: "Càrrega puntual de càlcul", formula: "Qd = γQ · Q", sym: "Qd", value: Qd, unit: "kN" },
          {
            label: "Tensió per làmina · puntual + pes propi",
            formula: "σ Q = 3 · Qd / (2π · n · t²) · [(1 + ν) · ln(2b / (π · r')) + β1] + β · γG · g · b² / (n · t²)",
            sym: "σ Q",
            value: sQpd,
            unit: "MPa",
            check: check(sQpd, "≤", fd, "MPa"),
            hint: "Superposició dels màxims al centre (conservador)",
          },
        ],
      },
    ],
  };

  const els: Section = {
    key: "els",
    title: "E.L.S. · fletxa (valors característics)",
    enabled: true,
    blocks: [
      {
        rows: [
          { label: "Fletxa admissible", formula: `w adm = b / ${fmt(limitB, 0)}`, sym: "w adm", value: wAdm, unit: "mm" },
          { label: "Fletxa · pes propi + uniforme", formula: "w q = α · (g + q) · b⁴ / (E · n · t³)", sym: "w q", value: wq, unit: "mm", check: check(wq, "≤", wAdm, "mm") },
          {
            label: "Fletxa · pes propi + puntual",
            formula: "w Q = αp · Q · b² / (E · n · t³) + α · g · b⁴ / (E · n · t³)",
            sym: "w Q",
            value: wQ,
            unit: "mm",
            check: check(wQ, "≤", wAdm, "mm"),
          },
        ],
      },
    ],
  };

  const postTrencament: Section = {
    key: "postTrencament",
    title: "Post-trencament · làmina superior trencada (combinació accidental, γ = 1,0)",
    enabled: true,
    blocks: [
      {
        rows: [
          { label: "Làmines resistents", formula: "n − 1", sym: "n − 1", value: nr, unit: "ut", decimals: 0, hint: "El pes de la làmina trencada continua actuant com a càrrega" },
          {
            label: "Tensió per làmina · càrrega uniforme",
            formula: "σ q = β · (g + q) · b² / ((n − 1) · t²)",
            sym: "σ q",
            value: sAcc,
            unit: "MPa",
            check: check(sAcc, "≤", fdAcc, "MPa"),
          },
          {
            label: "Tensió per làmina · puntual + pes propi",
            formula: "σ Q = 3 · Q / (2π · (n − 1) · t²) · [(1 + ν) · ln(2b / (π · r')) + β1] + β · g · b² / ((n − 1) · t²)",
            sym: "σ Q",
            value: sPAcc,
            unit: "MPa",
            check: check(sPAcc, "≤", fdAcc, "MPa"),
          },
          { label: "Nombre de làmines", sym: "n", value: n, unit: "ut", decimals: 0, check: check(n, "≥", 3, "ut", 0), hint: "Criteri DIN 18008-5: mínim 3 làmines" },
        ],
      },
    ],
  };

  const hipotesis: Section = {
    key: "hipotesis",
    title: "Hipòtesis i limitacions",
    enabled: true,
    blocks: [],
    notes: [
      "1. Placa rectangular simplement recolzada als 4 costats, càlcul lineal (teoria de plaques de Roark). No és vàlid per a vidres recolzats en 2 o 3 costats ni per a fixacions puntuals.",
      "2. Làmines iguals i sense col·laboració a través de l'intercalari (hipòtesi conservadora habitual): cada làmina rep la part proporcional de la càrrega.",
      "3. Les tensions de càrrega uniforme i puntual se superposen al centre del vidre (conservador).",
      "4. No es comprova la resistència al cop, el lliscament de la superfície, els recolzaments (calces, perfils) ni l'estructura portant.",
      "5. Eina de predimensionament: el gruix definitiu s'ha de verificar amb EN 16612 / DIN 18008-5 i amb el fabricant del vidre.",
    ],
  };

  return { sections: [dades, coeficients, elu, els, postTrencament, hipotesis] };
}
