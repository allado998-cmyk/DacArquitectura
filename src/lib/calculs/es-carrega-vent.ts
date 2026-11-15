// Spanish report texts of «Càrrega de vent» (carrega-vent.ts). Merged into
// i18n.ts; same rules: exact phrases here, patterns for texts built from
// parts. Only texts that i18n.ts does not already know.

// prettier-ignore
export const ES_CARREGA_VENT: Record<string, string> = {
  "Càrrega de vent": "Carga de viento",
  "Càrrega dinàmica del vent sobre un parament (CTE DB SE-AE)": "Carga dinámica del viento sobre un paramento (CTE DB SE-AE)",
  "Càrrega Vent CTE": "Carga Viento CTE",
  // qb
  "Pressió dinàmica del vent (qb)": "Presión dinámica del viento (qb)",
  "Densitat de l'aire": "Densidad del aire",
  "Zona eòlica": "Zona eólica",
  "Zona A · 26 m/s": "Zona A · 26 m/s",
  "Zona B · 27 m/s": "Zona B · 27 m/s",
  "Zona C · 29 m/s": "Zona C · 29 m/s",
  "Velocitat bàsica del vent": "Velocidad básica del viento",
  "Pressió dinàmica del vent": "Presión dinámica del viento",
  // ce
  "Coeficient d'exposició (ce)": "Coeficiente de exposición (ce)",
  "Grau d'aspror de l'entorn": "Grado de aspereza del entorno",
  "I · Vora del mar o d'un llac (≥ 5 km d'aigua a sobrevent)": "I · Borde del mar o de un lago (≥ 5 km de agua a barlovento)",
  "II · Terreny rural pla sense obstacles": "II · Terreno rural llano sin obstáculos",
  "III · Zona rural accidentada o amb obstacles aïllats": "III · Zona rural accidentada o con obstáculos aislados",
  "IV · Zona urbana en general, industrial o forestal": "IV · Zona urbana en general, industrial o forestal",
  "V · Centre de negocis de grans ciutats, amb edificis en alçada": "V · Centro de negocios de grandes ciudades, con edificios en altura",
  "Paràmetre k": "Parámetro k",
  "Paràmetre L": "Parámetro L",
  "Paràmetre Z": "Parámetro Z",
  "Alçària del punt considerat sobre el terreny": "Altura del punto considerado sobre el terreno",
  "Coeficient F": "Coeficiente F",
  "Coeficient d'exposició": "Coeficiente de exposición",
  // cp
  "Coeficient eòlic (cp)": "Coeficiente eólico (cp)",
  "Origen del coeficient eòlic": "Origen del coeficiente eólico",
  "Façana d'un edifici (CTE DB SE-AE taula 3.5)": "Fachada de un edificio (CTE DB SE-AE tabla 3.5)",
  "Mur o tanca aïllat (EN 1991-1-4 taula 7.9)": "Muro o cerca aislado (EN 1991-1-4 tabla 7.9)",
  "Valor escrit a mà": "Valor introducido a mano",
  "Esbeltesa en el pla paral·lel al vent": "Esbeltez en el plano paralelo al viento",
  "Coeficient eòlic de pressió": "Coeficiente eólico de presión",
  "Coeficient eòlic de succió": "Coeficiente eólico de succión",
  "Relació entre la longitud i l'alçària del mur": "Relación entre la longitud y la altura del muro",
  "Amb retorns de longitud ≥ h": "Con retornos de longitud ≥ h",
  "Zona del mur": "Zona del muro",
  "Zona A · fins a 0,3h de l'extrem lliure": "Zona A · hasta 0,3h del extremo libre",
  "Zona B · de 0,3h a 2h": "Zona B · de 0,3h a 2h",
  "Zona C · de 2h a 4h": "Zona C · de 2h a 4h",
  "Zona D · a més de 4h": "Zona D · a más de 4h",
  "Coeficient eòlic de càlcul (valor net)": "Coeficiente eólico de cálculo (valor neto)",
  "Descripció / origen del cp": "Descripción / origen del cp",
  // qe
  "Càrrega de vent (qe)": "Carga de viento (qe)",
  "Pressió estàtica del vent (valor característic)": "Presión estática del viento (valor característico)",
  "Valor característic, sense el coeficient parcial de seguretat de les accions variables (γQ = 1,5).":
    "Valor característico, sin el coeficiente parcial de seguridad de las acciones variables (γQ = 1,5).",
};

// The description of cp, written from the choice (« · cp escrit a mà» when
// typed over).
const MA = " · cp introducido a mano";
export const PATTERNS_CARREGA_VENT: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^Façana, esbeltesa h\/d (.+?)( · cp escrit a mà)?$/, (m) => `Fachada, esbeltez h/d ${m[1]}${m[2] ? MA : ""}`],
  [/^Mur o tanca aïllat, (.+), zona ([A-D])( · cp escrit a mà)?$/, (m) => `Muro o cerca aislado, ${m[1].replace("amb retorns de longitud", "con retornos de longitud")}, zona ${m[2]}${m[3] ? MA : ""}`],
];
