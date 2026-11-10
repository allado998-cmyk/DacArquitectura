#!/usr/bin/env node
// Adds every code-list value found in portal ITE exports to
// src/lib/ite/cataleg-base.json (see src/lib/ite/cataleg.ts). Takes .xml files
// or the portal's .zip exports. Only code-list objects are copied: no names,
// addresses or other report data.
//
//   node scripts/ite-cataleg.mjs export1.zip export2.xml …
import { register } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

register("./mcp-test-hooks.mjs", import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src/lib/ite/cataleg-base.json");
const xml = await import(pathToFileURL(join(ROOT, "src/lib/ite/xml.ts")).href);
const cat = await import(pathToFileURL(join(ROOT, "src/lib/ite/cataleg.ts")).href);
const zip = await import(pathToFileURL(join(ROOT, "src/lib/ite/zip.ts")).href);

const files = process.argv.slice(2);
if (!files.length) { console.error("Ús: node scripts/ite-cataleg.mjs <export.zip|informe.xml> …"); process.exit(1); }

const current = JSON.parse(await readFile(OUT, "utf8"));
const byKey = new Map(current.map((e) => [`${e.cat}|${e.obj.id}`, e]));
let added = 0;
for (const f of files) {
  const buf = await readFile(f);
  const texts = [];
  if (/\.zip$/i.test(f)) {
    for (const e of zip.readZip(new Uint8Array(buf))) if (/\.xml$/i.test(e.name)) texts.push(new TextDecoder().decode(await e.read()));
  } else texts.push(buf.toString("utf8"));
  for (const t of texts) {
    for (const e of cat.harvestCataleg(xml.parseIteXml(t).doc)) {
      const k = `${e.cat}|${e.obj.id}`;
      if (!byKey.has(k)) added++;
      byKey.set(k, e);
    }
  }
}
const list = [...byKey.values()].sort((a, b) => a.cat.localeCompare(b.cat) || Number(a.obj.id) - Number(b.obj.id));
await writeFile(OUT, JSON.stringify(list, null, 1) + "\n");
const counts = {};
for (const e of list) counts[e.cat] = (counts[e.cat] ?? 0) + 1;
console.log(`${added} valors nous; ${list.length} en total.`, counts);
