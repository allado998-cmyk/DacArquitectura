// Comprovació de bigueta de fusta i resistència al foc.
// Port of "Comprovació Bigueta de Fusta i Resistència al Foc.xls": a
// rectangular timber joist (B × H) under a uniform load, checked
//   1. at E.L.U. for bending and shear (fm,d = kmod · kh · fm,k / γM,
//      fv,d = kmod · fv,k / γM, τ = 1,5 · V / (kcr · B · H), kcr = 0,67), and
//      at E.L.S. for the three deflection limits of CTE DB SE 4.3.3.1
//      (integritat, confort, aparença) with creep (kdef) and ψ2;
//   2. in fire, by the reduced cross-section method: def = βn · t + k0 · d0,
//      burnt on three faces (B − 2·def, H − def), with the fire load
//      coefficients and kmod,fi · kfi · fm,k / γM,fi.
// The timber classes (fm,k, fv,k, E0,mean, ρmean, βn) are the sheet's 'Dades
// Perfils' (biguetes/fusta-classes.json); kdef, kmod and kh were typed in on
// the 'Dades ' sheet after looking them up in its tables, which here give the
// default of each (it can still be typed).
//
// Notes on the sheet:
// - The effective charring depth def (H140) is typed (55 mm), not computed
//   from its label "def = dchar,n + k0 · d0"; with the example (0,8 · 60 + 1 · 7)
//   it is the same 55 mm. Here it is computed, so RF, βn, k0 and d0 act on it.
//   βn was typed too (0,8): here it defaults to the class's value.
// - K def CV (H57) is shown but no formula uses it: the creep of the
//   variable loads (Wact, Wnet,fin) uses ψ2 · K def P. Kept as in the sheet.
// - ψ2 C.P. = 1 (H92) is shown and not used (it multiplies nothing).
// - Density: the sheet shows ρm / 100 as "N/mm³" (3,8) and ρm as "kg/cm³"
//   (380); it is 380 kg/m³ (no formula uses it). E0 shows as 900 kg/cm² (/10
//   instead of ·10,19), the reduced Ix in cm⁴ is divided by 1000 (L144), and
//   the fire section's conversions (L152–L159) are typed stale numbers. The
//   conversion column here uses 9,81.
// - The fire section looked up the class in another workbook ('[2]Dades
//   Perfils' of BIGUETA NOVA FUSTA.xls, rows shifted by two); here both parts
//   read the same table. The fire "coeficient d'altura k f" (1,25) is kfi.
// - Moment units "N/MM" → N·mm; "I x = B x H4 / 12" and "W x = B x H3 / 6" in
//   the reduced section → H³ and H².

import { type CalcResult, type Row, type Section, G, NMM2_TO_KGCM2, check, div, fmt, num } from "./common";
import { type CarreguesDades, type CarreguesFocDades, type EstatCarregues, AJUDA_BIGUETES, CARREGUES_FOC_DEFAULT, carreguesDefaults, estatCarregues, kgMl } from "./bigueta-carregues";
import classes from "./biguetes/fusta-classes.json";

export interface BiguetaFustaDades extends CarreguesDades, CarreguesFocDades {
  L: number; // mm
  B: number; // mm
  H: number; // mm
  classe: string;
  servei: string; // classe de servei 1 | 2 | 3
  kdefP: number | null; // null → from the tables
  kdefCV: number | null;
  kmod: number | null;
  kh: number | null;
  gM: number;
  limitInt: number; // L / 500
  limitConf: number; // L / 350
  limitApar: number; // L / 300
  psi2: number; // ψ2 of the variable loads
  // fire
  betaN: number | null; // mm/min; null → from the class
  rf: number; // min
  k0: number;
  d0: number; // mm
  kmodFi: number;
  kfi: number;
  gMFi: number;
}

export interface FustaClasse {
  classe: string;
  tipus: string;
  fmk: number;
  fvk: number;
  e0: number; // kN/mm²
  rho: number; // kg/m³
  betaN: number; // mm/min
}
export const FUSTA_CLASSES: FustaClasse[] = classes.rows;

// 'Dades ' sheet: classes de servei, kdef (taula 4.1) and kmod (taula 3.6) of
// "Estructuras de madera. Diseño y cálculo".
export const CLASSES_SERVEI = [
  { value: "1", label: "Classe 1 · interior" },
  { value: "2", label: "Classe 2 · cobert obert" },
  { value: "3", label: "Classe 3 · exterior" },
];
const KDEF = { permanent: [0.6, 0.8, 2], llarga: [0.5, 0.5, 1.5], mitja: [0.25, 0.25, 0.75], curta: [0, 0, 0.3] };
const KMOD = { permanent: [0.6, 0.6, 0.5], llarga: [0.7, 0.7, 0.55], mitja: [0.8, 0.8, 0.65], curta: [0.9, 0.9, 0.7], instantania: [1.1, 1.1, 0.9] };

// Height factor: (150 / h)^0,2 for h < 150 mm, at most 1,3; 1 otherwise.
export function factorAltura(h: number): number {
  return h > 0 && h < 150 ? Math.min(Math.pow(150 / h, 0.2), 1.3) : 1;
}

export function biguetaFustaDefaults(): BiguetaFustaDades {
  return {
    ...carreguesDefaults({ amplada: 0.6, pp: 0.25, cp: 2.14, envans: 1, us: 2 }),
    ...CARREGUES_FOC_DEFAULT,
    L: 4680,
    B: 150,
    H: 220,
    classe: "C18",
    servei: "1",
    kdefP: null,
    kdefCV: null,
    kmod: null,
    kh: null,
    gM: 1.3,
    limitInt: 500,
    limitConf: 350,
    limitApar: 300,
    psi2: 0,
    betaN: null,
    rf: 60,
    k0: 1,
    d0: 7,
    kmodFi: 1,
    kfi: 1.25,
    gMFi: 1,
  };
}

const d2 = (v: number) => fmt(v, 2);

function resumRows(e: EstatCarregues): Row[] {
  const row = (label: string, sym: string, value: number, formula?: string): Row => ({ label, formula, sym, value, unit: "N/mm", decimals: 4, alt: { value: kgMl(value), unit: "kg/ml" } });
  return [
    row("Càrrega uniforme repartida sense majorar (càrregues permanents)", "Q C.P. ELS", e.cpEls),
    row("Càrrega uniforme repartida sense majorar (càrregues variables)", "Q C.V. ELS", e.cvEls),
    row("Càrrega uniforme sense majorar (estat límit de servei)", "Q ELS", e.cpEls + e.cvEls, "Q ELS = Q C.P. ELS + Q C.V. ELS"),
    row("Càrrega uniforme repartida majorada (càrregues permanents)", "Q C.P. ELU", e.cpElu),
    row("Càrrega uniforme repartida majorada (càrregues variables)", "Q C.V. ELU", e.cvElu),
    row("Càrrega uniforme majorada (estat límit últim)", "Q ELU", e.cpElu + e.cvElu, "Q ELU = Q C.P. ELU + Q C.V. ELU"),
  ];
}

// Section rows: A = B·H, Ix = B·H³/12, Wx = B·H²/6 (mm).
function seccio(B: number, H: number) {
  const ok = B > 0 && H > 0;
  return { A: ok ? B * H : null, Ix: ok ? (B * H * H * H) / 12 : null, Wx: ok ? (B * H * H) / 6 : null };
}
function seccioRows(s: ReturnType<typeof seccio>): Row[] {
  return [
    { label: "Àrea de la secció", formula: "A x = B × H", sym: "A x", value: s.A, unit: "mm²", decimals: 0, alt: { value: s.A == null ? null : s.A / 100, unit: "cm²" } },
    { label: "Moment d'inèrcia", formula: "I x = B × H³ / 12", sym: "I x", value: s.Ix, unit: "mm⁴", decimals: 0, alt: { value: s.Ix == null ? null : s.Ix / 1e4, unit: "cm⁴" } },
    { label: "Mòdul resistent", formula: "W x = B × H² / 6", sym: "W x", value: s.Wx, unit: "mm³", decimals: 0, alt: { value: s.Wx == null ? null : s.Wx / 1e3, unit: "cm³" } },
  ];
}

function fustaRows(c: FustaClasse | null, select: boolean): Row[] {
  return [
    select
      ? { label: "Classe de fusta", value: c?.classe ?? null, input: { type: "select", key: "classe", options: FUSTA_CLASSES.map((x) => ({ value: x.classe, label: `${x.classe} · ${x.tipus}` })) }, aux: [AJUDA_BIGUETES.classes] }
      : { label: "Classe de fusta", value: c?.classe ?? null },
    { label: "Tipus de fusta", value: c?.tipus ?? null },
    { label: "Densitat mitja", sym: "ρ m", value: c?.rho ?? null, unit: "kg/m³", decimals: 0, alt: { value: c ? (c.rho * G) / 1000 : null, unit: "kN/m³" } },
  ];
}

const kgcm2 = (v: number | null) => (v == null ? null : v * NMM2_TO_KGCM2);

// Bending check rows (moments from the permanent and variable loads).
function flexioRows(e: EstatCarregues, L: number, Wx: number | null, fmd: number | null): { rows: Row[]; M: number; sigma: number | null } {
  const mCp = (e.cpElu * L * L) / 8;
  const mCv = (e.cvElu * L * L) / 8;
  const M = mCp + mCv;
  const sigma = div(M, Wx);
  const idx = div(sigma, fmd);
  const mRow = (label: string, formula: string, sym: string, v: number): Row => ({ label, formula, sym, value: v, unit: "N·mm", decimals: 0, alt: { value: v / 1e6, unit: "kN·m", decimals: 3 } });
  return {
    M,
    sigma,
    rows: [
      mRow("Moment màxim flector de càlcul C.P.", "M C.P. ELU = Q C.P. ELU · L² / 8", "M C.P. ELU", mCp),
      mRow("Moment màxim flector de càlcul C.V.", "M C.V. ELU = Q C.V. ELU · L² / 8", "M C.V. ELU", mCv),
      mRow("Moment màxim flector total", "M ELU = M C.P. ELU + M C.V. ELU", "M ELU", M),
      { label: "Tensió per moment flector", formula: "σ ELU = M ELU / W x", sym: "σ ELU", value: sigma, unit: "N/mm²", decimals: 3, check: check(sigma, "<", fmd, "N/mm²", 3) },
      { label: "Comprovació a flexió (índex)", formula: "σ ELU / f m,d", value: idx, decimals: 3, check: check(idx, "<", 1, "", 0) },
    ],
  };
}

export function computeBiguetaFusta(raw: Partial<BiguetaFustaDades>): CalcResult {
  const d = { ...biguetaFustaDefaults(), ...raw } as BiguetaFustaDades;
  const c = FUSTA_CLASSES.find((x) => x.classe === d.classe) ?? null;
  const s = Math.min(Math.max(Math.round(num(d.servei, 1)), 1), 3) - 1; // 0..2

  // ---- Estat de càrregues inicial + resum ----
  const est = estatCarregues(d);
  const carregues: Section = { key: "carregues", title: "Estat de càrregues inicial", enabled: true, blocks: [], loads: { groups: est.groups, totalUnf: est.qEls, totalFac: est.qElu } };
  const resum: Section = { key: "resum", title: "Resum estat de càrregues inicial", enabled: true, blocks: [{ title: "Dades globals de l'estat de càrregues", rows: resumRows(est) }] };

  // ---- Entrada de dades perfil existent de fusta ----
  const L = num(d.L);
  const B = num(d.B);
  const H = num(d.H);
  const sec = seccio(B, H);
  const E0 = c ? c.e0 * 1000 : null; // N/mm²
  const kdefPAuto = KDEF.permanent[s];
  const kdefCVAuto = KDEF.mitja[s];
  const kmodAuto = KMOD.permanent[s];
  const khAuto = factorAltura(H);
  const kdefP = d.kdefP ?? kdefPAuto;
  const kdefCV = d.kdefCV ?? kdefCVAuto;
  const kmod = d.kmod ?? kmodAuto;
  const kh = d.kh ?? khAuto;
  const gM = num(d.gM);
  const fmk = c?.fmk ?? null;
  const fvk = c?.fvk ?? null;
  const fmd = fmk == null ? null : div(fmk * kmod * kh, gM);
  const fvd = fvk == null ? null : div(fvk * kmod, gM);

  const entrada: Section = {
    key: "perfil",
    title: "Entrada de dades perfil existent de fusta",
    enabled: true,
    blocks: [
      { title: "Dades geomètriques", rows: [{ label: "Llum, distància entre recolzaments", sym: "L", value: L, unit: "mm", decimals: 0, input: { type: "num", key: "L", decimals: 0 }, alt: { value: L / 1000, unit: "m" } }] },
      {
        title: "Dades del perfil",
        rows: [
          { label: "Base de la bigueta", sym: "B", value: B, unit: "mm", decimals: 0, input: { type: "num", key: "B", decimals: 0 }, alt: { value: B / 10, unit: "cm" } },
          { label: "Alçària de la bigueta", sym: "H", value: H, unit: "mm", decimals: 0, input: { type: "num", key: "H", decimals: 0 }, alt: { value: H / 10, unit: "cm" } },
          ...seccioRows(sec),
        ],
      },
      { title: "Dades del tipus de fusta", rows: fustaRows(c, true) },
      {
        title: "Propietats de la secció",
        rows: [
          { label: "Mòdul d'elasticitat mitjà", sym: "E 0", value: E0, unit: "N/mm²", decimals: 0, alt: { value: kgcm2(E0), unit: "kg/cm²", decimals: 0 } },
          {
            label: "Classe de servei",
            value: CLASSES_SERVEI[s].label,
            input: { type: "select", key: "servei", options: CLASSES_SERVEI },
            hint: "1: lloc cobert i tancat (espai interior) · 2: lloc cobert però obert (porxo…), piscines · 3: fusta a l'aire lliure. Dona els valors per defecte de K def i K mod.",
          },
          {
            label: "Factor de deformació càrregues permanents",
            sym: "K def P",
            value: kdefP,
            input: { type: "num", key: "kdefP", decimals: 2, auto: kdefPAuto },
            hint: `Permanent, classe de servei 1 / 2 / 3: ${KDEF.permanent.map(d2).join(" / ")}`,
          },
          {
            label: "Factor de deformació càrregues variables",
            sym: "K def CV",
            value: kdefCV,
            input: { type: "num", key: "kdefCV", decimals: 2, auto: kdefCVAuto },
            hint: `Mitja duració, classe de servei 1 / 2 / 3: ${KDEF.mitja.map(d2).join(" / ")}. Com al full, no entra a les fletxes (la fluència de les variables fa servir ψ2 · K def P).`,
          },
          { label: "Resistència característica a flexió", sym: "f m,k", value: fmk, unit: "N/mm²", alt: { value: kgcm2(fmk), unit: "kg/cm²" } },
          {
            label: "Coeficient de modificació",
            sym: "K mod",
            value: kmod,
            input: { type: "num", key: "kmod", decimals: 2, auto: kmodAuto },
            hint: `Classe de servei ${s + 1}: permanent ${d2(KMOD.permanent[s])} · llarga ${d2(KMOD.llarga[s])} · mitja ${d2(KMOD.mitja[s])} · curta ${d2(KMOD.curta[s])} · instantània ${d2(KMOD.instantania[s])}. Amb accions de diferent duració es pot prendre la de més curta duració.`,
            aux: [AJUDA_BIGUETES.kmod],
          },
          { label: "Coeficient d'altura", sym: "k h", value: kh, decimals: 4, input: { type: "num", key: "kh", decimals: 4, auto: khAuto }, hint: "h < 150 mm: kh = (150 / h)^0,2 ≤ 1,3 · h ≥ 150 mm: kh = 1" },
          { label: "Coeficient parcial de seguretat de minoració del material", sym: "γ k", value: gM, input: { type: "num", key: "gM", decimals: 2 }, aux: [AJUDA_BIGUETES.gammaM] },
          { label: "Resistència de càlcul del material a flexió", formula: "f m,d = K mod · k h · f m,k / γ k", sym: "f m,d", value: fmd, unit: "N/mm²", decimals: 4, alt: { value: kgcm2(fmd), unit: "kg/cm²" } },
          { label: "Resistència característica a tallant", sym: "f v,k", value: fvk, unit: "N/mm²" },
          { label: "Coeficient parcial de seguretat de minoració del material", sym: "γ k", value: gM },
          { label: "Resistència de càlcul del material a tallant", formula: "f v,d = K mod · f v,k / γ k", sym: "f v,d", value: fvd, unit: "N/mm²", decimals: 4, alt: { value: kgcm2(fvd), unit: "kg/cm²" } },
        ],
      },
    ],
  };

  // ---- Comprovació perfil existent de fusta ----
  const flex = flexioRows(est, L, sec.Wx, fmd);
  const vCp = (est.cpElu * L) / 2;
  const vCv = (est.cvElu * L) / 2;
  const V = vCp + vCv;
  const KCR = 0.67;
  const tau = B > 0 && H > 0 ? (1.5 * V) / (KCR * B * H) : null;
  const tIdx = div(tau, fvd);
  const vRow = (label: string, formula: string, sym: string, v: number): Row => ({ label, formula, sym, value: v, unit: "N", decimals: 1, alt: { value: v / 1000, unit: "kN", decimals: 3 } });

  const fl = (q: number) => (E0 != null && sec.Ix != null && E0 > 0 ? (5 * q * Math.pow(L, 4)) / (384 * E0 * sec.Ix) : null);
  const wG = fl(est.cpEls);
  const wQ = fl(est.cvEls);
  const fluencia = wG == null ? null : kdefP * wG;
  const xInt = num(d.limitInt);
  const xConf = num(d.limitConf);
  const xApar = num(d.limitApar);
  const fInt = div(L, xInt);
  const fConf = div(L, xConf);
  const fApar = div(L, xApar);
  const psi2 = num(d.psi2);
  const wAct = wG == null || wQ == null ? null : wQ + kdefP * wG + psi2 * kdefP * wQ;
  const wInst = wQ;
  const wNetFin = wG == null || wQ == null ? null : wG * (1 + kdefP) + psi2 * wQ * (1 + kdefP);
  const NO_COBERTA = "No procedeix en coberta.";
  const limitRows = (label: string, key: string, x: number, f: number | null, hint?: string): Row[] => [
    { label: `Fletxa màxima admissible per ${label}`, sym: "L /", value: x, decimals: 0, input: { type: "num", key, decimals: 0 }, hint, aux: [AJUDA_BIGUETES.fletxes] },
    { label: `Deformació màxima admissible per ${label}`, formula: `f adm = L / ${fmt(x, 0)}`, sym: "f adm", value: f, unit: "mm", alt: { value: f == null ? null : f / 10, unit: "cm" } },
  ];

  const comprovacio: Section = {
    key: "comprovacio",
    title: "Comprovació perfil existent de fusta",
    enabled: true,
    blocks: [
      {
        title: "Estats límits últims (E.L.U.)",
        rows: [
          ...flex.rows,
          vRow("Esforç tallant màxim càrregues permanents", "V C.P. ELU = Q C.P. ELU · L / 2", "V C.P. ELU", vCp),
          vRow("Esforç tallant màxim càrregues variables", "V C.V. ELU = Q C.V. ELU · L / 2", "V C.V. ELU", vCv),
          vRow("Esforç tallant màxim total", "V ELU = V C.P. ELU + V C.V. ELU", "V ELU", V),
          { label: "Tensió per esforç tallant", formula: "τ ELU = 1,5 · V ELU / (kcr · B · H), kcr = 0,67", sym: "τ ELU", value: tau, unit: "N/mm²", decimals: 3, check: check(tau, "<", fvd, "N/mm²") },
          { label: "Comprovació a tallant (índex)", formula: "τ ELU / f v,d", value: tIdx, decimals: 3, check: check(tIdx, "<", 1, "", 0) },
        ],
      },
      {
        title: "Estats límits de servei (E.L.S.)",
        rows: [
          { label: "Fletxa instantània càrregues permanents", formula: "WG inst = 5 · Q C.P. ELS · L⁴ / (384 · E0 · Ix)", sym: "WG inst", value: wG, unit: "mm", decimals: 3 },
          { label: "Fletxa instantània càrregues variables", formula: "WQ inst = 5 · Q C.V. ELS · L⁴ / (384 · E0 · Ix)", sym: "WQ inst", value: wQ, unit: "mm", decimals: 3 },
          { label: "Fluència de les càrregues permanents", formula: "WG · K def P", value: fluencia, unit: "mm", decimals: 3 },
        ],
      },
      {
        title: "Limitacions de deformacions",
        rows: [
          ...limitRows("integritat", "limitInt", xInt, fInt),
          ...limitRows("confort dels usuaris", "limitConf", xConf, fConf, NO_COBERTA),
          ...limitRows("aparença", "limitApar", xApar, fApar),
        ],
      },
      {
        title: "Coeficients de simultaneïtat",
        rows: [
          { label: "Càrregues permanents", sym: "ψ2 C.P.", value: 1 },
          { label: "Càrregues variables", sym: "ψ2 C.V.", value: psi2, input: { type: "num", key: "psi2", decimals: 2 }, aux: [AJUDA_BIGUETES.psi] },
        ],
      },
      {
        title: "Exigències o límits segons l'art. 4.3.3.1 de DB SE",
        rows: [
          { label: "Per integritat d'elements constructius", formula: "Wact = WQ + K def · WG + ψ2 · K def · WQ", sym: "Wact", value: wAct, unit: "mm", decimals: 3, check: check(wAct, "<", fInt, "mm") },
          { label: "Per confort dels usuaris", formula: "Winst = WQ", sym: "Winst", value: wInst, unit: "mm", decimals: 3, check: check(wInst, "<", fConf, "mm"), hint: NO_COBERTA },
          { label: "Per aparença de l'obra", formula: "Wnet,fin = WG · (1 + K def) + ψ2 · WQ · (1 + K def)", sym: "Wnet,fin", value: wNetFin, unit: "mm", decimals: 3, check: check(wNetFin, "<", fApar, "mm") },
        ],
      },
    ],
  };

  // ---- Foc ----
  const estFoc = estatCarregues(d, { mode: "foc" });
  const carreguesFoc: Section = { key: "carreguesFoc", title: "Estat de càrregues proposat en cas de foc", enabled: true, blocks: [], loads: { groups: estFoc.groups, totalUnf: estFoc.qEls, totalFac: estFoc.qElu } };
  const resumFoc: Section = { key: "resumFoc", title: "Resum estat de càrregues proposat en cas de foc", enabled: true, blocks: [{ title: "Dades globals de l'estat de càrregues", rows: resumRows(estFoc) }] };

  const betaNAuto = c?.betaN ?? null;
  const betaN = d.betaN ?? betaNAuto ?? 0;
  const rf = num(d.rf);
  const dChar = betaN * rf;
  const k0 = num(d.k0);
  const d0 = num(d.d0);
  const dEf = dChar + k0 * d0;
  const bFi = B - 2 * dEf;
  const hFi = H - dEf;
  const secFi = seccio(bFi, hFi);
  const cremada = !(bFi > 0 && hFi > 0);

  const entradaFoc: Section = {
    key: "perfilFoc",
    title: "Entrada de dades perfil antic de fusta a comprovar al foc",
    enabled: true,
    blocks: [
      { title: "Dades geomètriques", rows: [{ label: "Llum, distància entre recolzaments", sym: "L", value: L, unit: "mm", decimals: 0, alt: { value: L / 1000, unit: "m" } }] },
      {
        title: "Dades originals del perfil antic",
        rows: [
          { label: "Base de la bigueta", sym: "B", value: B, unit: "mm", decimals: 0, alt: { value: B / 10, unit: "cm" } },
          { label: "Alçària de la bigueta", sym: "H", value: H, unit: "mm", decimals: 0, alt: { value: H / 10, unit: "cm" } },
          ...seccioRows(sec),
        ],
      },
      {
        title: "Dades resultants aplicant foc de la secció reduïda",
        rows: [
          { label: "Velocitat nominal de carbonització", sym: "βn", value: betaN, unit: "mm/min", input: { type: "num", key: "betaN", decimals: 2, auto: betaNAuto }, aux: [AJUDA_BIGUETES.betaN] },
          { label: "Resistència al foc", sym: "RF", value: rf, unit: "min", decimals: 0, input: { type: "num", key: "rf", decimals: 0 } },
          { label: "Profunditat de carbonització nominal de càlcul", formula: "dchar,n = βn · RF", sym: "dchar,n", value: dChar, unit: "mm", alt: { value: dChar / 10, unit: "cm" } },
          { label: "Coeficient k0", sym: "k0", value: k0, input: { type: "num", key: "k0", decimals: 2 }, hint: "Superfícies no protegides: t < 20 min → t / 20 · t ≥ 20 min → 1,0", aux: [AJUDA_BIGUETES.seccioReduida] },
          { label: "Gruix de la capa sense resistència", sym: "d0", value: d0, unit: "mm", input: { type: "num", key: "d0", decimals: 1 } },
          { label: "Profunditat eficaç de carbonització", formula: "def = dchar,n + k0 · d0 = βn · RF + k0 · d0", sym: "def", value: dEf, unit: "mm", alt: { value: dEf / 10, unit: "cm" } },
          { label: "Base de la bigueta", formula: "B − 2 · def", sym: "B", value: bFi, unit: "mm", decimals: 1, alt: { value: bFi / 10, unit: "cm" }, hint: cremada ? "La secció es consumeix del tot amb aquesta resistència al foc." : undefined },
          { label: "Alçària de la bigueta", formula: "H − def", sym: "H", value: hFi, unit: "mm", decimals: 1, alt: { value: hFi / 10, unit: "cm" } },
          ...seccioRows(secFi),
        ],
      },
    ],
  };

  const kmodFi = num(d.kmodFi);
  const kfi = num(d.kfi);
  const gMFi = num(d.gMFi);
  const fmdFi = fmk == null ? null : div(fmk * kmodFi * kfi, gMFi);
  const flexFi = flexioRows(estFoc, L, secFi.Wx, fmdFi);
  const comprovacioFoc: Section = {
    key: "comprovacioFoc",
    title: "Comprovació del perfil amb la secció reduïda",
    enabled: true,
    blocks: [
      { title: "Dades resultants aplicant foc de la secció reduïda", rows: fustaRows(c, false) },
      {
        title: "Propietats de la secció",
        rows: [
          { label: "Mòdul d'elasticitat mitjà", sym: "E 0", value: E0, unit: "N/mm²", decimals: 0, alt: { value: kgcm2(E0), unit: "kg/cm²", decimals: 0 } },
          { label: "Resistència característica a flexió", sym: "f m,k", value: fmk, unit: "N/mm²", alt: { value: kgcm2(fmk), unit: "kg/cm²" } },
          { label: "Coeficient de modificació", sym: "K mod,fi", value: kmodFi, input: { type: "num", key: "kmodFi", decimals: 2 } },
          { label: "Coeficient kfi", sym: "k fi", value: kfi, input: { type: "num", key: "kfi", decimals: 2 }, hint: "Fusta massissa: 1,25 (al full, «coeficient d'altura k f»)" },
          { label: "Coeficient parcial de seguretat de minoració del material", sym: "γ k", value: gMFi, input: { type: "num", key: "gMFi", decimals: 2 }, hint: "Combinacions accidentals (incendi): 1,0", aux: [AJUDA_BIGUETES.gammaM] },
          { label: "Resistència de càlcul del material a flexió", formula: "f m,d = K mod,fi · k fi · f m,k / γ k", sym: "f m,d", value: fmdFi, unit: "N/mm²", decimals: 4, alt: { value: kgcm2(fmdFi), unit: "kg/cm²" } },
        ],
      },
      { title: "Estats límits últims (E.L.U.)", rows: flexFi.rows },
    ],
  };

  return { sections: [carregues, resum, entrada, comprovacio, carreguesFoc, resumFoc, entradaFoc, comprovacioFoc] };
}
