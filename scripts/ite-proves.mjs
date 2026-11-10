#!/usr/bin/env node
// Builds three files to test the portal's «Importar» with, from a real export:
//
//   PROVA-1  the export with only its name changed. The portal's signature no
//            longer matches: does the import check it?
//   PROVA-2  the same without the signature: is a signature required?
//   PROVA-3  what the app exports for this report once imported (new id, no
//            signature, no signed PDF, no password, draft): the real thing.
//
//   node scripts/ite-proves.mjs <export.zip> [output folder, default ite-proves/]
//
// The output folder is git-ignored: the files carry a client's report.
import { register } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

register("./mcp-test-hooks.mjs", import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (p) => import(pathToFileURL(join(ROOT, "src/lib/ite", p)).href);
const xml = await load("xml.ts");
const zip = await load("zip.ts");
const cat = await load("cataleg.ts");
const model = await load("model.ts");

const [src, outDir = join(ROOT, "ite-proves")] = process.argv.slice(2);
if (!src) {
  console.error("Ús: node scripts/ite-proves.mjs <export.zip> [carpeta]");
  process.exit(1);
}
await mkdir(outDir, { recursive: true });
const enc = new TextEncoder();
const dec = new TextDecoder();

const entries = zip.readZip(new Uint8Array(await readFile(src)));
const xmlEntry = entries.find((e) => /\/dades\/\d+\/[^/]+\.xml$/.test(e.name));
if (!xmlEntry) throw new Error("No hi ha cap XML d'informe al zip.");
const original = dec.decode(await xmlEntry.read());
const { doc } = xml.parseIteXml(original);
const nom = String(doc.nom);
const all = await Promise.all(entries.map(async (e) => ({ name: e.name, data: await e.read() })));

// The report's own <nom> is the root child, the one indented by four spaces
// (the owner's and the account's are deeper).
function renamed(text, prefix) {
  return text.replace(/\n {4}<nom>([^<]*)<\/nom>/, (_, n) => `\n    <nom>${prefix}${n}</nom>`);
}

function unsigned(text) {
  const i = text.indexOf("<Signature");
  return i < 0 ? text : text.slice(0, i) + text.slice(text.indexOf("</Signature>") + "</Signature>".length);
}

async function save(file, list) {
  const bytes = await zip.buildZip(list);
  await writeFile(join(outDir, file), bytes);
  console.log(`  ${file}  (${(bytes.length / 1024 / 1024).toFixed(1)} MB, ${list.length} fitxers)`);
}

// 1 · name changed, signature kept (now invalid)
const x1 = renamed(original, "PROVA 1 · ");
await save("PROVA-1-signatura-alterada.zip", all.map((e) => (e.name === xmlEntry.name ? { name: e.name, data: enc.encode(x1) } : e)));

// 2 · name changed, signature removed
const x2 = unsigned(renamed(original, "PROVA 2 · "));
await save("PROVA-2-sense-signatura.zip", all.map((e) => (e.name === xmlEntry.name ? { name: e.name, data: enc.encode(x2) } : e)));

// 3 · as the app exports it
const d3 = model.normalizeImported(structuredClone(doc));
d3.nom = `PROVA 3 · ${nom}`;
for (const s of model.mediaSlots(d3)) {
  const m = model.getAt(d3, s.path);
  m.path = String(m.path).replace(/^\{IMAGEROOTDIR\}\/replaceFitxerId_\d+\//, "zip:/");
}
const plan = model.buildExport(d3, cat.buildCataleg(), { exportId: model.exportIdFor(1) });
const byRel = new Map(all.map((e) => [e.name.replace(/^ITE\/informes\/imatges\/\d+\//, ""), e.data]));
const files3 = [{ name: plan.xmlPath, data: enc.encode(plan.xml) }];
for (const f of plan.files) {
  const data = byRel.get(f.src.slice(5));
  if (!data) throw new Error(`Falta ${f.src}`);
  files3.push({ name: f.zipPath, data });
}
await save("PROVA-3-generat-per-app.zip", files3);
console.log(`\nFitxers a ${outDir}`);
