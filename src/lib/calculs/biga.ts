// Justificació: recolzament d'una biga amb daus o connectors.
// Port of "Justificació Comprovació Recolzament Biga amb Daus o Connectors.xls"
// (the printed part; the sheet's hidden beam check had broken references).
// Starting from the shear force at the support (from CYPE), it checks the
// masonry under a concrete pad and the connectors drilled through the wall.

import { type CalcResult, type Section, G, NMM2_TO_KGCM2, check, div, fabricaFd, fabricaRows, num } from "./common";

export interface BigaDades {
  V: number; // kg, esforç tallant (CYPE)
  k: number;
  fb: number;
  fm: number;
  gM: number;
  optDau: boolean;
  gParet: number; // cm
  aDau: number; // cm
  optConn: boolean;
  nConn: number;
  dn: number; // cm
  de: number; // cm
  lBarra: number; // cm
  rBarra: number; // kg/cm²
}

export function bigaDefaults(): BigaDades {
  return { V: 3917, k: 0.6, fb: 10, fm: 5, gM: 2.5, optDau: true, gParet: 15, aDau: 20, optConn: true, nConn: 8, dn: 1.6, de: 2, lBarra: 15, rBarra: 5100 };
}

export function computeBiga(raw: Partial<BigaDades>): CalcResult {
  const d = { ...bigaDefaults(), ...raw } as BigaDades;
  const dd = d as unknown as Record<string, unknown>;

  const V = num(d.V);
  const fd = fabricaFd(num(d.k), num(d.fb), num(d.fm), num(d.gM));
  const fdKg = fd == null ? null : fd * NMM2_TO_KGCM2;

  const carrega: Section = {
    key: "carrega",
    title: "Dades de càlcul",
    enabled: true,
    blocks: [{ rows: [{ label: "Esforç tallant al recolzament (segons CYPE)", sym: "V ELU", value: V, unit: "kg", input: { type: "num", key: "V", decimals: 2 }, alt: { value: V * G, unit: "N" } }] }],
  };

  const fabrica: Section = {
    key: "fabrica",
    title: "Paret de càrrega de suport",
    enabled: true,
    reference: ["fabrica"],
    blocks: [{ rows: fabricaRows(dd, fd) }],
  };

  const gP = num(d.gParet);
  const aDau = num(d.aDau);
  const aap = gP * aDau; // cm²
  const sDau = div(V, aap);
  const dau: Section = {
    key: "dau",
    title: "Daus de formigó en massa a la paret de càrrega als extrems de la biga",
    toggle: "optDau",
    enabled: d.optDau !== false,
    blocks: [
      {
        title: "Dades del dau",
        rows: [
          { label: "Gruix de la paret de càrrega", sym: "G", value: gP, unit: "cm", input: { type: "num", key: "gParet", decimals: 2 }, alt: { value: gP * 10, unit: "mm" } },
          { label: "Amplària del dau de formigó", sym: "A", value: aDau, unit: "cm", input: { type: "num", key: "aDau", decimals: 2 }, alt: { value: aDau * 10, unit: "mm" } },
          { label: "Àrea nominal de cada dau de formigó", formula: "Aap = G · A", sym: "Aap", value: aap, unit: "cm²", alt: { value: aap * 100, unit: "mm²" } },
        ],
      },
      {
        title: "Resultats tensió paret",
        rows: [{ label: "Tensió al dau (únicament estintolament)", formula: "V ELU / Aap", sym: "σ", value: sDau, unit: "kg/cm²", check: check(sDau, "<", fdKg, "kg/cm²") }],
      },
    ],
  };

  const nConn = num(d.nConn);
  const dn = num(d.dn);
  const de = num(d.de);
  const lBarra = num(d.lBarra);
  const aBarra = (Math.PI * dn * dn) / 4;
  const aTaladre = de * lBarra;
  const sB = div(V, nConn * aBarra);
  const sP = div(V, nConn * aTaladre);
  const conn: Section = {
    key: "conn",
    title: "Connectors travessers a la paret de càrrega als extrems de la biga",
    toggle: "optConn",
    enabled: d.optConn !== false,
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
          { label: "Esforç tallant", sym: "V ELU", value: V, unit: "kg", alt: { value: V * G, unit: "N" } },
          { label: "Resistència de la barra", sym: "R", value: num(d.rBarra), unit: "kg/cm²", input: { type: "num", key: "rBarra", decimals: 2 } },
          { label: "Tensió del suport", sym: "fd", value: fd, unit: "N/mm²", alt: { value: fdKg, unit: "kg/cm²" } },
        ],
      },
      {
        title: "Resultats barres i suports",
        rows: [
          { label: "Tensió en el connector", formula: "SB = V / (N · Ab) < R / √3", sym: "SB", value: sB, unit: "kg/cm²", check: check(sB, "<", num(d.rBarra) / Math.sqrt(3), "kg/cm²") },
          { label: "Tensió en la paret de càrrega de suport", formula: "SP = V / (N · At) < fd", sym: "SP", value: sP, unit: "kg/cm²", check: check(sP, "<", fdKg, "kg/cm²") },
        ],
      },
    ],
  };

  return { sections: [carrega, fabrica, dau, conn] };
}
