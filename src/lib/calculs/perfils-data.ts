// Catalogue tables, transcribed from the catalogue sheets David sent (the
// photos are under /public/calculs/perfils, linked from each table). One JSON
// file per table in ./perfils: { key, title, legend, columns, rows }, with
// rows[].v holding one number (or null for "—") per column.

import type { PerfilColumn, PerfilFamily, PerfilRow, SoldaduraRow } from "./perfils";
import ipe from "./perfils/ipe.json";
import ipn from "./perfils/ipn.json";
import heb from "./perfils/heb.json";
import hea from "./perfils/hea.json";
import hem from "./perfils/hem.json";
import upn from "./perfils/upn.json";
import t from "./perfils/t.json";
import l from "./perfils/l.json";
import ld from "./perfils/ld.json";
import zf from "./perfils/zf.json";
import tubQuadrat from "./perfils/tub-quadrat.json";
import tubRectangular from "./perfils/tub-rectangular.json";
import tubRodo from "./perfils/tub-rodo.json";
import rodoMassis from "./perfils/rodo-massis.json";
import soldadura from "./perfils/soldadura.json";

interface RawFamily {
  key: string;
  title: string;
  legend: { sym: string; desc: string }[];
  columns: PerfilColumn[];
  rows: { name: string; v: (number | null)[]; avail: string | null }[];
}

// Header bands are printed in Spanish in the catalogue.
const GROUPS: Record<string, string> = {
  Dimensiones: "Dimensions",
  "Términos de sección": "Termes de secció",
  "Posición del centro": "Posició del centre",
  "Posición de los ejes": "Posició dels eixos",
  Agujeros: "Forats",
  Peso: "Pes",
};

// Cells that look misprinted in the catalogue, found by checking each row
// against its other values and the section geometry. They are shown as
// printed, marked, with this note. None is a value the checks use. Where the
// photo itself was too blurry to tell two digits apart, the JSON holds the
// reading that fits the rest of the row and the note says so.
const ERRATA: { family: string; row: string; col: string; note: string }[] = [
  { family: "l", row: "L 45.5", col: "w", note: "Probable errata: w = b/√2 = 3,18 cm, com a les altres L 45." },
  { family: "l", row: "L 50.4", col: "ieta", note: "Lectura dubtosa a la foto (0,98 o 0,96); √(Iη/A) = 0,978 cm." },
  { family: "l", row: "L 60.8", col: "Weta", note: "Probable errata: Iη/v1 = 4,88 cm³." },
  { family: "l", row: "L 80.10", col: "Wx", note: "Probable errata: Ix/(b − c) = 15,4 cm³." },
  { family: "ld", row: "L 40.25.4", col: "p", note: "Errata: p = 0,785·A = 1,93 kp/m." },
  { family: "ld", row: "L 45.30.5", col: "name", note: "Al catàleg diu «L 45.30.4» (repetit), però el gruix d'aquesta fila és 5 mm." },
  { family: "ld", row: "L 80.40.6", col: "iy", note: "Lectura dubtosa a la foto (1,05 o 1,08); √(Iy/A) = 1,05 cm." },
  { family: "ld", row: "L 80.60.8", col: "Ix", note: "Lectura dubtosa a la foto (el 3 i el 9 es confonen); 66,30 quadra amb la resta de la fila." },
  { family: "ld", row: "L 100.65.7", col: "Iy", note: "Atenció, errata desfavorable: la resta de la fila i la geometria donen Iy ≈ 37,6 cm⁴." },
  { family: "ld", row: "L 120.80.12", col: "u", note: "Errata: el perímetre és 391 mm, com a les altres L 120.80." },
  { family: "ld", row: "L 120.80.12", col: "Izeta", note: "Lectura dubtosa a la foto (el 3 i el 9 es confonen); 371 quadra amb Ix + Iy − Iη." },
  { family: "ld", row: "L 130.65.8", col: "Wy", note: "Probable errata: Iy/(b − cy) = 8,7 cm³." },
  ...["L 80.60.6", "L 80.60.7", "L 80.60.8"].map((row) => ({ family: "ld", row, col: "w2", note: "No quadra amb la geometria (≈ 4,3 cm)." })),
  ...["L 200.100.10", "L 200.100.12", "L 200.100.15"].map((row) => ({ family: "ld", row, col: "w2", note: "No quadra amb la geometria (≈ 8,7 – 8,9 cm)." })),
  ...["L 200.150.10", "L 200.150.12", "L 200.150.15", "L 200.150.18"].map((row) => ({ family: "ld", row, col: "v3", note: "No quadra amb la geometria (≈ 4,3 – 4,5 cm)." })),
  { family: "zf", row: "ZF 100.2.0", col: "tga", note: "Errata: a partir d'Ix, Iy i Ixy, tg α = 0,667." },
  { family: "zf", row: "ZF 160.2.5", col: "w1", note: "Errata: repeteix v2; per a aquesta alçada w1 ≈ 9,00 cm." },
  { family: "zf", row: "ZF 300.2.5", col: "tga", note: "Lectura dubtosa a la foto (0,203 o 0,208); Ix, Iy i Ixy donen 0,203." },
  { family: "zf", row: "ZF 300.3.0", col: "ieta", note: "Atenció, errata desfavorable: √(Iη/A) = 2,18 cm." },
  { family: "ipe", row: "IPE 200", col: "u", note: "Probable errata: segons la geometria, u = 768 mm." },
  { family: "ipn", row: "IPN 550", col: "r1", note: "Probable errata: a la resta de la sèrie r1 = 0,6·e, que aquí dona 11,4 mm." },
  { family: "heb", row: "HEB 360", col: "h", note: "Errata del catàleg: un HEB 360 fa h = 360 mm (h1, Wx i el full de càlcul ho confirmen)." },
  { family: "hea", row: "HEA 160", col: "name", note: "Al catàleg diu «HEA 150», però totes les dades són d'un HEA 160." },
  { family: "hem", row: "HEM 140", col: "u", note: "Probable errata: segons la geometria, u = 857 mm." },
  { family: "hem", row: "HEM 300 (h=320)", col: "name", note: "El catàleg imprimeix «HEM 300» dues vegades: aquesta fila (h = 320 mm, 177 kp/m) és l'HE 300 C; l'altra és l'HEM 300 habitual (h = 340 mm)." },
  { family: "upn", row: "UPN 260", col: "It", note: "Fora de sèrie: pels perfils veïns caldria ≈ 27,1 cm⁴." },
  { family: "tub-quadrat", row: "# 40.2", col: "I", note: "Possible errata: W i i donen I ≈ 6,80 cm⁴." },
  { family: "tub-quadrat", row: "# 50.4", col: "A", note: "Errata: p, i i la geometria donen A = 6,81 cm²." },
  { family: "tub-quadrat", row: "# 90.3", col: "W", note: "Errata: W = 2·I/a = 28,0 cm³." },
  { family: "tub-quadrat", row: "# 90.4", col: "It", note: "Possible errata: la fórmula de torsió dona ≈ 262 cm⁴." },
  { family: "tub-quadrat", row: "# 140.5", col: "It", note: "Probable errata: hi falta l'«1.» inicial (≈ 1.260 cm⁴)." },
  { family: "tub-quadrat", row: "# 140.6", col: "It", note: "Probable errata: hi falta l'«1.» inicial (≈ 1.480 cm⁴)." },
  { family: "tub-quadrat", row: "# 140.8", col: "It", note: "Probable errata: hi falta l'«1.» inicial (≈ 1.890 cm⁴)." },
  { family: "tub-quadrat", row: "# 160.8", col: "u", note: "Possible errata: la geometria i els tubs amb el mateix perímetre donen 606 mm." },
  { family: "tub-rectangular", row: "□ 120.100.4", col: "Wy", note: "Errata: Wy = 2·Iy/b = 52,0 cm³." },
  { family: "tub-rodo", row: "Ø 55.4", col: "i", note: "Errata: i = √(I/A) = 1,81 cm." },
  { family: "tub-rodo", row: "Ø 65.4", col: "W", note: "Errata: W = 2·I/d = 11,02 cm³." },
  { family: "tub-rodo", row: "Ø 100.5", col: "It", note: "Errata: en un tub rodó It = 2·I = 338 cm⁴." },
  { family: "tub-rodo", row: "Ø 175.5", col: "It", note: "Errata: en un tub rodó It = 2·I ≈ 1.932 cm⁴." },
];

function family(raw: RawFamily, image: string, extra: { rows?: PerfilRow[]; note?: string } = {}): PerfilFamily {
  const errata: Record<string, string> = {};
  for (const e of ERRATA) if (e.family === raw.key) errata[`${e.row}|${e.col}`] = e.note;
  return {
    key: raw.key,
    title: raw.title,
    image: `/calculs/perfils/${image}`,
    legend: raw.legend,
    columns: raw.columns.map((c) => ({ ...c, group: GROUPS[c.group] ?? c.group })),
    rows: [...raw.rows.map((r) => ({ name: r.name, v: r.v, avail: r.avail })), ...(extra.rows ?? [])],
    note: extra.note,
    errata,
  };
}

// A row from named values; the columns not given are left empty.
function rowOf(raw: RawFamily, name: string, values: Record<string, number>): PerfilRow {
  return { name, v: raw.columns.map((c) => values[c.key] ?? null), avail: null, extra: true };
}

// UPN 320–400 are not on the catalogue sheet, but David's spreadsheets offer
// them (his example uses UPN 320). Ix, Wx, h1 and e come from his spreadsheet;
// the rest from EN 10279 / standard UPN tables.
const upnRaw = upn as RawFamily;
const UPN_EXTRA: PerfilRow[] = [
  rowOf(upnRaw, "UPN 320", { h: 320, b: 100, tw: 14, tf: 17.5, h1: 246, A: 75.8, Ix: 10870, Wx: 679, p: 59.5 }),
  rowOf(upnRaw, "UPN 350", { h: 350, b: 100, tw: 14, tf: 16, h1: 282, A: 77.3, Ix: 12840, Wx: 734, p: 60.6 }),
  rowOf(upnRaw, "UPN 380", { h: 380, b: 102, tw: 13.5, tf: 16, h1: 313, A: 80.4, Ix: 15760, Wx: 829, p: 63.1 }),
  rowOf(upnRaw, "UPN 400", { h: 400, b: 110, tw: 14, tf: 18, h1: 324, A: 91.5, Ix: 20350, Wx: 1020, p: 71.8 }),
];

export const FAMILIES: PerfilFamily[] = [
  family(ipe as RawFamily, "ipe.jpg"),
  family(ipn as RawFamily, "ipn.jpg"),
  family(heb as RawFamily, "he.jpg"),
  family(hea as RawFamily, "he.jpg"),
  family(hem as RawFamily, "he.jpg"),
  family(upnRaw, "upn.jpg", {
    rows: UPN_EXTRA,
    note: "UPN 320 a 400 no surten a la fitxa del catàleg: Ix, Wx, h1 i e són els del full de càlcul; la resta, de la norma EN 10279.",
  }),
  family(t as RawFamily, "t.jpg"),
  family(l as RawFamily, "l-ld.jpg"),
  family(ld as RawFamily, "l-ld.jpg"),
  family(zf as RawFamily, "zf.jpg"),
  family(tubQuadrat as RawFamily, "tub-quadrat.jpg"),
  family(tubRectangular as RawFamily, "tub-rectangular.jpg"),
  family(tubRodo as RawFamily, "tub-rodo.jpg"),
  family(rodoMassis as RawFamily, "rodo-massis.jpg"),
];

export const SOLDADURA: SoldaduraRow[] = (soldadura as { rows: SoldaduraRow[] }).rows;
