// The Descàrregues page: which documents it offers and how their files are
// named. Pure (the page, the download route and the generator share it).
//
// Each run of the generator (src/lib/descarregues/generar.ts) writes every
// PDF and the «Global» zip into a new folder of the private store and then an
// index (`index.json`) that points at it; the previous folders are deleted.
//   <area>/descarregues/index.json
//   <area>/descarregues/<carpeta>/expedients-2026.pdf, …, global.zip
// <area> is "dac" (the studio) or "demo" (the demo account, its own fake data).

export type Llista =
  | "expedients"
  | "expedients-estadistica"
  | "dedicacio-estadistica"
  | "actes"
  | "ite"
  | "honoraris"
  | "propostes"
  | "facturacio"
  | "clients"
  | "contactes";

// nom: the downloaded file's name (plus the year); carpeta: its folder in the zip.
export const LLISTES: Record<Llista, { nom: string; carpeta: string }> = {
  expedients: { nom: "Expedients", carpeta: "Expedients" },
  "expedients-estadistica": { nom: "Expedients - estadística", carpeta: "Expedients" },
  "dedicacio-estadistica": { nom: "Dedicació - estadística", carpeta: "Dedicació" },
  actes: { nom: "Actes", carpeta: "Actes" },
  ite: { nom: "ITE", carpeta: "ITE" },
  honoraris: { nom: "Càlculs d'honoraris", carpeta: "Honoraris" },
  propostes: { nom: "Propostes d'honoraris", carpeta: "Propostes" },
  facturacio: { nom: "Facturació", carpeta: "Facturació" },
  clients: { nom: "Clients", carpeta: "Base de Dades" },
  contactes: { nom: "Contactes", carpeta: "Base de Dades" },
};

// The rows of the page, in the order the studio asked for them. `anys`: one
// PDF per year («tots»), the current year's («actual») or a single one («cap»).
export const FILES: { titol: string; llista: Llista; anys: "tots" | "actual" | "cap" }[] = [
  { titol: "Expedients de tots els anys", llista: "expedients", anys: "tots" },
  { titol: "Expedients de l'any en curs", llista: "expedients", anys: "actual" },
  { titol: "Estadística d'expedients de l'any en curs", llista: "expedients-estadistica", anys: "actual" },
  { titol: "Estadística de dedicació de l'any en curs", llista: "dedicacio-estadistica", anys: "actual" },
  { titol: "Actes de tots els anys", llista: "actes", anys: "tots" },
  { titol: "Actes de l'any en curs", llista: "actes", anys: "actual" },
  { titol: "ITE de tots els anys", llista: "ite", anys: "tots" },
  { titol: "ITE de l'any en curs", llista: "ite", anys: "actual" },
  { titol: "Càlculs d'honoraris de tots els anys", llista: "honoraris", anys: "tots" },
  { titol: "Càlculs d'honoraris de l'any en curs", llista: "honoraris", anys: "actual" },
  { titol: "Propostes d'honoraris de tots els anys", llista: "propostes", anys: "tots" },
  { titol: "Propostes d'honoraris de l'any en curs", llista: "propostes", anys: "actual" },
  { titol: "Facturació de tots els anys", llista: "facturacio", anys: "tots" },
  { titol: "Facturació de l'any en curs", llista: "facturacio", anys: "actual" },
  { titol: "Llistat de clients", llista: "clients", anys: "cap" },
  { titol: "Llistat de contactes", llista: "contactes", anys: "cap" },
];

export const ZIP = "global.zip";

export interface Manifest {
  generat: string; // ISO time of the run
  anyActual: number; // «l'any en curs» when it ran (Barcelona time)
  carpeta: string; // the run's folder
  fitxers: { nom: string; bytes: number; files: number }[]; // PDFs; `files` = rows listed
  zip: { nom: string; bytes: number };
  ms: number; // how long the run took
}

const LLISTA_KEYS = Object.keys(LLISTES) as Llista[];

// "expedients-2026.pdf", "clients.pdf"
export function nomFitxer(llista: Llista, any?: number | null): string {
  return `${llista}${any ? `-${any}` : ""}.pdf`;
}

export function parseFitxer(nom: string): { llista: Llista; any: number | null } | null {
  const m = /^([a-z]+(?:-[a-z]+)*?)(?:-(\d{4}))?\.pdf$/.exec(nom);
  if (!m || !LLISTA_KEYS.includes(m[1] as Llista)) return null;
  return { llista: m[1] as Llista, any: m[2] ? Number(m[2]) : null };
}

// "Expedients 2026.pdf"
export function nomDescarrega(llista: Llista, any: number | null): string {
  return `${LLISTES[llista].nom}${any ? ` ${any}` : ""}.pdf`;
}

// A run's folder: when it started (so newer sorts after older) plus a few random letters.
export const CARPETA = /^\d{8}-\d{6}-[a-z0-9]{4}$/;

export function areaPrefix(area: "dac" | "demo"): string {
  return `${area}/descarregues/`;
}

// Date and time in Barcelona: "24/11/2026 06:00".
export function dataHoraBcn(iso: string | Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

export function anyBcn(d: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric" }).format(d));
}

// "2026-11-24", the day in Barcelona.
export function diaBcn(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
