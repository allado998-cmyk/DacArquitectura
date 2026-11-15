// Spanish report texts of «Reforç de trencallums» (reforc-trencallums.ts).
// Merged into i18n.ts; same rules: exact phrases here, patterns for texts
// built from parts. Only texts that i18n.ts does not already know.

// prettier-ignore
export const ES_REFORC_TRENCALLUMS: Record<string, string> = {
  "Reforç de trencallums": "Refuerzo de brochal",
  "Càlcul de reforç d'un trencallums": "Cálculo de refuerzo de un brochal",
  "Reforç de Trencallums": "Refuerzo de Brochal",
  // sections (exact, ahead of the «Estat de càrregues …» pattern)
  "Estat de càrregues sobre el trencallums": "Estado de cargas sobre el brochal",
  "Trencallums principal (perpendicular a les biguetes)": "Brochal principal (perpendicular a las viguetas)",
  "Comprovació del trencallums principal": "Comprobación del brochal principal",
  "Biga de suport (trencallums secundari, paral·lel a les biguetes)": "Viga de apoyo (brochal secundario, paralela a las viguetas)",
  "Comprovació de la biga de suport": "Comprobación de la viga de apoyo",
  "Passadors a la paret de càrrega": "Pasadores en el muro de carga",
  // rows
  "Amplària de l'entrebigat": "Ancho del entrevigado",
  "Nombre d'entrebigats a salvar": "Número de entrevigados a salvar",
  "Càrrega puntual sense majorar (estat límit de servei)": "Carga puntual sin mayorar (estado límite de servicio)",
  "Càrrega puntual majorada (estat límit últim)": "Carga puntual mayorada (estado límite último)",
  "Diàmetre del trepant del passador": "Diámetro del taladro del pasador",
  "Longitud del trepant del passador": "Longitud del taladro del pasador",
  "Àrea de contacte dels passadors": "Área de contacto de los pasadores",
  "Resistència característica a compressió de la fàbrica": "Resistencia característica a compresión de la fábrica",
};

export const PATTERNS_REFORC_TRENCALLUMS: [RegExp, (m: RegExpExecArray) => string][] = [];
