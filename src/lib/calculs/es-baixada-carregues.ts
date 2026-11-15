// Spanish report texts of «Baixada de càrregues i tensió a la paret»
// (baixada-carregues.ts). Merged into i18n.ts; same rules: exact phrases
// here, patterns for texts built from parts. Only texts that i18n.ts does not
// already know.

// prettier-ignore
export const ES_BAIXADA_CARREGUES: Record<string, string> = {
  "Baixada de càrregues i tensió a la paret": "Bajada de cargas y tensión en el muro",
  "Baixada de càrregues i comprovació de la tensió a la paret de càrrega": "Bajada de cargas y comprobación de la tensión en el muro de carga",
  "Baixada de Càrregues Comprovació Tensió Paret": "Bajada de Cargas Comprobación Tensión Muro",
  // sections, floors, loads
  "Baixada de càrregues": "Bajada de cargas",
  "Forjats tipus": "Forjados tipo",
  "Forjat coberta": "Forjado cubierta",
  "Pes propi de les plaques fotovoltaiques": "Peso propio de las placas fotovoltaicas",
  "Pes propi de la paret de càrrega": "Peso propio del muro de carga",
  "Càrrega total a la base de la paret": "Carga total en la base del muro",
  "Resultats a la base de la paret": "Resultados en la base del muro",
  "Càrrega total sense majorar": "Carga total sin mayorar",
  "Càrrega total majorada": "Carga total mayorada",
  "Càrrega majorada de les plaques fotovoltaiques": "Carga mayorada de las placas fotovoltaicas",
  "Increment de càrrega fotovoltaica": "Incremento de carga fotovoltaica",
  // masonry and stress
  "Resistència a compressió de la fàbrica": "Resistencia a compresión de la fábrica",
  "Resistència característica a compressió": "Resistencia característica a compresión",
  "Càrrega repartida i tensió a la fàbrica": "Carga repartida y tensión en la fábrica",
  "Longitud de paret considerada": "Longitud de muro considerada",
  "Tensió sense majorar": "Tensión sin mayorar",
  "Tensió majorada": "Tensión mayorada",
  "Aprofitament de la paret": "Aprovechamiento del muro",
};

export const PATTERNS_BAIXADA_CARREGUES: [RegExp, (m: RegExpExecArray) => string][] = [];
