#!/usr/bin/env node
// The portal's dropdown lists as its form shows them (docs/ite-portal-formulari.txt,
// the inventory made by Claude in Chrome) → src/lib/ite/cataleg-portal.json.
//
// Real exports give each value with the portal's own id (cataleg-base.json);
// the form only gives the text. Values already in cataleg-base.json are left
// out; the rest get an id of ours ("f" + hash of the list and the text), the
// list's `mestre` and, for deficiency types, the category they belong to. The
// portal does not import our files, so what matters now is the exact text
// Claude has to pick at the portal.
//
//   node scripts/ite-cataleg-portal.mjs [docs/ite-portal-formulari.txt]
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = process.argv[2] ?? join(ROOT, "docs/ite-portal-formulari.txt");
const BASE = join(ROOT, "src/lib/ite/cataleg-base.json");
const OUT = join(ROOT, "src/lib/ite/cataleg-portal.json");

// Typos the inventory itself corrected afterwards.
const CORRECCIONS = { "Balonyà": "Balenyà", "Maslllorenç": "Masllorenç" };

const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const label = (o) => o.descMultidioma || o.descripcio || o.nom || o.valor || o.codi || o.id;
const hashId = (cat, text) => "f" + createHash("sha1").update(`${cat}|${text}`).digest("hex").slice(0, 10);
const codiOf = (text) => fold(text).toUpperCase().replace(/ /g, "_");

const lines = (await readFile(SRC, "utf8")).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
const base = JSON.parse(await readFile(BASE, "utf8"));
const baseOf = (cat) => base.filter((e) => e.cat === cat).map((e) => e.obj);

const fields = lines
  .map((l) => l.split(" | ").map((p) => p.trim()))
  .filter((p) => p.length >= 5)
  .map((p) => ({ sec: p[0], grup: p[1], etiqueta: p[2].replace(/^\*\s*/, ""), tipus: p[3], opcions: p[5] ?? "" }));
const split = (s) => s.split(" ; ").map((x) => CORRECCIONS[x.trim()] ?? x.trim()).filter(Boolean);

function opcions(sec, etiqueta) {
  const f = fields.find((x) => x.sec === sec && etiqueta.test(x.etiqueta) && /desplegable|opció única/.test(x.tipus) && x.opcions && !x.opcions.startsWith("("));
  if (!f) throw new Error(`No trobo la llista «${etiqueta}» a «${sec}».`);
  return split(f.opcions);
}

const out = [];
const counts = {};
function add(cat, texts, make = () => ({})) {
  const known = new Set(baseOf(cat).map((o) => fold(label(o))));
  const template = baseOf(cat)[0];
  texts.forEach((text, i) => {
    counts[cat] ??= { portal: 0, nous: 0 };
    counts[cat].portal++;
    // The portal's own lists repeat a value now and then («Polígon»).
    if (known.has(fold(text))) return;
    known.add(fold(text));
    counts[cat].nous++;
    const obj = { id: hashId(cat, text), codi: codiOf(text), descMultidioma: text, descripcio: text, ordre: String(i + 1), ...make(text, i) };
    if (template?.mestre && !obj.mestre) obj.mestre = template.mestre;
    out.push({ cat, obj });
  });
}

const DG = "Dades Generals";
add("tipus_via", opcions(DG, /^Tipus via$/));
add("tipus_identificacio", opcions(DG, /^Tipus d'identificació$/), (t) => ({ codi: t.toUpperCase() }));
add("regim_juridic", opcions(DG, /^Règim jurídic$/));
add("titulacio", opcions(DG, /^Titulació$/));
add("colegi", opcions(DG, /^Col·legi Professional$/), (t) => ({ codi: t.toUpperCase(), valor: t }));
add("font_superficies", opcions("Desc. Bàsica Edifici", /^Font d'informació superfícies$/), (t) => ({ valor: t }));
add("implantacio", opcions("Desc. Bàsica Edifici", /^Implantació en parcel·la/));
add("nuclis", opcions("Desc. Bàsica Edifici", /^Nuclis de comunicació vertical/));
add("ascensors", opcions("Desc. Bàsica Edifici", /^Un sol nucli d'escales$/));
add("tipus_envolupant", opcions("Envolupant de l'edifici", /^Tipus$/));
add("orientacio", opcions("Envolupant de l'edifici", /^Orientació Façana Principal$/), (t) => ({ codi: "ORI_" + codiOf(t).replace(/_/g, "") }));
const GRAV = { "molt greu": "MG", greu: "G", important: "I", lleu: "LL" };
add("gravetat", opcions("Deficiències", /^Gravetat$/), (t) => ({
  codi: "DEF_" + codiOf(t),
  valor: GRAV[fold(t)],
  i18n: `Deficiencia.gravetat.${(GRAV[fold(t)] ?? "x").toLowerCase()}`,
}));

// Municipalities, per province. The real one (Barcelona, with its INE code) stays.
const PROV = { Barcelona: "08", Girona: "17", Lleida: "25", Tarragona: "43" };
for (const f of fields) {
  const m = /^Municipi \[Província = ([^,\]]+), (\d+)\]$/.exec(f.etiqueta);
  if (!m) continue;
  const [, prov, n] = m;
  const names = split(f.opcions);
  if (names.length !== Number(n)) throw new Error(`${prov}: ${names.length} municipis, l'inventari en diu ${n}.`);
  const codi = PROV[prov];
  if (!codi) throw new Error(`Província desconeguda: ${prov}`);
  const known = new Set(baseOf("municipi").filter((o) => o.codiProvincia === codi).map((o) => fold(o.nom)));
  counts.municipi ??= { portal: 0, nous: 0 };
  for (const nom of names) {
    counts.municipi.portal++;
    if (known.has(fold(nom))) continue;
    known.add(fold(nom));
    counts.municipi.nous++;
    out.push({ cat: "municipi", obj: { id: hashId(`municipi${codi}`, nom), nom, codiProvincia: codi, provincia: { id: String(Number(codi)), codi, descripcio: prov } } });
  }
}

// Deficiency types, per element. Each one points at its category through i18n
// (cataleg.ts categoriaDeTipus), like the portal's own.
const categories = baseOf("categoria_deficiencia");
const knownTipus = new Set(baseOf("tipus_deficiencia").map((o) => fold(label(o))));
counts.tipus_deficiencia = { portal: 0, nous: 0 };
for (const l of lines) {
  const m = /^\[([^\]]+)\]\s*(.+)$/.exec(l);
  if (!m) continue;
  const cat = categories.find((c) => fold(label(c)) === fold(m[1]));
  if (!cat) throw new Error(`Element de deficiències sense categoria: ${m[1]}`);
  split(m[2]).forEach((text, i) => {
    counts.tipus_deficiencia.portal++;
    if (knownTipus.has(fold(text))) return;
    knownTipus.add(fold(text));
    counts.tipus_deficiencia.nous++;
    const id = hashId("tipus_deficiencia", text);
    out.push({ cat: "tipus_deficiencia", obj: { id, codi: `${cat.codi}_${id.slice(1, 7).toUpperCase()}`, descMultidioma: text, i18n: `${cat.i18n}.${id}`, mestre: cat.mestre, ordre: String(i + 1) } });
  });
}

const ids = new Set();
for (const e of out) {
  const k = `${e.cat}|${e.obj.id}`;
  if (ids.has(k)) throw new Error(`id repetit: ${k} (${label(e.obj)})`);
  ids.add(k);
}
out.sort((a, b) => a.cat.localeCompare(b.cat) || Number(a.obj.ordre ?? 0) - Number(b.obj.ordre ?? 0) || label(a.obj).localeCompare(label(b.obj), "ca"));
await writeFile(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`${out.length} valors del formulari del portal → ${OUT.slice(ROOT.length + 1)}`);
for (const [cat, c] of Object.entries(counts)) console.log(`  ${cat}: ${c.portal} al portal, ${c.portal - c.nous} ja coneguts, ${c.nous} nous`);
