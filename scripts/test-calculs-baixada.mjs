#!/usr/bin/env node
// Checks «Baixada de càrregues i tensió a la paret» (src/lib/calculs/baixada-carregues.ts) against David's spreadsheet: each calculation runs with the
// inputs of his example and is compared with the values Excel computed (read
// from the cells, not the rounded display). What differs on purpose is
// explained in the header of the calculation file.
//
//   node scripts/test-calculs-baixada.mjs
import { register } from "node:module";
import assert from "node:assert/strict";

register("./mcp-test-hooks.mjs", import.meta.url);

const { CALC_TYPES, CALC_GROUPS, calcType } = await import("../src/lib/calculs/index.ts");
const { baixadaCarreguesDefaults, computeBaixadaCarregues } = await import("../src/lib/calculs/baixada-carregues.ts");
const { computeParet, newSostre } = await import("../src/lib/calculs/paret.ts");
const { G, verdict, verdictText } = await import("../src/lib/calculs/common.ts");
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

// The row with this symbol (or label) in the section with this key.
function row(result, section, sym) {
  const s = result.sections.find((x) => x.key === section);
  if (!s) throw new Error(`section not found: ${section}`);
  for (const b of s.blocks) for (const r of b.rows) if (r.sym === sym || r.label === sym) return r;
  throw new Error(`row not found: ${section} · ${sym}`);
}
const loads = (r) => r.sections.find((x) => x.key === "carregues").loads;
const group = (r, title) => loads(r).groups.find((g) => g.title === title);
const lineOf = (g, label) => g.lines.find((l) => l.line?.label === label).line;

console.log("Registre");
test("registered in the «Estructura vertical» group", () => {
  for (const tipus of ["baixada-carregues"]) {
    const t = calcType(tipus);
    assert.equal(t.tipus, tipus);
    assert.equal(t.group, "Estructura vertical");
    assert.ok(CALC_TYPES.includes(t));
  }
  assert.ok(CALC_GROUPS.includes("Estructura vertical"));
});

console.log("Exemple del full (6 forjats tipus + coberta amb plaques fotovoltaiques, mur de maó de 15 cm)");
const r = computeBaixadaCarregues({});
test("forjats tipus: pes propi 24 / 32,4 · ús 24 / 36 · total 48 / 68,4 kN/ml (rows 10–13)", () => {
  const g = group(r, "Forjats tipus");
  assert.equal(g.count, 6);
  assert.equal(g.sostreIndex, 0);
  const pp = lineOf(g, "Pes propi estructural");
  near(pp.unf, 24); near(pp.fac, 32.4);
  const us = lineOf(g, "Sobrecàrrega d'ús");
  near(us.unf, 24); near(us.fac, 36);
  near(g.total.unf, 48); near(g.total.fac, 68.4);
});
test("forjat coberta: 4 / 5,4 · paviments 4 / 5,4 · fotovoltaica 2 / 2,7 · neu 0,8 / 1,2 · total 10,8 / 14,7 (rows 17–22)", () => {
  const g = group(r, "Forjat coberta");
  assert.equal(g.count, 1);
  const pairs = [["Pes propi estructural", 4, 5.4], ["Càrregues permanents de paviments i morter", 4, 5.4], ["Pes propi de les plaques fotovoltaiques", 2, 2.7], ["Sobrecàrrega de neu", 0.8, 1.2]];
  for (const [label, unf, fac] of pairs) {
    near(lineOf(g, label).unf, unf, 1e-6, label);
    near(lineOf(g, label).fac, fac, 1e-6, label);
  }
  near(g.total.unf, 10.8); near(g.total.fac, 14.7);
});
test("pes propi de la paret: 0,15 × 6,9 × 18 = 18,63 / 25,1505 kN/ml (row 27)", () => {
  const g = loads(r).groups.at(-1);
  assert.equal(g.title, "Accions permanents · paret de càrrega");
  const l = lineOf(g, "Pes propi de la paret de càrrega");
  near(l.width, 1.035); near(l.unf, 18.63); near(l.fac, 25.1505);
  assert.ok(g.aux?.[0]?.src.endsWith("cte-se-ae-pes-fabriques.jpg"));
});
test("càrrega total a la base: 77,43 / 108,2505 kN/ml (F33, G33)", () => {
  near(loads(r).totalUnf, 77.43); near(loads(r).totalFac, 108.2505);
  assert.equal(loads(r).totalLabel, "Càrrega total a la base de la paret");
  near(row(r, "resultats", "Q ELS").value, 77.43);
  near(row(r, "resultats", "Q ELU").value, 108.2505);
});
test("kg/ml with 9,81 (the sheet: ×0,10197 → 7.895,5371 / 11.038,303)", () => {
  near(row(r, "resultats", "Q ELS").alt.value, 77430 / G);
  near(row(r, "resultats", "Q ELU").alt.value, 108250.5 / G);
  near(row(r, "resultats", "Q ELS").alt.value, 7895.5371, 1e-3); // within 0,1 %
});
test("increment de càrrega fotovoltaica 2,4942 % (G39)", () => {
  near(row(r, "resultats", "Q ELU fv").value, 2.7);
  near(row(r, "resultats", "Increment de càrrega fotovoltaica").value / 100, 0.024942148);
});
test("fàbrica: fk 4,0076866 · fd 1,3358955 N/mm² (F44, G44)", () => {
  near(row(r, "fabrica", "fk").value, 4.0076866);
  near(row(r, "fabrica", "fd").value, 1.3358955);
  near(row(r, "fabrica", "fd").alt.value, (1.3358955 * 100) / G); // the sheet: /9,8065 → 13,622552
});
test("càrrega repartida: t 150 mm (auto from 0,15 m) · L 1000 · A 150.000 mm² (C48–E48)", () => {
  const t = row(r, "tensio", "t");
  assert.equal(t.value, 150);
  assert.equal(t.input.auto, 150);
  near(row(r, "tensio", "L").value, 1000);
  near(row(r, "tensio", "A").value, 150000);
  near(row(r, "tensio", "A").alt.value, 1500);
});
test("σ ELS 0,5162 · σ ELU 0,72167 N/mm² < fd (F48, G48); kg/cm² with 9,81", () => {
  near(row(r, "tensio", "σ ELS").value, 0.5162);
  const s = row(r, "tensio", "σ ELU");
  near(s.value, 0.72167);
  assert.equal(s.check.ok, true);
  near(s.check.limit, 1.3358955);
  near(row(r, "tensio", "σ ELS").alt.value, (0.5162 * 100) / G); // the sheet: 5,2638556
  near(s.alt.value, (0.72167 * 100) / G); // the sheet: 7,3590986
});
test("aprofitament de la paret 54,02 % (G52) and the verdict", () => {
  near(row(r, "tensio", "Aprofitament de la paret").value / 100, 0.5402144);
  assert.deepEqual(verdict(r), { ok: true, total: 1, failed: 0 });
});

console.log("Variacions");
test("a typed gruix and another length: σ = Q / t whatever the length", () => {
  const x = computeBaixadaCarregues({ gruixMm: 300, longitud: 500 });
  near(row(x, "tensio", "A").value, 150000);
  near(row(x, "tensio", "σ ELU").value, 108.2505 / 300);
  assert.equal(row(x, "tensio", "t").input.auto, 150);
});
test("the floors are editable like paret's: nombre, a new floor, photovoltaics on any floor", () => {
  const d = baixadaCarreguesDefaults();
  const sostres = [{ ...d.sostres[0], nombre: 3, fv: 0.5 }, d.sostres[1], newSostre(3)];
  const x = computeBaixadaCarregues({ sostres });
  const g = group(x, "Forjats tipus");
  near(g.total.unf, (2 + 2 + 0.5) * 2 * 3);
  near(row(x, "resultats", "Q ELU fv").value, 0.5 * 2 * 3 * 1.35 + 2.7);
  const nou = group(x, "Sostre tipus 3");
  assert.equal(nou.sostreIndex, 2);
  assert.equal(nou.total.unf, 0);
  assert.equal(loads(x).groups.length, 4);
});
test("a heavier wall fails the stress check", () => {
  const x = computeBaixadaCarregues({ paretAlcada: 40 });
  assert.equal(row(x, "tensio", "σ ELU").check.ok, false);
  assert.equal(verdict(x).ok, false);
});
test("zero and empty inputs don't throw", () => {
  const zero = computeBaixadaCarregues({ sostres: [], paretGruix: 0, paretAlcada: 0, paretPes: 0, k: 0, fb: 0, fm: 0, gM: 0, gruixMm: 0, longitud: 0 });
  assert.equal(row(zero, "tensio", "σ ELU").value, null);
  assert.equal(row(zero, "fabrica", "fd").value, null);
  assert.equal(row(zero, "resultats", "Increment de càrrega fotovoltaica").value, null);
  assert.equal(verdict(zero).ok, false);
  const empty = computeBaixadaCarregues({ sostres: [{ nom: "", nombre: null, amplada: null }], paretGruix: null, k: null, gruixMm: null });
  assert.equal(group(empty, "Sostre tipus 1").total.unf, 0);
  computeBaixadaCarregues({ sostres: undefined });
});
test("paret behaves as before: a floor's fv is ignored there", () => {
  const floor = { ...newSostre(1), amplada: 3, pp: 2 };
  const without = computeParet({ sostres: [floor] });
  const withFv = computeParet({ sostres: [{ ...floor, fv: 5 }] });
  assert.deepEqual(withFv.sections.map((s) => s.blocks), without.sections.map((s) => s.blocks));
  near(withFv.sections[0].loads.totalUnf, without.sections[0].loads.totalUnf, 1e-12);
  near(withFv.sections[0].loads.groups.at(-1).total.unf, 6);
});

console.log("Informe");
const header = { tipus: "baixada-carregues", num: "CE-26-020", referencia: "261785", data: "2026-11-15" };
test("Catalan report: title, sections, floors, total, summary", () => {
  const html = buildCalculHtml(header, r, { logo: "/logo.jpg" });
  const t = calcType("baixada-carregues");
  for (const s of [t.reportTitle, ...r.sections.map((x) => x.title), "Forjats tipus", "Forjat coberta", "Càrrega total a la base de la paret", "Pes propi de les plaques fotovoltaiques", "Resum de les comprovacions", "Compleixen totes les comprovacions (1)."])
    assert.ok(html.includes(s), s);
});
test("Spanish report", () => {
  const html = buildCalculHtml(header, r, { logo: "/logo.jpg" }, "es");
  for (const s of ["Bajada de cargas y comprobación de la tensión en el muro de carga", "Bajada de cargas", "Forjados tipo", "Forjado cubierta", "Estado de cargas Forjados tipo", "Carga total en la base del muro",
    "Peso propio de las placas fotovoltaicas", "Resultados en la base del muro", "Incremento de carga fotovoltaica", "Resistencia característica a compresión", "Aprovechamiento del muro", "Resumen de las comprobaciones"])
    assert.ok(html.includes(s), s);
  for (const s of ["Forjats tipus", "Càrrega total", "Aprofitament", "Resum de les comprovacions"]) assert.ok(!html.includes(s), s);
  assert.equal(verdictText(verdict(r)), "Compleixen totes les comprovacions (1).");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
