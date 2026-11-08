// Calculation types: «Comprovació de bigueta» (joist checks), ports of David's
//   Comprovació Bigueta d'Acer Estandard.xls        → tipus "bigueta-acer"
//   Comprovació Bigueta d'Acer Ala Estreta.xls      → tipus "bigueta-acer-ala"
//   Comprovació Bigueta de Fusta i Resistència al Foc.xls → tipus "bigueta-fusta"
// Registered in index.ts through BIGUETES (group "Biguetes"). The formulas are
// in bigueta-acer.ts and bigueta-fusta.ts; the load table they share in
// bigueta-carregues.ts.

import type { CalcType } from "./index";
import { biguetaAcerAlaDefaults, biguetaAcerDefaults, biguetaAcerPerfilsValids, computeBiguetaAcer, computeBiguetaAcerAla } from "./bigueta-acer";
import { biguetaFustaDefaults, computeBiguetaFusta } from "./bigueta-fusta";

export const BIGUETES: CalcType[] = [
  {
    tipus: "bigueta-acer",
    group: "Biguetes",
    tab: "Bigueta d'acer estàndard",
    reportTitle: "Comprovació de bigueta d'acer estàndard",
    fileTitle: "Comprovació Bigueta d'Acer Estàndard",
    situacioLabel: "Sostre planta",
    desc: "Bigueta existent de perfils laminats estàndard (IPE, IPN, HEA, HEB, HEM o UPN) sota càrrega uniforme: estat de càrregues, deformació (E.L.S.) i flexió, tallant i fórmula combinada (E.L.U.).",
    defaults: () => biguetaAcerDefaults() as unknown as Record<string, unknown>,
    compute: (d) => computeBiguetaAcer(d),
    perfilsValids: (d) => ({ perfil: biguetaAcerPerfilsValids(d) }),
  },
  {
    tipus: "bigueta-acer-ala",
    group: "Biguetes",
    tab: "Bigueta d'acer d'ala estreta",
    reportTitle: "Comprovació de bigueta d'acer d'ala estreta",
    fileTitle: "Comprovació Bigueta d'Acer Ala Estreta",
    situacioLabel: "Sostre planta",
    desc: "Bigueta existent d'acer d'ala estreta (catàleg Torras o IPN, o dades escrites a mà): estat de càrregues, deformació (E.L.S.) i flexió, tallant i fórmula combinada (E.L.U.).",
    defaults: () => biguetaAcerAlaDefaults() as unknown as Record<string, unknown>,
    compute: (d) => computeBiguetaAcerAla(d),
  },
  {
    tipus: "bigueta-fusta",
    group: "Biguetes",
    tab: "Bigueta de fusta i resistència al foc",
    reportTitle: "Comprovació de bigueta de fusta i resistència al foc",
    fileTitle: "Comprovació Bigueta de Fusta i Resistència al Foc",
    situacioLabel: "Sostre planta",
    desc: "Bigueta de fusta massissa: flexió i tallant (E.L.U.), fletxes per integritat, confort i aparença (E.L.S.) i resistència al foc pel mètode de la secció reduïda.",
    defaults: () => biguetaFustaDefaults() as unknown as Record<string, unknown>,
    compute: (d) => computeBiguetaFusta(d),
  },
];
