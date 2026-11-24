// Càlculs › Normatives: the standards the studio consults (on actions in
// buildings, and fire safety), in the order David asked for them, each one as
// its PDF. The files are in normatives/ at the root of the repo (bundled with
// the route that serves them, see next.config.ts) and only reach a signed-in
// user, through /calculs/normatives/<fitxer>. Pure data: the page and the
// route share it.
//
// Whether each one is in force comes from the «Resum històric» itself.

export type NormativaKey = "norm-1962" | "norm-1988" | "norm-2006" | "norm-resum" | "norm-db-si";

export interface Normativa {
  key: NormativaKey;
  label: string; // the menu entry, as David named it
  fitxer: string; // file in normatives/
  titol: string;
  origen: string;
  estat: "vigent" | "derogada" | null;
}

export const NORMATIVES: Normativa[] = [
  {
    key: "norm-1962",
    label: "1962-MV-101-62",
    fitxer: "1962-MV-101-62.pdf",
    titol: "Norma MV 101-1962 «Acciones en la edificación»",
    origen: "Decreto 195/1963, de 17 de enero (BOE núm. 35, de 9 de febrero de 1963)",
    estat: "derogada",
  },
  {
    key: "norm-1988",
    label: "1988-NBE-AE-88",
    fitxer: "1988-NBE-AE-88.pdf",
    titol: "NBE-AE/88 «Acciones en la edificación»",
    origen: "Real Decreto 1370/1988, que modifica la MV 101-1962 i en canvia el nom",
    estat: "derogada",
  },
  {
    key: "norm-2006",
    label: "2006-CTE DB SE-AE",
    fitxer: "2006-CTE-DB-SE-AE.pdf",
    titol: "CTE DB SE-AE «Seguridad estructural. Acciones en la edificación»",
    origen: "Real Decreto 314/2006, de 17 de marzo, Código Técnico de la Edificación (document d'abril de 2009)",
    estat: "vigent",
  },
  {
    key: "norm-resum",
    label: "RESUM HISTÒRIC ESTRUCTURAL", // in capitals, as David asked
    fitxer: "Resum-historic.pdf",
    titol: "Resum històric de la normativa estructural",
    origen: "Escola Sert · Postgrau de Rehabilitació, mòdul 2 (actualitzat el novembre de 2026)",
    estat: null,
  },
  {
    key: "norm-db-si",
    label: "2006-CTE DB-SI",
    fitxer: "2006-CTE-DB-SI.pdf",
    titol: "CTE DB SI «Seguridad en caso de incendio»",
    origen: "Real Decreto 314/2006, de 17 de marzo, Código Técnico de la Edificación (versió del 4 de març de 2025)",
    estat: "vigent",
  },
];

export const isNormativa = (t: string | undefined): t is NormativaKey => NORMATIVES.some((n) => n.key === t);
