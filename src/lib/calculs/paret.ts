// Justificació de càlcul: biga d'estintolament d'una paret de càrrega.
// Port of "Justificació de Càlcul Estintolament Paret de Càrrega.xls":
// weighted load state → steel beam check (E.L.S. / E.L.U.) → bearing at the
// ends (A connectors, B concrete pads, C jamb profiles) → esnelles / passadors.
//
// Differences from the spreadsheet, on purpose:
// - Each check compares against the value the sheet prints next to it. In the
//   sheet, the E.L.S. / E.L.U. capacity checks compared against floor type 1
//   only, the jamb check reused the beam's bending check, and the esnella
//   shear check was a typed "OK!".
// - The end reaction is q·L/2 in N, converted to kg with 9,81. The sheet
//   divided by 10 and multiplied back by 9,81, which lowered it by ~2 %.
// - The beam's self-weight defaults to the catalogue weight of the chosen
//   profile (n · p · 9,81/1000 kN/ml) instead of 0,3 kN/ml per profile; it can
//   still be typed in.

import {
  type CalcResult,
  type LoadGroup,
  type LoadLine,
  type Row,
  type Section,
  G,
  NMM2_TO_KGCM2,
  check,
  div,
  fabricaFd,
  fabricaRows,
  num,
} from "./common";
import { perfilProps } from "./perfils";

export interface Sostre {
  nom: string;
  nombre: number;
  amplada: number; // m (tributary width)
  pp: number; // kN/m², pes propi estructural
  cp: number; // paviments i morter
  envans: number;
  gG: number; // γ permanents
  us: number; // sobrecàrrega d'ús
  neu: number;
  vent: number;
  gUs: number;
  gNeu: number;
  gVent: number;
}

export interface ParetDades {
  ppPerfil: number | null; // kN/ml; null → from the catalogue
  gPerfil: number;
  paretGruix: number; // m
  paretAlcada: number; // m
  paretPes: number; // kN/m³
  gParet: number;
  sostres: Sostre[];
  L: number; // mm
  limitL: number; // deflection limit L/x
  nPerfils: number;
  perfil: string;
  E: number; // N/mm²
  sk: number; // N/mm²
  gM0: number;
  gMur: number; // mm, thickness of the supporting wall
  k: number;
  fb: number;
  fm: number;
  gM: number;
  optA: boolean;
  nConn: number;
  dn: number; // cm
  de: number; // cm
  lBarra: number; // cm
  rBarra: number; // kg/cm²
  optB: boolean;
  aDau: number; // mm
  optC: boolean;
  nBrancal: number;
  perfilBrancal: string;
  skBrancal: number;
  gM0Brancal: number;
  optE: boolean;
  nEsnelles: number;
  perfilEsnella: string;
  bEsnella: number | null; // mm; null → flange width from the catalogue
  nPassadors: number;
  dPassador: number; // mm
  lEsnella: number; // mm
}

export function newSostre(n: number): Sostre {
  return { nom: `Sostre tipus ${n}`, nombre: 1, amplada: 0, pp: 0, cp: 0, envans: 0, gG: 1.35, us: 0, neu: 0, vent: 0, gUs: 1.5, gNeu: 1.5, gVent: 1.5 };
}

// Defaults: the values of David's template spreadsheet.
export function paretDefaults(): ParetDades {
  return {
    ppPerfil: null,
    gPerfil: 1.35,
    paretGruix: 0.15,
    paretAlcada: 18,
    paretPes: 18,
    gParet: 1.35,
    sostres: [
      { nom: "Sostre tipus 1", nombre: 5.5, amplada: 3.57, pp: 1.7, cp: 2, envans: 1, gG: 1.35, us: 2, neu: 0, vent: 0, gUs: 1.5, gNeu: 1.5, gVent: 1.5 },
      { nom: "Sostre tipus 2", nombre: 1, amplada: 3.57, pp: 1.7, cp: 2, envans: 0, gG: 1.35, us: 1, neu: 0.4, vent: 0, gUs: 1.5, gNeu: 1.5, gVent: 1.5 },
    ],
    L: 2400,
    limitL: 1000,
    nPerfils: 2,
    perfil: "UPN 320",
    E: 210000,
    sk: 275,
    gM0: 1.05,
    gMur: 300,
    k: 0.6,
    fb: 15,
    fm: 10,
    gM: 2.2,
    optA: true,
    nConn: 10,
    dn: 1.6,
    de: 2,
    lBarra: 15,
    rBarra: 5100,
    optB: true,
    aDau: 500,
    optC: true,
    nBrancal: 1,
    perfilBrancal: "UPN 140",
    skBrancal: 275,
    gM0Brancal: 1.05,
    optE: true,
    nEsnelles: 9,
    perfilEsnella: "HEB 100",
    bEsnella: null,
    nPassadors: 0,
    dPassador: 20,
    lEsnella: 1300,
  };
}

function line(label: string, q: number, width: number, gamma: number, keys: { q?: string; width?: string; gamma?: string }, units = { q: "kN/m²", width: "m" }): LoadLine {
  const unf = q * width;
  return { label, q, qUnit: units.q, width, widthUnit: units.width, unf, gamma, fac: unf * gamma, qKey: keys.q, widthKey: keys.width, gammaKey: keys.gamma };
}

export function computeParet(raw: Partial<ParetDades>): CalcResult {
  const d = { ...paretDefaults(), ...raw } as ParetDades;
  const dd = d as unknown as Record<string, unknown>;

  // ---- Estat de càrregues ponderat ----
  const nPerfils = num(d.nPerfils);
  const beam = perfilProps(d.perfil);
  const ppAuto = beam?.p != null ? (nPerfils * beam.p * G) / 1000 : null;
  const pp = d.ppPerfil ?? ppAuto ?? 0;

  const groups: LoadGroup[] = [];
  const lPerfil: LoadLine = { label: "Pes propi del perfil a calcular", q: pp, qUnit: "kN/ml", qAuto: ppAuto, width: null, unf: pp, gamma: num(d.gPerfil), fac: pp * num(d.gPerfil), qKey: "ppPerfil", gammaKey: "gPerfil" };
  groups.push({ title: "Accions permanents · perfil d'estintolament", lines: [{ line: lPerfil }] });

  const paretArea = num(d.paretGruix) * num(d.paretAlcada);
  const lParet: LoadLine = {
    label: "Pes propi de les parets de càrrega superiors",
    q: num(d.paretPes),
    qUnit: "kN/m³",
    width: paretArea,
    widthUnit: "m²",
    unf: num(d.paretPes) * paretArea,
    gamma: num(d.gParet),
    fac: num(d.paretPes) * paretArea * num(d.gParet),
    qKey: "paretPes",
    gammaKey: "gParet",
  };
  groups.push({
    title: "Accions permanents · paret de càrrega",
    lines: [
      { param: { label: "Gruix de la paret de càrrega", value: num(d.paretGruix), unit: "m", key: "paretGruix" } },
      { param: { label: "Alçària de la paret de càrrega", value: num(d.paretAlcada), unit: "m", key: "paretAlcada" } },
      { line: lParet },
    ],
  });

  (d.sostres ?? []).forEach((s, i) => {
    const w = num(s.amplada);
    const lines = [
      { heading: "Accions permanents" },
      { line: line("Pes propi estructural", num(s.pp), w, num(s.gG), { q: "pp", width: "amplada", gamma: "gG" }) },
      { line: line("Càrregues permanents de paviments i morter", num(s.cp), w, num(s.gG), { q: "cp" }) },
      { line: line("Càrregues permanents d'envans", num(s.envans), w, num(s.gG), { q: "envans" }) },
      { heading: "Accions variables" },
      { line: line("Sobrecàrrega d'ús", num(s.us), w, num(s.gUs), { q: "us", gamma: "gUs" }) },
      { line: line("Sobrecàrrega de neu", num(s.neu), w, num(s.gNeu), { q: "neu", gamma: "gNeu" }) },
      { line: line("Sobrecàrrega de vent", num(s.vent), w, num(s.gVent), { q: "vent", gamma: "gVent" }) },
    ];
    const ls = lines.map((l) => l.line).filter((l): l is LoadLine => !!l);
    const n = num(s.nombre);
    groups.push({
      title: s.nom || `Sostre tipus ${i + 1}`,
      count: n,
      lines,
      sostreIndex: i,
      total: {
        label: `Estat de càrregues ${s.nom || `sostre tipus ${i + 1}`}`,
        q: ls.reduce((a, l) => a + (l.q ?? 0), 0),
        unf: ls.reduce((a, l) => a + (l.unf ?? 0), 0) * n,
        fac: ls.reduce((a, l) => a + (l.fac ?? 0), 0) * n,
      },
    });
  });

  const qEls = (lPerfil.unf ?? 0) + (lParet.unf ?? 0) + groups.reduce((a, g) => a + (g.total?.unf ?? 0), 0); // kN/ml = N/mm
  const qElu = (lPerfil.fac ?? 0) + (lParet.fac ?? 0) + groups.reduce((a, g) => a + (g.total?.fac ?? 0), 0);

  const carregues: Section = {
    key: "carregues",
    title: "Estat de càrregues ponderat",
    enabled: true,
    blocks: [],
    loads: { groups, totalUnf: qEls, totalFac: qElu },
  };

  // ---- Perfil d'estintolament ----
  const L = num(d.L);
  const x = num(d.limitL);
  const fAdm = div(L, x);
  const E = num(d.E);
  const sd = div(num(d.sk), num(d.gM0));
  const td = sd == null ? null : sd / Math.sqrt(3);
  const Ix = beam?.Ix != null ? nPerfils * beam.Ix * 1e4 : null; // mm⁴
  const Wx = beam?.Wx != null ? nPerfils * beam.Wx * 1e3 : null; // mm³
  const Aa = beam?.h1 != null && beam?.tw != null ? nPerfils * beam.h1 * beam.tw : null; // mm²

  const perfil: Section = {
    key: "perfil",
    title: "Entrada de dades del perfil d'estintolament",
    enabled: true,
    blocks: [
      {
        title: "Dades geomètriques",
        rows: [
          { label: "Llum, distància entre recolzaments", sym: "L", value: L, unit: "mm", input: { type: "num", key: "L", decimals: 2 }, alt: { value: L / 1000, unit: "m" } },
          { label: "Limitació de deformació (fletxa màxima admissible)", sym: "L /", value: x, decimals: 0, input: { type: "num", key: "limitL", decimals: 0 } },
          { label: "Deformació (fletxa) màxima admissible", formula: "f adm = L / x", sym: "f adm", value: fAdm, unit: "mm", alt: { value: fAdm == null ? null : fAdm / 10, unit: "cm" } },
        ],
      },
      {
        title: "Dades del perfil",
        rows: [
          { label: "Nombre de perfils", value: nPerfils, unit: "ut", decimals: 0, input: { type: "num", key: "nPerfils", decimals: 0, integer: true } },
          { label: "Perfil", value: d.perfil, input: { type: "profile", key: "perfil" } },
        ],
      },
      {
        title: "Característiques del perfil",
        rows: [
          { label: "Mòdul d'elasticitat", sym: "E", value: E, unit: "N/mm²", input: { type: "num", key: "E", decimals: 2 }, alt: { value: E * NMM2_TO_KGCM2, unit: "kg/cm²" } },
          { label: "Límit elàstic característic de l'acer", sym: "σk", value: num(d.sk), unit: "N/mm²", input: { type: "num", key: "sk", decimals: 2 }, alt: { value: num(d.sk) * NMM2_TO_KGCM2, unit: "kg/cm²" }, hint: "S235: 235 · S275: 275 · S355: 355 N/mm² (t ≤ 16 mm)" },
          { label: "Coeficient de minoració del material", sym: "γM0", value: num(d.gM0), input: { type: "num", key: "gM0", decimals: 2 } },
          { label: "Resistència de càlcul del material", formula: "σd = σk / γM0", sym: "σd", value: sd, unit: "N/mm²", alt: { value: sd == null ? null : sd * NMM2_TO_KGCM2, unit: "kg/cm²" } },
          { label: "Coeficient de minoració per a esforços tangencials", sym: "√3", value: Math.sqrt(3) },
          { label: "Resistència de càlcul a esforços tangencials", formula: "τd = σd / √3", sym: "τd", value: td, unit: "N/mm²", alt: { value: td == null ? null : td * NMM2_TO_KGCM2, unit: "kg/cm²" } },
          { label: "Moment d'inèrcia", formula: nPerfils !== 1 ? `${nPerfils} × Ix` : undefined, sym: "Ix", value: Ix, unit: "mm⁴", alt: { value: Ix == null ? null : Ix / 1e4, unit: "cm⁴" } },
          { label: "Mòdul resistent", formula: nPerfils !== 1 ? `${nPerfils} × Wx` : undefined, sym: "Wx", value: Wx, unit: "mm³", alt: { value: Wx == null ? null : Wx / 1e3, unit: "cm³" } },
          { label: "Àrea de l'ànima", formula: `Aa = ${nPerfils !== 1 ? `${nPerfils} × ` : ""}e × h1`, sym: "Aa", value: Aa, unit: "mm²", alt: { value: Aa == null ? null : Aa / 100, unit: "cm²" } },
        ],
      },
    ],
  };

  // ---- Comprovació del perfil ----
  const I = Ix;
  const qMaxEls = fAdm != null && I != null && L > 0 ? (fAdm * 384 * E * I) / (5 * Math.pow(L, 4)) : null;
  const fD = I != null && E > 0 && I > 0 ? (5 * qEls * Math.pow(L, 4)) / (384 * E * I) : null;
  const ratioL = div(L, fD);
  const qMaxMf = sd != null && Wx != null && L > 0 ? (8 * sd * Wx) / (L * L) : null;
  const mElu = (qElu * L * L) / 8;
  const sElu = div(mElu, Wx);
  const qMaxV = td != null && Aa != null && L > 0 ? (2 * td * Aa) / L : null;
  const tElu = div((qElu * L) / 2, Aa);
  const comb = sElu != null && tElu != null ? Math.sqrt(sElu * sElu + 3 * tElu * tElu) : null;
  const pct = (a: number | null, b: number) => (a == null || b === 0 ? null : (a / b) * 100);

  const comprovacio: Section = {
    key: "comprovacio",
    title: "Comprovació del perfil d'estintolament",
    enabled: true,
    blocks: [
      {
        title: "Estats límits de servei (E.L.S.)",
        rows: [
          { label: "Capacitat de càrrega per deformació", formula: "Q max ELS = f adm · 384 · E · Ix / (5 · L⁴)", sym: "Q max ELS", value: qMaxEls, unit: "N/mm", check: check(qMaxEls, ">", qEls, "kN/ml") },
          { label: "Respecte a la sol·licitació E.L.S., la capacitat de càrrega representa…", value: pct(qMaxEls, qEls), unit: "%", check: check(pct(qMaxEls, qEls), ">", 100, "%") },
          { label: "Deformació del perfil", formula: "f D = 5 · Q ELS · L⁴ / (384 · E · Ix)", sym: "f D", value: fD, unit: "mm", check: check(fD, "<", fAdm, "mm") },
          { label: "Amb aquesta deformació la fletxa és equivalent a…", sym: "L /", value: ratioL, decimals: 0, check: check(ratioL, ">", x, "", 0) },
        ],
      },
      {
        title: "Estats límits últims (E.L.U.)",
        rows: [
          { label: "Capacitat de càrrega per moment flector", formula: "Q max Mf ELU = 8 · σd · Wx / L²", sym: "Q max Mf", value: qMaxMf, unit: "N/mm", check: check(qMaxMf, ">", qElu, "kN/ml") },
          { label: "Respecte a la sol·licitació E.L.U., la capacitat de càrrega representa…", value: pct(qMaxMf, qElu), unit: "%", check: check(pct(qMaxMf, qElu), ">", 100, "%") },
          { label: "Moment flector màxim de càlcul", formula: "M ELU = Q ELU · L² / 8", sym: "M ELU", value: mElu, unit: "N·mm", alt: { value: mElu / 1e6, unit: "kN·m" } },
          { label: "Tensió per moment flector", formula: "σ ELU = M ELU / Wx", sym: "σ ELU", value: sElu, unit: "N/mm²", check: check(sElu, "<", sd, "N/mm²") },
          { label: "Capacitat de càrrega per esforç tallant", formula: "Q max V ELU = 2 · τd · Aa / L", sym: "Q max V", value: qMaxV, unit: "N/mm", check: check(qMaxV, ">", qElu, "kN/ml") },
          { label: "Respecte a la sol·licitació E.L.U., la capacitat de càrrega representa…", value: pct(qMaxV, qElu), unit: "%", check: check(pct(qMaxV, qElu), ">", 100, "%") },
          { label: "Tensió per esforç tallant", formula: "τ ELU = (Q ELU · L / 2) / Aa", sym: "τ ELU", value: tElu, unit: "N/mm²", check: check(tElu, "<", td, "N/mm²") },
          { label: "Fórmula combinada", formula: "C = √(σ² + 3 · τ²)", sym: "C", value: comb, unit: "N/mm²", check: check(comb, "<", sd, "N/mm²") },
        ],
      },
      {
        title: "Coeficients de seguretat",
        rows: [
          { label: "Per deformació", formula: "γD = Q max ELS / Q ELS", sym: "γD", value: div(qMaxEls, qEls), check: check(div(qMaxEls, qEls), ">", 1, "", 0) },
          { label: "Per moment flector", formula: "γMf = Q max Mf ELU / Q ELS", sym: "γMf", value: div(qMaxMf, qEls), check: check(div(qMaxMf, qEls), ">", 1, "", 0) },
          { label: "Per esforç tallant", formula: "γV = Q max V ELU / Q ELS", sym: "γV", value: div(qMaxV, qEls), check: check(div(qMaxV, qEls), ">", 1, "", 0) },
        ],
      },
    ],
  };

  // ---- Fàbrica de suport (shared by A, B and the esnelles) ----
  const gMur = num(d.gMur);
  const fd = fabricaFd(num(d.k), num(d.fb), num(d.fm), num(d.gM));
  const fdKg = fd == null ? null : fd * NMM2_TO_KGCM2;
  const rN = (qElu * L) / 2; // N, at each end
  const rKg = rN / G;
  const reaccioRow: Row = { label: "Esforç tallant a cada extrem", formula: "V = Q ELU · L / 2", sym: "V ELU", value: rN, unit: "N", alt: { value: rKg, unit: "kg" } };

  const fabrica: Section = {
    key: "fabrica",
    title: "Paret de càrrega de suport",
    enabled: true,
    reference: ["fabrica"],
    blocks: [
      {
        rows: [
          { label: "Gruix de la paret de càrrega de suport", sym: "G", value: gMur, unit: "mm", input: { type: "num", key: "gMur", decimals: 2 }, alt: { value: gMur / 10, unit: "cm" } },
          ...fabricaRows(dd, fd),
          reaccioRow,
        ],
      },
    ],
  };

  // ---- Opció A: connectors ----
  const nConn = num(d.nConn);
  const dn = num(d.dn);
  const de = num(d.de);
  const lBarra = num(d.lBarra);
  const aBarra = (Math.PI * dn * dn) / 4; // cm²
  const aTaladre = de * lBarra; // cm²
  const sB = div(rKg, nConn * aBarra);
  const sBLim = num(d.rBarra) / Math.sqrt(3);
  const sP = div(rKg, nConn * aTaladre);
  const optA: Section = {
    key: "optA",
    title: "Opció A · Connectors travessers a la paret de càrrega als extrems de la biga",
    toggle: "optA",
    enabled: d.optA !== false,
    blocks: [
      {
        title: "Dades dels connectors",
        rows: [
          { label: "Nombre de connectors", sym: "N", value: nConn, unit: "ut", decimals: 0, input: { type: "num", key: "nConn", decimals: 0, integer: true } },
          { label: "Diàmetre nominal dels connectors", sym: "DN", value: dn, unit: "cm", input: { type: "num", key: "dn", decimals: 2 }, alt: { value: dn * 10, unit: "mm" } },
          { label: "Àrea nominal de cada barra", formula: "Ab = π · DN² / 4", sym: "Ab", value: aBarra, unit: "cm²", alt: { value: aBarra * 100, unit: "mm²" } },
          { label: "Diàmetre efectiu del trepant", sym: "DE", value: de, unit: "cm", input: { type: "num", key: "de", decimals: 2 }, alt: { value: de * 10, unit: "mm" } },
          { label: "Longitud de la barra", sym: "Lb", value: lBarra, unit: "cm", input: { type: "num", key: "lBarra", decimals: 2 }, alt: { value: lBarra * 10, unit: "mm" } },
          { label: "Àrea efectiva de cada trepant i barra", formula: "At = DE · Lb", sym: "At", value: aTaladre, unit: "cm²", alt: { value: aTaladre * 100, unit: "mm²" } },
        ],
      },
      {
        title: "Dades de càrrega",
        rows: [
          { ...reaccioRow, value: rKg, unit: "kg", alt: { value: rN, unit: "N" } },
          { label: "Resistència de la barra", sym: "R", value: num(d.rBarra), unit: "kg/cm²", input: { type: "num", key: "rBarra", decimals: 2 } },
        ],
      },
      {
        title: "Resultats barres i suports",
        rows: [
          { label: "Tensió en el connector", formula: "SB = V / (N · Ab) < R / √3", sym: "SB", value: sB, unit: "kg/cm²", check: check(sB, "<", sBLim, "kg/cm²") },
          { label: "Tensió en la paret de càrrega de suport", formula: "SP = V / (N · At) < fd", sym: "SP", value: sP, unit: "kg/cm²", check: check(sP, "<", fdKg, "kg/cm²") },
        ],
      },
    ],
  };

  // ---- Opció B: daus de formigó ----
  const aDau = num(d.aDau);
  const aap = gMur * aDau; // mm²
  const sApeu = div(rN, aap);
  const sParet = div(qElu, gMur); // N/mm ÷ mm
  const sTotal = sApeu != null && sParet != null ? sApeu + sParet : null;
  const optB: Section = {
    key: "optB",
    title: "Opció B · Daus de formigó en massa a la paret de càrrega als extrems de la biga",
    toggle: "optB",
    enabled: d.optB !== false,
    blocks: [
      {
        title: "Dades del dau",
        rows: [
          { label: "Gruix de la paret de càrrega", sym: "G", value: gMur, unit: "mm", alt: { value: gMur / 10, unit: "cm" } },
          { label: "Amplària del dau de formigó", sym: "A", value: aDau, unit: "mm", input: { type: "num", key: "aDau", decimals: 2 }, alt: { value: aDau / 10, unit: "cm" } },
          { label: "Àrea nominal de cada dau de formigó", formula: "Aap = G · A", sym: "Aap", value: aap, unit: "mm²", alt: { value: aap / 100, unit: "cm²" } },
        ],
      },
      { title: "Dades de càrrega", rows: [reaccioRow] },
      {
        title: "Resultats tensió paret",
        rows: [
          { label: "Increment de tensió per l'estintolament", formula: "V ELU / Aap", sym: "σ1", value: sApeu, unit: "N/mm²", check: check(sApeu, "<", fd, "N/mm²") },
          { label: "Tensió de la paret sense estintolament", formula: "Q ELU / G", sym: "σ2", value: sParet, unit: "N/mm²", check: check(sParet, "<", fd, "N/mm²") },
          { label: "Tensió total a la paret", formula: "σ1 + σ2", sym: "σ", value: sTotal, unit: "N/mm²", check: check(sTotal, "<", fd, "N/mm²") },
        ],
      },
    ],
  };

  // ---- Opció C: brancals ----
  const nBr = num(d.nBrancal);
  const brancal = perfilProps(d.perfilBrancal);
  const aBr = brancal?.A != null ? brancal.A * 100 : null; // mm²
  const sdBr = div(num(d.skBrancal), num(d.gM0Brancal));
  const sBr = aBr == null ? null : div(rN, nBr * aBr);
  const optC: Section = {
    key: "optC",
    title: "Opció C · Reforç dels brancals de la paret de càrrega als extrems de la biga",
    toggle: "optC",
    enabled: d.optC !== false,
    blocks: [
      {
        title: "Perfils dels brancals",
        rows: [
          { label: "Nombre de perfils a cada brancal", value: nBr, unit: "ut", decimals: 0, input: { type: "num", key: "nBrancal", decimals: 0, integer: true } },
          { label: "Perfil dels brancals", value: d.perfilBrancal, input: { type: "profile", key: "perfilBrancal" } },
          { label: "Límit elàstic característic de l'acer", sym: "σk", value: num(d.skBrancal), unit: "N/mm²", input: { type: "num", key: "skBrancal", decimals: 2 }, alt: { value: num(d.skBrancal) * NMM2_TO_KGCM2, unit: "kg/cm²" } },
          { label: "Coeficient de minoració del material", sym: "γM0", value: num(d.gM0Brancal), input: { type: "num", key: "gM0Brancal", decimals: 2 } },
          { label: "Resistència de càlcul del material", formula: "σd = σk / γM0", sym: "σd", value: sdBr, unit: "N/mm²", alt: { value: sdBr == null ? null : sdBr * NMM2_TO_KGCM2, unit: "kg/cm²" } },
          { label: "Secció del perfil", sym: "S", value: aBr, unit: "mm²", alt: { value: aBr == null ? null : aBr / 100, unit: "cm²" } },
        ],
      },
      { title: "Dades de càrrega", rows: [{ ...reaccioRow, label: "Esforç tallant al brancal" }] },
      {
        title: "Resultats perfils",
        rows: [{ label: "Tensió al perfil", formula: "σ = V ELU / (ut · S)", sym: "σ ELU", value: sBr, unit: "N/mm²", check: check(sBr, "<", sdBr, "N/mm²") }],
      },
    ],
  };

  // ---- Esnelles i passadors ----
  const nE = num(d.nEsnelles);
  const nP = num(d.nPassadors);
  const esn = perfilProps(d.perfilEsnella);
  const bAuto = esn?.b ?? null;
  const bE = d.bEsnella ?? bAuto ?? 0;
  const dP = num(d.dPassador);
  const aEsn = gMur * bE;
  const aPass = gMur * dP;
  const sTreball = div(qElu * L, nE * aEsn + nP * aPass);
  const tesat = sTreball == null ? null : (aPass * sTreball * 2) / G; // kg
  const lEsn = num(d.lEsnella);
  const qEsn = div((qElu * L) / 1000, nE + nP); // kN, point load on each esnella
  const IxE = esn?.Ix != null ? esn.Ix * 1e4 : null;
  const WxE = esn?.Wx != null ? esn.Wx * 1e3 : null;
  const AaE = esn?.h1 != null && esn?.tw != null ? esn.h1 * esn.tw : null;
  const mEsn = qEsn == null ? null : (qEsn * 1000 * lEsn) / 4;
  const sEsn = div(mEsn, WxE);
  const tEsn = qEsn == null ? null : div((qEsn * 1000) / 2, AaE);
  const optE: Section = {
    key: "optE",
    title: "Dimensionat i càlcul d'esnelles i travessers",
    toggle: "optE",
    enabled: d.optE !== false,
    blocks: [
      {
        title: "Nombre de travessers o passadors perpendiculars",
        rows: [
          { label: "Tensió de càlcul de la paret", sym: "fd", value: fd, unit: "N/mm²", alt: { value: fdKg, unit: "kg/cm²" } },
          { label: "Càrrega uniformement repartida màxima majorada (E.L.U.)", sym: "Q ELU", value: qElu, unit: "N/mm", alt: { value: (qElu * 1000) / G, unit: "kg/ml" } },
          { label: "Gruix del mur", sym: "G", value: gMur, unit: "mm", alt: { value: gMur / 10, unit: "cm" } },
        ],
      },
      {
        title: "Dades esnelles",
        rows: [
          { label: "Nombre d'esnelles", value: nE, unit: "ut", decimals: 0, input: { type: "num", key: "nEsnelles", decimals: 0, integer: true } },
          { label: "Perfil de les esnelles", value: d.perfilEsnella, input: { type: "profile", key: "perfilEsnella" } },
          { label: "Amplària de l'ala superior de les esnelles", sym: "b", value: bE, unit: "mm", input: { type: "num", key: "bEsnella", decimals: 2, auto: bAuto }, alt: { value: bE / 10, unit: "cm" } },
          { label: "Distància entre esnelles", formula: "L / (n + 1)", value: div(L, nE + 1), unit: "mm", alt: { value: div(L, (nE + 1) * 10), unit: "cm" } },
          { label: "Àrea de contacte de cada esnella", formula: "G · b", value: aEsn, unit: "mm²", alt: { value: aEsn / 100, unit: "cm²" } },
        ],
      },
      {
        title: "Dades passadors",
        rows: [
          { label: "Nombre de passadors", value: nP, unit: "ut", decimals: 0, input: { type: "num", key: "nPassadors", decimals: 0, integer: true } },
          { label: "Diàmetre dels passadors roscats", sym: "Ø", value: dP, unit: "mm", input: { type: "num", key: "dPassador", decimals: 2 }, alt: { value: dP / 10, unit: "cm" } },
          { label: "Distància entre passadors", formula: "L / (n + 1)", value: div(L, nP + 1), unit: "mm", alt: { value: div(L, (nP + 1) * 10), unit: "cm" } },
          { label: "Àrea de contacte de cada passador", formula: "G · Ø", value: aPass, unit: "mm²", alt: { value: aPass / 100, unit: "cm²" } },
          { label: "Tensió de tesat", formula: "2 · Ap · σ / 9,81", value: tesat, unit: "kg", alt: { value: tesat == null ? null : tesat * G, unit: "N" } },
        ],
      },
      {
        title: "Resultats tensió suport paret de càrrega",
        rows: [
          { label: "Tensió de treball", formula: "Q ELU · L / (nE · AE + nP · AP)", sym: "σ", value: sTreball, unit: "N/mm²", check: check(sTreball, "<", fd, "N/mm²") },
        ],
      },
      {
        title: "Comprovació tensional de les esnelles · perfil travesser amb càrrega puntual",
        rows: [
          { label: "Llum, longitud total entre recolzaments", sym: "L", value: lEsn, unit: "mm", input: { type: "num", key: "lEsnella", decimals: 2 } },
          { label: "Moment d'inèrcia", sym: "Ix", value: IxE, unit: "mm⁴", alt: { value: IxE == null ? null : IxE / 1e4, unit: "cm⁴" } },
          { label: "Mòdul resistent", sym: "Wx", value: WxE, unit: "mm³", alt: { value: WxE == null ? null : WxE / 1e3, unit: "cm³" } },
          { label: "Àrea de l'ànima", formula: "Aa = e · h1", sym: "Aa", value: AaE, unit: "mm²", alt: { value: AaE == null ? null : AaE / 100, unit: "cm²" } },
          { label: "Càrrega puntual a cada esnella", formula: "Q = Q ELU · L / (nE + nP)", sym: "Q", value: qEsn, unit: "kN" },
          { label: "Moment flector màxim de càlcul", formula: "M = Q · L / 4", sym: "M", value: mEsn, unit: "N·mm", alt: { value: mEsn == null ? null : mEsn / 1e6, unit: "kN·m" } },
          { label: "Tensió per moment flector", formula: "σ = M / Wx", sym: "σ", value: sEsn, unit: "N/mm²", check: check(sEsn, "<", sd, "N/mm²") },
          { label: "Tensió per esforç tallant", formula: "τ = (Q / 2) / Aa", sym: "τ", value: tEsn, unit: "N/mm²", check: check(tEsn, "<", td, "N/mm²") },
        ],
      },
    ],
  };

  return { sections: [carregues, perfil, comprovacio, fabrica, optA, optB, optC, optE] };
}
