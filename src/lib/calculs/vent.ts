// Calculation types: «Vent», ports of David's
//   OK-CARREGA VENT CTE.xlsx → tipus "carrega-vent"
// Registered in index.ts through VENT (group "Vent"). The formulas are in
// carrega-vent.ts.

import type { CalcType } from "./index";
import { carregaVentDefaults, computeCarregaVent } from "./carrega-vent";

export const VENT: CalcType[] = [
  {
    tipus: "carrega-vent",
    group: "Vent",
    tab: "Càrrega de vent",
    reportTitle: "Càrrega dinàmica del vent sobre un parament (CTE DB SE-AE)",
    fileTitle: "Càrrega Vent CTE",
    situacioLabel: "Situació",
    desc: "Càrrega estàtica de vent sobre un parament, qe = qb · ce · cp (CTE DB SE-AE, apartat 3.3 i annex D): pressió dinàmica, coeficient d'exposició i coeficient eòlic.",
    defaults: () => carregaVentDefaults() as unknown as Record<string, unknown>,
    compute: (d) => computeCarregaVent(d),
  },
];
