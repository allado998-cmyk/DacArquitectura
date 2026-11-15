// Reforç de trencallums: an opening in a floor of joists. Port of David's
// OK-REFOÇ DE TRENCALLUMS.xls (sheets «Baixada de Càrrgeues», «Càlcul Biga
// Trencallums» and «Càlcul Biga de Suport»; «Dades Perfils» is the catalogue of
// perfils.ts):
//
//   1. Estat de càrregues on the trencallums: the table of the joist checks
//      (bigueta-carregues.ts): upper walls kN/m³ · gruix · alçària, floor lines
//      kN/m² · amplària de càrrega, and the profile's self-weight.
//   2. Trencallums principal, perpendicular to the joists: it carries the cut
//      joists as a uniform load q over L = amplària de l'entrebigat · nombre
//      d'entrebigats, and is checked like a joist (comprovacioSection: E.L.S.,
//      E.L.U. and safety factors).
//   3. Biga de suport (trencallums secundari), parallel to the joists: it
//      carries the end reaction of the trencallums, P = q · Lt / 2, as a point
//      load at midspan: f = P · L³ / (48 · E · I), M = P · L / 4,
//      τ = (P / 2) / Aa and the combined stress. Its span defaults to the joist
//      span, 2 · amplària de càrrega (the sheet's D20 · 2), and can be typed.
//   4. Passadors that anchor the support beam into the load-bearing wall: the
//      bearing stress S = V / (N · DN · L), with V = P ELU / 2, against the
//      design strength of the masonry.
//
// Differences from the sheet, on purpose (effect on the sheet's example):
// - Self-weight of the trencallums: typed in the sheet (0,1 kN/ml); here it
//   defaults to the catalogue weight of the chosen profile (n · p · 9,81/1000,
//   as in bigueta-acer.ts) and can still be typed. HEB 120 (26,7 kg/m):
//   0,2619 kN/ml, so Q ELS 25,5475 → 25,7094 and Q ELU 35,3666 → 35,5852 N/mm;
//   every check still passes (the tightest, the passadors: S 1,3344 < fd
//   1,3359 N/mm²). The test types 0,1 to reproduce the sheet.
// - Masonry under the passadors: the sheet computes fk = K · fb^0,7 · fm^0,3
//   (EN 1996-1-1). The app uses CTE DB SE-F annex C, fk = K · fb^0,65 ·
//   fm^0,25 (fabricaFd, the formula of every other calculation and of the help
//   image): fk 4,87 → 4,01 and fd = fk / γM 1,62 → 1,34 N/mm²; S = 1,33 N/mm²
//   still passes (1,3262 < 1,3359).
// - Support beam moment: the sheet computes M = P / n · L / 4 and then divides
//   by Wx of the n profiles, so n counts twice; here M = P · L / 4. No effect
//   with n = 1 (the example).
// - IPN 240 web: the sheet's catalogue rounds h1 to 192,5 mm, perfils.ts gives
//   192 mm: Aa 1.674,75 → 1.670,4 mm², τ 9,5029 → 9,5276 N/mm² and the
//   combined stress 132,5270 → 132,5323 N/mm² (both OK). HEB 120 is identical.
// - The sheet's «Comprovació anàlisi a flexió / a tallant» rows (σ / σd and
//   τ / τd < 1, «SEGUR!») are not repeated: they are the same conditions as
//   σ < σd and τ < τd, printed next to each stress. In the trencallums they are
//   also the inverses of γMf and γV of comprovacioSection.
// - The passadors' «S < fd» has no OK / NO formula in the sheet; here it is a
//   check like every other.
// - The conversion column uses 9,81 (N → kg, N/mm → kg/ml, N/mm² → kg/cm²);
//   the sheet multiplies by 0,1, 100 or 10.
// As in the sheet, the support beam carries only P: its own weight is not added.
//
// Text slips in the sheet, fixed in the labels: «Q MAX Mf ELU» as the symbol of
// the shear capacity (comprovacioSection), «TOTAL BAIXADA DE CÀRREGUES D'UNA
// PARET» as the total of the trencallums, «PLAQUES D'ANCORATGE» as the heading
// of the passadors.

import { type CalcResult, type Row, type Section, G, NMM2_TO_KGCM2, check, div, fabricaFd, fabricaRows, num } from "./common";
import { AJUDA } from "./ajuda";
import { perfilOptions, perfilProps } from "./perfils";
import { type CarreguesDades, carreguesDefaults, estatCarregues, kgMl } from "./bigueta-carregues";
import { acerRows, comprovacioSection, geometriaRows, perfilLine } from "./bigueta-acer";

export interface TrencallumsDades extends CarreguesDades {
  ppPerfil: number | null; // kN/ml; null → catalogue weight of the trencallums
  gPerfil: number;
  // Trencallums principal
  entrebigat: number; // cm, amplària de l'entrebigat
  nEntrebigats: number;
  limitL: number; // L / x
  nPerfils: number;
  perfil: string;
  E: number; // N/mm²
  sk: number; // N/mm²
  gk: number; // γ, coeficient de minoració del material
  // Biga de suport
  LSuport: number | null; // mm; null → 2 · amplada (the joist span)
  limitLSuport: number;
  nSuport: number;
  perfilSuport: string;
  ESuport: number;
  skSuport: number;
  gkSuport: number;
  // Passadors and masonry of the supporting wall
  nPassadors: number;
  dPassador: number; // mm, diameter of the drilled hole
  lPassador: number; // mm, length of the drilled hole
  k: number;
  fb: number; // N/mm²
  fm: number; // N/mm²
  gM: number;
}

// Defaults: the sheet's example (no upper wall: 18 kN/m³ × 0 × 0).
export function trencallumsDefaults(): TrencallumsDades {
  return {
    ...carreguesDefaults({ amplada: 2.925, pp: 2.5, cp: 3.2, envans: 1, us: 2 }),
    paretPes: 18,
    paretGruix: 0,
    paretAlcada: 0,
    ppPerfil: null,
    gPerfil: 1.35,
    entrebigat: 60,
    nEntrebigats: 3,
    limitL: 500,
    nPerfils: 1,
    perfil: "HEB 120",
    E: 210000,
    sk: 275,
    gk: 1.05,
    LSuport: null,
    limitLSuport: 500,
    nSuport: 1,
    perfilSuport: "IPN 240",
    ESuport: 210000,
    skSuport: 275,
    gkSuport: 1.05,
    nPassadors: 5,
    dPassador: 20,
    lPassador: 120,
    k: 0.6,
    fb: 10,
    fm: 5,
    gM: 3,
  };
}

const passes = (s: Section) => s.blocks.every((b) => b.rows.every((r) => !r.check || r.check.ok));

// Ix (mm⁴), Wx (mm³) and the web area Aa = e · h1 (mm²) of n catalogue profiles.
function seccio(name: string, n: number) {
  const p = perfilProps(name);
  return {
    p,
    Ix: p?.Ix != null ? n * p.Ix * 1e4 : null,
    Wx: p?.Wx != null ? n * p.Wx * 1e3 : null,
    Aa: p?.h1 != null && p?.tw != null ? n * p.h1 * p.tw : null,
  };
}

function seccioRows(s: { Ix: number | null; Wx: number | null; Aa: number | null }, n: number): Row[] {
  const times = n !== 1 ? `${n} × ` : "";
  return [
    { label: "Moment d'inèrcia", formula: times ? `${times}Ix` : undefined, sym: "Ix", value: s.Ix, unit: "mm⁴", decimals: 0, alt: { value: s.Ix == null ? null : s.Ix / 1e4, unit: "cm⁴" } },
    { label: "Mòdul resistent", formula: times ? `${times}Wx` : undefined, sym: "Wx", value: s.Wx, unit: "mm³", decimals: 0, alt: { value: s.Wx == null ? null : s.Wx / 1e3, unit: "cm³" } },
    { label: "Àrea de l'ànima", formula: `Aa = ${times}e × h1`, sym: "Aa", value: s.Aa, unit: "mm²", alt: { value: s.Aa == null ? null : s.Aa / 100, unit: "cm²" } },
  ];
}

// ---- 1 and 2: estat de càrregues and trencallums principal ----

function principal(d: TrencallumsDades) {
  const n = num(d.nPerfils);
  const sec = seccio(d.perfil, n);
  const ppAuto = sec.p?.p != null ? (n * sec.p.p * G) / 1000 : null;
  const pp = d.ppPerfil != null ? num(d.ppPerfil) : ppAuto ?? 0;
  const est = estatCarregues(d, { perfil: perfilLine(pp, ppAuto, num(d.gPerfil)) });
  const carregues: Section = { key: "carregues", title: "Estat de càrregues sobre el trencallums", enabled: true, blocks: [], loads: { groups: est.groups, totalUnf: est.qEls, totalFac: est.qElu } };

  const a = num(d.entrebigat); // cm
  const nE = num(d.nEntrebigats);
  const L = a * nE * 10; // mm
  const x = num(d.limitL);
  const fAdm = div(L, x);
  const E = num(d.E);
  const sd = div(num(d.sk), num(d.gk));
  const td = sd == null ? null : sd / Math.sqrt(3);
  const [lRow, xRow, fRow] = geometriaRows(L, x, fAdm);

  const section: Section = {
    key: "principal",
    title: "Trencallums principal (perpendicular a les biguetes)",
    enabled: true,
    blocks: [
      {
        title: "Dades de càrrega",
        rows: [
          { label: "Càrrega uniforme sense majorar (estat límit de servei)", sym: "Q ELS", value: est.qEls, unit: "N/mm", alt: { value: kgMl(est.qEls), unit: "kg/ml" } },
          { label: "Càrrega uniforme majorada (estat límit últim)", sym: "Q ELU", value: est.qElu, unit: "N/mm", alt: { value: kgMl(est.qElu), unit: "kg/ml" } },
        ],
      },
      {
        title: "Dades geomètriques",
        rows: [
          { label: "Amplària de l'entrebigat", sym: "a", value: a, unit: "cm", input: { type: "num", key: "entrebigat", decimals: 2 }, alt: { value: a / 100, unit: "m" } },
          { label: "Nombre d'entrebigats a salvar", sym: "n", value: nE, unit: "ut", decimals: 0, input: { type: "num", key: "nEntrebigats", decimals: 0, integer: true } },
          // The span follows from the joists it cuts; not typed (as in the sheet).
          { ...lRow, formula: "L = a · n", input: undefined, hint: "Amplària de l'entrebigat × nombre d'entrebigats. Càrrega uniforme de les biguetes tallades.", aux: [AJUDA.carregaUniforme] },
          xRow,
          fRow,
        ],
      },
      {
        title: "Dades del perfil",
        rows: [
          { label: "Nombre de perfils", value: n, unit: "ut", decimals: 0, input: { type: "num", key: "nPerfils", decimals: 0, integer: true } },
          { label: "Nom del perfil", value: d.perfil, input: { type: "profile", key: "perfil", byType: true } },
        ],
      },
      { title: "Característiques del perfil", rows: [...acerRows(d, sd, td), ...seccioRows(sec, n)] },
    ],
  };

  const comprovacio = comprovacioSection("Comprovació del trencallums principal", { L, x, fAdm, E, sd, td, Ix: sec.Ix, Wx: sec.Wx, Aa: sec.Aa, qEls: est.qEls, qElu: est.qElu });
  return { carregues, section, comprovacio, qEls: est.qEls, qElu: est.qElu, L };
}

// ---- 3: biga de suport ----

// The joist checks' steel rows (acerRows) with the support beam's own keys.
const SUPORT_KEYS: Record<string, string> = { E: "ESuport", sk: "skSuport", gk: "gkSuport" };
function rekey(rows: Row[]): Row[] {
  return rows.map((r) => (r.input?.type === "num" && SUPORT_KEYS[r.input.key] ? { ...r, input: { ...r.input, key: SUPORT_KEYS[r.input.key] } } : r));
}

function suport(d: TrencallumsDades, t: { qEls: number; qElu: number; L: number }) {
  // The trencallums' end reaction, a point load at midspan (N).
  const pEls = (t.qEls * t.L) / 2;
  const pElu = (t.qElu * t.L) / 2;

  const LAuto = num(d.amplada) * 2 * 1000; // mm, the joist span
  const L = d.LSuport != null ? num(d.LSuport) : LAuto;
  const x = num(d.limitLSuport);
  const fAdm = div(L, x);
  const n = num(d.nSuport);
  const sec = seccio(d.perfilSuport, n);
  const E = num(d.ESuport);
  const sd = div(num(d.skSuport), num(d.gkSuport));
  const td = sd == null ? null : sd / Math.sqrt(3);
  const [lRow, xRow, fRow] = geometriaRows(L, x, fAdm);
  const reaccio = "Reacció a l'extrem del trencallums principal (Lt: la seva llum)";

  const section: Section = {
    key: "suport",
    title: "Biga de suport (trencallums secundari, paral·lel a les biguetes)",
    enabled: true,
    blocks: [
      {
        title: "Dades de càrrega",
        rows: [
          { label: "Càrrega puntual sense majorar (estat límit de servei)", formula: "P ELS = Q ELS · Lt / 2", sym: "P ELS", value: pEls, unit: "N", hint: reaccio, alt: { value: pEls / G, unit: "kg" } },
          { label: "Càrrega puntual majorada (estat límit últim)", formula: "P ELU = Q ELU · Lt / 2", sym: "P ELU", value: pElu, unit: "N", hint: reaccio, alt: { value: pElu / G, unit: "kg" } },
        ],
      },
      {
        title: "Dades geomètriques",
        rows: [
          {
            ...lRow,
            input: { type: "num", key: "LSuport", decimals: 0, auto: LAuto },
            hint: "Per defecte, la llum de les biguetes: 2 × amplària de càrrega del sostre. Càrrega puntual al centre.",
            aux: [AJUDA.carregaPuntual],
          },
          { ...xRow, input: { type: "num", key: "limitLSuport", decimals: 0 } },
          fRow,
        ],
      },
      {
        title: "Dades del perfil",
        rows: [
          { label: "Nombre de perfils", value: n, unit: "ut", decimals: 0, input: { type: "num", key: "nSuport", decimals: 0, integer: true } },
          { label: "Nom del perfil", value: d.perfilSuport, input: { type: "profile", key: "perfilSuport", byType: true } },
        ],
      },
      { title: "Característiques del perfil", rows: [...rekey(acerRows({ E: d.ESuport, sk: d.skSuport, gk: d.gkSuport }, sd, td)), ...seccioRows(sec, n)] },
    ],
  };

  const { Ix, Wx, Aa } = sec;
  const fD = Ix != null && Ix > 0 && E > 0 ? (pEls * Math.pow(L, 3)) / (48 * E * Ix) : null;
  const ratioL = div(L, fD);
  const mElu = (pElu * L) / 4;
  const sElu = div(mElu, Wx);
  const tElu = div(pElu / 2, Aa);
  const comb = sElu != null && tElu != null ? Math.sqrt(sElu * sElu + 3 * tElu * tElu) : null;

  const comprovacio: Section = {
    key: "comprovacioSuport",
    title: "Comprovació de la biga de suport",
    enabled: true,
    blocks: [
      {
        title: "Estats límits de servei (E.L.S.)",
        rows: [
          { label: "Deformació del perfil", formula: "f D = P ELS · L³ / (48 · E0 · Ix)", sym: "f D", value: fD, unit: "mm", check: check(fD, "<", fAdm, "mm") },
          { label: "Amb aquesta deformació la fletxa és equivalent a…", sym: "L /", value: ratioL, decimals: 0, check: check(ratioL, ">", x, "", 0) },
        ],
      },
      {
        title: "Estats límits últims (E.L.U.)",
        rows: [
          { label: "Moment màxim flector de càlcul", formula: "M max ELU = P ELU · L / 4", sym: "M max ELU", value: mElu, unit: "N·mm", decimals: 0, alt: { value: mElu / 1e6, unit: "kN·m" } },
          { label: "Tensió per moment flector", formula: "σ max ELU = M max ELU / Wx", sym: "σ max ELU", value: sElu, unit: "N/mm²", check: check(sElu, "<", sd, "N/mm²") },
          { label: "Tensió per esforç tallant", formula: "τ max ELU = (P ELU / 2) / Aa", sym: "τ max ELU", value: tElu, unit: "N/mm²", check: check(tElu, "<", td, "N/mm²") },
          { label: "Fórmula combinada", formula: "C = √(σ² + 3 · τ²)", sym: "C", value: comb, unit: "N/mm²", check: check(comb, "<", sd, "N/mm²") },
        ],
      },
    ],
  };

  return { section, comprovacio, pEls, pElu };
}

// ---- 4: passadors a la paret de càrrega ----

function passadors(d: TrencallumsDades, pElu: number): Section {
  const V = pElu / 2; // N, at each end of the support beam
  const nP = num(d.nPassadors);
  const dn = num(d.dPassador);
  const lp = num(d.lPassador);
  const aap = nP * dn * lp; // mm²
  const fk = fabricaFd(num(d.k), num(d.fb), num(d.fm), 1); // fd with γM = 1
  const fd = fabricaFd(num(d.k), num(d.fb), num(d.fm), num(d.gM));
  const S = div(V, aap);
  const fabrica = fabricaRows(d as unknown as Record<string, unknown>, fd);
  const fkRow: Row = {
    label: "Resistència característica a compressió de la fàbrica",
    formula: "fk = K · fb^0,65 · fm^0,25",
    sym: "fk",
    value: fk,
    unit: "N/mm²",
    alt: { value: fk == null ? null : fk * NMM2_TO_KGCM2, unit: "kg/cm²" },
  };

  return {
    key: "passadors",
    title: "Passadors a la paret de càrrega",
    enabled: true,
    blocks: [
      { title: "Dades de càrrega", rows: [{ label: "Esforç tallant a cada extrem", formula: "V = P ELU / 2", sym: "V", value: V, unit: "N", alt: { value: V / G, unit: "kg" } }] },
      {
        title: "Dades passadors",
        rows: [
          { label: "Nombre de passadors", sym: "N", value: nP, unit: "ut", decimals: 0, input: { type: "num", key: "nPassadors", decimals: 0, integer: true } },
          { label: "Diàmetre del trepant del passador", sym: "DN", value: dn, unit: "mm", input: { type: "num", key: "dPassador", decimals: 2 }, alt: { value: dn / 10, unit: "cm" } },
          { label: "Longitud del trepant del passador", sym: "L", value: lp, unit: "mm", input: { type: "num", key: "lPassador", decimals: 2 }, alt: { value: lp / 10, unit: "cm" } },
          { label: "Àrea de contacte dels passadors", formula: "Aap = N · DN · L", sym: "Aap", value: aap, unit: "mm²", alt: { value: aap / 100, unit: "cm²" } },
        ],
      },
      // K, fb, fm, γM, then fk and fd (the sheet's order).
      { title: "Paret de càrrega de suport", rows: [...fabrica.slice(0, 4), fkRow, ...fabrica.slice(4)] },
      {
        title: "Resultats tensió suport paret de càrrega",
        rows: [
          { label: "Tensió en la paret de càrrega de suport", formula: "S = V / Aap", sym: "S", value: S, unit: "N/mm²", check: check(S, "<", fd, "N/mm²"), alt: { value: S == null ? null : S * NMM2_TO_KGCM2, unit: "kg/cm²" } },
        ],
      },
    ],
  };
}

export function computeTrencallums(raw: Partial<TrencallumsDades>): CalcResult {
  const d = { ...trencallumsDefaults(), ...raw } as TrencallumsDades;
  const t = principal(d);
  const s = suport(d, t);
  return { sections: [t.carregues, t.section, t.comprovacio, s.section, s.comprovacio, passadors(d, s.pElu)] };
}

// Profile inputs (by key) → the catalogue profiles that pass. Trencallums:
// every check of its comprovació, each profile with its own catalogue
// self-weight (unless typed in). Support beam: every check of its comprovació
// under the current trencallums' reaction.
export function trencallumsPerfilsValids(raw: Partial<TrencallumsDades>): Record<string, Set<string>> {
  const d = { ...trencallumsDefaults(), ...raw } as TrencallumsDades;
  const t = principal(d);
  const perfil = new Set<string>();
  const perfilSuport = new Set<string>();
  for (const g of perfilOptions())
    for (const name of g.names) {
      if (passes(principal({ ...d, perfil: name }).comprovacio)) perfil.add(name);
      if (passes(suport({ ...d, perfilSuport: name }, t).comprovacio)) perfilSuport.add(name);
    }
  return { perfil, perfilSuport };
}
