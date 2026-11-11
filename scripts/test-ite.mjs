#!/usr/bin/env node
// Tests for the ITE module (src/lib/ite). No database or network.
//
//   node scripts/test-ite.mjs [export.zip]
//
// With a portal export (the zip from «Exportar informe»; by default any *.zip in
// the project folder, which git ignores) it also checks, on the real file:
// the XML is written back byte for byte, every field of the form exists in
// it, and our export of it carries no signature, no password and the right
// paths. Client reports are never committed, so those checks only run locally.
import { register } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";

register("./mcp-test-hooks.mjs", import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (p) => import(pathToFileURL(join(ROOT, "src/lib/ite", p)).href);
const xml = await load("xml.ts");
const zip = await load("zip.ts");
const cat = await load("cataleg.ts");
const schema = await load("schema.ts");
const model = await load("model.ts");
const defaults = await load("defaults.ts");
const cadastre = await load("cadastre.ts");
const fotos = await load("fotos.ts");

let passed = 0;
const failures = [];
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  ✗ ${name}\n    ${e?.stack ?? e}`);
  }
}

const cataleg = cat.buildCataleg();

function checkOrder(text) {
  // version/id first, then Java String order, repeated tags together.
  const stack = [[]];
  const re = /<(\/?)([A-Za-z_][\w.:-]*)>/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[1]) {
      const kids = stack.pop().filter((k, i, a) => k !== a[i - 1]);
      const rest = kids.filter((k) => k !== "version" && k !== "id");
      assert.deepEqual(rest, [...rest].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), `order under </${m[2]}>`);
      assert.equal(new Set(kids).size, kids.length, `repeated tags apart under </${m[2]}>`);
    } else {
      stack[stack.length - 1].push(m[2]);
      stack.push([]);
    }
  }
}

console.log("xml");
await test("a new report is written in the portal's layout and reads back the same", () => {
  const doc = model.newIteDoc({ nom: "Prova & <cometes>", tecnic: defaults.tecnicDespatx(cataleg), dataInspeccio: "2026-05-04" });
  const text = xml.serializeIteXml(doc);
  assert.ok(text.startsWith("<informeTecnic>\n    <version>2.0</version>\n    <id>null</id>\n"));
  assert.ok(text.endsWith("\n</informeTecnic>"));
  assert.ok(text.includes("<nom>Prova &amp; &lt;cometes&gt;</nom>"));
  assert.ok(text.includes("<dataInspeccio>2026-05-04T00:00:00</dataInspeccio>"));
  checkOrder(text);
  assert.deepEqual(xml.parseIteXml(text).doc, doc);
});
await test("lists stay lists with one element; multi-line text survives", () => {
  const doc = { version: "2.0", id: "1", deficiencies: [{ id: "null", deficienciaDescripcio: "línia 1\nlínia 2\n", fotos: [{ id: "null", path: "x" }] }] };
  const back = xml.parseIteXml(xml.serializeIteXml(doc)).doc;
  assert.deepEqual(back, doc);
});
await test("the signature is skipped and reported", () => {
  const p = xml.parseIteXml('<informeTecnic>\n    <id>5</id>\n<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo><x>1</x></SignedInfo></Signature></informeTecnic>');
  assert.equal(p.signed, true);
  assert.deepEqual(p.doc, { id: "5" });
});
await test("Java number and date formats; portal file names", () => {
  assert.equal(xml.javaDouble(18), "18.0");
  assert.equal(xml.javaDouble(0.9), "0.9");
  assert.equal(xml.javaDate("2025-04-03"), "2025-04-03T00:00:00");
  assert.equal(xml.portalFileBase("Inspecció Tècnica de l'Edifici del carrer Mallorca, 325 de Barcelona"), "InspeccioTecnicadelEdificidelcarrerMallorca325deBarcelona");
});

console.log("zip");
await test("zip written and read back", async () => {
  const a = new TextEncoder().encode("hola ".repeat(1000));
  const b = new Uint8Array([0, 1, 2, 255]);
  const z = await zip.buildZip([{ name: "ITE/informes/dades/9/a.xml", data: a }, { name: "x/b.JPG", data: b }]);
  const entries = zip.readZip(z);
  assert.deepEqual(entries.map((e) => e.name), ["ITE/informes/dades/9/a.xml", "x/b.JPG"]);
  assert.deepEqual(await entries[0].read(), a);
  assert.deepEqual(await entries[1].read(), b);
  assert.equal(zip.crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

console.log("form values");
await test("fields are stored the way the portal writes them", () => {
  const f = (p) => schema.FIELD_BY_PATH.get(p);
  let d = model.newIteDoc({});
  d = model.withField(d, f("edifici.edificiDescripcio.alturaSobreRasant"), "18,5", cataleg);
  assert.equal(model.getAt(d, "edifici.edificiDescripcio.alturaSobreRasant"), "18.5");
  assert.equal(model.fieldValue(d, f("edifici.edificiDescripcio.alturaSobreRasant")), "18,5");
  d = model.withField(d, f("edifici.edificiDescripcio.superficieConstruida"), "2025", cataleg);
  assert.equal(model.getAt(d, "edifici.edificiDescripcio.superficieConstruida"), "2025.0");
  d = model.withField(d, f("edifici.edificiDescripcio.numPlantesSobreRasant"), "6", cataleg);
  assert.equal(model.getAt(d, "edifici.edificiDescripcio.numPlantesSobreRasant"), "6");
  d = model.withField(d, f("edifici.edificiTancaments.tcAillamentTermic"), "2", cataleg);
  assert.equal(model.fieldText(d, f("edifici.edificiTancaments.tcAillamentTermic"), cataleg), "Es desconeix");
  d = model.withField(d, f("edifici.edificiDescripcio.orientacio"), "330", cataleg);
  assert.equal(model.getAt(d, "edifici.edificiDescripcio.orientacio").codi, "ORI_SUDEST");
  d = model.withField(d, f("edifici.referenciaCadastral.tipusVia"), "294", cataleg);
  assert.equal(model.getAt(d, "edifici.referenciaCadastral.tipusVia"), "294");
  d = model.withField(d, f("edifici.edificiDescripcio.anyConstruccio"), "", cataleg);
  assert.equal(model.getAt(d, "edifici.edificiDescripcio.anyConstruccio"), undefined);
  d = model.withField(d, f("edifici.edificiEstructura.verticalCarregaPedra"), "true", cataleg);
  assert.equal(model.getAt(d, "edifici.edificiEstructura.verticalCarregaPedra"), "true");
});
await test("every checkbox of the form starts as false, like a real export", () => {
  const d = model.newIteDoc({});
  for (const fd of schema.ALL_FIELDS.filter((x) => x.kind === "bool")) assert.equal(model.getAt(d, fd.path), "false", fd.path);
});
await test("floors: one door row per dwelling and premises, ticks kept", () => {
  let p = model.newPlanta("Primer", 2, 1);
  assert.deepEqual(model.inspeccionsOf(p).map((i) => [i.tipusInspeccio, i.porta, i.ordre]), [["1", "1", "1"], ["1", "2", "2"], ["2", "1", "3"]]);
  p = { ...p, inspeccions: model.inspeccionsOf(p).map((i, k) => (k === 1 ? { ...i, revisat: "true" } : i)) };
  p = model.syncInspeccions({ ...p, numLocals: "0" });
  assert.equal(model.inspeccionsOf(p).length, 2);
  assert.equal(model.inspeccionsOf(p)[1].revisat, "true");
});

console.log("defaults");
await test("addresses and report names", () => {
  assert.deepEqual(defaults.parseAdreca("C/ Mallorca, 325"), { word: "carrer", nom: "Mallorca", numero: "325" });
  assert.deepEqual(defaults.parseAdreca("Carrer Consell de Cent, 416"), { word: "carrer", nom: "Consell de Cent", numero: "416" });
  assert.deepEqual(defaults.parseAdreca("Av. Gaudí 41"), { word: "avinguda", nom: "Gaudí", numero: "41" });
  assert.equal(defaults.parseAdreca("Gran Via de les Corts Catalanes, 585").word, "gran via");
  assert.equal(defaults.nomInforme("carrer", "MALLORCA", "325", "Barcelona"), "Inspecció Tècnica de l'Edifici del carrer Mallorca, 325 de Barcelona");
  assert.equal(defaults.nomInforme("avinguda", "GAUDÍ", "41", "BARCELONA"), "Inspecció Tècnica de l'Edifici de l'avinguda Gaudí, 41 de Barcelona");
  assert.equal(defaults.nomInforme("carrer", "CONSELL DE CENT", "416", "Barcelona"), "Inspecció Tècnica de l'Edifici del carrer Consell de Cent, 416 de Barcelona");
});
await test("the office's technician and an owner from a client", () => {
  const t = defaults.tecnicDespatx(cataleg);
  assert.equal(t.identificacioTecnic, "35040453E");
  assert.equal(t.titulacioTecnic.codi, "ARQUITECTE");
  assert.equal(t.municipiTecnic.nom, "Barcelona");
  const p = defaults.propietatFromClient({ nom: "Comunitat de Propietaris Mallorca 325", nif: "h-65761249", carrer: "C/ Mallorca 325", ciutat: "barcelona", codi_postal: "08037" }, { telefon: "934 87 53 24", mail: "admin@example.com" }, cataleg);
  assert.equal(p.identificacioPropietat, "H65761249");
  assert.equal(p.tipusIdentificacioPropietat.codi, "CIF");
  assert.equal(p.tipusViaPropietat.codi, "CARRER");
  assert.equal(p.nomViaPropietat, "Mallorca 325");
  assert.equal(p.municipiPropietat.id, "4120");
  assert.equal(p.regimJuridic.codi, "PROP_HORITZONTAL");
  assert.equal(p.telefon1Propietat, "934875324");
});

console.log("cadastre");
const CATASTRO = {
  consulta_dnprcResult: {
    control: { cudnp: 3 },
    lrcdnp: {
      rcdnp: [
        { rc: { pc1: "1234567", pc2: "DF1234A" }, dt: { loine: { cp: "08", cm: "19" }, np: "BARCELONA", nm: "BARCELONA", locs: { lous: { lourb: { dir: { tv: "CL", nv: "EXEMPLE", pnp: "12" }, loint: { pt: "PR", pu: "02" }, dp: "08001" } } } }, debi: { luso: "Residencial", sfc: "90", ant: "1910" } },
        { rc: { pc1: "1234567", pc2: "DF1234A" }, dt: { loine: { cp: "08", cm: "19" }, np: "BARCELONA", nm: "BARCELONA", locs: { lous: { lourb: { dir: { tv: "CL", nv: "EXEMPLE", pnp: "12" }, loint: { pt: "LC", pu: "01" }, dp: "08001" } } } }, debi: { luso: "Comercial", sfc: "60", ant: "1910" } },
        { rc: { pc1: "1234567", pc2: "DF1234A" }, dt: { loine: { cp: "08", cm: "19" }, np: "BARCELONA", nm: "BARCELONA", locs: { lous: { lourb: { dir: { tv: "CL", nv: "EXEMPLE", pnp: "12" }, loint: { pt: "01", pu: "2A" }, dp: "08001" } } } }, debi: { luso: "Residencial", sfc: "75", ant: "1910" } },
      ],
    },
  },
};
await test("Catastro answer → address, year, surface and floors", () => {
  const d = cadastre.parseCadastre(CATASTRO);
  assert.equal(d.codiIne, "08019");
  assert.equal(d.superficieConstruida, 225);
  assert.equal(d.anyConstruccio, 1910);
  let doc = model.newIteDoc({});
  doc = cadastre.applyCadastre(doc, d, cataleg, { adreca: true, any: true, superficie: true, plantes: true, nom: true });
  assert.equal(model.getAt(doc, "edifici.referenciaCadastral.tipusVia"), "294");
  assert.equal(model.getAt(doc, "edifici.edificiDescripcio.superficieConstruida"), "225.0");
  assert.equal(model.getAt(doc, "edifici.edificiDescripcio.fontInformacioSup").codi, "CADASTRE");
  assert.equal(doc.nom, "Inspecció Tècnica de l'Edifici del carrer Exemple, 12 de Barcelona");
  assert.deepEqual(model.listOf(doc, "edifici.plantes").map((p) => [p.plantaDescripcio, p.numHabitatges, p.numLocals]), [
    ["Local 1 planta baixa", "0", "1"],
    ["Principal 2a", "1", "0"],
    ["Primer 2a A", "1", "0"],
  ]);
  assert.throws(() => cadastre.parseCadastre({ consulta_dnprcResult: { lerr: { err: [{ cod: "1", des: "LA REFERENCIA CATASTRAL NO EXISTE" }] } } }), /NO EXISTE/);
});

console.log("export");
await test("export: draft XML with our id, photos in the portal's folders, derived values", () => {
  let doc = model.newIteDoc({ nom: "Inspecció Tècnica de l'Edifici del carrer Exemple, 12 de Barcelona", tecnic: defaults.tecnicDespatx(cataleg), dataInspeccio: "2026-05-04" });
  doc.codiFinal = "AAAA0000";
  doc.dataFirma = "2026-01-01T00:00:00";
  const tipus = cataleg.tipus_deficiencia.find((t) => t.codi === "DEF_ENV_TERR_FILTR");
  const lleu = cataleg.gravetat.find((g) => g.valor === "LL");
  const important = cataleg.gravetat.find((g) => g.valor === "I");
  doc = model.setAt(doc, "deficiencies", [
    { id: "null", tipusDeficiencia: tipus, gravetat: important, deficienciaDescripcio: "Goteres", fotos: [model.newMedia("Terrat", "image/jpeg", "/fitxers/dac/ite/7/abc123/foto.jpg?mida=10"), model.newMedia("", "image/jpeg", "{IMAGEROOTDIR}/replaceFitxerId_1/DEFICIENCIES/perduda.JPG")] },
    { id: "null", tipusDeficiencia: tipus, gravetat: lleu, deficienciaDescripcio: "Embornal brut", fotos: [] },
  ]);
  doc = model.setAt(doc, "edifici.edificiDescripcio.croquis", model.newMedia("Croquis planta", "image/jpeg", "/fitxers/dac/ite/7/k/CROQUIS_FOTO_2025.04.06_19.20.261743960026255.JPG?mida=5"));
  const out = model.buildExport(doc, cataleg, { exportId: model.exportIdFor(7), now: new Date(2026, 10, 10, 9, 5, 3) });
  assert.equal(out.exportId, "900000007");
  assert.equal(out.xmlPath, "ITE/informes/dades/900000007/InspeccioTecnicadelEdificidelcarrerExemple12deBarcelona.xml");
  const back = xml.parseIteXml(out.xml).doc;
  assert.equal(back.id, "900000007");
  assert.equal(back.codiFinal, undefined);
  assert.equal(back.dataFirma, undefined);
  assert.equal(back.valoracio, "false");
  assert.equal(back.usuari.identificador, "35040453E");
  assert.equal(back.usuari.password, undefined);
  assert.ok(!out.xml.includes("Signature"));
  const ter = back.teDeficienciesTipus.entry.find((e) => e.key.codi === "DEF_ENV_TERR");
  assert.equal(ter.value, "true");
  assert.equal(back.teDeficienciesTipus.entry.filter((e) => e.value === "true").length, 1);
  assert.equal(back.deficiencies[0].fotos.length, 1, "the photo without a file is left out");
  assert.match(back.deficiencies[0].fotos[0].path, /^\{IMAGEROOTDIR\}\/replaceFitxerId_900000007\/DEFICIENCIES\/DEFICIENCIA_FOTO_2026\.11\.10_9\.5\.3\d+\.JPG$/);
  assert.equal(back.edifici.edificiDescripcio.croquis.path, "{IMAGEROOTDIR}/replaceFitxerId_900000007/CROQUIS/CROQUIS_FOTO_2025.04.06_19.20.261743960026255.JPG");
  assert.deepEqual(out.files.map((f) => f.zipPath.replace(/DEFICIENCIA_FOTO_.*/, "DEFICIENCIA_FOTO_…")), [
    "ITE/informes/imatges/900000007/CROQUIS/CROQUIS_FOTO_2025.04.06_19.20.261743960026255.JPG",
    "ITE/informes/imatges/900000007/DEFICIENCIES/DEFICIENCIA_FOTO_…",
  ]);
  checkOrder(out.xml);
  const check = model.validateIte(doc, cataleg);
  assert.ok(check.errors.some((e) => /foto/.test(e)));
});
await test("favourable assessment only with no deficiencies or minor ones", () => {
  const lleu = cataleg.gravetat.find((g) => g.valor === "LL");
  assert.equal(model.valoracioFavorable(model.newIteDoc({})), true);
  assert.equal(model.valoracioFavorable(model.setAt(model.newIteDoc({}), "deficiencies", [{ id: "null", gravetat: lleu }])), true);
});

console.log("plugin edits");
const edit = await load("edit.ts");
await test("fields by path with chat values; unknown paths and values are errors", () => {
  const doc = model.newIteDoc({});
  const r = edit.applyIteEdit(doc, {
    camps: {
      "edifici.edificiDescripcio.anyConstruccio": 1920,
      "edifici.edificiDescripcio.alturaSobreRasant": "18,5",
      "edifici.edificiTancaments.tcAillamentTermic": "es_desconeix",
      "edifici.edificiEstructura.verticalCarregaPedra": true,
      "edifici.edificiDescripcio.orientacio": "sud est",
      "edifici.edificiAccessibilitat.satisfa": "satisfà completament",
      "dataInspeccio": "2026-03-01",
    },
  }, cataleg);
  assert.deepEqual(r.errors, []);
  assert.equal(model.getAt(r.doc, "edifici.edificiDescripcio.anyConstruccio"), "1920");
  assert.equal(model.getAt(r.doc, "edifici.edificiDescripcio.alturaSobreRasant"), "18.5");
  assert.equal(model.getAt(r.doc, "edifici.edificiTancaments.tcAillamentTermic"), "2");
  assert.equal(model.getAt(r.doc, "edifici.edificiDescripcio.orientacio").codi, "ORI_SUDEST");
  assert.equal(model.getAt(r.doc, "edifici.edificiAccessibilitat.satisfa"), "true");
  assert.equal(r.changes.length, 7);
  const bad = edit.applyIteEdit(doc, { camps: { "edifici.inventat": 1, "edifici.edificiDescripcio.orientacio": "Marte" } }, cataleg);
  assert.equal(bad.errors.length, 2);
});
await test("lists: add, modify and remove by index; deficiencies need type and severity", () => {
  let doc = model.newIteDoc({});
  let r = edit.applyIteEdit(doc, {
    deficiencies: { afegir: [{ tipus: "DEF_ENV_TERR_FILTR", gravetat: "important", descripcio: "Goteres al 4t 1a" }, { tipus: "filtracions", gravetat: "LL" }] },
    plantes: { afegir: [{ descripcio: "Principal 1a", habitatges: 1, visitades: [1] }, { descripcio: "Local 1", locals: 1 }] },
    envolupants: { afegir: [{ tipus: "Façanes", descripcio: "Façana principal" }] },
    mesures: { afegir: [{ descripcio: "Canviar la caldera" }] },
  }, cataleg);
  assert.deepEqual(r.errors, []);
  doc = r.doc;
  assert.equal(model.listOf(doc, "deficiencies")[1].tipusDeficiencia.codi, "DEF_ENV_TERR_FILTR");
  assert.equal(model.listOf(doc, "edifici.plantes")[0].inspeccions[0].revisat, "true");
  assert.equal(model.listOf(doc, "edifici.plantes")[1].numLocals, "1");
  r = edit.applyIteEdit(doc, { deficiencies: { modificar: [{ index: 0, gravetat: "LL" }], treure: [1] } }, cataleg);
  assert.deepEqual(r.errors, []);
  assert.equal(model.listOf(r.doc, "deficiencies").length, 1);
  assert.equal(model.gravetatValor(model.listOf(r.doc, "deficiencies")[0]), "LL");
  const missing = edit.applyIteEdit(doc, { deficiencies: { afegir: [{ descripcio: "sense tipus" }], treure: [9] } }, cataleg);
  assert.equal(missing.errors.length, 3);
  const greu = edit.applyIteEdit(doc, { deficiencies: { modificar: [{ index: 0, gravetat: "greu" }] } }, cataleg);
  assert.match(greu.errors.join(" "), /encara no és a les llistes/);
});
await test("the report as text and the list of fields for the chat", () => {
  const doc = edit.applyIteEdit(model.newIteDoc({ nom: "X" }), { camps: { "edifici.edificiEstructura.verticalCarregaPedra": true, "edifici.edificiDescripcio.anyConstruccio": 1900 } }, cataleg).doc;
  const t = edit.iteAsText(doc, cataleg);
  assert.deepEqual(t["Sist. Constructius"]["Estructura vertical — Parets de càrrega"], ["De pedra"]);
  assert.equal(t["Desc. Bàsica Edifici"]["5. Dades generals de l'edifici"]["Any de construcció"], "1900");
  const camps = edit.iteCamps(cataleg, "descripcio");
  const ori = camps[0].camps.find((c) => c.camp === "edifici.edificiDescripcio.orientacio");
  assert.deepEqual(ori.valors, [{ valor: "ORI_SUDEST", text: "Sud Est" }]);
  const asc = camps[0].camps.find((c) => c.camp === "edifici.edificiTipologia.ascensorsUnNucli");
  assert.ok(asc.pista.includes("Nuclis de comunicació vertical"));
});

await test("the report as text is written for the portal's form (first run, 11/11/2026)", () => {
  const dades = schema.SECTIONS.find((s) => s.key === "dades").title;
  const sist = "Sist. Constructius";
  const defs = schema.SECTIONS.find((s) => s.key === "deficiencies").title;
  let doc = model.newIteDoc({ nom: "X", tecnic: defaults.tecnicDespatx(cataleg) });
  doc = edit.applyIteEdit(doc, {
    camps: { "propietat.codiPostalPropietat": "08028", "edifici.edificiInstalacions.caDisposa": true, "edifici.edificiInstalacions.aaSubministramentPublic": "1" },
    deficiencies: { afegir: [{ tipus: cataleg.tipus_deficiencia[0].codi, gravetat: "I", descripcio: "Goteres" }] },
  }, cataleg).doc;
  const t = edit.iteAsText(doc, cataleg);
  // the technician is the portal account: a note, not fields to type
  const tec = t[dades]["4. Identificació del tècnic redactor"];
  assert.ok(tec.nota && /David Lladó Porta \(35040453E\)/.test(tec.tecnic), JSON.stringify(tec));
  // what the portal sets itself is named apart (llocFirma is "Barcelona" by default)
  assert.deepEqual(t[dades]["No cal entrar-ho al portal"], ["Lloc de signatura"]);
  assert.ok(!("Lloc de signatura" in (t[dades]["1. Identificació de l'informe"] ?? {})));
  // the province the portal asks for, from the postcode
  assert.equal(t[dades]["3. Identificació propietat"]["Província (el portal la demana)"], "Barcelona");
  assert.equal(edit.provinciaDeCP("17001"), "Girona");
  assert.equal(edit.provinciaDeCP("28001"), "");
  // yes/no questions that reveal other fields are said even when "No"
  assert.deepEqual(t[sist]["Calefacció"], ["Es disposa de sistema de calefacció", "Es disposa de sistema de calefacció col·lectiva/central: No"]);
  assert.ok(t[sist]["Aigua calenta sanitària (ACS)"].includes("L'edifici disposa de sistema d'ACS: No"));
  assert.ok(t[sist]["Refrigeració"].includes("L'edifici disposa de sistema col·lectiu de refrigeració: No"));
  // a label that differs at the portal carries its hint
  const aigua = Object.values(t[sist]).find((g) => g && typeof g === "object" && "Connexió a la xarxa" in g);
  assert.ok(/^Directe — al portal/.test(aigua["Connexió a la xarxa"]));
  // per-category yes/no for deficiencies, the whole list
  const perCat = t[defs]["Té deficiències? (Sí/No per categoria, com ho demana el portal)"];
  assert.equal(Object.keys(perCat).length, cataleg.categoria_deficiencia.length);
  assert.equal(Object.values(perCat).filter((v) => v === "Sí").length, 1);
  assert.equal(t[defs].deficiencies[0].codi, "D01");
});

// Real export ----------------------------------------------------------------------
let zipPath = process.argv[2];
if (!zipPath) {
  const zips = (await readdir(ROOT)).filter((f) => /^Inspeccio.*\.zip$/i.test(f));
  if (zips[0]) zipPath = join(ROOT, zips[0]);
}
if (zipPath) {
  console.log(`real export (${zipPath.split(/[\\/]/).pop()})`);
  const entries = zip.readZip(new Uint8Array(await readFile(zipPath)));
  const xmlEntry = entries.find((e) => /\/dades\/\d+\/[^/]+\.xml$/.test(e.name));
  const src = new TextDecoder().decode(await xmlEntry.read());
  const parsed = xml.parseIteXml(src);
  await test("read and written back byte for byte (without the signature)", () => {
    const i = src.indexOf("<Signature"), j = src.indexOf("</Signature>") + "</Signature>".length;
    const unsigned = i >= 0 ? src.slice(0, i) + src.slice(j) : src;
    assert.equal(xml.serializeIteXml(parsed.doc, parsed.rootTag), unsigned.replace(/\n$/, ""));
  });
  await test("every field of the form exists in the real file", () => {
    const missing = schema.ALL_FIELDS.map((f) => f.path).filter((p) => model.getAt(parsed.doc, p) === undefined);
    assert.deepEqual(missing, []);
  });
  await test("its code lists are all in cataleg-base.json", () => {
    const known = new Set(Object.entries(cataleg).flatMap(([k, list]) => list.map((o) => `${k}|${o.id}`)));
    const unknown = cat.harvestCataleg(parsed.doc).map((e) => `${e.cat}|${e.obj.id}`).filter((k) => !known.has(k));
    assert.deepEqual(unknown, []);
  });
  await test("our export of it: same report, no signature or password, every photo found", async () => {
    // What the app does on import: floors in display order, photos in our store.
    const doc = model.normalizeImported(structuredClone(parsed.doc));
    for (const s of model.mediaSlots(doc)) {
      const m = model.getAt(doc, s.path);
      m.path = m.path.replace(/^\{IMAGEROOTDIR\}\/replaceFitxerId_\d+\//, "zip:/");
    }
    const out = model.buildExport(doc, cataleg, { exportId: "900000001" });
    assert.ok(!out.xml.includes("<password>") && !out.xml.includes("Signature"));
    const names = new Set(entries.map((e) => e.name.replace(/^ITE\/informes\/imatges\/\d+\//, "")));
    for (const f of out.files) assert.ok(names.has(f.src.slice(5)), f.src);
    const back = xml.parseIteXml(out.xml).doc;
    const strip = (d) => {
      const c = model.normalizeImported(structuredClone(d));
      for (const k of ["id", "codiFinal", "dataExport", "dataFirma", "usuari", "teDeficienciesTipus"]) delete c[k];
      return JSON.stringify(c).replace(/replaceFitxerId_\d+/g, "R");
    };
    const a = strip(back), b = strip(parsed.doc);
    if (a !== b) {
      let k = 0;
      while (a[k] === b[k]) k++;
      assert.fail(`export differs from the original near: …${b.slice(Math.max(0, k - 120), k + 60)}… (export: …${a.slice(Math.max(0, k - 20), k + 60)}…)`);
    }
    const sortEntries = (t) => JSON.stringify(t.entry.map((e) => [e.key.id, e.value]).sort());
    assert.equal(sortEntries(back.teDeficienciesTipus), sortEntries(parsed.doc.teDeficienciesTipus), "derived per-category flags match the portal's");
    assert.equal(back.valoracio, parsed.doc.valoracio);
  });
} else {
  console.log("real export: skipped (no Inspeccio*.zip in the project folder)");
}

console.log("fotos per al portal");
await test("photos are named by their place in the portal, with an index of captions", () => {
  let doc = model.newIteDoc({ nom: "Inspecció Tècnica de l'Edifici del carrer Llatzeret, 27 de Barcelona", tecnic: defaults.tecnicDespatx(cataleg) });
  doc = model.setAt(doc, "edifici.referenciaCadastral", { id: "null", tipusVia: "294", nomVia: "Llatzeret", numero: "27", municipi: "Barcelona" });
  const tipus = cataleg.tipus_deficiencia[0];
  const important = cataleg.gravetat.find((g) => g.valor === "I");
  const lleu = cataleg.gravetat.find((g) => g.valor === "LL");
  doc = model.setAt(doc, "deficiencies", [
    { id: "null", tipusDeficiencia: tipus, gravetat: important, deficienciaDescripcio: "Esquerdes a la caixa d'escala", fotos: [
      model.newMedia("Lateral est", "image/jpeg", "/fitxers/dac/ite/7/a/foto1.jpg?mida=10"),
      model.newMedia("Lateral oest", "image/png", "/fitxers/dac/ite/7/b/foto2.png?mida=10"),
    ] },
    { id: "null", tipusDeficiencia: tipus, gravetat: lleu, deficienciaDescripcio: "Embornal brut", fotos: [] },
    { id: "null", tipusDeficiencia: tipus, gravetat: lleu, deficienciaDescripcio: "Foto perduda", fotos: [model.newMedia("", "image/jpeg", "{IMAGEROOTDIR}/replaceFitxerId_1/DEFICIENCIES/perduda.JPG")] },
  ]);
  doc = model.setAt(doc, "edifici.edificiEnvolupants", [
    { id: "null", envolupantTipus: cataleg.tipus_envolupant[0], envolupantDescripcio: "Façana principal", fotos: [model.newMedia("Vista general", "image/jpeg", "/fitxers/dac/ite/7/c/f.jpg")] },
  ]);
  doc = model.setAt(doc, "edifici.edificiDescripcio.croquis", model.newMedia("Croquis planta", "image/jpeg", "/fitxers/dac/ite/7/k/CROQUIS.JPG"));
  doc = model.setAt(doc, "recomanacionsPdf", model.newMedia("RECOMANACIONS", "application/pdf", "/fitxers/dac/ite/7/r/rec.pdf"));

  const p = fotos.fotoPaquet(doc, cataleg);
  assert.deepEqual(p.fitxers.map((f) => f.zipPath), [
    "CROQUIS/CROQUIS.jpg",
    "ENVOLUPANTS/E01-1.jpg",
    "DEFICIENCIES/D01-1.jpg",
    "DEFICIENCIES/D01-2.png",
    "RECOMANACIONS.pdf",
  ]);
  assert.deepEqual(p.falten, ["DEFICIENCIES/D03-1"]);
  assert.equal(p.fitxers[2].peu, "Lateral est");
  assert.equal(p.fitxers[0].peu, "", "the slot's default text is not a caption");
  assert.ok(p.nom.endsWith("-fotos") && /Llatzeret-27/.test(p.nom), p.nom);
  assert.ok(p.index.includes("D01-1.jpg (Lateral est)"), "the index lists captions");
  assert.ok(/D02 .*Embornal brut\n\s+\(sense fotos\)/.test(p.index), "deficiencies without photos keep their number");
  assert.ok(p.index.includes("RECOMANACIONS.pdf"));
  assert.ok(p.index.includes("Sense fitxer a l'app (no són al zip): DEFICIENCIES/D03-1"));
  assert.deepEqual([fotos.codiDeficiencia(0), fotos.codiDeficiencia(9), fotos.codiEnvolupant(2)], ["D01", "D10", "E03"]);
  // the portal wants a photo per deficiency: the app warns before the portal does
  const rev = model.validateIte(doc, cataleg);
  assert.ok(rev.warnings.some((w) => w.startsWith("Deficiència 2: sense cap foto")), rev.warnings.join(" | "));
  assert.ok(!rev.warnings.some((w) => w.startsWith("Deficiència 1: sense cap foto")));
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
