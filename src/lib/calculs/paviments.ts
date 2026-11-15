// Calculation types: «Paviments», ports of David's
//   OK-PAVIMENTS DE VIDRE.xlsx → tipus "paviment-vidre"
// Registered in index.ts through PAVIMENTS (group "Paviments"). The formulas
// are in paviment-vidre.ts.

import type { CalcType } from "./index";
import { computePavimentVidre, pavimentVidreDefaults } from "./paviment-vidre";

export const PAVIMENTS: CalcType[] = [
  {
    tipus: "paviment-vidre",
    group: "Paviments",
    tab: "Paviment de vidre trepitjable",
    reportTitle: "Càlcul de paviment de vidre trepitjable",
    fileTitle: "Paviment de Vidre",
    situacioLabel: "Sostre planta",
    desc: "Vidre laminat trepitjable recolzat als 4 costats: tensions per càrrega uniforme i puntual (E.L.U.), fletxa (E.L.S.) i post-trencament amb la làmina superior trencada.",
    defaults: () => pavimentVidreDefaults() as unknown as Record<string, unknown>,
    compute: (d) => computePavimentVidre(d),
  },
];
