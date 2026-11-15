#!/usr/bin/env node
// Checks «Reforç de trencallums» (src/lib/calculs/reforc-trencallums.ts) against David's spreadsheet: each calculation runs with the
// inputs of his example and is compared with the values Excel computed (read
// from the cells, not the rounded display). What differs on purpose is
// explained in the header of the calculation file.
//
//   node scripts/test-calculs-trencallums.mjs
import { register } from "node:module";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

register("./mcp-test-hooks.mjs", import.meta.url);

const { CALC_TYPES, CALC_GROUPS, calcType } = await import("../src/lib/calculs/index.ts");
const { computeTrencallums, trencallumsDefaults, trencallumsPerfilsValids } = await import("../src/lib/calculs/reforc-trencallums.ts");
const { verdict, allChecks } = await import("../src/lib/calculs/common.ts");
const { AJUDA } = await import("../src/lib/calculs/ajuda.ts");
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
const loadsOf = (result) => result.sections.find((s) => s.key === "carregues").loads;
const ELS = "Estats límits de servei (E.L.S.)";
const ELU = "Estats límits últims (E.L.U.)";
const COEF = "Coeficients de seguretat";

console.log("Registre");
test("registered in the «Reforços» group", () => {
  for (const tipus of ["reforc-trencallums"]) {
    const t = calcType(tipus);
    assert.equal(t.tipus, tipus);
    assert.equal(t.group, "Reforços");
    assert.ok(CALC_TYPES.includes(t));
  }
  assert.ok(CALC_GROUPS.includes("Reforços"));
});

// ---------------------------------------------------------------------------
// The sheet types the trencallums' self-weight (0,1 kN/ml); the defaults hold
// the rest of the example.
const inputs = { ppPerfil: 0.1 };
const r = computeTrencallums(inputs);

console.log("Baixada de càrregues");
test("Q ELS 25,5475 · Q ELU 35,366625 N/mm (H30, K30); sostre 8,7 kN/m² (B25, H25, K25)", () => {
  const l = loadsOf(r);
  near(l.totalUnf, 25.5475, 1e-9, "H30");
  near(l.totalFac, 35.366625, 1e-9, "K30");
  const floor = l.groups.find((g) => g.total);
  near(floor.total.q, 8.7, 1e-9, "B25");
  near(floor.total.unf, 25.4475, 1e-9, "H25");
  near(floor.total.fac, 35.231625, 1e-9, "K25");
  const line = (label) => floor.lines.find((x) => x.line?.label === label).line;
  near(line("Pes propi estructural").unf, 7.3125, 1e-9, "H20");
  near(line("Pes propi estructural").fac, 9.871875, 1e-9, "K20");
  near(line("Càrregues permanents de paviments i morter").fac, 12.636, 1e-9, "K21");
  near(line("Càrregues permanents d'envans").fac, 3.94875, 1e-9, "K22");
  near(line("Sobrecàrrega d'ús").fac, 8.775, 1e-9, "K24");
  const wall = l.groups.find((g) => g.lines.some((x) => x.line?.qKey === "paretPes")).lines.find((x) => x.line).line;
  assert.equal(wall.q, 18, "B15");
  assert.equal(wall.unf, 0, "H15 (18 kN/m³ × 0 × 0)");
  const pp = l.groups[0].lines[0].line;
  near(pp.fac, 0.135, 1e-9, "K28");
});

console.log("Càlcul biga trencallums (HEB 120)");
test("Q ELS / Q ELU, L = 60 cm × 3 = 1.800 mm, f adm 3,6 mm (H4, H5, H9, H11)", () => {
  near(row(r, "principal", "Dades de càrrega", "Càrrega uniforme sense majorar").value, 25.5475, 1e-9, "H4");
  near(row(r, "principal", "Dades de càrrega", "Càrrega uniforme majorada").value, 35.366625, 1e-9, "H5");
  const L = row(r, "principal", "Dades geomètriques", "Llum");
  near(L.value, 1800, 1e-12, "H9");
  assert.equal(L.input, undefined, "L follows from the joists, not typed");
  near(row(r, "principal", "Dades geomètriques", "Deformació (fletxa) màxima").value, 3.6, 1e-12, "H11");
});
test("σd 261,90 · τd 151,21 · Ix 8.640.000 · Wx 144.000 · Aa 481 (H19, H21–H24)", () => {
  near(row(r, "principal", null, "Resistència de càlcul del material").value, 261.90476, 1e-6, "H19");
  near(row(r, "principal", null, "Resistència de càlcul a esforços").value, 151.21078, 1e-6, "H21");
  near(row(r, "principal", null, "Moment d'inèrcia").value, 8640000, 1e-12, "H22");
  near(row(r, "principal", null, "Mòdul resistent").value, 144000, 1e-12, "H23");
  near(row(r, "principal", null, "Àrea de l'ànima").value, 481, 1e-12, "H24");
});
test("E.L.S.: 47,7867 OK · 187,05 % OK · fletxa 1,9246 mm OK · L/935 OK (H26–H29)", () => {
  expectCheck(row(r, "comprovacio", ELS, "Capacitat de càrrega per deformació"), 47.786667, true, "H26");
  expectCheck(row(r, "comprovacio", ELS, "Respecte a la sol·licitació"), 187.05027, true, "H27");
  expectCheck(row(r, "comprovacio", ELS, "Deformació del perfil"), 1.9246164, true, "H28");
  expectCheck(row(r, "comprovacio", ELS, "Amb aquesta deformació"), 935.25133, true, "H29");
});
test("E.L.U.: flector, tallant i fórmula combinada (H31–H40), all OK", () => {
  expectCheck(row(r, "comprovacio", ELU, "Capacitat de càrrega per moment flector"), 93.121693, true, "H31");
  expectCheck(row(r, "comprovacio", ELU, "Respecte a la sol·licitació", 0), 263.30387, true, "H32");
  near(row(r, "comprovacio", ELU, "Moment màxim flector").value, 14323483, 1e-6, "H33");
  expectCheck(row(r, "comprovacio", ELU, "Tensió per moment flector"), 99.468633, true, "H34");
  expectCheck(row(r, "comprovacio", ELU, "Capacitat de càrrega per esforç tallant"), 80.813764, true, "H36");
  expectCheck(row(r, "comprovacio", ELU, "Respecte a la sol·licitació", 1), 228.5029, true, "H37");
  expectCheck(row(r, "comprovacio", ELU, "Tensió per esforç tallant"), 66.174558, true, "H38");
  expectCheck(row(r, "comprovacio", ELU, "Fórmula combinada"), 151.76042, true, "H40");
});
test("coeficients de seguretat 1,8705 · 2,6330 · 2,2850 (H42–H44); the sheet's σ/σd and τ/τd (H35, H39) are 1/γMf and 1/γV", () => {
  expectCheck(row(r, "comprovacio", COEF, "Per deformació"), 1.8705027, true, "H42");
  const gMf = row(r, "comprovacio", COEF, "Per moment flector");
  const gV = row(r, "comprovacio", COEF, "Per esforç tallant");
  expectCheck(gMf, 2.6330387, true, "H43");
  expectCheck(gV, 2.285029, true, "H44");
  near(1 / gMf.value, 0.37978933, 1e-6, "H35");
  near(1 / gV.value, 0.43763121, 1e-6, "H39");
});

console.log("Càlcul biga de suport (IPN 240)");
const SD = "Dades de càrrega";
test("P ELS 22.992,75 · P ELU 31.829,96 N = Q · Lt / 2 (H4, H5)", () => {
  near(row(r, "suport", SD, "Càrrega puntual sense majorar").value, 22992.75, 1e-9, "H4");
  near(row(r, "suport", SD, "Càrrega puntual majorada").value, 31829.962, 1e-6, "H5");
});
test("L 5.850 mm = 2 × amplària de càrrega (auto) · f adm 11,7 mm (H7, H9)", () => {
  const L = row(r, "suport", "Dades geomètriques", "Llum");
  near(L.value, 5850, 1e-12, "H7");
  assert.equal(L.input.key, "LSuport");
  near(L.input.auto, 5850, 1e-12, "auto");
  near(row(r, "suport", "Dades geomètriques", "Deformació (fletxa) màxima").value, 11.7, 1e-12, "H9");
});
test("σd 261,90 · τd 151,21 · Ix 42.500.000 · Wx 354.000 (H17, H19–H21), with the support's own keys", () => {
  near(row(r, "suport", null, "Resistència de càlcul del material").value, 261.90476, 1e-6, "H17");
  near(row(r, "suport", null, "Resistència de càlcul a esforços").value, 151.21078, 1e-6, "H19");
  near(row(r, "suport", null, "Moment d'inèrcia").value, 42500000, 1e-12, "H20");
  near(row(r, "suport", null, "Mòdul resistent").value, 354000, 1e-12, "H21");
  assert.equal(row(r, "suport", null, "Mòdul d'elasticitat").input.key, "ESuport");
  assert.equal(row(r, "suport", null, "Límit elàstic característic").input.key, "skSuport");
  assert.equal(row(r, "suport", null, "Coeficient de minoració del material").input.key, "gkSuport");
});
test("Aa: catalogue h1 192 mm → 1.670,4 mm² (the sheet's 192,5 mm gives 1.674,75, H22)", () => {
  near(row(r, "suport", null, "Àrea de l'ànima").value, 192 * 8.7, 1e-12, "app");
  near(192.5 * 8.7, 1674.75, 1e-12, "H22");
});
test("E.L.S.: fletxa 10,745 mm OK · L/544 OK (H24, H25)", () => {
  expectCheck(row(r, "comprovacioSuport", ELS, "Deformació del perfil"), 10.745065, true, "H24");
  expectCheck(row(r, "comprovacioSuport", ELS, "Amb aquesta deformació"), 544.43597, true, "H25");
});
test("E.L.U.: M 46.551.320 N·mm · σ 131,50 OK (H27, H28); τ and C with the catalogue's Aa", () => {
  near(row(r, "comprovacioSuport", ELU, "Moment màxim flector").value, 46551320, 1e-6, "H27");
  expectCheck(row(r, "comprovacioSuport", ELU, "Tensió per moment flector"), 131.5009, true, "H28");
  // The sheet: τ 9,5028997 (H30) and C 132,52699 (H32) with Aa = 1.674,75 mm².
  const pElu = 31829.9625;
  near((pElu / 2) / 1674.75, 9.5028997, 1e-6, "H30 with the sheet's Aa");
  const tau = row(r, "comprovacioSuport", ELU, "Tensió per esforç tallant");
  expectCheck(tau, pElu / 2 / (192 * 8.7), true, "τ app");
  near(Math.sqrt(131.5009 ** 2 + 3 * 9.5028997 ** 2), 132.52699, 1e-6, "H32 with the sheet's τ");
  expectCheck(row(r, "comprovacioSuport", ELU, "Fórmula combinada"), Math.sqrt((pElu * 5850 / 4 / 354000) ** 2 + 3 * tau.value ** 2), true, "C app");
});
test("M = P · L / 4 with n profiles (the sheet divides P by n again, H27): n = 2 halves σ, not a quarter", () => {
  const two = computeTrencallums({ ...inputs, nSuport: 2 });
  near(row(two, "comprovacioSuport", ELU, "Moment màxim flector").value, 46551320.15625, 1e-12, "M");
  near(row(two, "comprovacioSuport", ELU, "Tensió per moment flector").value, 131.50090439618643 / 2, 1e-9, "σ");
  near(row(two, "suport", null, "Moment d'inèrcia").value, 2 * 42500000, 1e-12, "2 × Ix");
});
test("a typed span of the support beam replaces the automatic one", () => {
  const t = computeTrencallums({ ...inputs, LSuport: 4000 });
  near(row(t, "suport", "Dades geomètriques", "Llum").value, 4000, 1e-12, "L");
  near(row(t, "comprovacioSuport", ELU, "Moment màxim flector").value, (31829.9625 * 4000) / 4, 1e-12, "M");
  const w = computeTrencallums({ ...inputs, amplada: 2 });
  near(row(w, "suport", "Dades geomètriques", "Llum").value, 4000, 1e-12, "auto = 2 × 2 m");
});

console.log("Passadors (plaques d'ancoratge)");
const PD = "Dades passadors";
const PF = "Paret de càrrega de suport";
test("V 15.914,98 N · Aap = 5 × 20 × 120 = 12.000 mm² (H36, H41)", () => {
  near(row(r, "passadors", SD, "Esforç tallant a cada extrem").value, 15914.981, 1e-6, "H36");
  near(row(r, "passadors", PD, "Àrea de contacte dels passadors").value, 12000, 1e-12, "H41");
});
test("fk / fd with CTE DB SE-F annex C: 4,0077 / 1,3359 N/mm² (the sheet's EN 1996 exponents give 4,8735 / 1,6245, I45 / L45)", () => {
  near(0.6 * 10 ** 0.7 * 5 ** 0.3, 4.8735144, 1e-6, "I45");
  near((0.6 * 10 ** 0.7 * 5 ** 0.3) / 3, 1.6245048, 1e-6, "L45");
  const fk = 0.6 * 10 ** 0.65 * 5 ** 0.25;
  near(row(r, "passadors", PF, "Resistència característica a compressió").value, fk, 1e-12, "fk");
  near(row(r, "passadors", PF, "Resistència de càlcul a compressió").value, fk / 3, 1e-12, "fd");
  near(fk, 4.0076866, 1e-6, "fk");
});
test("S = V / Aap 1,3262 N/mm² < fd OK (H47; the sheet prints «<» without OK)", () => {
  const s = row(r, "passadors", "Resultats tensió suport paret de càrrega", "Tensió en la paret de càrrega de suport");
  expectCheck(s, 1.3262484, true, "H47");
  near(s.check.limit, (0.6 * 10 ** 0.65 * 5 ** 0.25) / 3, 1e-12, "fd");
});

console.log("Resultat, perfils vàlids i casos límit");
test("verdict: 20 checks, all OK! (trencallums 14 · biga de suport 5 · passadors 1)", () => {
  const v = verdict(r);
  assert.equal(v.total, 20);
  assert.equal(v.failed, 0);
  const by = (title) => allChecks(r).filter((c) => c.section === title).length;
  assert.equal(by("Comprovació del trencallums principal"), 14);
  assert.equal(by("Comprovació de la biga de suport"), 5);
  assert.equal(by("Passadors a la paret de càrrega"), 1);
});
test("self-weight from the catalogue when not typed: n × 26,7 kg/m (HEB 120), and it reaches the support beam", () => {
  const d = computeTrencallums({});
  const l = loadsOf(d).groups[0].lines[0].line;
  near(l.q, (26.7 * 9.81) / 1000, 1e-12, "pp");
  assert.equal(l.qAuto, l.q);
  near(loadsOf(d).totalUnf, 25.4475 + (26.7 * 9.81) / 1000, 1e-12, "Q ELS");
  near(row(d, "suport", SD, "Càrrega puntual sense majorar").value, (loadsOf(d).totalUnf * 1800) / 2, 1e-12, "P ELS");
  assert.equal(verdict(d).failed, 0);
  const two = computeTrencallums({ nPerfils: 2 });
  near(loadsOf(two).groups[0].lines[0].line.q, (2 * 26.7 * 9.81) / 1000, 1e-12, "2 × pp");
});
test("profiles that pass: { perfil, perfilSuport }, each matching a full computation", () => {
  const ok = trencallumsPerfilsValids(inputs);
  assert.deepEqual(Object.keys(ok).sort(), ["perfil", "perfilSuport"]);
  assert.ok(ok.perfil.has("HEB 120"));
  assert.ok(ok.perfilSuport.has("IPN 240"));
  assert.ok(!ok.perfil.has("IPE 80"));
  assert.ok(!ok.perfilSuport.has("IPN 200"));
  const sectionPasses = (res, key) => res.sections.find((s) => s.key === key).blocks.every((b) => b.rows.every((x) => !x.check || x.check.ok));
  for (const name of ["HEB 100", "HEA 120", "IPE 160", "IPE 180", "IPN 160", "UPN 160", "UPN 200"])
    assert.equal(ok.perfil.has(name), sectionPasses(computeTrencallums({ ...inputs, perfil: name }), "comprovacio"), `perfil ${name}`);
  for (const name of ["IPN 220", "IPN 260", "IPE 240", "IPE 270", "HEB 200", "HEA 220", "UPN 260", "UPN 300"])
    assert.equal(ok.perfilSuport.has(name), sectionPasses(computeTrencallums({ ...inputs, perfilSuport: name }), "comprovacioSuport"), `suport ${name}`);
  const t0 = performance.now();
  trencallumsPerfilsValids({});
  const ms = performance.now() - t0;
  assert.ok(ms < 200, `${ms.toFixed(0)} ms`);
  console.log(`    ${ok.perfil.size} trencallums and ${ok.perfilSuport.size} support profiles pass the example (checked in ${ms.toFixed(0)} ms)`);
});
test("zero, empty and missing inputs don't throw; missing profiles fail their checks", () => {
  const zeros = Object.fromEntries(Object.entries(trencallumsDefaults()).map(([k, v]) => [k, typeof v === "number" ? 0 : v]));
  const empties = Object.fromEntries(Object.keys(trencallumsDefaults()).map((k) => [k, ""]));
  for (const raw of [{}, zeros, empties, { ...zeros, perfil: "", perfilSuport: "" }, { LSuport: 0, nSuport: 0, nPerfils: 0 }, { perfil: "Xapa", perfilSuport: "?" }]) {
    const res = computeTrencallums(raw);
    assert.equal(res.sections.length, 6);
    verdict(res);
    trencallumsPerfilsValids(raw);
    buildCalculHtml({ tipus: "reforc-trencallums" }, res, { logo: "" }, "es");
  }
  const none = computeTrencallums({ perfil: "", perfilSuport: "" });
  assert.equal(row(none, "principal", null, "Moment d'inèrcia").value, null);
  assert.equal(row(none, "comprovacio", ELS, "Capacitat de càrrega per deformació").check.ok, false);
  assert.equal(row(none, "comprovacioSuport", ELU, "Tensió per moment flector").check.ok, false);
  assert.equal(verdict(computeTrencallums({ nPassadors: 0 })).failed, 1, "no passadors: S has no value");
});

console.log("Ajuda i informe");
test("help images: uniform load on the trencallums, point load on the support beam, CTE annex C on K", () => {
  assert.deepEqual(row(r, "principal", "Dades geomètriques", "Llum").aux, [AJUDA.carregaUniforme]);
  assert.deepEqual(row(r, "suport", "Dades geomètriques", "Llum").aux, [AJUDA.carregaPuntual]);
  assert.deepEqual(row(r, "passadors", PF, "Constant de la fàbrica").aux, [AJUDA.annexC]);
  for (const img of [AJUDA.carregaUniforme, AJUDA.carregaPuntual, AJUDA.annexC]) assert.ok(existsSync(join(ROOT, "public", img.src)), img.src);
});
test("report in Catalan and Spanish", () => {
  const calc = { num: "CE-26-999", tipus: "reforc-trencallums", referencia: "12484", projecte: "P", adreca: "A", ciutat: "C", client: "X", arquitecte: "D", situacio: "Patis", element: "1", data: "2026-11-15", versio: "1" };
  const ca = buildCalculHtml(calc, r, { logo: "" });
  for (const s of ["Càlcul de reforç d'un trencallums", "Sostre planta", "Trencallums principal (perpendicular a les biguetes)", "Comprovació de la biga de suport", "Passadors a la paret de càrrega", "HEB 120", "IPN 240", "Compleixen totes les comprovacions (20)."])
    assert.ok(ca.includes(s), s);
  const es = buildCalculHtml(calc, r, { logo: "" }, "es");
  for (const s of ["Cálculo de refuerzo de un brochal", "Forjado planta", "Estado de cargas sobre el brochal", "Brochal principal (perpendicular a las viguetas)", "Viga de apoyo (brochal secundario, paralela a las viguetas)",
    "Pasadores en el muro de carga", "Carga puntual mayorada (estado límite último)", "Resistencia característica a compresión de la fábrica", "Cumplen todas las comprobaciones (20)."])
    assert.ok(es.includes(s), s);
  assert.ok(!es.includes("trencallums"), "no Catalan left");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
