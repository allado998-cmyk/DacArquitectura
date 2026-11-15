#!/usr/bin/env node
// Checks «Càrrega de vent» (src/lib/calculs/carrega-vent.ts) against David's spreadsheet: each calculation runs with the
// inputs of his example and is compared with the values Excel computed (read
// from the cells, not the rounded display). What differs on purpose is
// explained in the header of the calculation file.
//
//   node scripts/test-calculs-vent.mjs
import { register } from "node:module";
import assert from "node:assert/strict";

register("./mcp-test-hooks.mjs", import.meta.url);

const { CALC_TYPES, CALC_GROUPS, calcType } = await import("../src/lib/calculs/index.ts");
const { computeCarregaVent } = await import("../src/lib/calculs/carrega-vent.ts");
const { verdict, verdictText } = await import("../src/lib/calculs/common.ts");
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
const qe = (r) => row(r, "qe", "qe").value;
const cp = (r) => row(r, "cp", "cp,net").value;
const desc = (r) => row(r, "cp", "Descripció / origen del cp").value;

console.log("Registre");
test("registered in the «Vent» group", () => {
  for (const tipus of ["carrega-vent"]) {
    const t = calcType(tipus);
    assert.equal(t.tipus, tipus);
    assert.equal(t.group, "Vent");
    assert.ok(CALC_TYPES.includes(t));
  }
  assert.ok(CALC_GROUPS.includes("Vent"));
});

console.log("Exemple del full (zona C, grau IV, z = 10 m, façana h/d = 1)");
const r = computeCarregaVent({});
test("vb 29 m/s from zone C = 104,4 km/h (B18, E18)", () => {
  const vb = row(r, "qb", "vb");
  assert.equal(vb.value, 29);
  assert.equal(vb.input.auto, 29);
  near(vb.alt.value, 104.4);
  assert.equal(row(r, "qb", "Zona eòlica").value, "Zona C · 29 m/s");
});
test("qb = ½ · 1,25 · 29² = 0,525625 kN/m² = 53,58053 kgf/m² (B19, E19)", () => {
  near(row(r, "qb", "ρ").value, 1.25);
  near(row(r, "qb", "qb").value, 0.525625);
  near(row(r, "qb", "qb").alt.value, 53.58053);
});
test("grau IV: k 0,22 · L 0,3 · Z 5 (B24–B26)", () => {
  near(row(r, "ce", "k").value, 0.22);
  near(row(r, "ce", "L").value, 0.3);
  near(row(r, "ce", "Z").value, 5);
});
test("F 0,77144274 · ce 1,7831457 (B27, B28)", () => {
  near(row(r, "ce", "F").value, 0.77144274);
  near(row(r, "ce", "ce").value, 1.7831457);
});
test("cp 1,4 = 0,8 + 0,6 with the sheet's description (B31, B32)", () => {
  near(row(r, "cp", "cp").value, 0.8);
  near(row(r, "cp", "cs").value, -0.6);
  near(cp(r), 1.4);
  assert.equal(row(r, "cp", "cp,net").input.auto, cp(r));
  assert.equal(desc(r), "Façana, esbeltesa h/d = 1 (0,8 + 0,6)");
});
test("qe 1,3121724 kN/m² = 133,75865 kgf/m² (B35, E35), with the characteristic-value note", () => {
  near(qe(r), 1.3121724);
  near(row(r, "qe", "qe").alt.value, 133.75865);
  assert.match(r.sections.find((s) => s.key === "qe").notes[0], /γQ = 1,5/);
});
test("no checks", () => {
  assert.deepEqual(verdict(r), { ok: false, total: 0, failed: 0 });
  assert.equal(verdictText(verdict(r)), "Cap comprovació activa.");
});

console.log("Opcions");
test("each wind zone: 26 / 27 / 29 m/s; a typed vb wins", () => {
  for (const [zona, vb] of [["A", 26], ["B", 27], ["C", 29]]) {
    const x = computeCarregaVent({ zona });
    assert.equal(row(x, "qb", "vb").value, vb);
    near(row(x, "qb", "qb").value, (0.5 * 1.25 * vb * vb) / 1000);
  }
  near(row(computeCarregaVent({ zona: "A", vb: 30 }), "qb", "vb").value, 30);
});
test("each roughness grade (taula D.2) computes; z below Z uses Z", () => {
  const D2 = { I: [0.156, 0.003, 1], II: [0.17, 0.01, 1], III: [0.19, 0.05, 2], IV: [0.22, 0.3, 5], V: [0.24, 1, 10] };
  for (const [aspror, [k, L, Z]] of Object.entries(D2)) {
    const x = computeCarregaVent({ aspror, z: 3 });
    const F = k * Math.log(Math.max(3, Z) / L);
    near(row(x, "ce", "F").value, F, 1e-12, aspror);
    near(row(x, "ce", "ce").value, F * (F + 7 * k), 1e-12, aspror);
    assert.ok(qe(x) > 0, aspror);
  }
});
test("each façade slenderness (taula 3.5): cp + |cs|", () => {
  const T35 = { 0.25: 1.0, 0.5: 1.2, 0.75: 1.3, 1: 1.4, 1.25: 1.5, 5: 1.5 };
  for (const [esbeltesa, v] of Object.entries(T35)) near(cp(computeCarregaVent({ esbeltesa })), v, 1e-12, esbeltesa);
  assert.equal(desc(computeCarregaVent({ esbeltesa: "0.25" })), "Façana, esbeltesa h/d ≤ 0,25 (0,7 + 0,3)");
  assert.equal(desc(computeCarregaVent({ esbeltesa: "5" })), "Façana, esbeltesa h/d ≥ 5 (0,8 + 0,7)");
});
test("each free-standing wall l/h and zone (EN 1991-1-4 taula 7.9, φ = 1)", () => {
  const T79 = { 3: [2.3, 1.4, 1.2, 1.2], 5: [2.9, 1.8, 1.4, 1.2], 10: [3.4, 2.1, 1.7, 1.2], retorn: [2.1, 1.8, 1.4, 1.2] };
  for (const [murLh, vals] of Object.entries(T79))
    ["A", "B", "C", "D"].forEach((murZona, i) => {
      const x = computeCarregaVent({ cpOrigen: "mur", murLh, murZona });
      near(cp(x), vals[i], 1e-12, `${murLh} ${murZona}`);
      near(qe(x), 0.525625 * row(x, "ce", "ce").value * vals[i], 1e-9);
    });
  assert.equal(desc(computeCarregaVent({ cpOrigen: "mur", murLh: "10", murZona: "B" })), "Mur o tanca aïllat, l/h ≥ 10, zona B");
  assert.equal(desc(computeCarregaVent({ cpOrigen: "mur", murLh: "retorn", murZona: "A" })), "Mur o tanca aïllat, amb retorns de longitud ≥ h, zona A");
  // the façade rows are gone
  assert.throws(() => row(computeCarregaVent({ cpOrigen: "mur" }), "cp", "cs"));
});
test("cp typed over a table value: used, and said in the description", () => {
  const x = computeCarregaVent({ cp: 1.6 });
  near(cp(x), 1.6);
  near(qe(x), 0.525625 * 1.7831457 * 1.6);
  assert.equal(desc(x), "Façana, esbeltesa h/d = 1 (0,8 + 0,6) · cp escrit a mà");
  assert.equal(desc(computeCarregaVent({ cp: 1.4 })), "Façana, esbeltesa h/d = 1 (0,8 + 0,6)");
});
test("cp typed by choice: no auto, free-text description, nothing until typed", () => {
  const empty = computeCarregaVent({ cpOrigen: "manual" });
  assert.equal(cp(empty), null);
  assert.equal(qe(empty), null);
  assert.equal(row(empty, "cp", "cp,net").input.auto, undefined);
  assert.equal(row(empty, "cp", "Descripció / origen del cp").input.type, "text");
  const x = computeCarregaVent({ cpOrigen: "manual", cp: 2, cpDesc: "Coberta plana, zona F" });
  near(qe(x), 0.525625 * 1.7831457 * 2);
  assert.equal(desc(x), "Coberta plana, zona F");
});
test("zero, empty and unknown inputs don't throw", () => {
  const zero = computeCarregaVent({ rho: 0, vb: 0, z: 0 });
  assert.equal(qe(zero), 0);
  const empty = computeCarregaVent({ rho: null, z: null, vb: null, cp: null, cpDesc: null });
  assert.equal(row(empty, "qb", "vb").value, 29);
  const unknown = computeCarregaVent({ zona: "X", aspror: "VI", esbeltesa: "9", cpOrigen: "?" });
  assert.equal(row(unknown, "qb", "vb").value, null);
  assert.equal(row(unknown, "ce", "ce").value, null);
  assert.equal(cp(unknown), null);
  assert.equal(qe(unknown), null);
  assert.equal(qe(computeCarregaVent({ cpOrigen: "mur", murLh: "x", murZona: "Z" })), null);
});

console.log("Informe");
const header = { tipus: "carrega-vent", num: "CE-26-021", referencia: "12484", data: "2026-11-15" };
test("Catalan report: title, sections, description, note", () => {
  const html = buildCalculHtml(header, r, { logo: "/logo.jpg" });
  for (const s of [calcType("carrega-vent").reportTitle, ...r.sections.map((x) => x.title), "Façana, esbeltesa h/d = 1 (0,8 + 0,6)", "IV · Zona urbana en general, industrial o forestal", "γQ = 1,5", "Cap comprovació activa."])
    assert.ok(html.includes(s), s);
});
test("Spanish report, for each source of cp", () => {
  const es = buildCalculHtml(header, r, { logo: "/logo.jpg" }, "es");
  for (const s of ["Carga dinámica del viento sobre un paramento (CTE DB SE-AE)", "Presión dinámica del viento (qb)", "Coeficiente de exposición (ce)", "Fachada, esbeltez h/d = 1 (0,8 + 0,6)", "Fachada de un edificio (CTE DB SE-AE tabla 3.5)", "Valor característico, sin el coeficiente", "Ninguna comprobación activa."])
    assert.ok(es.includes(s), s);
  for (const s of ["Façana", "Pressió", "Coeficient d'exposició", "Cap comprovació"]) assert.ok(!es.includes(s), s);
  const mur = buildCalculHtml(header, computeCarregaVent({ cpOrigen: "mur", murLh: "retorn", murZona: "C", cp: 1.5 }), { logo: "/logo.jpg" }, "es");
  for (const s of ["Muro o cerca aislado, con retornos de longitud ≥ h, zona C · cp introducido a mano", "Zona C · de 2h a 4h", "Con retornos de longitud ≥ h"]) assert.ok(mur.includes(s), s);
  const manual = buildCalculHtml(header, computeCarregaVent({ cpOrigen: "manual", cp: 2, cpDesc: "Coberta plana, zona F" }), { logo: "/logo.jpg" }, "es");
  assert.ok(manual.includes("Valor introducido a mano") && manual.includes("Coberta plana, zona F")); // free text stays as typed
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
