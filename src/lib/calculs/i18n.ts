// Language of the generated report (Word / PDF): Catalan as written, or
// Spanish, like the actes and invoices. The calculations always produce
// Catalan; the report translates the finished result (titles, labels,
// formulas with words, units, select values, weld pairs, loads, drawings) and
// its own fixed texts. Exact phrases first, then patterns for texts built from
// parts («Geometria IPE 270», «IPE 270 · ala amb UPN 280 · ala»…). Formulas
// and units made only of symbols pass through unchanged. scripts/test-calculs
// checks that every text a calculation can print has a translation.

import type { CalcResult, Row, Section, WeldCombo, WeldPart } from "./common";

export type CalcLang = "ca" | "es";

// prettier-ignore
const ES: Record<string, string> = {
  // report chrome
  "Dades generals": "Datos generales",
  "Resum de les comprovacions": "Resumen de las comprobaciones",
  "Referència DAC": "Referencia DAC",
  "Projecte": "Proyecto",
  "Adreça": "Dirección",
  "Ciutat": "Ciudad",
  "Client": "Cliente",
  "Arquitecte": "Arquitecto",
  "Referència element": "Referencia elemento",
  "Data": "Fecha",
  "Versió càlcul": "Versión cálculo",
  "Concepte": "Concepto",
  "Càrrega": "Carga",
  "Amplària": "Ancho",
  "Càrrega s/majorar": "Carga s/mayorar",
  "Coef.": "Coef.",
  "Càrrega majorada": "Carga mayorada",
  "Conversió": "Conversión",
  "nombre": "número",
  "TOTAL ESTAT DE CÀRREGUES SOBRE EL PERFIL": "TOTAL ESTADO DE CARGAS SOBRE EL PERFIL",
  "càrregues sense majorar": "cargas sin mayorar",
  "càrregues majorades": "cargas mayoradas",
  "Cap combinació inclosa.": "Ninguna combinación incluida.",
  "Peça": "Pieza",
  "Gruix": "Espesor",
  "Gola màxima": "Garganta máxima",
  "Gola mínima": "Garganta mínima",
  "La gola màxima de la peça més prima ha d'estar dins del marge de la més gruixuda, i la gola mínima de la més gruixuda dins del marge de la més prima.":
    "La garganta máxima de la pieza más delgada debe estar dentro del margen de la más gruesa, y la garganta mínima de la más gruesa dentro del margen de la más delgada.",
  "Cap comprovació activa.": "Ninguna comprobación activa.",
  "No compatible": "No compatible",
  "Falta el gruix d'alguna peça.": "Falta el espesor de alguna pieza.",
  "Gruix fora de la taula de soldadures (4,0 – 36,0 mm).": "Espesor fuera de la tabla de soldaduras (4,0 – 36,0 mm).",
  "La gola màxima de la peça més prima no arriba a la mínima de la més gruixuda.": "La garganta máxima de la pieza más delgada no llega a la mínima de la más gruesa.",
  // calculation types
  "Estintolament paret de càrrega": "Apeo de muro de carga",
  "Justificació de càlcul biga d'estintolament paret de càrrega": "Justificación de cálculo de viga de apeo de muro de carga",
  "Justificació de Càlcul Estintolament Paret de Càrrega": "Justificación de Cálculo Apeo Muro de Carga",
  "Recolzament biga": "Apoyo de viga",
  "Justificació comprovació recolzament biga amb daus o connectors": "Justificación comprobación apoyo de viga con dados o conectores",
  "Justificació Comprovació Recolzament Biga amb Daus o Connectors": "Justificación Comprobación Apoyo Viga con Dados o Conectores",
  "Base pilar estintolament": "Base de pilar de apeo",
  "Justificació comprovació recolzament base pilar estintolament": "Justificación comprobación apoyo base de pilar de apeo",
  "Justificació Comprovació Recolzament Base Pilar Estintolament": "Justificación Comprobación Apoyo Base Pilar Apeo",
  "Gola soldadura i compatibilitat": "Garganta de soldadura y compatibilidad",
  "Justificació gola de soldadura i compatibilitat entre soldadures": "Justificación garganta de soldadura y compatibilidad entre soldaduras",
  "Justificació Gola Soldadura i Compatibilitat": "Justificación Garganta Soldadura y Compatibilidad",
  "Paret de càrrega": "Muro de carga",
  "Base paviment": "Base pavimento",
  "Situació": "Situación",
  // sections, blocks, rows
  "A dos costats": "A dos lados",
  "A un costat": "A un lado",
  "Accions permanents": "Acciones permanentes",
  "Accions permanents · paret de càrrega": "Acciones permanentes · muro de carga",
  "Accions permanents · perfil d'estintolament": "Acciones permanentes · perfil de apeo",
  "Accions variables": "Acciones variables",
  "Alçària de la paret de càrrega": "Altura del muro de carga",
  "Ales · cordó perimetral (opció 1)": "Alas · cordón perimetral (opción 1)",
  "Ales · gola màxima compatible": "Alas · garganta máxima compatible",
  "Ales · gola mínima compatible": "Alas · garganta mínima compatible",
  "Ales · només cordó exterior (opció 2)": "Alas · solo cordón exterior (opción 2)",
  "Ales (resisteixen M i N)": "Alas (resisten M y N)",
  "Amb aquesta deformació la fletxa és equivalent a…": "Con esta deformación la flecha equivale a…",
  "Amplada de l'ala": "Ancho del ala",
  "Amplada de la UPN d'arribada a la base": "Ancho de la UPN de llegada a la base",
  "Amplària de l'ala superior de les esnelles": "Ancho del ala superior de las agujas",
  "Amplària del dau de formigó": "Ancho del dado de hormigón",
  "Ànima · 2 cordons": "Alma · 2 cordones",
  "Ànima · gola màxima compatible": "Alma · garganta máxima compatible",
  "Ànima · gola mínima compatible": "Alma · garganta mínima compatible",
  "Ànima (2 cares)": "Alma (2 caras)",
  "Ànima (resisteix V)": "Alma (resiste V)",
  "Àrea de contacte de cada esnella": "Área de contacto de cada aguja",
  "Àrea de contacte de cada passador": "Área de contacto de cada pasador",
  "Àrea de l'ànima": "Área del alma",
  "Àrea efectiva de cada trepant i barra": "Área efectiva de cada taladro y barra",
  "Àrea nominal": "Área nominal",
  "Àrea nominal de cada barra": "Área nominal de cada barra",
  "Àrea nominal de cada dau de formigó": "Área nominal de cada dado de hormigón",
  "arrodonida a 0,5 mm i ≥ a mín": "redondeada a 0,5 mm y ≥ a mín",
  "Axial (+ tracció / − compressió)": "Axil (+ tracción / − compresión)",
  "Axial del pilar (segons CYPE)": "Axil del pilar (según CYPE)",
  "Base": "Base",
  "Base de formigó en massa als extrems de l'estintolament": "Base de hormigón en masa en los extremos del apeo",
  "Cantell": "Canto",
  "Cantell del dorment (gruix del forjat)": "Canto del durmiente (espesor del forjado)",
  "Capacitat de càrrega per deformació": "Capacidad de carga por deformación",
  "Capacitat de càrrega per esforç tallant": "Capacidad de carga por esfuerzo cortante",
  "Capacitat de càrrega per moment flector": "Capacidad de carga por momento flector",
  "Cara exterior d’ala": "Cara exterior del ala",
  "Cara interior d’ala": "Cara interior del ala",
  "Característiques del perfil": "Características del perfil",
  "Càrrega puntual a cada esnella": "Carga puntual en cada aguja",
  "Càrrega uniformement repartida màxima majorada (E.L.U.)": "Carga uniformemente repartida máxima mayorada (E.L.U.)",
  "Càrregues permanents d'envans": "Cargas permanentes de tabiques",
  "Càrregues permanents de paviments i morter": "Cargas permanentes de pavimentos y mortero",
  "Coeficient de correlació": "Coeficiente de correlación",
  "Coeficient de minoració del material": "Coeficiente de minoración del material",
  "Coeficient de minoració per a esforços tangencials": "Coeficiente de minoración para esfuerzos tangenciales",
  "Coeficient parcial de seguretat": "Coeficiente parcial de seguridad",
  "Coeficient parcial de seguretat del material": "Coeficiente parcial de seguridad del material",
  "Coeficients de seguretat": "Coeficientes de seguridad",
  "Compatibilitat de soldadures (de les combinacions)": "Compatibilidad de soldaduras (de las combinaciones)",
  "Comprovació del perfil d'estintolament": "Comprobación del perfil de apeo",
  "Comprovació tensional de les esnelles · perfil travesser amb càrrega puntual": "Comprobación tensional de las agujas · perfil travesaño con carga puntual",
  "Connectors travessers a la paret de càrrega als extrems de la biga": "Conectores transversales en el muro de carga en los extremos de la viga",
  "Constant de la fàbrica": "Constante de la fábrica",
  "cos 60° / sin 60°": "cos 60° / sen 60°",
  "Dades de càlcul": "Datos de cálculo",
  "Dades de càrrega": "Datos de carga",
  "Dades del dau": "Datos del dado",
  "Dades del perfil": "Datos del perfil",
  "Dades del perfil 1": "Datos del perfil 1",
  "Dades del perfil 2": "Datos del perfil 2",
  "Dades dels connectors": "Datos de los conectores",
  "Dades dels perfils": "Datos de los perfiles",
  "Dades esnelles": "Datos agujas",
  "Dades geomètriques": "Datos geométricos",
  "Dades passadors": "Datos pasadores",
  "Daus de formigó en massa a la paret de càrrega als extrems de la biga": "Dados de hormigón en masa en el muro de carga en los extremos de la viga",
  "Deformació (fletxa) màxima admissible": "Deformación (flecha) máxima admisible",
  "Deformació del perfil": "Deformación del perfil",
  "Diàmetre dels passadors roscats": "Diámetro de los pasadores roscados",
  "Diàmetre efectiu del trepant": "Diámetro efectivo del taladro",
  "Diàmetre nominal dels connectors": "Diámetro nominal de los conectores",
  "Dimensionat i càlcul d'esnelles i travessers": "Dimensionado y cálculo de agujas y travesaños",
  "Distància entre esnelles": "Distancia entre agujas",
  "Distància entre passadors": "Distancia entre pasadores",
  "El càlcul de gola necessita que el perfil 1 sigui un perfil en I o H (IPE, IPN, HEA, HEB o HEM).":
    "El cálculo de garganta necesita que el perfil 1 sea un perfil en I o H (IPE, IPN, HEA, HEB o HEM).",
  "Entrada de dades del perfil d'estintolament": "Entrada de datos del perfil de apeo",
  "Esforç tallant": "Esfuerzo cortante",
  "Esforç tallant a cada extrem": "Esfuerzo cortante en cada extremo",
  "Esforç tallant al brancal": "Esfuerzo cortante en la jamba",
  "Esforç tallant al recolzament (segons CYPE)": "Esfuerzo cortante en el apoyo (según CYPE)",
  "Esforços de càlcul (ELU)": "Esfuerzos de cálculo (ELU)",
  "Estat de càrregues ponderat": "Estado de cargas ponderado",
  "Estats límits de servei (E.L.S.)": "Estados límite de servicio (E.L.S.)",
  "Estats límits últims (E.L.U.)": "Estados límite últimos (E.L.U.)",
  "Factor t → kN": "Factor t → kN",
  "Força a l'ala per axial": "Fuerza en el ala por axil",
  "Força a l'ala per moment": "Fuerza en el ala por momento",
  "Força total a l'ala": "Fuerza total en el ala",
  "Fórmula combinada": "Fórmula combinada",
  "Gola a adoptar = màx(càlcul ; mínima compatible)": "Garganta a adoptar = máx(cálculo ; mínima compatible)",
  "Gola de referència per descomptar extrems": "Garganta de referencia para descontar extremos",
  "Gola mínima constructiva": "Garganta mínima constructiva",
  "Gola per càlcul": "Garganta por cálculo",
  "Gola segons càlcul": "Garganta según cálculo",
  "Gruix de l'ànima": "Espesor del alma",
  "Gruix de la paret de càrrega": "Espesor del muro de carga",
  "Gruix de la paret de càrrega de suport": "Espesor del muro de carga de apoyo",
  "Gruix de la xapa": "Espesor de la chapa",
  "Gruix de les ales": "Espesor de las alas",
  "Gruix del mur": "Espesor del muro",
  "h − 2·e1 − 2r − 2a ref, arrodonida a 10 mm": "h − 2·e1 − 2r − 2a ref, redondeada a 10 mm",
  "Increment de tensió per l'estintolament": "Incremento de tensión por el apeo",
  "Lef = a + p + 2 · c · cos 60° / sin 60°": "Lef = a + p + 2 · c · cos 60° / sen 60°",
  "Lef = a + p + c · cos 60° / sin 60°": "Lef = a + p + c · cos 60° / sen 60°",
  "Límit elàstic característic de l'acer": "Límite elástico característico del acero",
  "Limitació de deformació (fletxa màxima admissible)": "Limitación de deformación (flecha máxima admisible)",
  "Llum, distància entre recolzaments": "Luz, distancia entre apoyos",
  "Llum, longitud total entre recolzaments": "Luz, longitud total entre apoyos",
  "Longitud cordó exterior": "Longitud cordón exterior",
  "Longitud de la barra": "Longitud de la barra",
  "Longitud efectiva de contacte (repartiment a 60°)": "Longitud efectiva de contacto (reparto a 60°)",
  "Longitud eficaç cordó ànima (×2)": "Longitud eficaz cordón alma (×2)",
  "Longitud eficaç cordó interior (×2 per ala)": "Longitud eficaz cordón interior (×2 por ala)",
  "Material": "Material",
  "màx(a càlcul ; a mín. compatible)": "máx(a cálculo ; a mín. compatible)",
  "Mòdul d'elasticitat": "Módulo de elasticidad",
  "Mòdul resistent": "Módulo resistente",
  "Moment d'inèrcia": "Momento de inercia",
  "Moment flector": "Momento flector",
  "Moment flector màxim de càlcul": "Momento flector máximo de cálculo",
  "Nombre d'esnelles": "Número de agujas",
  "Nombre de connectors": "Número de conectores",
  "Nombre de passadors": "Número de pasadores",
  "Nombre de perfils": "Número de perfiles",
  "Nombre de perfils a cada brancal": "Número de perfiles en cada jamba",
  "Nombre de travessers o passadors perpendiculars": "Número de travesaños o pasadores perpendiculares",
  "Opció 1 · cordó perimetral": "Opción 1 · cordón perimetral",
  "Opció 1 · gola per càlcul": "Opción 1 · garganta por cálculo",
  "Opció 1 · gola segons càlcul": "Opción 1 · garganta según cálculo",
  "Opció 1 · longitud total (exterior + 2 interiors)": "Opción 1 · longitud total (exterior + 2 interiores)",
  "Opció 2 · gola per càlcul (només exterior)": "Opción 2 · garganta por cálculo (solo exterior)",
  "Opció 2 · gola segons càlcul": "Opción 2 · garganta según cálculo",
  "Opció 2 · només cordó exterior": "Opción 2 · solo cordón exterior",
  "Opció A · Connectors travessers a la paret de càrrega als extrems de la biga": "Opción A · Conectores transversales en el muro de carga en los extremos de la viga",
  "Opció B · Daus de formigó en massa a la paret de càrrega als extrems de la biga": "Opción B · Dados de hormigón en masa en el muro de carga en los extremos de la viga",
  "Opció C · Reforç dels brancals de la paret de càrrega als extrems de la biga": "Opción C · Refuerzo de las jambas del muro de carga en los extremos de la viga",
  "Paret de càrrega de suport": "Muro de carga de apoyo",
  "Per deformació": "Por deformación",
  "Per esforç tallant": "Por esfuerzo cortante",
  "Per moment flector": "Por momento flector",
  "Perfil": "Perfil",
  "Perfil de les esnelles": "Perfil de las agujas",
  "Perfil dels brancals": "Perfil de las jambas",
  "Perfil laminat en calent 1": "Perfil laminado en caliente 1",
  "Perfil laminat en calent 2": "Perfil laminado en caliente 2",
  "Perfils dels brancals": "Perfiles de las jambas",
  "Pes propi de les parets de càrrega superiors": "Peso propio de los muros de carga superiores",
  "Pes propi del perfil a calcular": "Peso propio del perfil a calcular",
  "Pes propi estructural": "Peso propio estructural",
  "Pletina de reforç a la base de la UPN": "Pletina de refuerzo en la base de la UPN",
  "Radi d'arrodoniment": "Radio de acuerdo",
  "Repartiment de la càrrega a 60°": "Reparto de la carga a 60°",
  "Resistència a tracció de l'acer": "Resistencia a tracción del acero",
  "Resistència de càlcul a compressió": "Resistencia de cálculo a compresión",
  "Resistència de càlcul a esforços tangencials": "Resistencia de cálculo a esfuerzos tangenciales",
  "Resistència de càlcul de la soldadura": "Resistencia de cálculo de la soldadura",
  "Resistència de càlcul del material": "Resistencia de cálculo del material",
  "Resistència de la barra": "Resistencia de la barra",
  "Resistència del morter": "Resistencia del mortero",
  "Resistència normalitzada de les peces": "Resistencia normalizada de las piezas",
  "Respecte a la sol·licitació E.L.S., la capacitat de càrrega representa…": "Respecto a la solicitación E.L.S., la capacidad de carga representa…",
  "Respecte a la sol·licitació E.L.U., la capacitat de càrrega representa…": "Respecto a la solicitación E.L.U., la capacidad de carga representa…",
  "Resultats barres i suports": "Resultados barras y soportes",
  "Resultats combinacions compatibilitat de soldadures": "Resultados combinaciones compatibilidad de soldaduras",
  "Resultats de la tensió de la paret": "Resultados de la tensión del muro",
  "Resultats perfils": "Resultados perfiles",
  "Resultats tensió paret": "Resultados tensión muro",
  "Resultats tensió suport paret de càrrega": "Resultados tensión apoyo muro de carga",
  "Secció del perfil": "Sección del perfil",
  "Sobrecàrrega d'ús": "Sobrecarga de uso",
  "Sobrecàrrega de neu": "Sobrecarga de nieve",
  "Sobrecàrrega de vent": "Sobrecarga de viento",
  "Tensió a la base": "Tensión en la base",
  "Tensió al dau (únicament estintolament)": "Tensión en el dado (únicamente apeo)",
  "Tensió al perfil": "Tensión en el perfil",
  "Tensió de càlcul de la paret": "Tensión de cálculo del muro",
  "Tensió de la paret sense estintolament": "Tensión del muro sin apeo",
  "Tensió de tesat": "Tensión de tesado",
  "Tensió de treball": "Tensión de trabajo",
  "Tensió del suport": "Tensión del soporte",
  "Tensió en el connector": "Tensión en el conector",
  "Tensió en la paret de càrrega de suport": "Tensión en el muro de carga de apoyo",
  "Tensió per esforç tallant": "Tensión por esfuerzo cortante",
  "Tensió per moment flector": "Tensión por momento flector",
  "Tensió total a la paret": "Tensión total en el muro",
  "Tipus d'unió": "Tipo de unión",
  "Unió articulada": "Unión articulada",
  "Unió encastada": "Unión empotrada",
  "ut": "ud",
  "Opcions de soldadura: cordó perimetral o només exterior": "Opciones de soldadura: cordón perimetral o solo exterior",
};

// Texts built from parts. Each returns the Spanish text, translating the parts.
const PATTERNS: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^Estat de càrregues (.+)$/, (m) => `Estado de cargas ${es(m[1])}`],
  [/^Sostre tipus (.+)$/, (m) => `Forjado tipo ${m[1]}`],
  [/^Geometria (.+)$/, (m) => `Geometría ${m[1]}`],
  [/^Gola de soldadura · (.+)$/, (m) => `Garganta de soldadura · ${es(m[1])}`],
  [/^Unió a xapa (.+)$/, (m) => `Unión a chapa ${m[1]}`],
  [/^Unió a (.+)$/, (m) => `Unión a ${m[1]}`],
  [/^Xapa ([\d,.]+ mm)$/, (m) => `Chapa ${m[1]}`],
  [/^(.+ · (?:ala|ànima)|Xapa [\d,.]+ mm) amb (.+ · (?:ala|ànima)|Xapa [\d,.]+ mm)$/, (m) => `${es(m[1])} con ${es(m[2])}`],
  [/^(.+) · ànima$/, (m) => `${m[1]} · alma`],
  [/^(.+) · ala$/, (m) => `${m[1]} · ala`],
  [/^a ales = (.+) · a ànima = (.+)$/, (m) => `a alas = ${m[1]} · a alma = ${m[2]}`],
  [/^Ala: (.+)$/, (m) => `Ala: ${m[1]}`],
  [/^Gola compatible: (.+)$/, (m) => `Garganta compatible: ${m[1]}`],
  [/^Compleixen totes les comprovacions \((\d+)\)\.$/, (m) => `Cumplen todas las comprobaciones (${m[1]}).`],
  [/^No compleixen (\d+) de (\d+) comprovacions\.$/, (m) => `No cumplen ${m[1]} de ${m[2]} comprobaciones.`],
];

// Made only of symbols, numbers, units and short abbreviations (formulas like
// «σ = M / Wx» or «Q max ELS = f adm · 384 · E · Ix / (5 · L⁴)»): the same in
// both languages. Words of four or more letters mean it needs a translation,
// except these technical tokens.
const NEUTRAL_WORDS = new Set(["CYPE", "Aap", "Ieta", "Izeta", "Weta", "Wzeta"]);
function isSymbolic(s: string): boolean {
  const words = s.match(/[A-Za-zÀ-ÿ]{4,}/g) ?? [];
  return words.every((w) => NEUTRAL_WORDS.has(w));
}

// Spanish for a Catalan text, or null when there is none.
export function esKnown(s: string): string | null {
  const t = s.trim();
  if (!t) return s;
  if (t in ES) return ES[t];
  for (const [re, f] of PATTERNS) {
    const m = re.exec(t);
    if (m) return f(m);
  }
  if (isSymbolic(t)) return t;
  return null;
}
function es(s: string): string {
  return esKnown(s) ?? s;
}

export function tr(s: string, lang: CalcLang): string;
export function tr(s: string | null | undefined, lang: CalcLang): string | null | undefined;
export function tr(s: string | null | undefined, lang: CalcLang) {
  if (lang === "ca" || s == null) return s;
  return es(s);
}

// ---- translating a whole result ----

const unesc = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const reesc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function trRow(r: Row, lang: CalcLang): Row {
  return {
    ...r,
    label: tr(r.label, lang),
    formula: tr(r.formula, lang) ?? undefined,
    unit: tr(r.unit, lang) ?? undefined,
    value: typeof r.value === "string" && r.input?.type !== "profile" ? tr(r.value, lang) : r.value,
    check: r.check ? { ...r.check, unit: tr(r.check.unit, lang) ?? undefined } : undefined,
    alt: r.alt ? { ...r.alt, unit: tr(r.alt.unit, lang) } : undefined,
  };
}
const trPart = (p: WeldPart, lang: CalcLang): WeldPart => ({ ...p, label: tr(p.label, lang) });
const trWeld = (w: WeldCombo, lang: CalcLang): WeldCombo => ({
  ...w,
  label: tr(w.label, lang),
  note: tr(w.note, lang) ?? undefined,
  a: trPart(w.a, lang),
  b: trPart(w.b, lang),
});

function trSection(s: Section, lang: CalcLang): Section {
  return {
    ...s,
    title: tr(s.title, lang),
    blocks: s.blocks.map((b) => ({ ...b, title: tr(b.title, lang) ?? undefined, rows: b.rows.map((r) => trRow(r, lang)) })),
    welds: s.welds?.map((w) => trWeld(w, lang)),
    loads: s.loads && {
      ...s.loads,
      groups: s.loads.groups.map((g) => ({
        ...g,
        title: tr(g.title, lang),
        total: g.total && { ...g.total, label: tr(g.total.label, lang) },
        lines: g.lines.map((l) => ({
          heading: tr(l.heading, lang) ?? undefined,
          line: l.line && { ...l.line, label: tr(l.line.label, lang), qUnit: tr(l.line.qUnit, lang), widthUnit: tr(l.line.widthUnit, lang) ?? undefined },
          param: l.param && { ...l.param, label: tr(l.param.label, lang), unit: tr(l.param.unit, lang) },
        })),
      })),
    },
    figure: s.figure && {
      ...s.figure,
      svg: s.figure.svg.replace(/(<text[^>]*>)([^<]+)(<\/text>)/g, (_m, a: string, text: string, b: string) => a + reesc(tr(unesc(text), lang)) + b),
      alt: tr(s.figure.alt, lang),
    },
  };
}

export function translateResult(r: CalcResult, lang: CalcLang): CalcResult {
  if (lang === "ca") return r;
  return { ...r, sections: r.sections.map((s) => trSection(s, lang)) };
}
