// Justificació: recolzament de la base d'un pilar d'estintolament.
// Port of "Justificació Comprovació Recolzament Base Pilar Estintolament.xls":
// the pillar's axial load (from CYPE) spreads at 60° through the sleeper
// (dorment) into the load-bearing wall; checks the wall stress under it.

import { type CalcResult, type Section, G, NMM2_TO_KGCM2, check, div, fabricaFd, fabricaRows, num } from "./common";

export interface PilarDades {
  aUpn: number; // cm, width of the UPN arriving at the base
  pletina: number; // cm, reinforcing plate under the UPN
  cantell: number; // cm, sleeper depth (slab thickness)
  gParet: number; // cm
  N: number; // kg, axial (CYPE)
  k: number;
  fb: number;
  fm: number;
  gM: number;
}

export function pilarDefaults(): PilarDades {
  return { aUpn: 6, pletina: 20, cantell: 5, gParet: 15, N: 6811, k: 0.6, fb: 10, fm: 5, gM: 2.5 };
}

const COT60 = 1 / Math.tan(Math.PI / 3); // cos 60° / sin 60° = 0,577

export function computePilar(raw: Partial<PilarDades>): CalcResult {
  const d = { ...pilarDefaults(), ...raw } as PilarDades;
  const dd = d as unknown as Record<string, unknown>;

  const a = num(d.aUpn);
  const p = num(d.pletina);
  const c = num(d.cantell);
  const gP = num(d.gParet);
  const lef = a + p + 2 * c * COT60; // cm
  const aap = lef * gP; // cm²
  const N = num(d.N);
  const fd = fabricaFd(num(d.k), num(d.fb), num(d.fm), num(d.gM));
  const fdKg = fd == null ? null : fd * NMM2_TO_KGCM2;
  const s = div(N, aap);

  const base: Section = {
    key: "base",
    title: "Base de formigó en massa als extrems de l'estintolament",
    enabled: true,
    reference: ["pilar60"],
    blocks: [
      {
        title: "Base",
        rows: [
          { label: "Amplada de la UPN d'arribada a la base", sym: "a", value: a, unit: "cm", input: { type: "num", key: "aUpn", decimals: 2 }, alt: { value: a * 10, unit: "mm" } },
          { label: "Pletina de reforç a la base de la UPN", sym: "p", value: p, unit: "cm", input: { type: "num", key: "pletina", decimals: 2 }, alt: { value: p * 10, unit: "mm" } },
          { label: "Cantell del dorment (gruix del forjat)", sym: "c", value: c, unit: "cm", input: { type: "num", key: "cantell", decimals: 2 }, alt: { value: c * 10, unit: "mm" } },
          { label: "cos 60° / sin 60°", value: COT60, decimals: 3 },
          { label: "Longitud efectiva de contacte (repartiment a 60°)", formula: "Lef = a + p + 2 · c · cos 60° / sin 60°", sym: "Lef", value: lef, unit: "cm", alt: { value: lef * 10, unit: "mm" } },
          { label: "Gruix de la paret de càrrega", sym: "G", value: gP, unit: "cm", input: { type: "num", key: "gParet", decimals: 2 }, alt: { value: gP * 10, unit: "mm" } },
          { label: "Àrea nominal", formula: "Aap = Lef · G", sym: "Aap", value: aap, unit: "cm²", alt: { value: aap * 100, unit: "mm²" } },
        ],
      },
      {
        title: "Dades de càlcul",
        rows: [{ label: "Axial del pilar (segons CYPE)", sym: "N ELU", value: N, unit: "kg", input: { type: "num", key: "N", decimals: 2 }, alt: { value: N * G, unit: "N" } }],
      },
    ],
  };

  const fabrica: Section = {
    key: "fabrica",
    title: "Paret de càrrega de suport",
    enabled: true,
    reference: ["fabrica"],
    blocks: [
      { rows: fabricaRows(dd, fd) },
      {
        title: "Resultats de la tensió de la paret",
        rows: [{ label: "Tensió a la base", formula: "σ = N ELU / Aap", sym: "σ", value: s, unit: "kg/cm²", alt: { value: s == null ? null : s / NMM2_TO_KGCM2, unit: "N/mm²" }, check: check(s, "<", fdKg, "kg/cm²") }],
      },
    ],
  };

  return { sections: [base, fabrica] };
}
