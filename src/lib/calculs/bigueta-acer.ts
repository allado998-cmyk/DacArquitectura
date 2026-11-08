// Comprovació de bigueta d'acer: an existing steel joist under a uniform load,
// checked for deflection (E.L.S.) and for bending, shear and the combined
// stress (E.L.U.). Ports of two of David's sheets that share every formula:
//   Comprovació Bigueta d'Acer Estandard.xls  → computeBiguetaAcer
//     (any IPE / IPN / HEA / HEB / HEM / UPN, n profiles, from the catalogue)
//   Comprovació Bigueta d'Acer Ala Estreta.xls → computeBiguetaAcerAla
//     (old narrow-flange beams: Ix, Wx and the web typed in from the Torras
//     catalogue image David pastes in the sheet; here they can also be picked)
//
// Notes on the sheets:
// - The profile data of the standard sheet ('Dades Perfils') is the same
//   catalogue as perfils.ts: identical for the example (UPN 300) and for
//   every UPN, HEB and HEA up to 600; it rounds h1 to 0,1 mm where the
//   catalogue gives whole mm (IPE / IPN) and has a few typos (HEB 600 Wx 5790,
//   HEM 200 Ix 10642, HEM 280 Wx 2500, IPE 120 Ix 316, …). HE 650–1000 are
//   not in the catalogue.
// - The self-weight line is typed in the sheets (0,5 kN/ml); here it
//   defaults to the catalogue weight (n · p · 9,81/1000), as in paret.ts, and
//   can still be typed. In the narrow-flange sheet David notes that this value
//   "comes from the image and the chosen profile".
// - Narrow flange: the web area is labelled "Aa = e × h1" but the example
//   typed 120 × 5,1, the full height of an IPN 120 (h1 = 92 mm). The app keeps
//   the labelled formula with h1 and e as inputs (from the chosen profile, or
//   typed); typing h1 = 120 gives the sheet's example.
// - The narrow-flange sheet's deflection check shows #REF! as its limit
//   (L56); the check itself (J56) compares with f adm, as here.
// - Text slips in the sheets, fixed in the labels: "Q MAX Mf ELU" as the
//   symbol of the shear capacity, "Q MIN ELU" in the deflection formula of the
//   narrow-flange sheet (it uses the unfactored load), "γD = Q MAX D ELU / Q MAX
//   ELS". The conversion column uses 9,81 (the sheets multiply by 10 or 100;
//   L43 even shows 275 N/mm² as 27,5 kg/cm²).

import { type CalcResult, type LoadLine, type Row, type Section, G, NMM2_TO_KGCM2, check, div, num } from "./common";
import { perfilOptions, perfilProps } from "./perfils";
import { type CarreguesDades, AJUDA_BIGUETES, carreguesDefaults, estatCarregues } from "./bigueta-carregues";
import torras from "./biguetes/ala-estreta-torras.json";

interface AcerComu extends CarreguesDades {
  ppPerfil: number | null; // kN/ml; null → from the profile's weight
  gPerfil: number;
  L: number; // mm
  limitL: number; // L / x
  E: number; // N/mm²
  sk: number; // N/mm²
  gk: number; // γ, coeficient de minoració del material
}

export interface BiguetaAcerDades extends AcerComu {
  nPerfils: number;
  perfil: string;
}

export interface BiguetaAcerAlaDades extends AcerComu {
  perfil: string; // a Torras or IPN profile, or MANUAL
  Ix: number | null; // cm⁴; null → from the profile
  Wx: number | null; // cm³
  h1: number | null; // mm, web height for the shear area
  e: number | null; // mm, web thickness
}

// Defaults: the example of each sheet.
export function biguetaAcerDefaults(): BiguetaAcerDades {
  return {
    ...carreguesDefaults({ amplada: 1.084, pp: 5, cp: 2, envans: 1, us: 2 }),
    ppPerfil: null,
    gPerfil: 1.35,
    L: 5630,
    limitL: 500,
    nPerfils: 1,
    perfil: "UPN 300",
    E: 210000,
    sk: 275,
    gk: 1.05,
  };
}

export function biguetaAcerAlaDefaults(): BiguetaAcerAlaDades {
  return {
    ...carreguesDefaults({ amplada: 0.6, pp: 2, cp: 1, envans: 1, us: 2 }),
    ppPerfil: null,
    gPerfil: 1.35,
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
  };
}

// ---- shared rows ----

function perfilLine(pp: number, ppAuto: number | null | undefined, gPerfil: number): LoadLine {
  return { label: "Pes propi del perfil a calcular", q: pp, qUnit: "kN/ml", qAuto: ppAuto, width: null, unf: pp, gamma: gPerfil, fac: pp * gPerfil, qKey: "ppPerfil", gammaKey: "gPerfil" };
}

function geometriaRows(L: number, x: number, fAdm: number | null): Row[] {
  return [
    { label: "Llum, distància entre recolzaments", sym: "L", value: L, unit: "mm", decimals: 0, input: { type: "num", key: "L", decimals: 0 }, alt: { value: L / 1000, unit: "m" } },
    { label: "Limitació de deformació (fletxa màxima admissible)", sym: "L /", value: x, decimals: 0, input: { type: "num", key: "limitL", decimals: 0 } },
    { label: "Deformació (fletxa) màxima admissible", formula: "f adm = L / x", sym: "f adm", value: fAdm, unit: "mm", alt: { value: fAdm == null ? null : fAdm / 10, unit: "cm" } },
  ];
}

function acerRows(d: AcerComu, sd: number | null, td: number | null): Row[] {
  const E = num(d.E);
  const sk = num(d.sk);
  return [
    { label: "Mòdul d'elasticitat", sym: "E0", value: E, unit: "N/mm²", decimals: 0, input: { type: "num", key: "E", decimals: 0 }, alt: { value: E * NMM2_TO_KGCM2, unit: "kg/cm²", decimals: 0 } },
    { label: "Límit elàstic característic de l'acer", sym: "σk", value: sk, unit: "N/mm²", input: { type: "num", key: "sk", decimals: 2 }, alt: { value: sk * NMM2_TO_KGCM2, unit: "kg/cm²" }, hint: "S235: 235 · S275: 275 · S355: 355 N/mm² (t ≤ 16 mm)" },
    { label: "Coeficient de minoració del material", sym: "γk", value: num(d.gk), input: { type: "num", key: "gk", decimals: 2 } },
    { label: "Resistència de càlcul del material", formula: "σd = σk / γk", sym: "σd", value: sd, unit: "N/mm²", alt: { value: sd == null ? null : sd * NMM2_TO_KGCM2, unit: "kg/cm²" } },
    { label: "Coeficient de minoració del material per a esforços tangencials", sym: "√3", value: Math.sqrt(3), decimals: 4 },
    { label: "Resistència de càlcul a esforços tangencials", formula: "τd = σd / √3", sym: "τd", value: td, unit: "N/mm²", alt: { value: td == null ? null : td * NMM2_TO_KGCM2, unit: "kg/cm²" } },
  ];
}

const pct = (a: number | null, b: number) => (a == null || b === 0 ? null : (a / b) * 100);

// «Comprovació perfil existent»: E.L.S., E.L.U. and the safety factors.
// Ix in mm⁴, Wx in mm³, Aa in mm²; loads in N/mm.
function comprovacioSection(title: string, p: { L: number; x: number; fAdm: number | null; E: number; sd: number | null; td: number | null; Ix: number | null; Wx: number | null; Aa: number | null; qEls: number; qElu: number }): Section {
  const { L, x, fAdm, E, sd, td, Ix, Wx, Aa, qEls, qElu } = p;
  const qMaxEls = fAdm != null && Ix != null && L > 0 ? (fAdm * 384 * E * Ix) / (5 * Math.pow(L, 4)) : null;
  const fD = Ix != null && E > 0 && Ix > 0 ? (5 * qEls * Math.pow(L, 4)) / (384 * E * Ix) : null;
  const ratioL = div(L, fD);
  const qMaxMf = sd != null && Wx != null && L > 0 ? (8 * sd * Wx) / (L * L) : null;
  const mElu = (qElu * L * L) / 8;
  const sElu = div(mElu, Wx);
  const qMaxV = td != null && Aa != null && L > 0 ? (2 * td * Aa) / L : null;
  const tElu = div((qElu * L) / 2, Aa);
  const comb = sElu != null && tElu != null ? Math.sqrt(sElu * sElu + 3 * tElu * tElu) : null;
  const gD = div(qMaxEls, qEls);
  const gMf = div(qMaxMf, qElu);
  const gV = div(qMaxV, qElu);
  return {
    key: "comprovacio",
    title,
    enabled: true,
    blocks: [
      {
        title: "Estats límits de servei (E.L.S.)",
        rows: [
          { label: "Capacitat de càrrega per deformació", formula: "Q max ELS = f adm · 384 · E0 · Ix / (5 · L⁴)", sym: "Q max ELS", value: qMaxEls, unit: "N/mm", check: check(qMaxEls, ">", qEls, "kN/ml") },
          { label: "Respecte a la sol·licitació màxima per complir E.L.S., la capacitat de càrrega representa…", value: pct(qMaxEls, qEls), unit: "%", check: check(pct(qMaxEls, qEls), ">", 100, "%") },
          { label: "Deformació del perfil", formula: "f D = 5 · Q ELS · L⁴ / (384 · E0 · Ix)", sym: "f D", value: fD, unit: "mm", check: check(fD, "<", fAdm, "mm") },
          { label: "Amb aquesta deformació la fletxa és equivalent a…", sym: "L /", value: ratioL, decimals: 0, check: check(ratioL, ">", x, "", 0) },
        ],
      },
      {
        title: "Estats límits últims (E.L.U.)",
        rows: [
          { label: "Capacitat de càrrega per moment flector", formula: "Q max Mf ELU = 8 · σd · Wx / L²", sym: "Q max Mf", value: qMaxMf, unit: "N/mm", check: check(qMaxMf, ">", qElu, "kN/ml") },
          { label: "Respecte a la sol·licitació màxima per complir E.L.U., la capacitat de càrrega representa…", value: pct(qMaxMf, qElu), unit: "%", check: check(pct(qMaxMf, qElu), ">", 100, "%") },
          { label: "Moment màxim flector de càlcul", formula: "M max ELU = Q ELU · L² / 8", sym: "M max ELU", value: mElu, unit: "N·mm", decimals: 0, alt: { value: mElu / 1e6, unit: "kN·m" } },
          { label: "Tensió per moment flector", formula: "σ max ELU = M max ELU / Wx", sym: "σ max ELU", value: sElu, unit: "N/mm²", check: check(sElu, "<", sd, "N/mm²") },
          { label: "Capacitat de càrrega per esforç tallant", formula: "Q max V ELU = 2 · τd · Aa / L", sym: "Q max V", value: qMaxV, unit: "N/mm", check: check(qMaxV, ">", qElu, "kN/ml") },
          { label: "Respecte a la sol·licitació màxima per complir E.L.U., la capacitat de càrrega representa…", value: pct(qMaxV, qElu), unit: "%", check: check(pct(qMaxV, qElu), ">", 100, "%") },
          { label: "Tensió per esforç tallant", formula: "τ max ELU = (Q ELU · L / 2) / Aa", sym: "τ max ELU", value: tElu, unit: "N/mm²", check: check(tElu, "<", td, "N/mm²") },
          { label: "Fórmula combinada", formula: "C = √(σ² + 3 · τ²)", sym: "C", value: comb, unit: "N/mm²", check: check(comb, "<", sd, "N/mm²") },
        ],
      },
      {
        title: "Coeficients de seguretat",
        rows: [
          { label: "Per deformació", formula: "γD = Q max ELS / Q ELS", sym: "γD", value: gD, check: check(gD, ">", 1, "", 0) },
          { label: "Per moment flector", formula: "γMf = Q max Mf ELU / Q ELU", sym: "γMf", value: gMf, check: check(gMf, ">", 1, "", 0) },
          { label: "Per esforç tallant", formula: "γV = Q max V ELU / Q ELU", sym: "γV", value: gV, check: check(gV, ">", 1, "", 0) },
        ],
      },
    ],
  };
}

const passes = (r: CalcResult) => {
  const s = r.sections.find((x) => x.key === "comprovacio");
  return !!s && s.blocks.every((b) => b.rows.every((row) => !row.check || row.check.ok));
};

// ---- bigueta d'acer estàndard ----

export function computeBiguetaAcer(raw: Partial<BiguetaAcerDades>): CalcResult {
  const d = { ...biguetaAcerDefaults(), ...raw } as BiguetaAcerDades;

  const n = num(d.nPerfils);
  const p = perfilProps(d.perfil);
  const ppAuto = p?.p != null ? (n * p.p * G) / 1000 : null;
  const pp = d.ppPerfil ?? ppAuto ?? 0;
  const est = estatCarregues(d, { perfil: perfilLine(pp, ppAuto, num(d.gPerfil)) });

  const carregues: Section = { key: "carregues", title: "Estat de càrregues inicial", enabled: true, blocks: [], loads: { groups: est.groups, totalUnf: est.qEls, totalFac: est.qElu } };

  const L = num(d.L);
  const x = num(d.limitL);
  const fAdm = div(L, x);
  const sd = div(num(d.sk), num(d.gk));
  const td = sd == null ? null : sd / Math.sqrt(3);
  const Ix = p?.Ix != null ? n * p.Ix * 1e4 : null; // mm⁴
  const Wx = p?.Wx != null ? n * p.Wx * 1e3 : null; // mm³
  const Aa = p?.h1 != null && p?.tw != null ? n * p.h1 * p.tw : null; // mm²
  const times = n !== 1 ? `${n} × ` : "";

  const perfil: Section = {
    key: "perfil",
    title: "Entrada de dades perfil existent d'acer estàndard",
    enabled: true,
    blocks: [
      { title: "Dades geomètriques", rows: geometriaRows(L, x, fAdm) },
      {
        title: "Dades del perfil",
        rows: [
          { label: "Nombre de perfils", value: n, unit: "ut", decimals: 0, input: { type: "num", key: "nPerfils", decimals: 0, integer: true } },
          { label: "Nom del perfil", value: d.perfil, input: { type: "profile", key: "perfil", byType: true }, hint: "Perfil laminat estàndard" },
        ],
      },
      {
        title: "Característiques del perfil",
        rows: [
          ...acerRows(d, sd, td),
          { label: "Moment d'inèrcia", formula: times ? `${times}Ix` : undefined, sym: "Ix", value: Ix, unit: "mm⁴", decimals: 0, alt: { value: Ix == null ? null : Ix / 1e4, unit: "cm⁴" } },
          { label: "Mòdul resistent", formula: times ? `${times}Wx` : undefined, sym: "Wx", value: Wx, unit: "mm³", decimals: 0, alt: { value: Wx == null ? null : Wx / 1e3, unit: "cm³" } },
          { label: "Àrea de l'ànima", formula: `Aa = ${times}e × h1`, sym: "Aa", value: Aa, unit: "mm²", alt: { value: Aa == null ? null : Aa / 100, unit: "cm²" } },
        ],
      },
    ],
  };

  const comprovacio = comprovacioSection("Comprovació perfil existent d'acer estàndard", { L, x, fAdm, E: num(d.E), sd, td, Ix, Wx, Aa, qEls: est.qEls, qElu: est.qElu });
  return { sections: [carregues, perfil, comprovacio] };
}

// The catalogue profiles that pass every check of «Comprovació perfil
// existent», each tried with its own catalogue self-weight (unless typed in).
export function biguetaAcerPerfilsValids(raw: Partial<BiguetaAcerDades>): Set<string> {
  const ok = new Set<string>();
  for (const g of perfilOptions()) for (const name of g.names) if (passes(computeBiguetaAcer({ ...raw, perfil: name }))) ok.add(name);
  return ok;
}

// ---- bigueta d'acer d'ala estreta ----

export const MANUAL = "manual";

interface AlaPerfil {
  name: string;
  Ix: number | null; // cm⁴
  Wx: number | null; // cm³
  h1: number | null; // mm
  e: number | null; // mm
  p: number | null; // kg/m
}

// Torras first (the catalogue David pastes in the sheet), then the IPN.
const ALA_PERFILS: AlaPerfil[] = [
  ...torras.rows.map((r) => ({ name: r.name, Ix: r.Ix, Wx: r.Wx, h1: r.h1, e: r.d, p: r.p })),
  ...(perfilOptions(["ipn"])[0]?.names ?? []).map((name) => {
    const p = perfilProps(name);
    return { name, Ix: p?.Ix ?? null, Wx: p?.Wx ?? null, h1: p?.h1 ?? null, e: p?.tw ?? null, p: p?.p ?? null };
  }),
];

function alaPerfil(name: string): AlaPerfil | null {
  return ALA_PERFILS.find((p) => p.name === name) ?? null;
}

export function computeBiguetaAcerAla(raw: Partial<BiguetaAcerAlaDades>, markOptions = true): CalcResult {
  const d = { ...biguetaAcerAlaDefaults(), ...raw } as BiguetaAcerAlaDades;

  const cat = alaPerfil(d.perfil);
  const ppAuto = cat?.p != null ? (cat.p * G) / 1000 : undefined;
  const pp = d.ppPerfil ?? ppAuto ?? 0;
  const est = estatCarregues(d, { perfil: perfilLine(pp, ppAuto, num(d.gPerfil)) });
  const carregues: Section = { key: "carregues", title: "Estat de càrregues inicial", enabled: true, blocks: [], loads: { groups: est.groups, totalUnf: est.qEls, totalFac: est.qElu } };

  const L = num(d.L);
  const x = num(d.limitL);
  const fAdm = div(L, x);
  const sd = div(num(d.sk), num(d.gk));
  const td = sd == null ? null : sd / Math.sqrt(3);
  // Typed value, else the chosen profile's (MANUAL: no catalogue value).
  const pick = (v: number | null | undefined, auto: number | null | undefined) => (v != null ? num(v) : auto ?? null);
  const IxCm = pick(d.Ix, cat?.Ix);
  const WxCm = pick(d.Wx, cat?.Wx);
  const h1 = pick(d.h1, cat?.h1);
  const e = pick(d.e, cat?.e);
  const Ix = IxCm == null ? null : IxCm * 1e4; // mm⁴
  const Wx = WxCm == null ? null : WxCm * 1e3; // mm³
  const Aa = h1 == null || e == null ? null : h1 * e; // mm²
  const auto = (v: number | null | undefined) => (cat ? v ?? null : undefined);

  // The picker marks the profiles that pass with their own catalogue values.
  const options = [...ALA_PERFILS.map((p) => p.name), MANUAL].map((name) => {
    if (name === MANUAL) return { value: MANUAL, label: "Altres · dades escrites a mà" };
    const ok = markOptions && passes(computeBiguetaAcerAla({ ...raw, perfil: name, Ix: null, Wx: null, h1: null, e: null }, false));
    return { value: name, label: ok ? `${name}  ✓` : name };
  });

  const perfil: Section = {
    key: "perfil",
    title: "Entrada de dades perfil existent d'acer d'ala estreta",
    enabled: true,
    blocks: [
      { title: "Dades geomètriques", rows: geometriaRows(L, x, fAdm) },
      {
        title: "Dades del perfil",
        rows: [
          {
            label: "Nom del perfil",
            value: d.perfil === MANUAL ? "Dades escrites a mà" : d.perfil,
            input: { type: "select", key: "perfil", options },
            hint: "Ix, Wx, l'ànima i el pes surten del catàleg (Torras o IPN) i es poden escriure a mà. ✓: compleix amb els valors del catàleg.",
            aux: [AJUDA_BIGUETES.torras],
          },
        ],
      },
      {
        title: "Característiques del perfil",
        rows: [
          ...acerRows(d, sd, td),
          { label: "Moment d'inèrcia", sym: "Ix", value: IxCm, unit: "cm⁴", input: { type: "num", key: "Ix", decimals: 2, auto: auto(cat?.Ix) }, alt: { value: Ix, unit: "mm⁴", decimals: 0 } },
          { label: "Mòdul resistent", sym: "Wx", value: WxCm, unit: "cm³", input: { type: "num", key: "Wx", decimals: 2, auto: auto(cat?.Wx) }, alt: { value: Wx, unit: "mm³", decimals: 0 } },
          { label: "Alçària de l'ànima", sym: "h1", value: h1, unit: "mm", input: { type: "num", key: "h1", decimals: 1, auto: auto(cat?.h1) } },
          { label: "Gruix de l'ànima", sym: "e", value: e, unit: "mm", input: { type: "num", key: "e", decimals: 1, auto: auto(cat?.e) } },
          { label: "Àrea de l'ànima", formula: "Aa = e × h1", sym: "Aa", value: Aa, unit: "mm²", alt: { value: Aa == null ? null : Aa / 100, unit: "cm²" } },
        ],
      },
    ],
  };

  const comprovacio = comprovacioSection("Comprovació perfil existent d'acer d'ala estreta", { L, x, fAdm, E: num(d.E), sd, td, Ix, Wx, Aa, qEls: est.qEls, qElu: est.qElu });
  return { sections: [carregues, perfil, comprovacio] };
}
