// "Límits fletxes": the deformation limits David consults (CTE DB SE 4.3,
// Codi Estructural, EFHE/EHE as good practice), from his spreadsheet
// "Límits fletxes.xlsx" (LLM Manager ticket #4). Reference only: nothing is
// stored. Lengths in metres, deflections in millimetres.

export type Material = "formigo" | "acer";

export interface FletxaInputs {
  L: number; // llum de càlcul (m); voladís: L = 2 × longitud
  H: number; // alçada total de l'edifici (m)
  h: number; // alçada de planta (m)
  material: Material;
}

export interface Criteri {
  n: number;
  criteri: string;
  regla: string;
  /** Límit relatiu (mm), from the span or height. */
  relatiu: (x: FletxaInputs) => number;
  /** Límit absolut (mm), when there is one. */
  absolut?: (x: FletxaInputs) => number;
}

const mm = (m: number) => m * 1000;

// "Calculadora" sheet: one row per criterion; the adopted limit is the more
// restrictive of the relative and the absolute one.
export const CRITERIS: Criteri[] = [
  { n: 1, criteri: "Envans fràgils / paviments rígids sense juntes – activa", regla: "mín. (L/500 ; L/1000 + 5)", relatiu: ({ L }) => mm(L) / 500, absolut: ({ L }) => mm(L) / 1000 + 5 },
  { n: 2, criteri: "Envans ordinaris / paviments rígids amb juntes – activa", regla: "Formigó L/500 · Acer L/400 ; 10 mm", relatiu: ({ L, material }) => mm(L) / (material === "acer" ? 400 : 500), absolut: () => 10 },
  { n: 3, criteri: "Sense envans – activa", regla: "L/300", relatiu: ({ L }) => mm(L) / 300 },
  { n: 4, criteri: "Confort – instantània per variables", regla: "L/350", relatiu: ({ L }) => mm(L) / 350 },
  { n: 5, criteri: "Aparença – total a temps infinit", regla: "mín. (L/300 ; L/500 + 10)", relatiu: ({ L }) => mm(L) / 300, absolut: ({ L }) => mm(L) / 500 + 10 },
  { n: 6, criteri: "Estintolament sota fàbrica – activa", regla: "mín. (L/1000 ; 5)", relatiu: ({ L }) => mm(L) / 1000, absolut: () => 5 },
  { n: 7, criteri: "Estintolament – total", regla: "L/500", relatiu: ({ L }) => mm(L) / 500 },
  { n: 8, criteri: "Desplom total", regla: "H/500", relatiu: ({ H }) => mm(H) / 500 },
  { n: 9, criteri: "Desplom local de planta", regla: "h/250", relatiu: ({ h }) => mm(h) / 250 },
];

/** The limit to apply (mm): the smaller of the relative and absolute limits. */
export function adoptat(c: Criteri, x: FletxaInputs): number {
  const r = c.relatiu(x);
  const a = c.absolut?.(x);
  if (a == null) return r;
  if (!Number.isFinite(r)) return a;
  return Math.min(r, a);
}

export const FLETXES_DEFAULT: FletxaInputs = { L: 6, H: 15, h: 3, material: "formigo" };

// "Quadre resum" sheet.
export const QUADRE_TITOL = "Quadre resum general – Limitació de deformacions";
export const QUADRE_SUBTITOL = "CTE DB SE 4.3 + Codi Estructural (RD 470/2021) + bona pràctica (EFHE/EHE, derogades)";
export const QUADRE_COLUMNES = [
  "Element / situació",
  "Què es controla",
  "Combinació",
  "CTE DB SE 4.3",
  "Codi Estructural (formigó, EC2)",
  "Valor absolut (bona pràctica EFHE/EHE)",
  "Criteri a adoptar",
  "Observacions",
];
export const QUADRE: string[][] = [
  ["Forjats amb envans fràgils o paviments rígids sense juntes", "Fletxa activa", "Característica", "L/500", "L/500", "L/1000 + 5 mm", "mín. (L/500 ; L/1000 + 5 mm)", "L/1000+5 mm governa a partir de L = 5 m"],
  ["Forjats amb envans ordinaris o paviments rígids amb juntes", "Fletxa activa", "Característica", "L/400", "L/500", "10 mm", "Formigó: mín. (L/500 ; 10 mm)\nAcer: mín. (L/400 ; 10 mm)", "L/500 en formigó: lectura estricta de l'EC2 (no distingeix tipus d'envà)"],
  ["Forjats sense envans (resta de casos)", "Fletxa activa", "Característica", "L/300", "—", "—", "L/300", ""],
  ["Confort dels usuaris", "Fletxa instantània per accions variables", "Característica (només variables)", "L/350", "—", "—", "L/350", ""],
  ["Aparença de l'obra (tots els forjats)", "Fletxa total a temps infinit", "Quasi permanent", "L/300", "L/250", "L/500 + 10 mm", "mín. (L/300 ; L/500 + 10 mm)", "L/500+10 mm governa a partir de L = 7,5 m"],
  ["Estintolaments sota fàbrica", "Fletxa activa (càrregues posteriors a la retirada del suport)", "Característica", "—", "—", "—", "mín. (L/1000 ; 5 mm)", "Criteri del projectista: justificar a la memòria"],
  ["Estintolaments", "Fletxa total", "Quasipermanent", "—", "—", "—", "L/500", "Criteri del projectista"],
  ["Desplom total de l'edifici", "Integritat", "Característica", "H/500", "—", "—", "H/500", "H = alçada total"],
  ["Desplom local d'una planta", "Integritat i aparença", "Característica / quasipermanent", "H/250", "—", "—", "H/250", "h = alçada de planta"],
];
export const REGLES = [
  "Voladissos: L = 2 × longitud del voladís.",
  "Entre dos punts qualssevol: L = 2 × distància entre ells (murs continus, estintolaments).",
  "La fletxa activa es compta a partir de la construcció de l'element que es pot danyar.",
  "En edificació cal complir alhora el CTE i el Codi Estructural, adoptant el valor més restrictiu.",
  "EFHE (2002) i EHE-08 estan derogades: els seus valors absoluts s'apliquen com a bona pràctica i per avaluar forjats existents.",
  "Codi Estructural: verificar la redacció literal de l'Annex 19 abans de citar-lo en una memòria.",
];

// "Taula per llums" sheet: the adopted limit for usual spans.
export const LLUMS = [3, 4, 5, 6, 7, 8, 9, 10];
export const PER_LLUM: { criteri: string; f: (L: number) => number }[] = [
  { criteri: "1. Envans fràgils (activa)", f: (L) => Math.min(mm(L) / 500, mm(L) / 1000 + 5) },
  { criteri: "2. Envans ordinaris, formigó (activa)", f: (L) => Math.min(mm(L) / 500, 10) },
  { criteri: "2. Envans ordinaris, acer (activa)", f: (L) => Math.min(mm(L) / 400, 10) },
  { criteri: "3. Sense envans (activa)", f: (L) => mm(L) / 300 },
  { criteri: "4. Confort (variables)", f: (L) => mm(L) / 350 },
  { criteri: "5. Aparença (total)", f: (L) => Math.min(mm(L) / 300, mm(L) / 500 + 10) },
  { criteri: "6. Estintolament (activa)", f: (L) => Math.min(mm(L) / 1000, 5) },
  { criteri: "7. Estintolament (total)", f: (L) => mm(L) / 500 },
];
export const CANVIS_CRITERI = "Canvis de criteri: fràgils i estintolament a L = 5 m · ordinaris formigó a 5 m, acer a 4 m · aparença a 7,5 m.";

// "Normativa" sheet.
export const NORMATIVA_ESTAT = "Estat a novembre de 2026";
export const NORMATIVA: { ambit: string; norma: string; estat: string; obs: string }[] = [
  { ambit: "Exigències de servei (fletxes, desploms, vibracions)", norma: "CTE DB SE, apartat 4.3", estat: "Vigent", obs: "No derogat pel Codi Estructural" },
  { ambit: "Formigó: càlcul de la fletxa i límits", norma: "Codi Estructural (RD 470/2021), Annex 19", estat: "Vigent des del 10/11/2021", obs: "Adaptació de l'Eurocodi 2 (L/250 total, L/500 després de la construcció)" },
  { ambit: "Acer: perfils d'estintolament", norma: "CTE DB SE-A / Codi Estructural, Annex 22", estat: "Vigent", obs: "Límits de fletxa segons DB SE 4.3" },
  { ambit: "Forjats unidireccionals prefabricats", norma: "EFHE-2002, art. 15.2.1", estat: "Derogada", obs: "Valors absoluts com a bona pràctica" },
  { ambit: "Formigó estructural", norma: "EHE-08, art. 50", estat: "Derogada (Codi Estructural)", obs: "Valors absoluts com a bona pràctica / forjats existents" },
];
