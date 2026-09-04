#!/usr/bin/env node
// Fill the DEMO database with fake-but-plausible data so every page of the app
// has something to show in a client demo.
//
//   node --env-file=.env.demo.local scripts/seed-demo.mjs
//
// Destructive: it wipes and rebuilds the demo dataset. It refuses to run
// against anything whose database name isn't "demo", so it can't touch the real
// database by accident. Catalog tables seeded by the migrations (conceptes,
// tipologies, ite_tarifa) are left alone.
//
// Dates are anchored on "today" at seed time, so re-running it refreshes the
// Planificació window.

import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const url = process.env.DEMO_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Set DEMO_DATABASE_URL (or DATABASE_URL) before running.");
  process.exit(1);
}
const dbName = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
if (!/demo/i.test(dbName)) {
  console.error(`Refusing to seed database "${dbName}" — the name must contain "demo".`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

let _s = 0x9e3779b9;
function rnd() {
  _s |= 0;
  _s = (_s + 0x6d2b79f5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
const money = (min, max, step = 50) => Math.round((min + rnd() * (max - min)) / step) * step;
function sample(arr, n) {
  const copy = arr.slice();
  const out = [];
  for (let i = 0; i < n && copy.length; i++) out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0]);
  return out;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const TODAY = new Date();
TODAY.setHours(12, 0, 0, 0);
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const dayOff = (n) => addDays(TODAY, n);
function dateInYear(year) {
  return new Date(Date.UTC(year, int(0, 11), int(1, 28), 12));
}
// A weekday-ish date, so the planner doesn't fill up with Sunday visits.
function workday(d) {
  const x = new Date(d);
  const w = x.getDay();
  if (w === 0) x.setDate(x.getDate() + 1);
  if (w === 6) x.setDate(x.getDate() + 2);
  return x;
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

const CITIES = [
  ["Barcelona", "08013"], ["Barcelona", "08025"], ["Barcelona", "08036"],
  ["Badalona", "08911"], ["L'Hospitalet de Llobregat", "08901"], ["Terrassa", "08221"],
  ["Sabadell", "08201"], ["Girona", "17001"], ["Mataró", "08301"], ["Sitges", "08870"],
  ["Vic", "08500"], ["Manresa", "08240"], ["Reus", "43201"], ["Granollers", "08400"],
  ["Igualada", "08700"], ["Sant Cugat del Vallès", "08172"], ["Cornellà de Llobregat", "08940"],
  ["Vilanova i la Geltrú", "08800"], ["Figueres", "17600"], ["Palafrugell", "17200"],
];

const STREETS = [
  "Carrer de Mallorca", "Carrer del Rosselló", "Avinguda Diagonal", "Carrer de Bailèn",
  "Rambla de Catalunya", "Carrer Gran de Gràcia", "Passeig de Sant Joan", "Carrer de Muntaner",
  "Carrer de la Riera", "Avinguda de la Font", "Carrer Major", "Passatge dels Til·lers",
  "Carrer del Pi Vell", "Avinguda Mediterrània", "Carrer de Montgrí", "Carrer de la Roureda",
];

const EMPRESES = [
  "Promocions Vallcorba SL", "Construccions Ribalta i Fills SL", "Estructures Nova Sitja SLU",
  "Immobiliària Cap de Creus SA", "Grup Edifica Mediterrani SL", "Bonavista Habitatges SL",
  "Rehabilitacions Puigmal SL", "Tallers Metàl·lics Sorell SL", "Hotels Marfull SA",
  "Distribucions Roldós SL", "Fusteria Camprodon SL", "Energies Tramuntana SL",
  "Clínica Dental Sant Andreu SLP", "Supermercats Vallès Nord SA", "Logística Portsec SL",
];

const COMUNITATS = [
  "CP Carrer Bellaterra, 42", "CP Avinguda Mediterrània, 118", "CP Passatge Molins, 7",
  "CP Carrer Nàpols, 233", "CP Rambla Sant Ferran, 9", "CP Carrer Roureda, 55",
  "CP Plaça del Pi Vell, 3", "CP Carrer Montgrí, 21", "CP Carrer de Ponent, 14",
];

const PUBLICS = [
  "Ajuntament de Vilanova del Camí", "Ajuntament de Sant Feliu de Codines",
  "Ajuntament de Palafrugell", "Consell Comarcal del Baix Ter", "Diputació de Ponent",
  "Institut Municipal d'Habitatge de Terrassa", "Consorci d'Educació del Vallès",
];

const PARTICULARS = [
  "Marta Puigcerdà Roure", "Jordi Alsina Ferrer", "Núria Bastida Colomer",
  "Ramon Vilaseca Mundó", "Laia Ferrer Miquel", "Sergi Bonet Ràfols",
  "Anna Rovira Duran", "Pau Estruch Llorens", "Elisenda Camps Prat",
  "Oriol Sagristà Vendrell", "Carme Batlle Fontanals", "Xavier Munné Tarrida",
  "Gemma Solanes Ripoll", "Enric Dalmau Costa", "Roser Vinyals Aguiló",
  "Marc Tarradellas Ollé", "Sílvia Codina Puigvert", "Albert Fontcuberta Serra",
];

const NOMS_CONTACTE = [
  "Aleix Serra", "Berta Miralles", "Clara Ventura", "David Roig", "Eva Pons",
  "Ferran Grau", "Helena Mas", "Ignasi Bosch", "Judit Aymerich", "Lluís Comes",
  "Mireia Sanjuán", "Nil Vergés", "Pere Casanovas", "Queralt Ymbern", "Rut Balcells",
  "Sara Feliu", "Toni Gispert", "Vera Llobet", "Guillem Ausió", "Ariadna Falgueras",
];

const PROJECTES = [
  "Reforma integral d'habitatge", "Rehabilitació de façana i patis de llum",
  "Projecte bàsic i executiu d'habitatge unifamiliar", "ITE i cèdula d'habitabilitat",
  "Ampliació de nau industrial", "Canvi d'ús de local a habitatge",
  "Projecte d'activitat per a bar-restaurant", "Reforma de coberta i impermeabilització",
  "Legalització d'obres executades", "Estudi de patologies estructurals",
  "Direcció d'obra de rehabilitació energètica", "Certificat d'eficiència energètica",
  "Projecte d'instal·lació d'ascensor", "Rehabilitació de mitgeres",
  "Adequació d'oficines", "Projecte de piscina i jardí", "Reforma de local comercial",
  "Diagnosi estructural de forjats", "Projecte d'urbanització de plaça",
  "Reforma de bany i cuina", "Consolidació de balcons",
  "Projecte executiu d'equipament esportiu", "Substitució de coberta de fibrociment",
  "Divisió horitzontal i cèdules", "Informe pericial d'humitats",
  "Reforç estructural de jàsseres", "Projecte de rehabilitació de coberta plana",
  "Estudi de viabilitat urbanística",
];

const VISITA_DO = "Visita direcció d'obres";
const TASQUES = [
  "Visita al lloc", VISITA_DO, "Informació a despatx", "Memòria", "Memòria Diagnosi",
  "Dibuix", "Amidaments", "Tràmits Administratius", "Reunió amb client",
  "Redacció de projecte", "Càlcul d'estructura", "Pressupost",
  "Coordinació industrials", "Primera Ocupació", "Informe Visites d'Obra",
];

const ACTIVITATS = [
  "Treball de web", "Treball de factures", "Formació", "Comptabilitat",
  "Comercial / prospecció", "Manteniment despatx",
];

const PRESCRIPTORS = [
  "Administració de Finques Serrat", "Finques Bonanova", "Gestoria Puig & Associats",
  "Administradors Vallmitjana", "Immobiliària Cases del Nord", "Recomanació de client",
  "Web pròpia", "Col·legi d'Aparelladors", "Finques Riera", "Contacte directe",
];

const COMENTARIS = [
  "Repàs d'amidaments amb el constructor.",
  "Pendent rebre la documentació del client.",
  "Revisió de plànols abans de visat.",
  "Coordinació amb l'instal·lador elèctric.",
  "Presa de dades i fotografies de l'estat actual.",
  "Ajust del pressupost segons canvis del promotor.",
  "Reunió a l'ajuntament per resoldre requeriment.",
  "Comprovació d'humitats a la planta baixa.",
  "Seguiment de l'execució de la coberta.",
  "Tancament de l'acta i enviament al client.",
];

const FITA_TIPUS = [
  ["Llicència d'obres", "diamond", "#f59e0b"],
  ["Inici d'obra", "triangle", "#16a34a"],
  ["Replanteig", "square", "#0ea5e9"],
  ["Certificat final d'obra", "star", "#a855f7"],
  ["Lliurament", "circle", "#ec4899"],
  ["Visat col·legial", "diamond", "#14b8a6"],
  ["Reunió de seguiment", "circle", "#3b82f6"],
  ["Fi d'obra", "star", "#ef4444"],
];

const INCLUSIONS = [
  "Redacció del projecte bàsic i executiu.",
  "Aixecament de plànols de l'estat actual.",
  "Tramitació de la llicència d'obres davant l'ajuntament.",
  "Direcció facultativa de les obres.",
  "Coordinació de seguretat i salut en fase d'execució.",
  "Certificat final d'obra i documentació de final d'obra.",
  "Amidaments i pressupost per a la comparació d'ofertes.",
  "Assistència a les reunions amb la propietat.",
];

const EXCLUSIONS = [
  "Taxes municipals i impostos (ICIO).",
  "Drets de visat col·legial.",
  "Estudi geotècnic i assaigs de laboratori.",
  "Projectes d'instal·lacions específiques signats per enginyer.",
  "Aixecament topogràfic.",
  "Gestió de residus i taxes d'abocador.",
  "Legalització d'instal·lacions davant indústria.",
];

const PAGAMENTS = [
  "A l'acceptació de la proposta",
  "A l'entrega del projecte bàsic",
  "A l'entrega del projecte executiu",
  "A l'inici de les obres",
  "Al certificat final d'obra",
];

const FACTURA_CONCEPTES = [
  "Honoraris de redacció de projecte",
  "Honoraris de direcció d'obra",
  "Honoraris d'inspecció tècnica d'edificis (ITE)",
  "Honoraris de certificat d'eficiència energètica",
  "Honoraris d'informe tècnic",
  "Honoraris de tramitació de llicència",
  "Honoraris de projecte d'activitat",
  "Primera certificació d'honoraris",
];

const SUPLITS = [
  ["Visat col·legial", 90, 320],
  ["Taxes municipals", 120, 600],
  ["Còpies i impressions", 20, 90],
  ["Certificat cadastral", 15, 45],
  ["Nota simple registral", 12, 30],
];

function nif(kind) {
  const letters = "ABCDEFGHJKLMNPQRSTUVW";
  const digits = () => String(int(10000000, 99999999));
  if (kind === "empresa") return pick(letters.split("")) + digits();
  if (kind === "public") return "P" + digits();
  return digits() + "TRWAGMYFPDXBNJZSQVHLCKE"[int(0, 22)];
}

const telefon = () =>
  chance(0.6)
    ? `6${int(10, 99)} ${int(100, 999)} ${int(100, 999)}`
    : `9${int(30, 79)} ${int(10, 99)} ${int(10, 99)} ${int(10, 99)}`;

const slug = (s) =>
  s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "").slice(0, 24);

// ---------------------------------------------------------------------------
// Build the dataset
// ---------------------------------------------------------------------------

const clients = [];
let clientId = 0;
for (const [names, kind] of [
  [EMPRESES, "empresa"], [COMUNITATS, "comunitat"], [PUBLICS, "public"], [PARTICULARS, "particular"],
]) {
  for (const nom of names) {
    const [ciutat, cp] = pick(CITIES);
    clients.push({
      id: ++clientId,
      nom,
      nif: nif(kind === "comunitat" ? "empresa" : kind),
      carrer: `${pick(STREETS)}, ${int(1, 220)}`,
      ciutat,
      codi_postal: cp,
      contacte: kind === "particular" ? nom : pick(NOMS_CONTACTE),
      kind,
    });
  }
}

const contactes = [];
let contacteId = 0;
for (const c of clients) {
  const n = c.kind === "particular" ? 1 : int(1, 3);
  for (const nom of sample(NOMS_CONTACTE, n)) {
    const person = c.kind === "particular" ? c.nom : nom;
    contactes.push({
      id: ++contacteId,
      client_id: c.id,
      nom: person,
      telefon: telefon(),
      mail: `${slug(person)}@${slug(c.nom).split(".").slice(0, 2).join("")}.cat`,
      comentari: chance(0.25) ? pick(["Contacte principal.", "Millor trucar a les tardes.", "Porta la part tècnica.", "Signa la documentació."]) : null,
      ordre: contactes.length,
    });
  }
}
// A few contacts not tied to any client.
for (const nom of sample(NOMS_CONTACTE, 6)) {
  contactes.push({
    id: ++contacteId,
    client_id: null,
    nom,
    telefon: telefon(),
    mail: `${slug(nom)}@correu.cat`,
    comentari: pick(["Industrial de fusteria.", "Constructor de confiança.", "Enginyer col·laborador.", "Topògraf."]),
    ordre: contactes.length,
  });
}

// --- Honoraris càlculs -----------------------------------------------------

const CONCEPTES_DIRECTES = [
  ["Visita al lloc", 28.27], ["Visites", 28.27], ["Informació a despatx", 28.27],
  ["Memòria Diagnosi", 32.0], ["Memòria", 30.0], ["Dibuix", 28.27],
  ["Amidaments", 30.0], ["Tràmits Administratius", 26.0], ["Primera Ocupació", 28.27],
  ["Informe Visites d'Obra", 30.0],
];
const CONCEPTES_ALTRES = [
  ["Desplaçaments Benzina (litres)", 0.34, 20, 90],
  ["Desplaçament Desgast Cotxe", 0.1, 40, 250],
  ["Desplaçament Peatges", 5.28, 2, 12],
  ["Pàrquing", 3.0, 2, 14],
  ["Dietes Dinar", 10.0, 1, 8],
  ["Còpies", 25.0, 1, 4],
  ["Visat", 0.0, 1, 1],
  ["Responsabilitat Civil", 0.0201, 1, 1],
  ["Altres Despeses", 10.0, 1, 6],
];

const calculs = [];
const calculDirectes = [];
const calculAltres = [];
let calculId = 0;
for (const [year, count] of [[2024, 8], [2025, 12], [2026, 14]]) {
  const yy = String(year).slice(-2);
  for (let i = 1; i <= count; i++) {
    const esIte = chance(0.25);
    const client = pick(clients);
    const id = ++calculId;
    calculs.push({
      id,
      num_proposta: `${yy}-${String(i).padStart(3, "0")}`,
      data: iso(dateInYear(year)),
      projecte: pick(PROJECTES),
      client_id: client.id,
      contacte_prescriptor: pick(PRESCRIPTORS),
      preu_hora_default: 28.27,
      despeses_indirectes_pct: esIte ? 0 : int(8, 18),
      benefici_pct: esIte ? 0 : int(8, 20),
      total_honoraris_override: null,
      es_ite: esIte,
      ut_habitatges: esIte ? int(4, 42) : 0,
      ut_locals_200: esIte ? int(0, 4) : 0,
      ut_locals_400: esIte ? int(0, 2) : 0,
      ut_locals_600: 0,
      ut_locals_800: 0,
      ut_locals_1000: 0,
      ite_descompte_pct: esIte && chance(0.3) ? int(5, 15) : 0,
      ite_comissio_activa: esIte && chance(0.4),
      ite_comissio_pct: 10,
      year,
    });

    if (esIte) continue;
    for (const [nom, preu] of sample(CONCEPTES_DIRECTES, int(3, 7))) {
      calculDirectes.push({
        proposta_id: id,
        concepte_nom: nom,
        hores: int(2, 60) + (chance(0.5) ? 0.5 : 0),
        preu_hora: preu,
        ordre: calculDirectes.length,
      });
    }
    for (const [nom, preu, lo, hi] of sample(CONCEPTES_ALTRES, int(2, 5))) {
      calculAltres.push({
        proposta_id: id,
        concepte_nom: nom,
        unitats: int(lo, hi),
        preu_unitat: preu,
        ordre: calculAltres.length,
      });
    }
  }
}
// Rough total per càlcul, used to keep linked propostes/expedients coherent.
const calculTotal = new Map();
for (const c of calculs) {
  if (c.es_ite) {
    const ent = c.ut_habitatges + c.ut_locals_200 + c.ut_locals_400 * 2;
    calculTotal.set(c.id, ent < 6 ? 650 : ent < 11 ? 750 : 850 + 15 * (ent - 10));
  } else {
    const base =
      calculDirectes.filter((l) => l.proposta_id === c.id).reduce((s, l) => s + l.hores * l.preu_hora, 0) +
      calculAltres.filter((l) => l.proposta_id === c.id && l.concepte_nom !== "Responsabilitat Civil")
        .reduce((s, l) => s + l.unitats * l.preu_unitat, 0);
    const rest = 100 - Number(c.despeses_indirectes_pct) - Number(c.benefici_pct);
    calculTotal.set(c.id, rest > 0 ? (base * 100) / rest : base);
  }
}

// --- Propostes (document) --------------------------------------------------

const propostesDoc = [];
const docServeis = [];
const docInclusions = [];
const docExclusions = [];
const docPagaments = [];
let docId = 0;
for (const [year, count] of [[2024, 6], [2025, 9], [2026, 11]]) {
  const yy = String(year).slice(-2);
  for (let i = 1; i <= count; i++) {
    const client = pick(clients);
    const [ciutat, cp] = pick(CITIES);
    const linked = chance(0.45) ? pick(calculs.filter((c) => c.year === year)) : null;
    const id = ++docId;
    propostesDoc.push({
      id,
      num: `PH-${yy}-${String(i).padStart(3, "0")}`,
      data: iso(dateInYear(year)),
      descripcio: pick(PROJECTES),
      adreca: `${pick(STREETS)}, ${int(1, 180)}`,
      ciutat,
      codi_postal: cp,
      client_id: client.id,
      calcul_id: linked ? linked.id : null,
      estat: year === 2026 ? pick(["pendent", "pendent", "acceptada", "rebutjada"])
        : pick(["acceptada", "acceptada", "acceptada", "pendent", "rebutjada"]),
    });

    const total = linked ? Math.round(calculTotal.get(linked.id) / 50) * 50 : money(1800, 42000);
    const nServeis = int(1, 4);
    let left = total;
    for (let s = 0; s < nServeis; s++) {
      const preu = s === nServeis - 1 ? Math.max(left, 0) : Math.round((left / (nServeis - s)) * (0.7 + rnd() * 0.6) / 50) * 50;
      left -= preu;
      docServeis.push({
        doc_id: id,
        descripcio: pick([
          "Projecte bàsic i executiu", "Direcció facultativa d'obra",
          "Estudi bàsic de seguretat i salut", "Coordinació de seguretat i salut",
          "Certificat final d'obra", "Informe tècnic i diagnosi",
          "Amidaments i pressupost", "Tramitació de llicència",
        ]),
        preu: Math.max(preu, 150),
        ordre: docServeis.length,
      });
    }
    for (const text of sample(INCLUSIONS, int(3, 6))) {
      docInclusions.push({ doc_id: id, text, ordre: docInclusions.length });
    }
    for (const text of sample(EXCLUSIONS, int(2, 5))) {
      docExclusions.push({ doc_id: id, text, ordre: docExclusions.length });
    }
    const nPag = int(2, 4);
    for (let p = 0; p < nPag; p++) {
      docPagaments.push({
        doc_id: id,
        descripcio: PAGAMENTS[p % PAGAMENTS.length],
        import: Math.round((total / nPag) * 100) / 100,
        ordre: docPagaments.length,
      });
    }
  }
}

// --- Expedients ------------------------------------------------------------

const CATEGORIES = ["re", "re", "re", "ed", "ed", "co", "co", "rec", "do"];
const expedients = [];
let expNum = 0;
for (const [year, count] of [[2021, 12], [2022, 16], [2023, 20], [2024, 22], [2025, 26], [2026, 24]]) {
  const yy = String(year).slice(-2);
  for (let i = 0; i < count; i++) {
    expNum += 1;
    const tancatProb = year <= 2023 ? 0.94 : year === 2024 ? 0.88 : year === 2025 ? 0.55 : 0.15;
    const tancat = chance(tancatProb);
    const client = pick(clients);

    let inici, final, tancament = null;
    if (tancat) {
      inici = dateInYear(year);
      final = addDays(inici, int(60, 400));
      tancament = addDays(inici, int(50, 430));
      if (tancament > TODAY) tancament = addDays(TODAY, -int(5, 200));
    } else {
      // Open files straddle "today" so the Planificació gantt is populated.
      inici = chance(0.15) ? dayOff(int(4, 30)) : dayOff(-int(20, 520));
      final = dayOff(int(12, 260));
    }

    // Only link paperwork that already existed when the file was opened.
    const calculsFins = calculs.filter((c) => c.year <= year);
    const docsFins = propostesDoc.filter((d) => Number(d.data.slice(0, 4)) <= year);
    const calcul = calculsFins.length && chance(0.28) ? pick(calculsFins) : null;
    const doc = !calcul && docsFins.length && chance(0.22) ? pick(docsFins) : null;
    const pressupost = calcul
      ? Math.round(calculTotal.get(calcul.id) / 50) * 50
      : money(3500, 240000, 100);

    expedients.push({
      id: expNum,
      num_expedient: `${yy}-${String(expNum).padStart(4, "0")}`,
      projecte: pick(PROJECTES),
      client_id: client.id,
      ciutat: client.ciutat,
      estat: tancat ? "tancat" : "obert",
      categoria: pick(CATEGORIES),
      tipologia_nom: null, // filled from the catalog at insert time
      tipus: client.kind === "public" ? "public" : chance(0.12) ? "public" : "privat",
      direccio_obres: chance(0.42),
      web: chance(0.3),
      pressupost,
      pressupost_origen: calcul ? "calcul" : doc ? "proposta" : "manual",
      calcul_id: calcul ? calcul.id : null,
      proposta_doc_id: doc ? doc.id : null,
      data_inici: iso(inici),
      data_final: iso(final),
      data_tancament: tancament ? iso(tancament) : null,
      _inici: inici,
      _final: final,
      _tancament: tancament,
      year,
    });
  }
}
const oberts = expedients.filter((e) => e.estat === "obert");

// --- Dedicacions -----------------------------------------------------------

const dedicacions = [];
for (const e of expedients) {
  const from = e._inici;
  const to = e._tancament ?? (e._final < TODAY ? e._final : TODAY);
  const span = Math.max(1, Math.round((to - from) / 86400000));
  const n = int(3, e.estat === "obert" ? 14 : 10);
  for (let i = 0; i < n; i++) {
    const d = workday(addDays(from, int(0, span)));
    dedicacions.push({
      expedient_id: e.id,
      activitat: null,
      data: iso(d),
      hores: [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8][int(0, 9)],
      tasca: pick(TASQUES.filter((t) => t !== VISITA_DO)),
      comentari: chance(0.45) ? pick(COMENTARIS) : null,
      _visita: false,
    });
  }
  // Site-visit entries drive the Planificació "visites" markers.
  if (e.direccio_obres) {
    const visites = e.estat === "obert" ? int(3, 7) : int(1, 4);
    for (let i = 0; i < visites; i++) {
      const d = e.estat === "obert" ? workday(dayOff(int(-16, 44))) : workday(addDays(from, int(0, span)));
      dedicacions.push({
        expedient_id: e.id,
        activitat: null,
        data: iso(d),
        hores: [1.5, 2, 2.5, 3][int(0, 3)],
        tasca: VISITA_DO,
        comentari: chance(0.6) ? pick(COMENTARIS) : null,
        _visita: true,
      });
    }
  }
}
// Non-expedient work.
for (let i = 0; i < 60; i++) {
  dedicacions.push({
    expedient_id: null,
    activitat: pick(ACTIVITATS),
    data: iso(workday(dayOff(-int(0, 700)))),
    hores: [0.5, 1, 1.5, 2, 3][int(0, 4)],
    tasca: pick(["Informació a despatx", "Tràmits Administratius", "Reunió amb client"]),
    comentari: chance(0.3) ? pick(COMENTARIS) : null,
    _visita: false,
  });
}

// --- Fites -----------------------------------------------------------------

const fites = [];
for (const e of oberts) {
  for (const [nom] of sample(FITA_TIPUS, int(1, 4))) {
    fites.push({ expedient_id: e.id, tipus_nom: nom, data: iso(workday(dayOff(int(-14, 42)))) });
  }
}

// --- Factures --------------------------------------------------------------

const factures = [];
const facturaSuplits = [];
const facturaConceptes = [];
let facturaId = 0;
for (const [year, count] of [[2024, 26], [2025, 34], [2026, 28]]) {
  const yy = String(year).slice(-2);
  for (let i = 1; i <= count; i++) {
    const exp = pick(expedients.filter((e) => e.year <= year)) ?? pick(expedients);
    const client = clients.find((c) => c.id === exp.client_id);
    const id = ++facturaId;
    const preu = money(600, 26000, 10);
    const data = year === 2026 ? workday(dayOff(-int(1, 240))) : dateInYear(year);
    factures.push({
      id,
      num: `${yy}-${String(i).padStart(3, "0")}`,
      estat: "emesa",
      client_id: client.id,
      data: iso(data),
      expedient_id: exp.id,
      preu,
      iva_pct: 21,
      pagada: year < 2026 ? chance(0.96) : chance(0.62),
      concepte: pick(FACTURA_CONCEPTES),
      lang: chance(0.7) ? "es" : "ca",
    });

    if (chance(0.3)) {
      for (const [descripcio, lo, hi] of sample(SUPLITS, int(1, 3))) {
        facturaSuplits.push({ factura_id: id, descripcio, import: money(lo, hi, 1), ordre: facturaSuplits.length });
      }
    }
    if (chance(0.22)) {
      const n = int(2, 3);
      let left = preu;
      for (let k = 0; k < n; k++) {
        const imp = k === n - 1 ? Math.round(left * 100) / 100 : Math.round((left / (n - k)) * 100) / 100;
        left -= imp;
        facturaConceptes.push({
          factura_id: id,
          descripcio: pick(FACTURA_CONCEPTES),
          import: imp,
          ordre: facturaConceptes.length,
        });
      }
    }
  }
}
// "Propera facturació" rows: no number, no date yet.
for (let i = 0; i < 7; i++) {
  const exp = pick(oberts);
  factures.push({
    id: ++facturaId,
    num: null,
    estat: "propera",
    client_id: exp.client_id,
    data: null,
    expedient_id: exp.id,
    preu: money(800, 18000, 10),
    iva_pct: 21,
    pagada: false,
    concepte: pick(FACTURA_CONCEPTES),
    lang: chance(0.7) ? "es" : "ca",
  });
}

// --- Actes -----------------------------------------------------------------

const TEMES = [
  ["Estat general de l'obra", "S'observa un avanç correcte respecte a la planificació prevista. La coberta està enllestida i es continua amb els tancaments interiors."],
  ["Estructura", "Es revisen els reforços dels forjats de planta primera. Cal aportar el certificat de l'acer abans del proper certificat."],
  ["Instal·lacions", "Pendent de definir el traçat definitiu de la instal·lació de fontaneria a la zona de cuines."],
  ["Façana", "S'acorda mantenir l'acabat de morter monocapa en color sorra segons mostra aprovada per la propietat."],
  ["Seguretat i salut", "Es recorda l'obligació de mantenir les baranes perimetrals a totes les plantes."],
  ["Terminis", "Es preveu acabar els treballs d'envans la setmana vinent per encadenar amb els paviments."],
  ["Pressupost i canvis", "El promotor sol·licita pressupost per a l'ampliació del bany de planta baixa."],
  ["Documentació", "Cal lliurar les fitxes tècniques dels materials per a la documentació de final d'obra."],
];
const EMPRESES_ACTA = ["Direcció d'obra", "Promotor", "Constructora", "Industrial d'instal·lacions", "Coordinació S+S"];

const actes = [];
let actaId = 0;
const candidatesActa = oberts.filter((e) => e.direccio_obres).slice(0, 16);
for (const [idx, e] of candidatesActa.entries()) {
  const client = clients.find((c) => c.id === e.client_id);
  const data = workday(dayOff(-int(2, 70)));
  const assistents = sample(NOMS_CONTACTE, int(3, 5)).map((nom) => ({
    present: chance(0.85), nom, empresa: pick(EMPRESES_ACTA),
  }));
  const temes = sample(TEMES, int(3, 6)).map(([titol, text]) => ({
    titol, text,
    responsable: pick(NOMS_CONTACTE),
    responsables: [pick(NOMS_CONTACTE)],
    estat: pick(["pendent", "executat", "tractat"]),
  }));
  const propera = workday(addDays(data, int(7, 21)));
  actes.push({
    id: ++actaId,
    num: `AC-26-${String(idx + 1).padStart(3, "0")}`,
    tipus: pick(["visita", "visita", "visita", "reunio", "coordinacio"]),
    expedient_id: e.id,
    acta_num: String(int(1, 9)).padStart(2, "0"),
    data: iso(data),
    hora: pick(["09:00", "09:30", "10:00", "11:00", "16:00", "17:30"]),
    lloc: `${e.projecte} — ${e.ciutat}`,
    projecte: e.projecte,
    referencia: e.num_expedient,
    ubicacio: `${pick(STREETS)}, ${int(1, 180)} — ${e.ciutat}`,
    client: client.nom,
    assistents,
    temes,
    propera_data: iso(propera),
    propera_hora: pick(["09:30", "10:00", "16:00"]),
    signatures: [
      { titol: "Direcció d'obra", persona: "David Lladó (DL)" },
      { titol: "Contractista", persona: pick(NOMS_CONTACTE) },
    ],
  });
}

// --- Notes -----------------------------------------------------------------

const notes = [
  {
    id: 1,
    title: "Pendents de la setmana",
    content:
      "<h3>Pendents</h3><ul><li>Enviar proposta PH-26-004 a la comunitat del Carrer Nàpols</li>" +
      "<li>Revisar amidaments de la reforma de Sitges</li><li>Trucar a l'administrador de finques per l'ITE</li>" +
      "<li>Passar a visat el projecte de la nau de Granollers</li></ul>",
  },
  {
    id: 2,
    title: "Contactes útils",
    content:
      "<h3>Industrials</h3><ul><li>Fusteria Camprodon — pressupostos en 3-4 dies</li>" +
      "<li>Estructures Nova Sitja — càlcul de bigues</li><li>Topògraf: Guillem Ausió</li></ul>",
  },
  {
    id: 3,
    title: "Notes de la reunió amb l'ajuntament",
    content:
      "<h3>Llicència Palafrugell</h3><p>Cal aportar l'estudi de gestió de residus i la fitxa " +
      "d'accessibilitat. El tècnic municipal confirma que no cal informe de patrimoni.</p>",
  },
  {
    id: 4,
    title: "Tarifes i criteris",
    content:
      "<h3>Criteris de pressupost</h3><ul><li>Preu/hora base: 28,27 €</li>" +
      "<li>Despeses indirectes: 12-15 %</li><li>Benefici: 12-18 %</li>" +
      "<li>ITE: segons taula d'entitats</li></ul>",
  },
];

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

const pool = new Pool({ connectionString: url });
const client = await pool.connect();

async function insertMany(table, columns, rows) {
  if (!rows.length) return;
  const size = 200;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const params = [];
    const tuples = chunk.map((r) => {
      const ph = columns.map((c) => {
        params.push(r[c]);
        return `$${params.length}`;
      });
      return `(${ph.join(", ")})`;
    });
    await client.query(
      `insert into public.${table} (${columns.map((c) => `"${c}"`).join(", ")}) values ${tuples.join(", ")}`,
      params,
    );
  }
}

try {
  await client.query("begin");

  await client.query(`
    truncate table
      public.acta, public.expedient_fita, public.dedicacions,
      public.factura_concepte, public.factura_suplit, public.factura,
      public.proposta_doc_servei, public.proposta_doc_inclusio,
      public.proposta_doc_exclusio, public.proposta_doc_pagament, public.proposta_doc,
      public.proposta_despesa_directa_line, public.proposta_altra_despesa_line,
      public.propostes, public.expedients, public.client_contactes, public.clients,
      public.fita_tipus, public.notes, public.tasca
    restart identity cascade
  `);

  // The ITE planned-hours formula looks for a despesa directa concept named "ITE".
  await client.query(`
    insert into public.concepte_despesa_directa (nom, preu_hora_default, ordre)
    values ('ITE', 32.00, 110)
    on conflict (nom) do nothing
  `);

  await insertMany(
    "clients",
    ["id", "nom", "nif", "carrer", "ciutat", "codi_postal", "contacte"],
    clients,
  );
  await insertMany(
    "client_contactes",
    ["id", "client_id", "nom", "telefon", "mail", "comentari", "ordre"],
    contactes,
  );

  await insertMany(
    "propostes",
    [
      "id", "num_proposta", "data", "projecte", "client_id", "contacte_prescriptor",
      "preu_hora_default", "despeses_indirectes_pct", "benefici_pct", "total_honoraris_override",
      "es_ite", "ut_habitatges", "ut_locals_200", "ut_locals_400", "ut_locals_600",
      "ut_locals_800", "ut_locals_1000", "ite_descompte_pct", "ite_comissio_activa", "ite_comissio_pct",
    ],
    calculs,
  );

  // Catalog ids, needed by the line tables.
  const directaIds = new Map(
    (await client.query("select id, nom from public.concepte_despesa_directa")).rows.map((r) => [r.nom, Number(r.id)]),
  );
  const altraIds = new Map(
    (await client.query("select id, nom from public.concepte_altra_despesa")).rows.map((r) => [r.nom, Number(r.id)]),
  );
  await insertMany(
    "proposta_despesa_directa_line",
    ["proposta_id", "concepte_id", "hores", "preu_hora", "ordre"],
    calculDirectes.map((l) => ({ ...l, concepte_id: directaIds.get(l.concepte_nom) })),
  );
  await insertMany(
    "proposta_altra_despesa_line",
    ["proposta_id", "concepte_id", "unitats", "preu_unitat", "ordre"],
    calculAltres.map((l) => ({ ...l, concepte_id: altraIds.get(l.concepte_nom) })),
  );

  await insertMany(
    "proposta_doc",
    ["id", "num", "data", "descripcio", "adreca", "ciutat", "codi_postal", "client_id", "calcul_id", "estat"],
    propostesDoc,
  );
  await insertMany("proposta_doc_servei", ["doc_id", "descripcio", "preu", "ordre"], docServeis);
  await insertMany("proposta_doc_inclusio", ["doc_id", "text", "ordre"], docInclusions);
  await insertMany("proposta_doc_exclusio", ["doc_id", "text", "ordre"], docExclusions);
  await insertMany("proposta_doc_pagament", ["doc_id", "descripcio", "import", "ordre"], docPagaments);

  // Tipologies come from the migrations; spread the expedients across them.
  const tipologiaIds = (await client.query("select id from public.tipologies order by ordre, nom")).rows.map((r) => Number(r.id));
  for (const e of expedients) e.tipologia_id = pick(tipologiaIds);

  await insertMany(
    "expedients",
    [
      "id", "num_expedient", "projecte", "client_id", "ciutat", "estat", "categoria",
      "tipologia_id", "tipus", "direccio_obres", "web", "pressupost", "pressupost_origen",
      "calcul_id", "proposta_doc_id", "data_inici", "data_final", "data_tancament",
    ],
    expedients,
  );

  await insertMany(
    "dedicacions",
    ["expedient_id", "activitat", "data", "hores", "tasca", "comentari"],
    dedicacions,
  );
  await insertMany(
    "tasca",
    ["nom"],
    [...new Set(dedicacions.map((d) => d.tasca).filter(Boolean))].map((nom) => ({ nom })),
  );

  await insertMany(
    "fita_tipus",
    ["id", "nom", "forma", "color"],
    FITA_TIPUS.map(([nom, forma, color], i) => ({ id: i + 1, nom, forma, color })),
  );
  const fitaIds = new Map(FITA_TIPUS.map(([nom], i) => [nom, i + 1]));
  await insertMany(
    "expedient_fita",
    ["expedient_id", "tipus_id", "data"],
    fites.map((f) => ({ ...f, tipus_id: fitaIds.get(f.tipus_nom) })),
  );

  await insertMany(
    "factura",
    ["id", "num", "estat", "client_id", "data", "expedient_id", "preu", "iva_pct", "pagada", "concepte", "lang"],
    factures,
  );
  await insertMany("factura_suplit", ["factura_id", "descripcio", "import", "ordre"], facturaSuplits);
  await insertMany("factura_concepte", ["factura_id", "descripcio", "import", "ordre"], facturaConceptes);
  // Where an invoice has a concept breakdown, the header price is their sum.
  await client.query(`
    update public.factura f
       set preu = s.total
      from (select factura_id, sum(import) as total from public.factura_concepte group by factura_id) s
     where s.factura_id = f.id
  `);

  await insertMany(
    "acta",
    [
      "id", "num", "tipus", "expedient_id", "acta_num", "data", "hora", "lloc", "projecte",
      "referencia", "ubicacio", "client", "assistents", "temes", "propera_data", "propera_hora", "signatures",
    ],
    actes.map((a) => ({
      ...a,
      assistents: JSON.stringify(a.assistents),
      temes: JSON.stringify(a.temes),
      signatures: JSON.stringify(a.signatures),
    })),
  );
  // Hang each acta off one of its expedient's site visits, like the app does.
  await client.query(`
    update public.acta a
       set dedicacio_id = (
         select d.id from public.dedicacions d
          where d.expedient_id = a.expedient_id and d.tasca = $1
          order by d.data desc, d.id desc limit 1
       )
     where a.expedient_id is not null
  `, [VISITA_DO]);

  await insertMany("notes", ["id", "title", "content"], notes);

  // Explicit ids were used above, so push the sequences past them.
  for (const t of ["clients", "client_contactes", "propostes", "proposta_doc", "expedients", "factura", "acta", "fita_tipus", "notes"]) {
    await client.query(
      `select setval(pg_get_serial_sequence('public.${t}', 'id'), coalesce((select max(id) from public.${t}), 1))`,
    );
  }

  await client.query("commit");
} catch (err) {
  await client.query("rollback").catch(() => {});
  console.error("seed FAILED");
  console.error(err);
  client.release();
  await pool.end();
  process.exit(1);
}

const counts = await client.query(`
  select 'clients' t, count(*) n from public.clients
  union all select 'contactes', count(*) from public.client_contactes
  union all select 'expedients', count(*) from public.expedients
  union all select 'dedicacions', count(*) from public.dedicacions
  union all select 'fites', count(*) from public.expedient_fita
  union all select 'calculs', count(*) from public.propostes
  union all select 'propostes', count(*) from public.proposta_doc
  union all select 'factures', count(*) from public.factura
  union all select 'actes', count(*) from public.acta
  union all select 'notes', count(*) from public.notes
  order by 1
`);
for (const r of counts.rows) console.log(`  ${r.t}: ${r.n}`);

client.release();
await pool.end();
console.log(`done — demo data seeded into "${dbName}".`);
