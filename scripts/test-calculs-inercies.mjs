#!/usr/bin/env node
// Checks the «Suma d'inèrcies» calculations (src/lib/calculs/inercies.ts)
// against David's spreadsheets: each one runs with the inputs of his example
// and is compared with the values Excel computed (read from the cells, not the
// rounded display). See the header of inercies.ts for what differs on purpose.
//
//   node scripts/test-calculs-inercies.mjs
import { register } from "node:module";
import assert from "node:assert/strict";

register("./mcp-test-hooks.mjs", import.meta.url);

const { INERCIES, computeInerciesPerfils, computeInerciesPletines, computeInerciesPerfilPletina, sumaInercies } = await import("../src/lib/calculs/inercies.ts");
const { CALC_TYPES, CALC_GROUPS, calcType } = await import("../src/lib/calculs/index.ts");
const { verdict } = await import("../src/lib/calculs/common.ts");
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

// The row with this symbol in the section with this key.
function row(result, section, sym) {
  const s = result.sections.find((x) => x.key === section);
  if (!s) throw new Error(`section not found: ${section}`);
  for (const b of s.blocks) for (const r of b.rows) if (r.sym === sym) return r;
  throw new Error(`row not found: ${section} · ${sym}`);
}
// Excel's cached values, by symbol.
function expectAll(result, section, values) {
  for (const [sym, v] of Object.entries(values)) near(row(result, section, sym).value, v, 1e-6, `${section} · ${sym}`);
}

console.log("Registre");
test("three types in the «Inèrcies» group, with the given labels", () => {
  assert.deepEqual(INERCIES.map((t) => t.tipus), ["inercies-perfils", "inercies-pletines", "inercies-perfil-pletina"]);
  for (const t of INERCIES) {
    assert.equal(t.group, "Inèrcies");
    assert.equal(calcType(t.tipus), t);
    assert.ok(CALC_TYPES.includes(t));
  }
  assert.ok(CALC_GROUPS.includes("Inèrcies"));
  assert.deepEqual(INERCIES.map((t) => t.tab), ["Suma d'inèrcies entre perfils", "Suma d'inèrcies entre pletines", "Suma d'inèrcies entre perfils i pletina"]);
  assert.deepEqual(INERCIES.map((t) => t.fileTitle), ["Suma d'Inèrcies entre Perfils", "Suma d'Inèrcies entre Pletines", "Suma d'Inèrcies entre Perfils i Pletina"]);
  assert.deepEqual(INERCIES.map((t) => t.situacioLabel), ["Sostre planta", "Situació", "Sostre planta"]);
});
test("Steiner helper: two equal plates side by side keep the sum", () => {
  const { d, IT } = sumaInercies(10, 10, 0, 5, 5);
  assert.equal(d, 0);
  assert.equal(IT, 10);
  assert.deepEqual(sumaInercies(0, 0, 5, 1, 1), { d: null, IT: null });
});

console.log("Perfils (Suma d'Inercies entre Perfils.xls · IPN-140 + IPN-120, necessari UPN-180)");
const perfils = computeInerciesPerfils({});
test("catalogue values = the sheet's typed ones (h1 14, h2 12, A1 18,3, A2 14,2, I1 573, I2 328 · UPN 180: 1350 / 150)", () => {
  expectAll(perfils, "calcul", { h1: 14, h2: 12, h3: 6, A1: 18.3, A2: 14.2, I1: 573, I2: 328 });
  expectAll(perfils, "resultat", { "I nec": 1350, "W nec": 150 });
});
test("X 13 · d 5,68 · y 13,32 cm · IT 2252,272 cm⁴ · WT 169,0895 cm³", () => {
  expectAll(perfils, "calcul", { X: 13, d: 5.68, y: 13.32 });
  expectAll(perfils, "resultat", { IT: 2252.2719999999999, WT: 169.08948948948949 });
});
test("IT > 1350 and WT > 150: OK", () => {
  assert.equal(row(perfils, "resultat", "IT").check.ok, true);
  assert.equal(row(perfils, "resultat", "WT").check.ok, true);
  assert.deepEqual(verdict(perfils), { ok: true, total: 2, failed: 0 });
});
test("typing the sheet's numbers gives the same result", () => {
  const typed = computeInerciesPerfils({ h1: 14, h2: 12, h3: 6, A1: 18.3, A2: 14.2, I1: 573, I2: 328, Inec: 1350, Wnec: 150 });
  expectAll(typed, "resultat", { IT: 2252.2719999999999, WT: 169.08948948948949 });
});
test("h3 follows a typed h2, and can be typed itself", () => {
  near(row(computeInerciesPerfils({ h2: 10 }), "calcul", "h3").value, 5);
  const r = computeInerciesPerfils({ h3: 4 });
  near(row(r, "calcul", "X").value, 7 + (12 - 4), 1e-12);
});
test("another profile and another required one come from the catalogue", () => {
  const r = computeInerciesPerfils({ perfil1: "IPE 200", perfil2: "UPN 100", perfilNec: "HEB 200" });
  expectAll(r, "calcul", { h1: 20, A1: 28.5, I1: 1940, h2: 10 });
  assert.equal(row(r, "resultat", "I nec").input.auto, row(r, "resultat", "I nec").value);
  assert.equal(r.sections[0].blocks[0].rows[0].value, "IPE 200 + UPN 100");
});
test("a weaker composite fails", () => {
  const r = computeInerciesPerfils({ perfil1: "IPN 80", perfil2: "IPN 80", perfilNec: "UPN 180" });
  assert.equal(verdict(r).ok, false);
});

console.log("Pletines (Suma d'Inercies entre Pletines.xls · 300 × 10 mm + 10 × 230 mm)");
const pletines = computeInerciesPletines({});
test("pletina horitzontal: A 30 · I 2,5 · W 5", () => expectAll(pletines, "horitzontal", { b: 30, h: 1, A: 30, I: 2.5, W: 5 }));
test("pletina vertical: A 23 · I 1013,9167 · W 88,1667", () => expectAll(pletines, "vertical", { b: 1, h: 23, A: 23, I: 1013.9166666666666, W: 88.166666666666657 }));
test("secció: X 12 · d 5,20755 · y 18,29245 · IT 2891,1336 · WT 158,0506", () =>
  expectAll(pletines, "seccio", { b1: 30, h1: 1, A1: 30, b2: 1, h2: 23, A2: 23, X: 12, d: 5.2075471698113205, I1: 2.5, I2: 1013.9166666666666, y: 18.29245283018868, IT: 2891.133647798742, WT: 158.05062747120508 }));
test("no checks (the sheet has none) and the plate descriptions", () => {
  assert.equal(verdict(pletines).total, 0);
  assert.equal(pletines.sections[0].blocks[0].rows[0].value, "Pletina 300 × 10 mm");
  assert.equal(pletines.sections[2].blocks[0].rows[0].value, "Pletines 300 × 10 mm + 10 × 230 mm");
  assert.equal(row(pletines, "seccio", "d").label, "Distància de la pletina horitzontal al nou c.d.g.");
});

console.log("Perfil i pletina (Suma d'Inercies entre Perfils i Pletina.xls · the sheet's placeholder example)");
const sheetPP = { b2: 40, h2: 1, A1: 10, h1: 10, I1: 83.333333333333329, perfilNec: "UPN 180" };
const pp = computeInerciesPerfilPletina(sheetPP);
test("A2 40 · X 5,5 · d 4,4 · I2 3,3333 · y 1,6", () => expectAll(pp, "calcul", { A2: 40, X: 5.5, d: 4.4000000000000004, I2: 3.3333333333333335, y: 1.5999999999999996 }));
test("IT 328,6667 cm⁴ · WT 205,4167 cm³", () => expectAll(pp, "resultat", { IT: 328.66666666666663, WT: 205.41666666666669 }));
test("against UPN 180: IT < 1350 NO! · WT > 150 OK!", () => {
  assert.equal(row(pp, "resultat", "IT").check.ok, false);
  assert.equal(row(pp, "resultat", "WT").check.ok, true);
  assert.deepEqual(verdict(pp), { ok: false, total: 2, failed: 1 });
});
test("IT uses A1 · d² (the sheet's cell used h1; same result while A1 = h1)", () => {
  const r = computeInerciesPerfilPletina({ ...sheetPP, A1: 20 });
  const X = 5.5;
  const d = (40 * X) / (20 + 40);
  near(row(r, "resultat", "IT").value, 83.333333333333329 + 20 * d ** 2 + (40 / 12 + 40 * (X - d) ** 2), 1e-12);
});
test("a new one starts as IPE 200 + pletina 100 × 10 mm, from the catalogue", () => {
  const r = computeInerciesPerfilPletina({});
  expectAll(r, "calcul", { A1: 28.5, h1: 20, I1: 1940, A2: 10 });
  assert.equal(r.sections[0].blocks[0].rows[0].value, "IPE 200 + pletina 100 × 10 mm");
  assert.equal(verdict(r).total, 2);
});

console.log("Informe i figura");
test("each report has its title, its sections, the drawing and the summary", () => {
  for (const t of INERCIES) {
    const r = t.compute(t.defaults());
    const html = buildCalculHtml({ tipus: t.tipus, num: "CE-26-009", referencia: "241520", data: "2026-11-08" }, r, { logo: "/logo.jpg" });
    assert.ok(html.includes(t.reportTitle), `${t.tipus}: title`);
    for (const s of r.sections) assert.ok(html.includes(s.title), `${t.tipus}: ${s.title}`);
    assert.ok(html.includes("<svg ") && html.includes("Fibra traccionada"), `${t.tipus}: figure`);
    assert.ok(html.includes("Resum de les comprovacions"), `${t.tipus}: summary`);
  }
});
test("the drawing carries the numbers and escapes text", () => {
  const f = perfils.sections[0].figure;
  assert.ok(f.svg.startsWith("<svg ") && f.svg.endsWith("</svg>"));
  assert.ok(f.svg.includes("1 · IPN 140") && f.svg.includes("2 · IPN 120"));
  assert.ok(f.svg.includes("X = 13,00 cm") && f.svg.includes("IT = 2.252,27 cm⁴"));
  const odd = computeInerciesPerfils({ perfil1: "<b>", h1: 14, A1: 18, I1: 500 }).sections[0].figure;
  assert.ok(odd.svg.includes("&lt;b&gt;") && !odd.svg.includes("<b>"));
});
test("no drawing for an empty section", () => {
  assert.equal(computeInerciesPletines({ b1: 0, h1: 0, b2: 0, h2: 0 }).sections[2].figure, undefined);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
