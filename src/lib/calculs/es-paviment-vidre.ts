// Spanish report texts of «Paviment de vidre trepitjable» (paviment-vidre.ts).
// Merged into i18n.ts; same rules: exact phrases here, patterns for texts
// built from parts. Only texts that i18n.ts does not already know.

// prettier-ignore
export const ES_PAVIMENT_VIDRE: Record<string, string> = {
  "Paviment de vidre trepitjable": "Pavimento de vidrio pisable",
  "Càlcul de paviment de vidre trepitjable": "Cálculo de pavimento de vidrio pisable",
  "Paviment de Vidre": "Pavimento de Vidrio",
  // sections and blocks
  "Entrada de dades del paviment de vidre": "Entrada de datos del pavimento de vidrio",
  "Composició del vidre (làmines iguals)": "Composición del vidrio (láminas iguales)",
  "Accions": "Acciones",
  "Coeficients de placa (taules de Roark)": "Coeficientes de placa (tablas de Roark)",
  "Càrrega uniforme · Roark cas 1a (a/b ≤ 5)": "Carga uniforme · Roark caso 1a (a/b ≤ 5)",
  "Càrrega puntual centrada · Roark cas 1b (a/b ≤ 2)": "Carga puntual centrada · Roark caso 1b (a/b ≤ 2)",
  "E.L.U. · laminat intacte (sense col·laboració entre làmines)": "E.L.U. · laminado intacto (sin colaboración entre láminas)",
  "E.L.S. · fletxa (valors característics)": "E.L.S. · flecha (valores característicos)",
  "Post-trencament · làmina superior trencada (combinació accidental, γ = 1,0)": "Post-rotura · lámina superior rota (combinación accidental, γ = 1,0)",
  "Hipòtesis i limitacions": "Hipótesis y limitaciones",
  // rows
  "Costat 1 del vidre": "Lado 1 del vidrio",
  "Costat 2 del vidre": "Lado 2 del vidrio",
  "Costat llarg": "Lado largo",
  "Costat curt (llum de càlcul)": "Lado corto (luz de cálculo)",
  "a = màx(L1, L2)": "a = máx(L1, L2)",
  "Relació de costats": "Relación de lados",
  "Nombre de làmines": "Número de láminas",
  "Gruix nominal per làmina": "Espesor nominal por lámina",
  "Gruix mínim de càlcul per làmina": "Espesor mínimo de cálculo por lámina",
  "Composició": "Composición",
  "Pes propi del vidre": "Peso propio del vidrio",
  "Tipus de vidre": "Tipo de vidrio",
  "Trempat (ESG / templat)": "Templado (ESG)",
  "Termoendurit (TVG)": "Termoendurecido (TVG)",
  "Recuit (float)": "Recocido (float)",
  "Coeficient de tipus de construcció": "Coeficiente de tipo de construcción",
  "Coeficient parcial de seguretat del material en situació accidental (post-trencament)": "Coeficiente parcial de seguridad del material en situación accidental (post-rotura)",
  "Resistència de càlcul a flexió en situació accidental": "Resistencia de cálculo a flexión en situación accidental",
  "Coeficient de Poisson": "Coeficiente de Poisson",
  "Sobrecàrrega d'ús uniforme": "Sobrecarga de uso uniforme",
  "Càrrega concentrada": "Carga concentrada",
  "Costat de l'àrea quadrada de càrrega": "Lado del área cuadrada de carga",
  "Coeficient de majoració de les accions permanents": "Coeficiente de mayoración de las acciones permanentes",
  "Coeficient de majoració de les accions variables": "Coeficiente de mayoración de las acciones variables",
  "Límit de fletxa": "Límite de flecha",
  "Coeficient de tensió": "Coeficiente de tensión",
  "Coeficient de fletxa": "Coeficiente de flecha",
  "Radi equivalent de l'àrea de càrrega": "Radio equivalente del área de carga",
  "Radi corregit": "Radio corregido",
  "Avís de validesa": "Aviso de validez",
  "Dins del rang de taules": "Dentro del rango de las tablas",
  "Fora de rang (a/b > 2)": "Fuera de rango (a/b > 2)",
  "Coeficients de càrrega puntual presos per a a/b = 2 (verificar)": "Coeficientes de carga puntual tomados para a/b = 2 (verificar)",
  "Càrrega uniforme de càlcul": "Carga uniforme de cálculo",
  "Tensió per làmina · càrrega uniforme": "Tensión por lámina · carga uniforme",
  "Càrrega puntual de càlcul": "Carga puntual de cálculo",
  "Tensió per làmina · puntual + pes propi": "Tensión por lámina · puntual + peso propio",
  "Fletxa admissible": "Flecha admisible",
  "Fletxa · pes propi + uniforme": "Flecha · peso propio + uniforme",
  "Fletxa · pes propi + puntual": "Flecha · peso propio + puntual",
  "Làmines resistents": "Láminas resistentes",
  // notes
  "Coeficients de Roark's Formulas for Stress and Strain, taula 11.4 (placa rectangular simplement recolzada als 4 costats, ν = 0,3), interpolats linealment segons a/b. Verificar els valors amb l'edició de Roark disponible.":
    "Coeficientes de Roark's Formulas for Stress and Strain, tabla 11.4 (placa rectangular simplemente apoyada en los 4 lados, ν = 0,3), interpolados linealmente según a/b. Verificar los valores con la edición de Roark disponible.",
  "1. Placa rectangular simplement recolzada als 4 costats, càlcul lineal (teoria de plaques de Roark). No és vàlid per a vidres recolzats en 2 o 3 costats ni per a fixacions puntuals.":
    "1. Placa rectangular simplemente apoyada en los 4 lados, cálculo lineal (teoría de placas de Roark). No es válido para vidrios apoyados en 2 o 3 lados ni para fijaciones puntuales.",
  "2. Làmines iguals i sense col·laboració a través de l'intercalari (hipòtesi conservadora habitual): cada làmina rep la part proporcional de la càrrega.":
    "2. Láminas iguales y sin colaboración a través del intercalario (hipótesis conservadora habitual): cada lámina recibe la parte proporcional de la carga.",
  "3. Les tensions de càrrega uniforme i puntual se superposen al centre del vidre (conservador).":
    "3. Las tensiones de carga uniforme y puntual se superponen en el centro del vidrio (conservador).",
  "4. No es comprova la resistència al cop, el lliscament de la superfície, els recolzaments (calces, perfils) ni l'estructura portant.":
    "4. No se comprueba la resistencia al impacto, el deslizamiento de la superficie, los apoyos (calzos, perfiles) ni la estructura portante.",
  "5. Eina de predimensionament: el gruix definitiu s'ha de verificar amb EN 16612 / DIN 18008-5 i amb el fabricant del vidre.":
    "5. Herramienta de predimensionado: el espesor definitivo se debe verificar con EN 16612 / DIN 18008-5 y con el fabricante del vidrio.",
};

export const PATTERNS_PAVIMENT_VIDRE: [RegExp, (m: RegExpExecArray) => string][] = [];
