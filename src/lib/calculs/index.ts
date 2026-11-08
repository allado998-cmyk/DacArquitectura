// The calculation types (one per spreadsheet David sent).

import type { CalcResult, CalcTipus } from "./common";
import { computeParet, paretDefaults, paretPerfilsValids } from "./paret";
import { computeBiga, bigaDefaults } from "./biga";
import { computePilar, pilarDefaults } from "./pilar";
import { computeSoldadura, soldaduraDefaults } from "./soldadura";
import { BIGUETES } from "./biguetes";
import { INERCIES } from "./inercies";

export type { CalcTipus } from "./common";

// How the «Càlculs» menu groups the types.
export type CalcGroup = "Estintolaments" | "Biguetes" | "Inèrcies" | "Soldadures";
export const CALC_GROUPS: CalcGroup[] = ["Estintolaments", "Biguetes", "Inèrcies", "Soldadures"];

export interface CalcType {
  tipus: CalcTipus;
  group: CalcGroup;
  tab: string; // tab / list label
  reportTitle: string; // printed title of the justification
  fileTitle: string; // exported file name prefix (the original spreadsheet name)
  situacioLabel: string; // header row under "Arquitecte" (value e.g. "Planta baixa")
  desc: string;
  defaults: () => Record<string, unknown>;
  compute: (dades: Record<string, unknown>) => CalcResult;
  // Profile inputs (by key) → the profiles that pass, marked in the picker.
  perfilsValids?: (dades: Record<string, unknown>) => Record<string, Set<string>>;
}

const BASE_TYPES: CalcType[] = [
  {
    tipus: "paret",
    group: "Estintolaments",
    tab: "Estintolament paret de càrrega",
    reportTitle: "Justificació de càlcul biga d'estintolament paret de càrrega",
    fileTitle: "Justificació de Càlcul Estintolament Paret de Càrrega",
    situacioLabel: "Paret de càrrega",
    desc: "Estat de càrregues ponderat, comprovació del perfil (E.L.S. i E.L.U.), recolzament als extrems (connectors, daus o brancals) i esnelles.",
    defaults: () => paretDefaults() as unknown as Record<string, unknown>,
    compute: (d) => computeParet(d),
    perfilsValids: (d) => ({ perfil: paretPerfilsValids(d) }),
  },
  {
    tipus: "biga",
    group: "Estintolaments",
    tab: "Recolzament biga",
    reportTitle: "Justificació comprovació recolzament biga amb daus o connectors",
    fileTitle: "Justificació Comprovació Recolzament Biga amb Daus o Connectors",
    situacioLabel: "Paret de càrrega",
    desc: "Recolzament d'una biga sobre paret de càrrega a partir de l'esforç tallant (CYPE): daus de formigó en massa i connectors travessers.",
    defaults: () => bigaDefaults() as unknown as Record<string, unknown>,
    compute: (d) => computeBiga(d),
  },
  {
    tipus: "pilar",
    group: "Estintolaments",
    tab: "Base pilar estintolament",
    reportTitle: "Justificació comprovació recolzament base pilar estintolament",
    fileTitle: "Justificació Comprovació Recolzament Base Pilar Estintolament",
    situacioLabel: "Base paviment",
    desc: "Tensió a la paret de càrrega sota la base d'un pilar d'estintolament, amb repartiment a 60° a través del dorment.",
    defaults: () => pilarDefaults() as unknown as Record<string, unknown>,
    compute: (d) => computePilar(d),
  },
  {
    tipus: "soldadura",
    group: "Soldadures",
    tab: "Gola soldadura i compatibilitat",
    reportTitle: "Justificació gola de soldadura i compatibilitat entre soldadures",
    fileTitle: "Justificació Gola Soldadura i Compatibilitat",
    situacioLabel: "Situació",
    desc: "Gola de soldadura en angle compatible entre dos perfils (ala i ànima de cadascun, o una xapa), segons els gruixos del catàleg i la taula de valors límit de la gola; i gola per càlcul d'una unió encastada o articulada.",
    defaults: () => soldaduraDefaults() as unknown as Record<string, unknown>,
    compute: (d) => computeSoldadura(d),
  },
];

// Every type, in menu order (the first one is the fallback for unknown types).
export const CALC_TYPES: CalcType[] = [...BASE_TYPES, ...BIGUETES, ...INERCIES].sort(
  (a, b) => CALC_GROUPS.indexOf(a.group) - CALC_GROUPS.indexOf(b.group),
);

export function calcType(tipus: string): CalcType {
  return CALC_TYPES.find((t) => t.tipus === tipus) ?? CALC_TYPES[0];
}
