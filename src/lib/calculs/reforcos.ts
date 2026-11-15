// Calculation types: «Reforços» (reinforcement of existing floors), ports of David's
//   OK-REFOÇ DE TRENCALLUMS.xls                                    → tipus "reforc-trencallums"
//   OK-REFORÇ BIGA D'ACER AMB XAPA COMPRESSIÓ-reforç.xls           → tipus "reforc-biga-acer"
//   OK-REFORÇ BIGA D'ACER ALA ESTRETA AMB XAPA COMPRESSIÓ-reforç.xls → tipus "reforc-biga-acer-ala"
// Registered in index.ts through REFORCOS (group "Reforços"). The formulas are
// in reforc-trencallums.ts and reforc-biga.ts.

import type { CalcType } from "./index";
import { computeTrencallums, trencallumsDefaults, trencallumsPerfilsValids } from "./reforc-trencallums";
import { computeReforcBigaAcer, computeReforcBigaAcerAla, reforcBigaAcerAlaDefaults, reforcBigaAcerDefaults, reforcBigaAcerPerfilsValids } from "./reforc-biga";

export const REFORCOS: CalcType[] = [
  {
    tipus: "reforc-trencallums",
    group: "Reforços",
    tab: "Reforç de trencallums",
    reportTitle: "Càlcul de reforç d'un trencallums",
    fileTitle: "Reforç de Trencallums",
    situacioLabel: "Sostre planta",
    desc: "Obertura en un sostre de biguetes: trencallums perpendicular a les biguetes (càrrega uniforme), biga de suport paral·lela a les biguetes (càrrega puntual) i passadors a la paret de càrrega.",
    defaults: () => trencallumsDefaults() as unknown as Record<string, unknown>,
    compute: (d) => computeTrencallums(d),
    perfilsValids: (d) => trencallumsPerfilsValids(d),
  },
  {
    tipus: "reforc-biga-acer",
    group: "Reforços",
    tab: "Reforç biga d'acer estàndard amb xapa de compressió",
    reportTitle: "Comprovació de perfil existent d'acer estàndard i reforç amb xapa de compressió de formigó armat",
    fileTitle: "Reforç Biga d'Acer amb Xapa de Compressió",
    situacioLabel: "Sostre planta",
    desc: "Bigueta existent de perfil laminat estàndard reforçada amb una xapa de compressió de formigó armat connectada: comprovació del perfil existent, secció mixta acer + formigó, comprovació reforçada i connectors.",
    defaults: () => reforcBigaAcerDefaults() as unknown as Record<string, unknown>,
    compute: (d) => computeReforcBigaAcer(d),
    perfilsValids: (d) => ({ perfil: reforcBigaAcerPerfilsValids(d) }),
  },
  {
    tipus: "reforc-biga-acer-ala",
    group: "Reforços",
    tab: "Reforç biga d'acer d'ala estreta amb xapa de compressió",
    reportTitle: "Comprovació de perfil existent d'acer d'ala estreta i reforç amb xapa de compressió de formigó armat",
    fileTitle: "Reforç Biga d'Acer Ala Estreta amb Xapa de Compressió",
    situacioLabel: "Sostre planta",
    desc: "Bigueta existent d'acer d'ala estreta (catàleg Torras o IPN, o dades a mà) reforçada amb una xapa de compressió de formigó armat connectada: perfil existent, secció mixta, comprovació reforçada i connectors.",
    defaults: () => reforcBigaAcerAlaDefaults() as unknown as Record<string, unknown>,
    compute: (d) => computeReforcBigaAcerAla(d),
  },
];
