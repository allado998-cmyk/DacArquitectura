#!/usr/bin/env node
// Checks the three joist calculations (src/lib/calculs/bigueta-*.ts) against
// David's spreadsheets: each one runs with the inputs of his example and is
// compared with the values Excel computed (the cells' cached results, not the
// rounded display), including every OK! / NO!.
//
//   node scripts/test-calculs-biguetes.mjs
import { register } from "node:module";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

register("./mcp-test-hooks.mjs", import.meta.url);

const { computeBiguetaAcer, computeBiguetaAcerAla, biguetaAcerPerfilsValids, biguetaAcerDefaults, MANUAL } = await import("../src/lib/calculs/bigueta-acer.ts");
const { computeBiguetaFusta, biguetaFustaDefaults, factorAltura, FUSTA_CLASSES } = await import("../src/lib/calculs/bigueta-fusta.ts");
const { AJUDA_BIGUETES } = await import("../src/lib/calculs/bigueta-carregues.ts");
const { BIGUETES } = await import("../src/lib/calculs/biguetes.ts");
const { CALC_TYPES, calcType } = await import("../src/lib/calculs/index.ts");
const { verdict, allChecks } = await import("../src/lib/calculs/common.ts");
const { buildCalculHtml } = await import("../src/lib/calculs/report.ts");

let passed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  ✗ ${name}\n    ${e?.message ?? e}`);
  }
}
function near(actual, expected, rel = 1e-6, what = "") {
  const ok = typeof actual === "number" && Math.abs(actual - expected) <= Math.abs(expected) * rel + 1e-9;
  assert.ok(ok, `${what} expected ≈ ${expected}, got ${actual}`);
}

// Row by section key, block title and label prefix (the n-th match).
function row(result, section, block, label, nth = 0) {
  const s = result.sections.find((x) => x.key === section);
  if (!s) throw new Error(`section not found: ${section}`);
  const found = [];
  for (const b of s.blocks) {
    if (block && b.title !== block) continue;
    for (const r of b.rows) if (r.label.startsWith(label)) found.push(r);
  }
  if (!found[nth]) throw new Error(`row not found: ${section} / ${block} / ${label} #${nth}`);
  return found[nth];
}
// Value and OK! / NO! of a check row, as in the sheet.
function expectCheck(r, value, ok, what) {
  near(r.value, value, 1e-6, what);
  assert.ok(r.check, `${what}: no check`);
  assert.equal(r.check.ok, ok, `${what}: expected ${ok ? "OK!" : "NO!"}`);
}
const loadsOf = (result, key = "carregues") => result.sections.find((s) => s.key === key).loads;

// ---------------------------------------------------------------------------
console.log("Bigueta d'acer estàndard (Comprovació Bigueta d'Acer Estandard.xls)");
const acerInputs = { ppPerfil: 0.5 }; // the sheet types 0,5 kN/ml; the defaults hold the rest of the example
const acer = computeBiguetaAcer(acerInputs);
const ELS = "Estats límits de servei (E.L.S.)";
const ELU = "Estats límits últims (E.L.U.)";
const COEF = "Coeficients de seguretat";

test("estat de càrregues: Q ELS 11,34 · Q ELU 15,6342 kN/ml · sostre 10 kN/m² (F30, I30, B30)", () => {
  const l = loadsOf(acer);
  near(l.totalUnf, 11.34, 1e-9, "F30");
  near(l.totalFac, 15.634200000000002, 1e-9, "I30");
  const floor = l.groups.find((g) => g.total);
  near(floor.total.q, 10, 1e-12, "B30");
  near(floor.lines.find((x) => x.line?.label === "Pes propi estructural").line.fac, 7.317, 1e-9, "I23");
});
test("perfil UPN 300: f adm, σd, τd, Ix, Wx, Aa (H37, H45, H47–H50)", () => {
  near(row(acer, "perfil", "Dades geomètriques", "Deformació (fletxa) màxima").value, 11.26, 1e-9, "H37");
  near(row(acer, "perfil", null, "Resistència de càlcul del material").value, 261.90476190476187, 1e-9, "H45");
  near(row(acer, "perfil", null, "Resistència de càlcul a esforços").value, 151.21078478775911, 1e-9, "H47");
  near(row(acer, "perfil", null, "Moment d'inèrcia").value, 80300000, 1e-9, "H48");
  near(row(acer, "perfil", null, "Mòdul resistent").value, 535000, 1e-9, "H49");
  near(row(acer, "perfil", null, "Àrea de l'ànima").value, 2320, 1e-9, "H50");
});
test("E.L.S.: capacitat 14,5145 OK · 128 % OK · fletxa 8,797 mm OK · L/640 OK", () => {
  expectCheck(row(acer, "comprovacio", ELS, "Capacitat de càrrega per deformació"), 14.514459608919962, true, "H55");
  expectCheck(row(acer, "comprovacio", ELS, "Respecte a la sol·licitació"), 127.99347097813019, true, "H56");
  expectCheck(row(acer, "comprovacio", ELS, "Deformació del perfil"), 8.7973237337426067, true, "H57");
  expectCheck(row(acer, "comprovacio", ELS, "Amb aquesta deformació"), 639.96735489065077, true, "I58");
});
test("E.L.U.: flector, tallant i fórmula combinada (H60–H67), all OK", () => {
  expectCheck(row(acer, "comprovacio", ELU, "Capacitat de càrrega per moment flector"), 35.364732227832405, true, "H60");
  expectCheck(row(acer, "comprovacio", ELU, "Respecte a la sol·licitació", 0), 226.20109905100617, true, "H61");
  near(row(acer, "comprovacio", ELU, "Moment màxim flector").value, 61944459.24750001, 1e-9, "H62");
  expectCheck(row(acer, "comprovacio", ELU, "Tensió per moment flector"), 115.78403597663554, true, "H63");
  expectCheck(row(acer, "comprovacio", ELU, "Capacitat de càrrega per esforç tallant"), 124.62132174337519, true, "H64");
  expectCheck(row(acer, "comprovacio", ELU, "Respecte a la sol·licitació", 1), 797.10712248388256, true, "H65");
  expectCheck(row(acer, "comprovacio", ELU, "Tensió per esforç tallant"), 18.96994525862069, true, "H66");
  expectCheck(row(acer, "comprovacio", ELU, "Fórmula combinada"), 120.35580358413976, true, "H67");
});
test("coeficients de seguretat 1,2799 · 2,2620 · 7,9711 OK (H69–H71)", () => {
  expectCheck(row(acer, "comprovacio", COEF, "Per deformació"), 1.2799347097813019, true, "H69");
  expectCheck(row(acer, "comprovacio", COEF, "Per moment flector"), 2.2620109905100616, true, "H70");
  expectCheck(row(acer, "comprovacio", COEF, "Per esforç tallant"), 7.971071224838826, true, "H71");
});
test("verdict: the 14 checks of the sheet, all OK!", () => {
  const v = verdict(acer);
  assert.equal(v.total, 14);
  assert.equal(v.failed, 0);
});
test("self-weight from the catalogue when not typed: n × 46,2 kg/m (UPN 300)", () => {
  const r = computeBiguetaAcer({ nPerfils: 2 });
  const l = loadsOf(r).groups[0].lines[0].line;
  near(l.q, (2 * 46.2 * 9.81) / 1000, 1e-12, "pp");
  assert.equal(l.qAuto, l.q);
  near(row(r, "perfil", null, "Moment d'inèrcia").value, 2 * 80300000, 1e-12, "2 × Ix");
});
test("profiles that pass: UPN 300 does, IPE 80 doesn't, and each matches a full computation", () => {
  const ok = biguetaAcerPerfilsValids(acerInputs);
  const passes = (perfil) => verdict(computeBiguetaAcer({ ...acerInputs, perfil })).failed === 0;
  assert.ok(ok.has("UPN 300"));
  assert.ok(!ok.has("IPE 80"));
  for (const name of ["UPN 260", "UPN 280", "IPE 220", "IPE 240", "HEB 160", "HEA 180", "IPN 220", "HEM 100"]) assert.equal(ok.has(name), passes(name), name);
  const t0 = performance.now();
  biguetaAcerPerfilsValids({});
  const ms = performance.now() - t0;
  assert.ok(ms < 200, `${ms.toFixed(0)} ms`);
  console.log(`    ${ok.size} catalogue profiles pass the example (checked in ${ms.toFixed(0)} ms)`);
});

// ---------------------------------------------------------------------------
console.log("Bigueta d'acer d'ala estreta (Comprovació Bigueta d'Acer Ala Estreta.xls)");
// The sheet types Ix = 328 cm⁴, Wx = 54,7 cm³ and Aa = 120 × 5,1 mm² for an IPN 120.
const alaInputs = { perfil: "IPN 120", ppPerfil: 0.5, Ix: 328, Wx: 54.7, h1: 120, e: 5.1 };
const ala = computeBiguetaAcerAla(alaInputs);
test("estat de càrregues: Q ELS 4,1 · Q ELU 5,715 kN/ml (F30, I30)", () => {
  near(loadsOf(ala).totalUnf, 4.1, 1e-9, "F30");
  near(loadsOf(ala).totalFac, 5.715, 1e-9, "I30");
});
test("perfil: σd 208,70 · τd 120,49 · Ix 3.280.000 mm⁴ · Wx 54.700 mm³ · Aa 612 mm²", () => {
  near(row(ala, "perfil", null, "Resistència de càlcul del material").value, 208.69565217391306, 1e-9, "H44");
  near(row(ala, "perfil", null, "Resistència de càlcul a esforços").value, 120.49049096131321, 1e-9, "H46");
  near(row(ala, "perfil", null, "Moment d'inèrcia").alt.value, 3280000, 1e-9, "H47");
  near(row(ala, "perfil", null, "Mòdul resistent").alt.value, 54700, 1e-9, "H48");
  near(row(ala, "perfil", null, "Àrea de l'ànima").value, 612, 1e-9, "H49");
});
test("E.L.S.: 2,0887 NO · 50,9 % NO · fletxa 14,53 mm NO · L/255 NO (H54–I57)", () => {
  expectCheck(row(ala, "comprovacio", ELS, "Capacitat de càrrega per deformació"), 2.0887149823307607, false, "H54");
  expectCheck(row(ala, "comprovacio", ELS, "Respecte a la sol·licitació"), 50.944267861725876, false, "H55");
  const fD = row(ala, "comprovacio", ELS, "Deformació del perfil");
  expectCheck(fD, 14.525677393353174, false, "H56");
  near(fD.check.limit, 7.4, 1e-9, "f adm (the sheet shows #REF! here)");
  expectCheck(row(ala, "comprovacio", ELS, "Amb aquesta deformació"), 254.72133930862933, false, "I57");
});
test("E.L.U.: all OK (H59–H66)", () => {
  expectCheck(row(ala, "comprovacio", ELU, "Capacitat de càrrega per moment flector"), 6.6709435640105452, true, "H59");
  expectCheck(row(ala, "comprovacio", ELU, "Respecte a la sol·licitació", 0), 116.72692150499641, true, "H60");
  near(row(ala, "comprovacio", ELU, "Moment màxim flector").value, 9779793.75, 1e-9, "H61");
  expectCheck(row(ala, "comprovacio", ELU, "Tensió per moment flector"), 178.78964808043875, true, "H62");
  expectCheck(row(ala, "comprovacio", ELU, "Capacitat de càrrega per esforç tallant"), 39.859557009904691, true, "H63");
  expectCheck(row(ala, "comprovacio", ELU, "Respecte a la sol·licitació", 1), 697.45506579010839, true, "H64");
  expectCheck(row(ala, "comprovacio", ELU, "Tensió per esforç tallant"), 17.275735294117649, true, "H65");
  expectCheck(row(ala, "comprovacio", ELU, "Fórmula combinada"), 181.27628457849747, true, "H66");
});
test("coeficients de seguretat: 0,5094 NO · 1,1673 OK · 6,9746 OK (H68–H70)", () => {
  expectCheck(row(ala, "comprovacio", COEF, "Per deformació"), 0.50944267861725878, false, "H68");
  expectCheck(row(ala, "comprovacio", COEF, "Per moment flector"), 1.1672692150499642, true, "H69");
  expectCheck(row(ala, "comprovacio", COEF, "Per esforç tallant"), 6.9745506579010836, true, "H70");
  const v = verdict(ala);
  assert.equal(v.total, 14);
  assert.equal(v.failed, 5);
});
test("profile values come from the picked profile unless typed (IPN 120: h1 = 92, Torras 160)", () => {
  const ipn = computeBiguetaAcerAla({ perfil: "IPN 120" });
  near(row(ipn, "perfil", null, "Moment d'inèrcia").value, 328, 1e-12, "Ix");
  near(row(ipn, "perfil", null, "Àrea de l'ànima").value, 92 * 5.1, 1e-12, "Aa = e · h1");
  near(loadsOf(ipn).groups[0].lines[0].line.q, (11.2 * 9.81) / 1000, 1e-9, "pp IPN 120 (catalogue 11,2 kg/m)");
  const t = computeBiguetaAcerAla({ perfil: "Torras 160" });
  near(row(t, "perfil", null, "Moment d'inèrcia").value, 768, 1e-12, "Ix");
  near(row(t, "perfil", null, "Mòdul resistent").value, 96, 1e-12, "Wx");
  near(row(t, "perfil", null, "Àrea de l'ànima").value, 120 * 6.5, 1e-12, "Aa");
  near(loadsOf(t).groups[0].lines[0].line.q, (16 * 9.81) / 1000, 1e-12, "pp 16 kg/m");
});
test("the picker marks the profiles that pass, and MANUAL takes typed values only", () => {
  const picker = row(ala, "perfil", "Dades del perfil", "Nom del perfil").input;
  assert.equal(picker.type, "select");
  const marked = picker.options.filter((o) => o.label.includes("✓")).map((o) => o.value);
  for (const o of picker.options) {
    if (o.value === MANUAL) continue;
    const ok = verdict(computeBiguetaAcerAla({ ...alaInputs, perfil: o.value, Ix: null, Wx: null, h1: null, e: null })).failed === 0;
    assert.equal(marked.includes(o.value), ok, o.value);
  }
  assert.ok(picker.options[0].value.startsWith("Torras"));
  const m = computeBiguetaAcerAla({ perfil: MANUAL, Ix: 328, Wx: 54.7, h1: 120, e: 5.1, ppPerfil: 0.5 });
  near(row(m, "comprovacio", COEF, "Per deformació").value, 0.50944267861725878, 1e-9, "manual = sheet");
  const empty = computeBiguetaAcerAla({ perfil: MANUAL });
  assert.equal(row(empty, "perfil", null, "Moment d'inèrcia").value, null);
  assert.equal(row(empty, "comprovacio", ELS, "Capacitat de càrrega per deformació").check.ok, false);
});

// ---------------------------------------------------------------------------
console.log("Bigueta de fusta i resistència al foc (Comprovació Bigueta de Fusta i Resistència al Foc.xls)");
const fusta = computeBiguetaFusta({}); // the defaults are the sheet's example
const R = "Dades globals de l'estat de càrregues";
test("estat de càrregues inicial: Q ELS 3,234 · Q ELU 4,5459 · sostre 5,39 kN/m² (F28, I28, B28)", () => {
  near(loadsOf(fusta).totalUnf, 3.234, 1e-9, "F28");
  near(loadsOf(fusta).totalFac, 4.5458999999999996, 1e-9, "I28");
  near(loadsOf(fusta).groups.find((g) => g.total).total.q, 5.3900000000000006, 1e-9, "B28");
});
test("resum (H33–H38)", () => {
  near(row(fusta, "resum", R, "Càrrega uniforme repartida sense majorar (càrregues permanents)").value, 2.0339999999999998, 1e-9, "H33");
  near(row(fusta, "resum", R, "Càrrega uniforme repartida sense majorar (càrregues variables)").value, 1.2, 1e-9, "H34");
  near(row(fusta, "resum", R, "Càrrega uniforme sense majorar").value, 3.234, 1e-9, "H35");
  near(row(fusta, "resum", R, "Càrrega uniforme repartida majorada (càrregues permanents)").value, 2.7459000000000002, 1e-9, "H36");
  near(row(fusta, "resum", R, "Càrrega uniforme repartida majorada (càrregues variables)").value, 1.7999999999999998, 1e-9, "H37");
  near(row(fusta, "resum", R, "Càrrega uniforme majorada").value, 4.5458999999999996, 1e-9, "H38");
});
test("secció 150 × 220 i fusta C18 (H47–H65)", () => {
  near(row(fusta, "perfil", "Dades del perfil", "Àrea de la secció").value, 33000, 1e-12, "H47");
  near(row(fusta, "perfil", "Dades del perfil", "Moment d'inèrcia").value, 133100000, 1e-12, "H48");
  near(row(fusta, "perfil", "Dades del perfil", "Mòdul resistent").value, 1210000, 1e-12, "H49");
  assert.equal(row(fusta, "perfil", null, "Tipus de fusta").value, "Conífera");
  near(row(fusta, "perfil", null, "Densitat mitja").value, 380, 1e-12, "H53 · 100");
  near(row(fusta, "perfil", null, "Mòdul d'elasticitat").value, 9000, 1e-12, "H55");
  near(row(fusta, "perfil", null, "Factor de deformació càrregues permanents").value, 0.6, 1e-12, "H56");
  near(row(fusta, "perfil", null, "Factor de deformació càrregues variables").value, 0.25, 1e-12, "H57");
  near(row(fusta, "perfil", null, "Resistència característica a flexió").value, 18, 1e-12, "H58");
  near(row(fusta, "perfil", null, "Coeficient de modificació").value, 0.6, 1e-12, "H59");
  near(row(fusta, "perfil", null, "Coeficient d'altura").value, 1, 1e-12, "H60");
  near(row(fusta, "perfil", null, "Resistència de càlcul del material a flexió").value, 8.3076923076923066, 1e-9, "H62");
  near(row(fusta, "perfil", null, "Resistència característica a tallant").value, 3.4, 1e-12, "H63");
  near(row(fusta, "perfil", null, "Resistència de càlcul del material a tallant").value, 1.5692307692307692, 1e-9, "H65");
});
test("E.L.U.: flexió 10,286 N/mm² NO (índex 1,238 NO) · tallant 0,7217 OK (índex 0,460 OK)", () => {
  near(row(fusta, "comprovacio", ELU, "Moment màxim flector de càlcul C.P.").value, 7517725.0200000014, 1e-9, "H70");
  near(row(fusta, "comprovacio", ELU, "Moment màxim flector de càlcul C.V.").value, 4928040, 1e-9, "H71");
  near(row(fusta, "comprovacio", ELU, "Moment màxim flector total").value, 12445765.020000001, 1e-9, "H72");
  expectCheck(row(fusta, "comprovacio", ELU, "Tensió per moment flector"), 10.285756214876034, false, "H73");
  expectCheck(row(fusta, "comprovacio", ELU, "Comprovació a flexió"), 1.2381002851239673, false, "H74");
  near(row(fusta, "comprovacio", ELU, "Esforç tallant màxim càrregues permanents").value, 6425.4060000000009, 1e-9, "H75");
  near(row(fusta, "comprovacio", ELU, "Esforç tallant màxim càrregues variables").value, 4212, 1e-9, "H76");
  near(row(fusta, "comprovacio", ELU, "Esforç tallant màxim total").value, 10637.406000000001, 1e-9, "H77");
  expectCheck(row(fusta, "comprovacio", ELU, "Tensió per esforç tallant"), 0.72166933514246945, true, "H78");
  expectCheck(row(fusta, "comprovacio", ELU, "Comprovació a tallant"), 0.45988732141431876, true, "H79");
});
test("E.L.S.: fletxes 10,606 / 6,257 / fluència 6,364 mm; límits 9,36 / 13,37 / 15,6 mm", () => {
  near(row(fusta, "comprovacio", ELS, "Fletxa instantània càrregues permanents").value, 10.60602327723516, 1e-9, "H81");
  near(row(fusta, "comprovacio", ELS, "Fletxa instantània càrregues variables").value, 6.2572408715251688, 1e-9, "H82");
  near(row(fusta, "comprovacio", ELS, "Fluència").value, 6.363613966341096, 1e-9, "H83");
  const lim = "Limitacions de deformacions";
  near(row(fusta, "comprovacio", lim, "Deformació màxima admissible per integritat").value, 9.36, 1e-9, "H86");
  near(row(fusta, "comprovacio", lim, "Deformació màxima admissible per confort").value, 13.371428571428572, 1e-9, "H88");
  near(row(fusta, "comprovacio", lim, "Deformació màxima admissible per aparença").value, 15.6, 1e-9, "H90");
});
test("exigències 4.3.3.1: Wact 12,62 NO · Winst 6,26 OK · Wnet,fin 16,97 NO (H95–H97)", () => {
  const ex = "Exigències o límits segons l'art. 4.3.3.1 de DB SE";
  expectCheck(row(fusta, "comprovacio", ex, "Per integritat"), 12.620854837866265, false, "H95");
  expectCheck(row(fusta, "comprovacio", ex, "Per confort"), 6.2572408715251688, true, "H96");
  expectCheck(row(fusta, "comprovacio", ex, "Per aparença"), 16.969637243576255, false, "H97");
});
test("foc: càrregues Q ELS 3,234 · Q ELU 2,754; resum H117–H122", () => {
  near(loadsOf(fusta, "carreguesFoc").totalUnf, 3.234, 1e-9, "F112");
  near(loadsOf(fusta, "carreguesFoc").totalFac, 2.7539999999999996, 1e-9, "I112");
  near(row(fusta, "resumFoc", R, "Càrrega uniforme repartida majorada (càrregues permanents)").value, 2.0339999999999998, 1e-9, "H120");
  near(row(fusta, "resumFoc", R, "Càrrega uniforme repartida majorada (càrregues variables)").value, 0.72, 1e-9, "H121");
  near(row(fusta, "resumFoc", R, "Càrrega uniforme majorada").value, 2.7539999999999996, 1e-9, "H122");
  // read-only loads, fire coefficients as inputs
  const lines = loadsOf(fusta, "carreguesFoc").groups.flatMap((g) => g.lines.map((l) => l.line).filter(Boolean));
  for (const l of lines) {
    assert.equal(l.qKey, undefined, l.label);
    assert.ok(l.gammaKey?.startsWith("f"), l.label);
  }
});
test("foc: secció reduïda dchar 48 · def 55 · 40 × 165 mm (H137–H145)", () => {
  const b = "Dades resultants aplicant foc de la secció reduïda";
  near(row(fusta, "perfilFoc", b, "Profunditat de carbonització nominal").value, 48, 1e-12, "H137");
  near(row(fusta, "perfilFoc", b, "Profunditat eficaç").value, 55, 1e-12, "H140");
  near(row(fusta, "perfilFoc", b, "Base de la bigueta").value, 40, 1e-12, "H141");
  near(row(fusta, "perfilFoc", b, "Alçària de la bigueta").value, 165, 1e-12, "H142");
  near(row(fusta, "perfilFoc", b, "Àrea de la secció").value, 6600, 1e-12, "H143");
  near(row(fusta, "perfilFoc", b, "Moment d'inèrcia").value, 14973750, 1e-12, "H144");
  near(row(fusta, "perfilFoc", b, "Mòdul resistent").value, 181500, 1e-12, "H145");
});
test("foc: fm,d 22,5 · σ 41,54 N/mm² NO · índex 1,846 NO (H159–H165)", () => {
  near(row(fusta, "comprovacioFoc", null, "Resistència de càlcul del material a flexió").value, 22.5, 1e-12, "H159");
  near(row(fusta, "comprovacioFoc", ELU, "Moment màxim flector de càlcul C.P.").value, 5568685.1999999993, 1e-9, "H161");
  near(row(fusta, "comprovacioFoc", ELU, "Moment màxim flector de càlcul C.V.").value, 1971216, 1e-9, "H162");
  near(row(fusta, "comprovacioFoc", ELU, "Moment màxim flector total").value, 7539901.1999999993, 1e-9, "H163");
  expectCheck(row(fusta, "comprovacioFoc", ELU, "Tensió per moment flector"), 41.542155371900826, false, "H164");
  expectCheck(row(fusta, "comprovacioFoc", ELU, "Comprovació a flexió"), 1.8463180165289257, false, "H165");
});
test("verdict: 9 checks, 6 NO! as in the sheet", () => {
  const v = verdict(fusta);
  assert.equal(v.total, 9);
  assert.equal(v.failed, 6);
  assert.deepEqual(allChecks(fusta).filter((c) => c.ok).map((c) => c.label), ["Tensió per esforç tallant", "Comprovació a tallant (índex)", "Per confort dels usuaris"]);
});
test("auto values: kdef / kmod from the service class, kh from H, βn from the class", () => {
  const s2 = computeBiguetaFusta({ servei: "2" });
  near(row(s2, "perfil", null, "Factor de deformació càrregues permanents").value, 0.8, 1e-12, "kdef P, classe 2");
  const s3 = computeBiguetaFusta({ servei: "3" });
  near(row(s3, "perfil", null, "Coeficient de modificació").value, 0.5, 1e-12, "kmod, classe 3");
  near(factorAltura(100), Math.pow(1.5, 0.2), 1e-12, "kh 100 mm (Dades D51 = 1,0845)");
  near(factorAltura(100), 1.0844717711976986, 1e-12, "D51");
  assert.equal(factorAltura(220), 1);
  assert.equal(factorAltura(10), 1.3);
  const h = computeBiguetaFusta({ H: 100 });
  near(row(h, "perfil", null, "Coeficient d'altura").value, 1.0844717711976986, 1e-12, "kh auto");
  const typed = computeBiguetaFusta({ kmod: 0.8, kh: 1.1 });
  near(row(typed, "perfil", null, "Resistència de càlcul del material a flexió").value, (18 * 0.8 * 1.1) / 1.3, 1e-12, "typed kmod, kh");
  const d40 = computeBiguetaFusta({ classe: "D40" });
  near(row(d40, "perfilFoc", null, "Velocitat nominal de carbonització").value, 0.55, 1e-12, "βn frondosa");
  near(row(d40, "perfilFoc", null, "Profunditat eficaç").value, 0.55 * 60 + 7, 1e-12, "def");
});
test("a section burnt through has no resistance (NO!)", () => {
  const r = computeBiguetaFusta({ B: 100, rf: 90 });
  const s = row(r, "comprovacioFoc", ELU, "Tensió per moment flector");
  assert.equal(s.value, null);
  assert.equal(s.check.ok, false);
});
test("timber classes: 20, C14–C50 and D18–D70, with every value", () => {
  assert.equal(FUSTA_CLASSES.length, 20);
  for (const c of FUSTA_CLASSES) for (const k of ["fmk", "fvk", "e0", "rho", "betaN"]) assert.ok(c[k] > 0, `${c.classe} ${k}`);
});

// ---------------------------------------------------------------------------
console.log("Registre, ajuda i informe");
test("the three types are registered in the Biguetes group", () => {
  assert.deepEqual(BIGUETES.map((t) => t.tipus), ["bigueta-acer", "bigueta-acer-ala", "bigueta-fusta"]);
  for (const t of BIGUETES) {
    assert.equal(t.group, "Biguetes");
    assert.ok(CALC_TYPES.includes(t));
    assert.equal(calcType(t.tipus), t);
    assert.equal(t.situacioLabel, "Sostre planta");
  }
});
test("defaults compute and give checks; stored data with missing keys falls back to them", () => {
  for (const t of BIGUETES) {
    assert.ok(verdict(t.compute(t.defaults())).total > 0, t.tipus);
    assert.ok(verdict(t.compute({})).total > 0, t.tipus);
  }
  assert.deepEqual(biguetaAcerDefaults().perfil, "UPN 300");
  assert.equal(biguetaFustaDefaults().classe, "C18");
});
test("every help image exists", () => {
  for (const img of Object.values(AJUDA_BIGUETES)) assert.ok(existsSync(join(ROOT, "public", img.src)), img.src);
});
test("report: title and both load tables, for every type", () => {
  const calc = { num: "CE-26-999", tipus: "bigueta-fusta", referencia: "14598", projecte: "P", adreca: "A", ciutat: "C", client: "X", arquitecte: "D", situacio: "Entresòl", element: "3.1", data: "2026-11-08", versio: "1" };
  const html = buildCalculHtml(calc, fusta, { logo: "" });
  assert.ok(html.includes("Comprovació de bigueta de fusta i resistència al foc"));
  assert.ok(html.includes("Estat de càrregues proposat en cas de foc"));
  assert.ok(html.includes("Sostre planta"));
  for (const t of BIGUETES) assert.ok(buildCalculHtml({ ...calc, tipus: t.tipus }, t.compute(t.defaults()), { logo: "" }).includes(t.reportTitle));
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
