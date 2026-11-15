// Calculation types: «Estructura vertical», ports of David's
//   OK-BAIXADA DE CÀRREGUES COMPROVACIÓ TENSIÓ PARET.xls → tipus "baixada-carregues"
// Registered in index.ts through ESTRUCTURA_VERTICAL (group "Estructura vertical").
// The formulas are in baixada-carregues.ts.

import type { CalcType } from "./index";
import { baixadaCarreguesDefaults, computeBaixadaCarregues } from "./baixada-carregues";

export const ESTRUCTURA_VERTICAL: CalcType[] = [
  {
    tipus: "baixada-carregues",
    group: "Estructura vertical",
    tab: "Baixada de càrregues i tensió a la paret",
    reportTitle: "Baixada de càrregues i comprovació de la tensió a la paret de càrrega",
    fileTitle: "Baixada de Càrregues Comprovació Tensió Paret",
    situacioLabel: "Paret de càrrega",
    desc: "Baixada de càrregues dels sostres (forjats tipus i coberta) i del pes propi de la paret fins a la base, i comprovació de la tensió a la fàbrica (CTE DB SE-F).",
    defaults: () => baixadaCarreguesDefaults() as unknown as Record<string, unknown>,
    compute: (d) => computeBaixadaCarregues(d),
  },
];
