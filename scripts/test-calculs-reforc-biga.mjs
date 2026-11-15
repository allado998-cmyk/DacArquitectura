#!/usr/bin/env node
// Checks «Reforç biga d'acer amb xapa de compressió» (src/lib/calculs/reforc-biga.ts) against David's spreadsheets: each calculation runs with the
// inputs of his example and is compared with the values Excel computed (read
// from the cells, not the rounded display), including every OK! / NO!. What
// differs on purpose is explained in the header of the calculation file; here
// the app's value is asserted, computed from the sheet's own numbers, and the
// sheet's is printed beside it.
//
//   node scripts/test-calculs-reforc-biga.mjs
import { register } from "node:module";
import assert from "node:assert/strict";

register("./mcp-test-hooks.mjs", import.meta.url);

const { CALC_TYPES, CALC_GROUPS, calcType } = await import("../src/lib/calculs/index.ts");
const { computeReforcBigaAcer, computeReforcBigaAcerAla, reforcBigaAcerDefaults, reforcBigaAcerAlaDefaults, reforcBigaAcerPerfilsValids } = await import("../src/lib/calculs/reforc-biga.ts");
const { MANUAL } = await import("../src/lib/calculs/bigueta-acer.ts");
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
const val = (...args) => row(...args).value;
// Value and OK! / NO! of a check row, as in the sheet.
function expectCheck(r, value, ok, what) {
  near(r.value, value, 1e-6, what);
  assert.ok(r.check, `${what}: no check`);
  assert.equal(r.check.ok, ok, `${what}: expected ${ok ? "OK!" : "NO!"}`);
}
const loadsOf = (result, key) => result.sections.find((s) => s.key === key).loads;
const lineOf = (loads, label) => loads.groups.flatMap((g) => g.lines).find((l) => l.line?.label === label).line;
const ELS = "Estats límits de servei (E.L.S.)";
const ELU = "Estats límits últims (E.L.U.)";
const COEF = "Coeficients de seguretat";
const PCT = "Percentatge d'increment";
const sheetVsApp = (what, sheet, app) => console.log(`      ${what}: sheet ${sheet} · app ${app}`);

console.log("Registre");
test("registered in the «Reforços» group", () => {
  for (const tipus of ["reforc-biga-acer", "reforc-biga-acer-ala"]) {
    const t = calcType(tipus);
    assert.equal(t.tipus, tipus);
    assert.equal(t.group, "Reforços");
    assert.ok(CALC_TYPES.includes(t));
  }
  assert.ok(CALC_GROUPS.includes("Reforços"));
});

// ---------------------------------------------------------------------------
console.log("Reforç biga d'acer estàndard (OK-REFORÇ BIGA D'ACER AMB XAPA COMPRESSIÓ-reforç.xls)");
const acer = computeReforcBigaAcer({}); // the defaults are the sheet's example
// Deliberate differences (see reforc-biga.ts): IPN 120's web is 92 × 5,1 mm in
// the catalogue (the sheet's 'Dades Perfils': 92,4 mm → 471,24 mm²), and γMf /
// γV divide by Q ELU (the sheet: by the unfactored load).
const AA = 92 * 5.1;
const TD = 275 / 1.05 / Math.sqrt(3); // H45 = 151,21078
const qMaxV = (2 * TD * AA) / 3500; // H62 / H127 with the catalogue web

test("estat de càrregues inicial: Q ELS 5,74 · Q ELU 7,995 kN/ml · sostre 7 kN/m², no profile line (F28, I28, B28)", () => {
  const l = loadsOf(acer, "carregues");
  near(l.totalUnf, 5.74, 1e-9, "F28");
  near(l.totalFac, 7.995, 1e-9, "I28");
  near(l.groups.find((g) => g.total).total.q, 7, 1e-12, "B28");
  near(lineOf(l, "Pes propi estructural").fac, 2.214, 1e-9, "I21");
  assert.ok(!l.groups.some((g) => g.lines.some((x) => x.line?.label === "Pes propi del perfil a calcular")));
});
test("perfil IPN 120: f adm, σd, τd, Ix, Wx (H35, H43, H45–H47); Aa from the catalogue's h1", () => {
  near(val(acer, "perfil", "Dades geomètriques", "Deformació (fletxa) màxima"), 7, 1e-12, "H35");
  near(val(acer, "perfil", null, "Resistència de càlcul del material"), 261.90476, 1e-6, "H43");
  near(val(acer, "perfil", null, "Resistència de càlcul a esforços"), 151.21078, 1e-6, "H45");
  near(val(acer, "perfil", null, "Moment d'inèrcia"), 3280000, 1e-12, "H46");
  near(val(acer, "perfil", null, "Mòdul resistent"), 54700, 1e-12, "H47");
  near(val(acer, "perfil", null, "Àrea de l'ànima"), AA, 1e-12, "Aa");
  sheetVsApp("Aa (H48)", "471,24 mm²", `${AA} mm²`);
});
test("comprovació perfil existent: informative, every OK! / NO! of the sheet (H53–H69)", () => {
  const s = acer.sections.find((x) => x.key === "comprovacio");
  assert.equal(s.informative, true);
  assert.equal(s.title, "Comprovació perfil existent d'acer estàndard");
  expectCheck(row(acer, "comprovacio", ELS, "Capacitat de càrrega per deformació"), 2.467631, false, "H53");
  expectCheck(row(acer, "comprovacio", ELS, "Respecte a la sol·licitació"), 42.990087, false, "H54");
  expectCheck(row(acer, "comprovacio", ELS, "Deformació del perfil"), 16.282823, false, "H55");
  expectCheck(row(acer, "comprovacio", ELS, "Amb aquesta deformació"), 214.95044, false, "I56");
  expectCheck(row(acer, "comprovacio", ELU, "Capacitat de càrrega per moment flector"), 9.3558795, true, "H58");
  expectCheck(row(acer, "comprovacio", ELU, "Respecte a la sol·licitació", 0), 117.02163, true, "H59");
  near(val(acer, "comprovacio", ELU, "Moment màxim flector"), 12242344, 1e-6, "H60");
  expectCheck(row(acer, "comprovacio", ELU, "Tensió per moment flector"), 223.80884, true, "H61");
  const tau = (7.995 * 3500) / 2 / AA;
  expectCheck(row(acer, "comprovacio", ELU, "Capacitat de càrrega per esforç tallant"), qMaxV, true, "H62 (catalogue web)");
  expectCheck(row(acer, "comprovacio", ELU, "Respecte a la sol·licitació", 1), (qMaxV / 7.995) * 100, true, "H63 (catalogue web)");
  expectCheck(row(acer, "comprovacio", ELU, "Tensió per esforç tallant"), tau, true, "H64 (catalogue web)");
  expectCheck(row(acer, "comprovacio", ELU, "Fórmula combinada"), Math.sqrt(223.80884 ** 2 + 3 * tau ** 2), true, "H65 (catalogue web)");
  sheetVsApp("Q max V · τ · C", "40,71804 · 29,690285 · 229,64089", `${qMaxV.toFixed(5)} · ${tau.toFixed(6)} · ${row(acer, "comprovacio", ELU, "Fórmula combinada").value.toFixed(5)}`);
  expectCheck(row(acer, "comprovacio", COEF, "Per deformació"), 0.42990087, false, "H67");
  expectCheck(row(acer, "comprovacio", COEF, "Per moment flector"), 9.3558795 / 7.995, true, "H68 / Q ELU");
  expectCheck(row(acer, "comprovacio", COEF, "Per esforç tallant"), qMaxV / 7.995, true, "H69 / Q ELU");
  sheetVsApp("γMf · γV (÷ Q ELS in the sheet, ÷ Q ELU here)", "1,6299442 · 7,0937352", `${(9.3558795 / 7.995).toFixed(7)} · ${(qMaxV / 7.995).toFixed(7)}`);
});
test("secció mixta: H1, B1, A1 from the profile; B2 820 mm; IT 17.003.909 mm⁴, WT 123.328 mm³ (H74–H96)", () => {
  const M = "mixta";
  near(val(acer, M, null, "Alçària de la bigueta"), 120, 1e-12, "H74");
  near(val(acer, M, null, "Base de la bigueta"), 58, 1e-12, "H75");
  near(row(acer, M, null, "Àrea de la bigueta").alt.value, 1420, 1e-12, "H76");
  near(val(acer, M, null, "Mòdul d'elasticitat de la bigueta"), 210000, 1e-12, "H77");
  near(val(acer, M, null, "Gruix de la capa"), 80, 1e-12, "H79");
  near(val(acer, M, null, "Amplària de la capa"), 820, 1e-12, "H80");
  near(val(acer, M, null, "Àrea de la capa"), 65600, 1e-12, "H81");
  near(val(acer, M, null, "Mòdul d'elasticitat de la capa"), 16000, 1e-12, "H82");
  near(val(acer, M, null, "Relació entre mòduls"), 0.076190476, 1e-6, "H83");
  near(val(acer, M, null, "Amplària equivalent"), 62.47619, 1e-6, "H84");
  near(val(acer, M, null, "Àrea equivalent"), 4998.0952, 1e-6, "H85");
  near(val(acer, M, null, "Distància entre els centres"), 100, 1e-12, "H87");
  near(val(acer, M, null, "Distància del perfil al nou"), 77.875056, 1e-6, "H88");
  near(val(acer, M, null, "Moment d'inèrcia de la bigueta"), 3280000, 1e-12, "H90");
  near(val(acer, M, null, "Moment d'inèrcia de la capa"), 2665650.8, 1e-6, "H91");
  near(val(acer, M, null, "Distància nou c.d.g."), 137.87506, 1e-6, "H92");
  near(val(acer, M, null, "Moment d'inèrcia total"), 17003909, 1e-6, "H94");
  near(val(acer, M, null, "Mòdul resistent total"), 123328.39, 1e-6, "H95");
  near(val(acer, M, null, "Àrea de l'ànima resultant"), AA, 1e-12, "H96 (catalogue web; sheet 471,24)");
});
test("estat de càrregues final: capa 1,4 kN/m² · Q ELS 8,528 · Q ELU 12,1278 · sostre 10,4; increments (B105, F112, I112, B112, row 113)", () => {
  const l = loadsOf(acer, "carreguesFinal");
  near(lineOf(l, "Pes propi de la capa de compressió").q, 1.4, 1e-12, "B105");
  near(lineOf(l, "Pes propi de la capa de compressió").fac, 1.5498, 1e-9, "I105");
  near(lineOf(l, "Càrregues permanents de paviments i morter").q, 1, 1e-12, "B106 (typed 1, initial 2)");
  near(lineOf(l, "Sobrecàrrega d'ús").fac, 6.15, 1e-9, "I109");
  near(l.totalUnf, 8.528, 1e-9, "F112");
  near(l.totalFac, 12.1278, 1e-9, "I112");
  near(l.groups.find((g) => g.total).total.q, 10.4, 1e-9, "B112");
  const I = "Increment de càrrega";
  near(val(acer, "carreguesFinal", I, "Increment de càrrega del sostre"), 3.4, 1e-9, "B113");
  near(val(acer, "carreguesFinal", I, PCT), 48.571429, 1e-6, "D113 · 100");
  near(val(acer, "carreguesFinal", I, "Increment de càrrega sense majorar"), 2.788, 1e-9, "F113");
  near(val(acer, "carreguesFinal", I, "Increment de càrrega majorada"), 4.1328, 1e-9, "I113");
});
test("comprovació perfil mixte: every OK! of the sheet (H118–H134)", () => {
  const K = "comprovacio-mixte";
  assert.ok(!acer.sections.find((x) => x.key === K).informative);
  expectCheck(row(acer, K, ELS, "Capacitat de càrrega per deformació"), 12.792492, true, "H118");
  expectCheck(row(acer, K, ELS, "Respecte a la sol·licitació"), 150.00576, true, "H119");
  expectCheck(row(acer, K, ELS, "Deformació del perfil"), 4.6664873, true, "H120");
  expectCheck(row(acer, K, ELS, "Amb aquesta deformació"), 750.02882, true, "I121");
  expectCheck(row(acer, K, ELU, "Capacitat de càrrega per moment flector"), 21.094069, true, "H123");
  expectCheck(row(acer, K, ELU, "Respecte a la sol·licitació", 0), 173.93154, true, "H124");
  near(val(acer, K, ELU, "Moment màxim flector"), 18570694, 1e-6, "H125");
  expectCheck(row(acer, K, ELU, "Tensió per moment flector"), 150.57923, true, "H126");
  const tau = (12.1278 * 3500) / 2 / AA;
  expectCheck(row(acer, K, ELU, "Capacitat de càrrega per esforç tallant"), qMaxV, true, "H127 (catalogue web)");
  expectCheck(row(acer, K, ELU, "Respecte a la sol·licitació", 1), (qMaxV / 12.1278) * 100, true, "H128 (catalogue web)");
  expectCheck(row(acer, K, ELU, "Tensió per esforç tallant"), tau, true, "H129 (catalogue web)");
  expectCheck(row(acer, K, ELU, "Fórmula combinada"), Math.sqrt(150.57923 ** 2 + 3 * tau ** 2), true, "H130 (catalogue web)");
  expectCheck(row(acer, K, COEF, "Per deformació"), 1.5000576, true, "H132");
  expectCheck(row(acer, K, COEF, "Per moment flector"), 21.094069 / 12.1278, true, "H133 / Q ELU");
  expectCheck(row(acer, K, COEF, "Per esforç tallant"), qMaxV / 12.1278, true, "H134 / Q ELU");
  sheetVsApp("γMf · γV", "2,4735071 · 4,7746295", `${(21.094069 / 12.1278).toFixed(7)} · ${(qMaxV / 12.1278).toFixed(7)}`);
  // the formulas name the composite values
  assert.equal(row(acer, K, ELS, "Capacitat de càrrega per deformació").formula, "Q max ELS = f adm · 384 · E0 · IT / (5 · L⁴)");
  assert.equal(row(acer, K, ELU, "Tensió per esforç tallant").formula, "τ max ELU = (Q ELU · L / 2) / Aap");
});
test("verdict: the 14 checks of the reinforced section, all OK!; the existing joist's are left out", () => {
  const v = verdict(acer);
  assert.equal(v.total, 14);
  assert.equal(v.failed, 0);
  assert.ok(allChecks(acer).every((c) => c.section === "Comprovació perfil mixte acer + formigó"));
});
test("connectors: lb, Me, R, Prd, 3 + 2 + 3 connectors at 218,75 / 583,33 mm (H146–H156)", () => {
  const C = "connectors";
  near(val(acer, C, null, "Longitud d'ancoratge"), 428.57143, 1e-6, "H146");
  near(val(acer, C, null, "Moment estàtic"), 110582.58, 1e-6, "H147");
  near(val(acer, C, null, "Esforç tallant a cada extrem"), (12.1278 * 3500) / 2000, 1e-9, "V (I112 · H33 / 1000 / 2)");
  near(val(acer, C, null, "Tensió rasant"), 0.002509547 * 1000, 1e-6, "H148 (kN/mm² → N/mm²)");
  near(val(acer, C, null, "Resistència de cada connector (barres)"), (43.509116 * Math.PI) / 3.14, 1e-6, "H149 with π");
  sheetVsApp("Prd,b (π instead of 3,14)", "43,509116 kN", `${val(acer, C, null, "Resistència de cada connector (barres)").toFixed(6)} kN`);
  near(val(acer, C, null, "Resistència de cada connector (soldadura)"), 36.760231, 1e-6, "H150");
  near(val(acer, C, null, "Resistència de càlcul del connector"), 36.760231, 1e-6, "min (the weld governs)");
  near(val(acer, C, null, "Connectors necessaris a cada interval extrem"), 2.4640477, 1e-6, "F153");
  near(val(acer, C, null, "Connectors necessaris a l'interval central"), 1.6426985, 1e-6, "F154");
  assert.equal(val(acer, C, null, "Connectors adoptats a cada interval extrem"), 3, "H153");
  assert.equal(val(acer, C, null, "Connectors adoptats a l'interval central"), 2, "H154");
  near(val(acer, C, null, "Separació a cada interval extrem"), 218.75, 1e-12, "L153 · 10");
  near(val(acer, C, null, "Separació a l'interval central"), 583.33333, 1e-6, "L154 · 10");
  near(val(acer, C, null, "Total connectors necessaris"), 6.5707938, 1e-6, "F156");
  assert.equal(val(acer, C, null, "Total connectors per bigueta"), 8, "H156");
});
test("resum general (H161–H200)", () => {
  const R = "resum";
  const L = "Estat de càrregues existent i reforçat";
  near(val(acer, R, L, "Càrregues sense majorar inicials"), 5.74, 1e-9, "H161");
  near(val(acer, R, L, "Càrregues sense majorar perfil mixte"), 8.528, 1e-9, "H162");
  near(val(acer, R, L, "Increment de càrrega", 0), 2.788, 1e-9, "H163");
  near(val(acer, R, L, PCT, 0), 48.571429, 1e-6, "H164");
  near(val(acer, R, L, "Càrregues majorades inicials"), 7.995, 1e-9, "H165");
  near(val(acer, R, L, "Càrregues majorades perfil mixte"), 12.1278, 1e-9, "H166");
  near(val(acer, R, L, "Increment de càrrega", 1), 4.1328, 1e-9, "H167");
  near(val(acer, R, L, PCT, 1), 51.692308, 1e-6, "H168");
  const P = "Dades perfil existent i reforçat";
  near(val(acer, R, P, "Moment d'inèrcia perfil existent"), 3280000, 1e-12, "H170");
  near(val(acer, R, P, "Moment d'inèrcia perfil mixte"), 17003909, 1e-6, "H171");
  near(val(acer, R, P, PCT, 0), 418.41185, 1e-6, "H172");
  near(val(acer, R, P, "Mòdul resistent perfil existent"), 54700, 1e-12, "H173");
  near(val(acer, R, P, "Mòdul resistent perfil mixte"), 123328.39, 1e-6, "H174");
  near(val(acer, R, P, PCT, 1), 125.46324, 1e-6, "H175");
  near(val(acer, R, P, "Àrea resistent perfil existent"), AA, 1e-12, "H176 (catalogue web)");
  near(val(acer, R, P, "Àrea resistent perfil mixte"), AA, 1e-12, "H177 (catalogue web)");
  assert.equal(val(acer, R, P, PCT, 2), 0, "H178");
  const C = "Comprovació del perfil existent i reforçat";
  near(val(acer, R, C, "Deformació perfil existent"), 16.282823, 1e-6, "H180");
  near(val(acer, R, C, "Deformació perfil mixte"), 4.6664873, 1e-6, "H181");
  near(val(acer, R, C, PCT, 0), -71.341043, 1e-6, "H182");
  near(val(acer, R, C, "Tensió per moment flector perfil existent"), 223.80884, 1e-6, "H183");
  near(val(acer, R, C, "Tensió per moment flector perfil mixte"), 150.57923, 1e-6, "H184");
  near(val(acer, R, C, PCT, 1), -32.719715, 1e-6, "H185");
  near(val(acer, R, C, "Tensió per esforç tallant perfil existent"), (7.995 * 1750) / AA, 1e-9, "H186 (catalogue web)");
  near(val(acer, R, C, "Tensió per esforç tallant perfil mixte"), (12.1278 * 1750) / AA, 1e-9, "H187 (catalogue web)");
  near(val(acer, R, C, PCT, 2), 51.692308, 1e-6, "H188 (the same: the web cancels out)");
  const D = "Dades del reforç amb capa de compressió";
  assert.equal(val(acer, R, D, "Perfil existent"), "IPN 120", "H190");
  near(val(acer, R, D, "Gruix de la capa"), 80, 1e-12, "H192");
  const armat = row(acer, R, D, "Armat de la capa");
  assert.equal(armat.value, "# DN 6 MM. C / 10 CM.", "H193");
  assert.equal(armat.input.type, "text");
  near(val(acer, R, D, "Diàmetre de les barres"), 12, 1e-12, "H194");
  near(val(acer, R, D, "Nombre de barres per connector"), 2, 1e-12, "H195");
  near(val(acer, R, D, "Longitud de cada barra"), 300, 1e-12, "H196");
  near(val(acer, R, D, "Longitud total de cada connector"), 655, 1e-12, "H197");
  near(val(acer, R, D, "Nombre de connectors per bigueta"), 8, 1e-12, "H198");
  near(val(acer, R, D, "Separació dels connectors a cada interval extrem"), 218.75, 1e-12, "H199");
  near(val(acer, R, D, "Separació dels connectors a l'interval central"), 583.33333, 1e-6, "H200");
});
test("final loads default to the initial ones; typed values, width and wall area override them", () => {
  const r = computeReforcBigaAcer({ finCp: null, finUs: null });
  const l = loadsOf(r, "carreguesFinal");
  near(l.totalUnf, 5.74 + 1.4 * 0.82, 1e-9, "initial + capa");
  for (const [label, key, q] of [["Càrregues permanents de paviments i morter", "finCp", 2], ["Sobrecàrrega d'ús", "finUs", 2], ["Pes propi estructural", "finPp", 2]]) {
    const ln = lineOf(l, label);
    assert.equal(ln.qKey, key, label);
    assert.equal(ln.qAuto, q, label);
    assert.equal(ln.q, q, label);
    assert.equal(ln.qAutoNote, "Igual que a l'estat inicial; escriu-hi per canviar-lo.");
    assert.equal(ln.qAutoReset, "Tornar al valor de l'estat inicial");
  }
  const capa = lineOf(l, "Pes propi de la capa de compressió");
  assert.equal(capa.qKey, undefined);
  assert.equal(capa.gammaKey, undefined);
  // gammas read-only, equal to the initial ones
  for (const g of l.groups) for (const x of g.lines) if (x.line) assert.equal(x.line.gammaKey, undefined, x.line.label);
  const pp = lineOf(l, "Pes propi estructural");
  assert.equal(pp.widthKey, "finAmplada");
  assert.equal(pp.widthAuto, 0.82);
  const w = computeReforcBigaAcer({ amplada: 1, finAmplada: null });
  assert.equal(lineOf(loadsOf(w, "carreguesFinal"), "Sobrecàrrega d'ús").width, 1);
  const w2 = computeReforcBigaAcer({ amplada: 1, finAmplada: 0.5 });
  assert.equal(lineOf(loadsOf(w2, "carreguesFinal"), "Sobrecàrrega d'ús").width, 0.5);
  assert.equal(lineOf(loadsOf(w2, "carregues"), "Sobrecàrrega d'ús").width, 1);
  const wall = computeReforcBigaAcer({ paretPes: 10, finParetArea: 2 });
  near(lineOf(loadsOf(wall, "carregues"), "Pes propi de les parets de càrrega superiors").unf, 10 * 0.75, 1e-12, "initial wall");
  near(lineOf(loadsOf(wall, "carreguesFinal"), "Pes propi de les parets de càrrega superiors").unf, 20, 1e-12, "final wall");
  near(val(computeReforcBigaAcer({ densitatCapa: 25 }), "mixta", null, "Pes propi de la capa"), 2, 1e-12, "25 kN/m³ · 0,08 m");
});
test("B2 = mín(amplària · 1000 ; L / 4) unless typed; n profiles: B1 = n · b, A1 = n · A", () => {
  near(val(computeReforcBigaAcer({ amplada: 2 }), "mixta", null, "Amplària de la capa"), 875, 1e-12, "L / 4");
  near(val(computeReforcBigaAcer({ amplada: 2, B2: 500 }), "mixta", null, "Amplària de la capa"), 500, 1e-12, "typed");
  const two = computeReforcBigaAcer({ nPerfils: 2 });
  near(val(two, "mixta", null, "Base de la bigueta"), 116, 1e-12, "2 × 58");
  near(val(two, "mixta", null, "Àrea de la bigueta"), 28.4, 1e-12, "2 × 14,2");
  near(val(two, "mixta", null, "Alçària de la bigueta"), 120, 1e-12, "h");
  near(val(two, "mixta", null, "Moment d'inèrcia de la bigueta"), 2 * 3280000, 1e-12, "2 × Ix");
  assert.equal(val(two, "resum", null, "Perfil existent"), "2 × IPN 120");
  near(val(computeReforcBigaAcer({ H1: 130, A1: 15 }), "mixta", null, "Àrea de la bigueta"), 15, 1e-12, "typed A1");
});
test("profiles that pass: IPN 120 does, IPE 80 doesn't, and each matches a full computation", () => {
  const ok = reforcBigaAcerPerfilsValids({});
  const passes = (perfil) => {
    const v = verdict(computeReforcBigaAcer({ perfil }));
    return v.total > 0 && v.failed === 0;
  };
  assert.ok(ok.has("IPN 120"));
  assert.ok(!ok.has("IPE 80"));
  for (const name of ["IPN 100", "IPN 140", "IPE 100", "IPE 120", "UPN 80", "UPN 100", "HEB 100", "HEA 100"]) assert.equal(ok.has(name), passes(name), name);
  // a typed H1 / A1 doesn't leak into the other profiles
  assert.equal(reforcBigaAcerPerfilsValids({ A1: 0.01, H1: 1 }).size, ok.size);
  const t0 = performance.now();
  reforcBigaAcerPerfilsValids({});
  const ms = performance.now() - t0;
  assert.ok(ms < 200, `${ms.toFixed(0)} ms`);
  console.log(`    ${ok.size} catalogue profiles pass the example once reinforced (checked in ${ms.toFixed(0)} ms)`);
});

// ---------------------------------------------------------------------------
console.log("Reforç biga d'acer d'ala estreta (OK-REFORÇ BIGA D'ACER ALA ESTRETA AMB XAPA COMPRESSIÓ-reforç.xls)");
// The sheet types Ix 328, Wx 54,7 (= IPN 120 in the catalogue) and Aa = 120 × 5,1:
// h1 = 120 (the full height) instead of the catalogue's 92, as in the joist check.
const alaInputs = { h1: 120 };
const ala = computeReforcBigaAcerAla(alaInputs);
const ala3 = 3.14 / Math.PI; // connectors needed scale with 1 / π (the bars govern)

test("estat de càrregues inicial: Q ELS 17,6616 · Q ELU 25,18956 · sostre 6,69 kN/m² (F28, I28, B28)", () => {
  const l = loadsOf(ala, "carregues");
  near(l.totalUnf, 17.6616, 1e-9, "F28");
  near(l.totalFac, 25.18956, 1e-9, "I28");
  near(l.groups.find((g) => g.total).total.q, 6.69, 1e-9, "B28");
  near(lineOf(l, "Sobrecàrrega de vent").fac, 3.96, 1e-9, "I27");
});
test("perfil: f adm 7,4 · σd · τd · Ix · Wx · Aa 612 mm² (H35, H42–H47)", () => {
  near(val(ala, "perfil", null, "Deformació (fletxa) màxima"), 7.4, 1e-12, "H35");
  near(val(ala, "perfil", null, "Resistència de càlcul del material"), 208.69565, 1e-6, "H42");
  near(val(ala, "perfil", null, "Resistència de càlcul a esforços"), 120.49049, 1e-6, "H44");
  near(row(ala, "perfil", null, "Moment d'inèrcia").alt.value, 3280000, 1e-12, "H45");
  near(row(ala, "perfil", null, "Mòdul resistent").alt.value, 54700, 1e-12, "H46");
  near(val(ala, "perfil", null, "Àrea de l'ànima"), 612, 1e-12, "H47");
});
test("comprovació perfil existent: informative, every OK! / NO! of the sheet (H52–H68)", () => {
  assert.equal(ala.sections.find((x) => x.key === "comprovacio").informative, true);
  expectCheck(row(ala, "comprovacio", ELS, "Capacitat de càrrega per deformació"), 2.088715, false, "H52");
  expectCheck(row(ala, "comprovacio", ELS, "Respecte a la sol·licitació"), 11.826307, false, "H53");
  expectCheck(row(ala, "comprovacio", ELS, "Deformació del perfil"), 62.572367, false, "H54");
  expectCheck(row(ala, "comprovacio", ELS, "Amb aquesta deformació"), 59.131533, false, "I55");
  expectCheck(row(ala, "comprovacio", ELU, "Capacitat de càrrega per moment flector"), 6.6709436, false, "H57");
  expectCheck(row(ala, "comprovacio", ELU, "Respecte a la sol·licitació", 0), 26.48297, false, "H58");
  near(val(ala, "comprovacio", ELU, "Moment màxim flector"), 43105635, 1e-6, "H59");
  expectCheck(row(ala, "comprovacio", ELU, "Tensió per moment flector"), 788.03719, false, "H60");
  expectCheck(row(ala, "comprovacio", ELU, "Capacitat de càrrega per esforç tallant"), 39.859557, true, "H61");
  expectCheck(row(ala, "comprovacio", ELU, "Respecte a la sol·licitació", 1), 158.2384, true, "H62");
  expectCheck(row(ala, "comprovacio", ELU, "Tensió per esforç tallant"), 76.144912, true, "H63");
  expectCheck(row(ala, "comprovacio", ELU, "Fórmula combinada"), 798.99735, false, "H64");
  expectCheck(row(ala, "comprovacio", COEF, "Per deformació"), 0.11826307, false, "H66");
  expectCheck(row(ala, "comprovacio", COEF, "Per moment flector"), 6.6709436 / 25.18956, false, "H67 / Q ELU");
  expectCheck(row(ala, "comprovacio", COEF, "Per esforç tallant"), 39.859557 / 25.18956, true, "H68 / Q ELU");
  sheetVsApp("γMf · γV", "0,3777089 · 2,2568486", `${(6.6709436 / 25.18956).toFixed(7)} · ${(39.859557 / 25.18956).toFixed(7)}`);
});
test("secció mixta: B2 = L / 4 = 925 mm; IT 11.326.812 mm⁴, WT 93.931,7 mm³ (H73–H95)", () => {
  const M = "mixta";
  near(val(ala, M, null, "Alçària de la bigueta"), 120, 1e-12, "H73");
  near(val(ala, M, null, "Base de la bigueta"), 58, 1e-12, "H74");
  near(row(ala, M, null, "Àrea de la bigueta").alt.value, 1420, 1e-12, "H75");
  near(val(ala, M, null, "Gruix de la capa"), 50, 1e-12, "H78");
  near(val(ala, M, null, "Amplària de la capa"), 925, 1e-12, "H79");
  near(val(ala, M, null, "Àrea de la capa"), 46250, 1e-12, "H80");
  near(val(ala, M, null, "Relació entre mòduls"), 0.076190476, 1e-6, "H82");
  near(val(ala, M, null, "Amplària equivalent"), 70.47619, 1e-6, "H83");
  near(val(ala, M, null, "Àrea equivalent"), 3523.8095, 1e-6, "H84");
  near(val(ala, M, null, "Distància entre els centres"), 85, 1e-12, "H86");
  near(val(ala, M, null, "Distància del perfil al nou"), 60.585629, 1e-6, "H87");
  near(val(ala, M, null, "Moment d'inèrcia de la capa"), 734126.98, 1e-6, "H90");
  near(val(ala, M, null, "Distància nou c.d.g."), 120.58563, 1e-6, "H91");
  near(val(ala, M, null, "Moment d'inèrcia total"), 11326812, 1e-6, "H93");
  near(val(ala, M, null, "Mòdul resistent total"), 93931.694, 1e-6, "H94");
  near(val(ala, M, null, "Àrea de l'ànima resultant"), 612, 1e-12, "H95");
});
test("estat de càrregues final: capa 0,875 kN/m² · Q ELS 19,9716 · Q ELU 28,30806 (B104, F111, I111, row 112)", () => {
  const l = loadsOf(ala, "carreguesFinal");
  near(lineOf(l, "Pes propi de la capa de compressió").q, 0.875, 1e-12, "B104");
  near(l.totalUnf, 19.9716, 1e-9, "F111");
  near(l.totalFac, 28.30806, 1e-9, "I111");
  near(l.groups.find((g) => g.total).total.q, 7.565, 1e-9, "B111");
  near(val(ala, "carreguesFinal", null, "Increment de càrrega del sostre"), 0.875, 1e-9, "B112");
  near(val(ala, "carreguesFinal", null, PCT), 13.079223, 1e-6, "D112 · 100");
  near(val(ala, "carreguesFinal", null, "Increment de càrrega sense majorar"), 2.31, 1e-9, "F112");
  near(val(ala, "carreguesFinal", null, "Increment de càrrega majorada"), 3.1185, 1e-9, "I112");
});
test("comprovació perfil mixte: every OK! / NO! of the sheet (H117–H133)", () => {
  const K = "comprovacio-mixte";
  expectCheck(row(ala, K, ELS, "Capacitat de càrrega per deformació"), 7.2129521, false, "H117");
  expectCheck(row(ala, K, ELS, "Respecte a la sol·licitació"), 36.116045, false, "H118");
  expectCheck(row(ala, K, ELS, "Deformació del perfil"), 20.489508, false, "H119");
  expectCheck(row(ala, K, ELS, "Amb aquesta deformació"), 180.58023, false, "I120");
  expectCheck(row(ala, K, ELU, "Capacitat de càrrega per moment flector"), 11.455448, false, "H122");
  expectCheck(row(ala, K, ELU, "Respecte a la sol·licitació", 0), 40.467091, false, "H123");
  near(val(ala, K, ELU, "Moment màxim flector"), 48442168, 1e-6, "H124");
  expectCheck(row(ala, K, ELU, "Tensió per moment flector"), 515.71696, false, "H125");
  expectCheck(row(ala, K, ELU, "Capacitat de càrrega per esforç tallant"), 39.859557, true, "H126");
  expectCheck(row(ala, K, ELU, "Respecte a la sol·licitació", 1), 140.80639, true, "H127");
  expectCheck(row(ala, K, ELU, "Tensió per esforç tallant"), 85.57175, true, "H128");
  expectCheck(row(ala, K, ELU, "Fórmula combinada"), 536.59254, false, "H129");
  expectCheck(row(ala, K, COEF, "Per deformació"), 0.36116045, false, "H131");
  expectCheck(row(ala, K, COEF, "Per moment flector"), 11.455448 / 28.30806, false, "H132 / Q ELU");
  expectCheck(row(ala, K, COEF, "Per esforç tallant"), 39.859557 / 28.30806, true, "H133 / Q ELU");
  sheetVsApp("γMf · γV", "0,57358692 · 1,9958119", `${(11.455448 / 28.30806).toFixed(8)} · ${(39.859557 / 28.30806).toFixed(7)}`);
  const v = verdict(ala);
  assert.equal(v.total, 14);
  assert.equal(v.failed, 10);
});
test("connectors: the bars govern; 18 + 12 + 18 connectors at 48,68 / 142,31 mm (H145–H155)", () => {
  const C = "connectors";
  near(val(ala, C, null, "Longitud d'ancoratge"), 428.57143, 1e-6, "H145");
  near(val(ala, C, null, "Moment estàtic"), 86031.593, 1e-6, "H146");
  near(val(ala, C, null, "Tensió rasant"), 0.0079554012 * 1000, 1e-6, "H147 (kN/mm² → N/mm²)");
  near(val(ala, C, null, "Resistència de cada connector (barres)"), 15.890286 / ala3, 1e-6, "H148 with π");
  near(val(ala, C, null, "Resistència de cada connector (soldadura)"), 55.69732, 1e-6, "H149");
  near(val(ala, C, null, "Connectors necessaris a cada interval extrem"), 17.366143 * ala3, 1e-6, "F152 with π");
  near(val(ala, C, null, "Connectors necessaris a l'interval central"), 11.577429 * ala3, 1e-6, "F153 with π");
  near(val(ala, C, null, "Total connectors necessaris"), 46.309715 * ala3, 1e-6, "F155 with π");
  sheetVsApp("connectors needed (π instead of 3,14)", "17,366143 · 11,577429", `${val(ala, C, null, "Connectors necessaris a cada interval extrem").toFixed(6)} · ${val(ala, C, null, "Connectors necessaris a l'interval central").toFixed(6)}`);
  assert.equal(val(ala, C, null, "Connectors adoptats a cada interval extrem"), 18, "H152");
  assert.equal(val(ala, C, null, "Connectors adoptats a l'interval central"), 12, "H153");
  assert.equal(val(ala, C, null, "Total connectors per bigueta"), 48, "H155");
  near(val(ala, C, null, "Separació a cada interval extrem"), 48.684211, 1e-6, "L152 · 10");
  near(val(ala, C, null, "Separació a l'interval central"), 142.30769, 1e-6, "L153 · 10");
});
test("resum general (H160–H199)", () => {
  const R = "resum";
  near(val(ala, R, null, "Càrregues sense majorar inicials"), 17.6616, 1e-9, "H160");
  near(val(ala, R, null, "Càrregues sense majorar perfil mixte"), 19.9716, 1e-9, "H161");
  near(val(ala, R, null, PCT, 0), 13.079223, 1e-6, "H163");
  near(val(ala, R, null, "Càrregues majorades perfil mixte"), 28.30806, 1e-9, "H165");
  near(val(ala, R, null, "Increment de càrrega", 1), 3.1185, 1e-9, "H166");
  near(val(ala, R, null, PCT, 1), 12.380129, 1e-6, "H167");
  near(val(ala, R, null, PCT, 2), 245.32965, 1e-6, "H171");
  near(val(ala, R, null, PCT, 3), 71.721561, 1e-6, "H174");
  assert.equal(val(ala, R, null, PCT, 4), 0, "H177");
  near(val(ala, R, null, PCT, 5), -67.254702, 1e-6, "H181");
  near(val(ala, R, null, "Tensió per moment flector perfil existent"), 788.03719, 1e-6, "H182");
  near(val(ala, R, null, PCT, 6), -34.556774, 1e-6, "H184");
  near(val(ala, R, null, "Tensió per esforç tallant perfil mixte"), 85.57175, 1e-6, "H186");
  near(val(ala, R, null, PCT, 7), 12.380129, 1e-6, "H187");
  assert.equal(val(ala, R, null, "Perfil existent"), "IPN 120", "H189");
  near(val(ala, R, null, "Gruix de la capa"), 50, 1e-12, "H191");
  near(val(ala, R, null, "Longitud de cada barra"), 120, 1e-12, "H195");
  near(val(ala, R, null, "Longitud total de cada connector"), 290, 1e-12, "H196");
  near(val(ala, R, null, "Nombre de connectors per bigueta"), 48, 1e-12, "H197");
  near(val(ala, R, null, "Separació dels connectors a cada interval extrem"), 48.684211, 1e-6, "H198");
  near(val(ala, R, null, "Separació dels connectors a l'interval central"), 142.30769, 1e-6, "H199");
});
test("profile values come from the picked profile unless typed (IPN 120: h1 = 92; Torras 160: H1 160, B1 50, A1 20,4)", () => {
  const ipn = computeReforcBigaAcerAla({});
  near(val(ipn, "perfil", null, "Àrea de l'ànima"), 92 * 5.1, 1e-12, "Aa = e · h1");
  const t = computeReforcBigaAcerAla({ perfil: "Torras 160" });
  near(val(t, "perfil", null, "Moment d'inèrcia"), 768, 1e-12, "Ix");
  near(val(t, "perfil", null, "Àrea de l'ànima"), 120 * 6.5, 1e-12, "Aa");
  near(val(t, "mixta", null, "Alçària de la bigueta"), 160, 1e-12, "H1");
  near(val(t, "mixta", null, "Base de la bigueta"), 50, 1e-12, "B1");
  near(val(t, "mixta", null, "Àrea de la bigueta"), 20.4, 1e-12, "A1");
  assert.equal(row(t, "mixta", null, "Àrea de la bigueta").input.auto, 20.4);
});
test("the picker marks the profiles whose reinforced section passes; MANUAL takes typed values only", () => {
  const picker = row(ala, "perfil", "Dades del perfil", "Nom del perfil").input;
  assert.equal(picker.type, "select");
  const marked = picker.options.filter((o) => o.label.includes("✓")).map((o) => o.value);
  for (const o of picker.options) {
    if (o.value === MANUAL) continue;
    const v = verdict(computeReforcBigaAcerAla({ ...alaInputs, perfil: o.value, h1: null }));
    assert.equal(marked.includes(o.value), v.total > 0 && v.failed === 0, o.value);
  }
  assert.ok(marked.length > 0 && !marked.includes("IPN 120"), marked.join(", "));
  const m = computeReforcBigaAcerAla({ perfil: MANUAL, Ix: 328, Wx: 54.7, h1: 120, e: 5.1, H1: 120, B1: 58, A1: 14.2 });
  near(val(m, "comprovacio-mixte", ELS, "Capacitat de càrrega per deformació"), 7.2129521, 1e-6, "manual = sheet");
  assert.equal(val(m, "resum", null, "Perfil existent"), "Dades escrites a mà");
  const empty = computeReforcBigaAcerAla({ perfil: MANUAL });
  assert.equal(row(empty, "mixta", null, "Alçària de la bigueta").input.auto, undefined);
  assert.equal(val(empty, "mixta", null, "Moment d'inèrcia total"), null);
  assert.equal(val(empty, "connectors", null, "Total connectors per bigueta"), null);
  assert.equal(row(empty, "comprovacio-mixte", ELS, "Capacitat de càrrega per deformació").check.ok, false);
});

// ---------------------------------------------------------------------------
console.log("Entrades buides, valors per defecte i informe");
test("zero or empty inputs don't throw: every value is a finite number, a text or null (—)", () => {
  const cases = [];
  for (const [compute, defaults] of [[computeReforcBigaAcer, reforcBigaAcerDefaults()], [computeReforcBigaAcerAla, reforcBigaAcerAlaDefaults()]]) {
    const keys = Object.keys(defaults).filter((k) => typeof defaults[k] === "number" || defaults[k] === null);
    cases.push([compute, Object.fromEntries(keys.map((k) => [k, 0]))]);
    cases.push([compute, Object.fromEntries(Object.keys(defaults).map((k) => [k, null]))]);
    cases.push([compute, { perfil: "" }]);
    cases.push([compute, { L: 0, H2: 0, amplada: 0 }]);
  }
  for (const [compute, inputs] of cases) {
    const r = compute(inputs);
    for (const s of r.sections) {
      for (const b of s.blocks) for (const x of b.rows) assert.ok(x.value === null || typeof x.value === "string" || Number.isFinite(x.value), `${s.key} / ${x.label}: ${x.value}`);
      for (const g of s.loads?.groups ?? []) for (const l of g.lines) if (l.line) assert.ok(Number.isFinite(l.line.unf) && Number.isFinite(l.line.fac), l.line.label);
    }
  }
  const z = computeReforcBigaAcer({ E2: 0, E: 0 });
  assert.equal(val(z, "mixta", null, "Relació entre mòduls"), null);
  assert.equal(val(z, "comprovacio-mixte", ELS, "Deformació del perfil"), null);
  const noWeld = computeReforcBigaAcer({ longB: 0 });
  assert.equal(val(noWeld, "connectors", null, "Tensió rasant"), null);
  assert.equal(val(noWeld, "connectors", null, "Connectors adoptats a cada interval extrem"), null);
});
test("defaults compute through the registry; stored data with missing keys falls back to them", () => {
  for (const tipus of ["reforc-biga-acer", "reforc-biga-acer-ala"]) {
    const t = calcType(tipus);
    assert.equal(verdict(t.compute(t.defaults())).total, 14, tipus);
    assert.equal(verdict(t.compute({})).total, 14, tipus);
    assert.deepEqual(t.compute({}).sections.map((s) => s.key), ["carregues", "perfil", "comprovacio", "mixta", "carreguesFinal", "comprovacio-mixte", "connectors", "resum"]);
  }
  assert.ok(calcType("reforc-biga-acer").perfilsValids({}).perfil.has("IPN 120"));
});
test("report in Catalan and Spanish: titles, both load tables, free text as typed, summary without the existing joist", () => {
  const calc = { num: "CE-26-999", referencia: "19004", projecte: "P", adreca: "A", ciutat: "C", client: "X", arquitecte: "D", situacio: "Tipus", element: "Bigueta", data: "2026-11-15", versio: "1" };
  for (const [tipus, r] of [["reforc-biga-acer", acer], ["reforc-biga-acer-ala", ala]]) {
    const t = calcType(tipus);
    const ca = buildCalculHtml({ ...calc, tipus }, r, { logo: "" });
    for (const s of [t.reportTitle, "Estat de càrregues inicial", "Estat de càrregues final reforçat acer + formigó", "Determinació secció mixta acer + formigó", "Pes propi de la capa de compressió", "Càlcul dels connectors", "Resum general de dades", "# DN 6 MM. C / 10 CM.", "Comprovació del perfil existent sense el reforç"])
      assert.ok(ca.includes(s), `${tipus} ca: ${s}`);
    const es = buildCalculHtml({ ...calc, tipus }, r, { logo: "" }, "es");
    for (const s of ["Comprobación de perfil existente de acero", "Estado de cargas inicial", "Estado de cargas final reforzado acero + hormigón", "Determinación sección mixta acero + hormigón", "Peso propio de la capa de compresión", "Cálculo de los conectores", "Resumen general de datos", "Comprobación perfil mixto acero + hormigón", "Tensión rasante", "# DN 6 MM. C / 10 CM.", "Resumen de las comprobaciones"])
      assert.ok(es.includes(s), `${tipus} es: ${s}`);
    for (const s of ["Determinació secció mixta", "Càlcul dels connectors", "Capa de compressió", "Resum general"]) assert.ok(!es.includes(s), `${tipus} es still has: ${s}`);
    // the summary lists only the 14 checks of the reinforced section
    const summary = ca.slice(ca.lastIndexOf("Resum de les comprovacions"));
    assert.equal((summary.match(/Comprovació perfil mixte acer \+ formigó/g) ?? []).length, 14, tipus);
    assert.ok(!summary.includes("Comprovació perfil existent"), tipus);
  }
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
