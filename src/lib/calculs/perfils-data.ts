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

function family(raw: RawFamily, image: string, extra: { rows?: PerfilRow[]; note?: string } = {}): PerfilFamily {
  return {
    key: raw.key,
    title: raw.title,
    image: `/calculs/perfils/${image}`,
    legend: raw.legend,
    columns: raw.columns.map((c) => ({ ...c, group: GROUPS[c.group] ?? c.group })),
    rows: [...raw.rows.map((r) => ({ name: r.name, v: r.v, avail: r.avail })), ...(extra.rows ?? [])],
    note: extra.note,
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
  family(l as RawFamily, "l.jpg"),
  family(ld as RawFamily, "ld.jpg"),
  family(tubQuadrat as RawFamily, "tub-quadrat.jpg"),
  family(tubRectangular as RawFamily, "tub-rectangular.jpg"),
  family(tubRodo as RawFamily, "tub-rodo.jpg"),
  family(rodoMassis as RawFamily, "rodo-massis.jpg"),
  family(zf as RawFamily, "zf.jpg"),
];

export const SOLDADURA: SoldaduraRow[] = (soldadura as { rows: SoldaduraRow[] }).rows;
