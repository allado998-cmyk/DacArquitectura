#!/usr/bin/env node
// Checks «Paviment de vidre trepitjable» (src/lib/calculs/paviment-vidre.ts) against David's spreadsheet: each calculation runs with the
// inputs of his example and is compared with the values Excel computed (read
// from the cells, not the rounded display). What differs on purpose is
// explained in the header of the calculation file.
//
//   node scripts/test-calculs-vidre.mjs
import { register } from "node:module";
import assert from "node:assert/strict";

register("./mcp-test-hooks.mjs", import.meta.url);

const { CALC_TYPES, CALC_GROUPS, calcType } = await import("../src/lib/calculs/index.ts");
const { computePavimentVidre, pavimentVidreDefaults, interpola, ROARK_UNIFORME, ROARK_PUNTUAL, VIDRES } = await import("../src/lib/calculs/paviment-vidre.ts");
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

// The row with this symbol (or label) in the section with this key.
function row(result, section, sym) {
  const s = result.sections.find((x) => x.key === section);
  if (!s) throw new Error(`section not found: ${section}`);
  for (const b of s.blocks) for (const r of b.rows) if (r.sym === sym || (!r.sym && r.label === sym)) return r;
  throw new Error(`row not found: ${section} · ${sym}`);
}
const val = (result, section, sym) => row(result, section, sym).value;
// Excel's cached values, by symbol.
function expectAll(result, section, values, rel = 1e-6) {
  for (const [sym, v] of Object.entries(values)) near(val(result, section, sym), v, rel, `${section} · ${sym}`);
}
const checks = (result, section) => {
  const out = [];
  for (const b of result.sections.find((x) => x.key === section).blocks) for (const r of b.rows) if (r.check) out.push(r);
  return out;
};

console.log("Registre");
test("registered in the «Paviments» group", () => {
  for (const tipus of ["paviment-vidre"]) {
    const t = calcType(tipus);
    assert.equal(t.tipus, tipus);
    assert.equal(t.group, "Paviments");
    assert.ok(CALC_TYPES.includes(t));
  }
  assert.ok(CALC_GROUPS.includes("Paviments"));
});
test("sections in the order of the sheet", () => {
  const r = computePavimentVidre({});
  assert.deepEqual(r.sections.map((s) => s.key), ["dades", "coeficients", "elu", "els", "postTrencament", "hipotesis"]);
});

console.log("Exemple del full (1,5 × 1,5 m · 3 × 10 mm trempat · q 2 kN/m² · Q 2 kN)");
const ex = computePavimentVidre(pavimentVidreDefaults());
test("geometria: a 1,5 · b 1,5 · a/b 1", () => expectAll(ex, "dades", { L1: 1.5, L2: 1.5, a: 1.5, b: 1.5, "a/b": 1 }));
test("composició: n 3 · t,nom 10 · t 9,7 (EN 572-2, typed in the sheet) · «3 × 10 mm» · g 0,75 kN/m²", () => {
  expectAll(ex, "dades", { n: 3, "t,nom": 10, t: 9.7, g: 0.75 });
  assert.equal(row(ex, "dades", "t").input.auto, 9.7);
  assert.equal(val(ex, "dades", "Composició"), "3 × 10 mm");
});
test("material: fk 120 · kc 1 · γM 1,5 · fd 80 · γM,acc 1,5 · fd,acc 80 · E 70000 · ν 0,23", () => {
  expectAll(ex, "dades", { fk: 120, kc: 1, "γM": 1.5, fd: 80, "γM,acc": 1.5, "fd,acc": 80, E: 70000, "ν": 0.23 });
  assert.equal(val(ex, "dades", "Tipus de vidre"), "Trempat (ESG / templat)");
});
test("accions: q 2 · Q 2 · c 50 · γG 1,35 · γQ 1,5 · b / 200", () => expectAll(ex, "dades", { q: 2, Q: 2, c: 50, "γG": 1.35, "γQ": 1.5, "b /": 200 }));
test("coeficients: β 0,2874 · α 0,0444 · β1 0,435 · αp 0,1267 · r = r' 28,209479 mm", () => {
  expectAll(ex, "coeficients", { "β": 0.2874, "α": 0.0444, "β1": 0.435, "αp": 0.1267, r: 28.209479, "r'": 28.209479 });
  assert.equal(val(ex, "coeficients", "Avís de validesa"), "Dins del rang de taules");
});
test("E.L.U.: qd 4,0125 · σ 9,1922029 · Qd 3 · σ 26,510106 MPa", () => expectAll(ex, "elu", { qd: 4.0125, "σ q": 9.1922029, Qd: 3, "σ Q": 26.510106 }));
test("E.L.S.: w adm 7,5 · w 3,2251224 · w 3,8543573 mm", () => expectAll(ex, "els", { "w adm": 7.5, "w q": 3.2251224, "w Q": 3.8543573 }));
test("post-trencament: n − 1 2 · σ 9,4499283 · σ 26,767832 MPa · n 3", () => expectAll(ex, "postTrencament", { "n − 1": 2, "σ q": 9.4499283, "σ Q": 26.767832, n: 3 }));
test("every check compares with the value printed next to it", () => {
  const fd = val(ex, "dades", "fd");
  const fdAcc = val(ex, "dades", "fd,acc");
  const wAdm = val(ex, "els", "w adm");
  for (const r of checks(ex, "elu")) assert.equal(r.check.limit, fd);
  for (const r of checks(ex, "els")) assert.equal(r.check.limit, wAdm);
  const post = checks(ex, "postTrencament");
  assert.deepEqual(post.map((r) => r.check.limit), [fdAcc, fdAcc, 3]);
  assert.deepEqual([...checks(ex, "elu"), ...checks(ex, "els"), ...post.slice(0, 2)].map((r) => r.check.op), ["≤", "≤", "≤", "≤", "≤", "≤"]);
  // n ≥ 3 (DIN 18008-5), as the sheet.
  assert.equal(post[2].check.op, "≥");
  assert.equal(checks(computePavimentVidre({ ...pavimentVidreDefaults(), n: 2 }), "postTrencament")[2].check.ok, false);
});
test("the sheet's RESULTAT GLOBAL: OK! (7 checks)", () => assert.deepEqual(verdict(ex), { ok: true, total: 7, failed: 0 }));
test("typing the sheet's typed values (t 9,7 · fk 120 · γM 1,5) gives the same result", () => {
  const typed = computePavimentVidre({ t: 9.7, fk: 120, gM: 1.5 });
  expectAll(typed, "elu", { "σ q": 9.1922029, "σ Q": 26.510106 });
  expectAll(typed, "postTrencament", { "σ Q": 26.767832 });
});

console.log("Coeficients de placa (interpolació com INDEX/MATCH del full)");
test("at each row of both tables, the table's value", () => {
  for (const t of [ROARK_UNIFORME, ROARK_PUNTUAL]) for (const [x, s, w] of t) {
    near(interpola(t, 1, x), s, 1e-12, `a/b ${x}`);
    near(interpola(t, 2, x), w, 1e-12, `a/b ${x}`);
  }
});
test("between rows: linear (a/b 1,1 · 2,5 · 4,5 uniform; 1,1 · 1,9 point)", () => {
  near(interpola(ROARK_UNIFORME, 1, 1.1), (0.2874 + 0.3762) / 2, 1e-12);
  near(interpola(ROARK_UNIFORME, 2, 2.5), (0.111 + 0.1335) / 2, 1e-12);
  near(interpola(ROARK_UNIFORME, 1, 4.5), (0.741 + 0.7476) / 2, 1e-12);
  near(interpola(ROARK_PUNTUAL, 1, 1.1), (0.435 + 0.565) / 2, 1e-12);
  near(interpola(ROARK_PUNTUAL, 2, 1.9), (0.177 + 0.1805) / 2, 1e-12);
  // 1,65 × 1,5 m → a/b = 1,1
  const r = computePavimentVidre({ L1: 1.65, L2: 1.5 });
  near(val(r, "coeficients", "β"), (0.2874 + 0.3762) / 2, 1e-9);
  near(val(r, "coeficients", "αp"), (0.1267 + 0.1478) / 2, 1e-9);
});
test("beyond the ends: MATCH keeps the last segment, so it extrapolates; below the first row #N/A → null", () => {
  near(interpola(ROARK_PUNTUAL, 1, 2.2), 0.77 + (0.2 * (0.77 - 0.745)) / 0.2, 1e-12);
  assert.equal(interpola(ROARK_UNIFORME, 1, 0.9), null);
  assert.equal(interpola(ROARK_UNIFORME, 1, null), null);
});
test("a/b 2,5: uniform interpolated, point taken at a/b = 2 with the warning", () => {
  const r = computePavimentVidre({ L1: 2.5, L2: 1 });
  near(val(r, "coeficients", "β"), (0.6102 + 0.7134) / 2, 1e-9);
  expectAll(r, "coeficients", { "β1": 0.77, "αp": 0.1805 }, 1e-12);
  const avis = row(r, "coeficients", "Avís de validesa");
  assert.equal(avis.value, "Fora de rang (a/b > 2)");
  assert.equal(avis.formula, "Coeficients de càrrega puntual presos per a a/b = 2 (verificar)");
});
test("a/b 6: uniform taken at a/b = 5 (0,7476 · 0,1417)", () => {
  const r = computePavimentVidre({ L1: 6, L2: 1 });
  expectAll(r, "coeficients", { "β": 0.7476, "α": 0.1417, "β1": 0.77, "αp": 0.1805 }, 1e-12);
});
test("a/b exactly 2 is in range", () => {
  const r = computePavimentVidre({ L1: 3, L2: 1.5 });
  assert.equal(val(r, "coeficients", "Avís de validesa"), "Dins del rang de taules");
  expectAll(r, "coeficients", { "β": 0.6102, "β1": 0.77 }, 1e-12);
});
test("the sides in either order give the same a and b", () => {
  const r = computePavimentVidre({ L1: 1.2, L2: 2 });
  expectAll(r, "dades", { a: 2, b: 1.2 });
  near(val(r, "elu", "σ Q"), val(computePavimentVidre({ L1: 2, L2: 1.2 }), "elu", "σ Q"), 1e-12);
});
test("r < 0,5 · t: Roark's equivalent radius r' = √(1,6 · r² + t²) − 0,675 · t", () => {
  const r = computePavimentVidre({ c: 5 });
  const rr = 5 / Math.sqrt(Math.PI);
  near(val(r, "coeficients", "r'"), Math.sqrt(1.6 * rr * rr + 9.7 * 9.7) - 0.675 * 9.7, 1e-12);
  assert.ok(row(r, "coeficients", "r'").formula.startsWith("r' = √"));
});

console.log("Gruix, tipus de vidre i nombre de làmines");
test("calculation thickness from the nominal: 8 → 7,7 · 12 → 11,7 · 15 → 14,5", () => {
  for (const [nom, t] of [[8, 7.7], [12, 11.7], [15, 14.5]]) {
    const r = computePavimentVidre({ tNom: nom });
    near(val(r, "dades", "t"), t, 1e-12, `t,nom ${nom}`);
    near(val(r, "dades", "g"), (25 * 3 * nom) / 1000, 1e-12);
  }
});
test("another nominal thickness has no default: «—» and failing checks until typed", () => {
  const r = computePavimentVidre({ tNom: 6 });
  assert.equal(row(r, "dades", "t").input.auto, undefined);
  assert.equal(val(r, "dades", "t"), null);
  assert.equal(val(r, "elu", "σ q"), null);
  assert.equal(val(r, "els", "w Q"), null);
  assert.equal(verdict(r).failed, 6);
  const typed = computePavimentVidre({ tNom: 6, t: 5.8 });
  near(val(typed, "dades", "t"), 5.8, 1e-12);
  assert.ok(val(typed, "elu", "σ q") > 0);
});
test("a typed thickness wins over the default", () => {
  near(val(computePavimentVidre({ t: 9.5 }), "dades", "t"), 9.5, 1e-12);
  const r = computePavimentVidre({ t: 9.5 });
  near(val(r, "elu", "σ q"), (9.1922029 * 9.7 * 9.7) / (9.5 * 9.5), 1e-6);
});
test("each glass type computes, with its default fk and γM", () => {
  const expected = { trempat: [120, 1.5, 80, 80], termoendurit: [70, 1.5, 70 / 1.5, 70 / 1.5], recuit: [45, 1.8, 25, 30] };
  for (const v of VIDRES) {
    const r = computePavimentVidre({ vidre: v.value });
    const [fk, gM, fd, fdAcc] = expected[v.value];
    expectAll(r, "dades", { fk, "γM": gM, fd, "fd,acc": fdAcc }, 1e-12);
    assert.equal(val(r, "dades", "Tipus de vidre"), v.label);
    assert.equal(row(r, "dades", "fk").input.auto, fk);
  }
});
test("annealed glass: the point stress 26,51 > fd 25 fails", () => {
  const r = computePavimentVidre({ vidre: "recuit" });
  assert.equal(row(r, "elu", "σ Q").check.ok, false);
  assert.deepEqual(verdict(r), { ok: false, total: 7, failed: 1 });
  // typed fk / γM win
  near(val(computePavimentVidre({ vidre: "recuit", fk: 50, gM: 1.6 }), "dades", "fd"), 50 / 1.6, 1e-12);
});
test("n = 2: post-breakage on one ply, and the DIN 18008-5 check fails", () => {
  const r = computePavimentVidre({ n: 2 });
  assert.equal(val(r, "postTrencament", "n − 1"), 1);
  near(val(r, "postTrencament", "σ q"), (0.2874 * (0.5 + 2) * 1e-3 * 1500 * 1500) / (1 * 9.7 * 9.7), 1e-12);
  assert.equal(row(r, "postTrencament", "n").check.ok, false);
  assert.equal(verdict(r).ok, false);
});
test("n = 1: no ply left after breakage → «—» (the sheet prints 9999) and both checks fail", () => {
  const r = computePavimentVidre({ n: 1 });
  assert.equal(val(r, "postTrencament", "σ q"), null);
  assert.equal(val(r, "postTrencament", "σ Q"), null);
  assert.deepEqual(checks(r, "postTrencament").map((x) => x.check.ok), [false, false, false]);
  assert.equal(row(r, "elu", "σ q").check.ok, true);
});

console.log("Dades buides o zero");
test("zero / empty inputs don't throw and give «—» where a value can't be computed", () => {
  const keys = Object.keys(pavimentVidreDefaults());
  const zeros = computePavimentVidre(Object.fromEntries(keys.map((k) => [k, k === "vidre" ? "" : 0])));
  const nulls = computePavimentVidre(Object.fromEntries(keys.map((k) => [k, null])));
  const texts = computePavimentVidre(Object.fromEntries(keys.map((k) => [k, ""])));
  for (const r of [zeros, nulls, texts]) {
    assert.equal(val(r, "dades", "a/b"), null);
    assert.equal(val(r, "coeficients", "β"), null);
    assert.equal(val(r, "coeficients", "Avís de validesa"), null);
    for (const s of r.sections) for (const b of s.blocks) for (const x of b.rows) if (typeof x.value === "number") assert.ok(Number.isFinite(x.value), `${s.key} · ${x.label}`);
    assert.equal(verdict(r).ok, false);
  }
  for (const d of [{ n: 0 }, { E: 0 }, { c: 0 }, { t: 0 }, { c: 0, t: 0 }, { limitB: 0 }, { gM: 0 }, { L1: 0 }, { vidre: "?" }]) {
    const r = computePavimentVidre(d);
    for (const s of r.sections) for (const b of s.blocks) for (const x of b.rows) if (typeof x.value === "number") assert.ok(Number.isFinite(x.value), `${JSON.stringify(d)} ${s.key} · ${x.label}`);
  }
  assert.equal(val(computePavimentVidre({ n: 0 }), "elu", "σ q"), null);
  assert.equal(val(computePavimentVidre({ E: 0 }), "els", "w q"), null);
  assert.equal(val(computePavimentVidre({ c: 0, t: 0 }), "elu", "σ Q"), null);
  assert.equal(val(computePavimentVidre({ vidre: "?" }), "dades", "fd"), null);
});

console.log("Informe");
test("report in Catalan: title, sections, notes, the summary", () => {
  const t = calcType("paviment-vidre");
  const html = buildCalculHtml({ tipus: t.tipus, num: "CE-26-020", referencia: "12484", data: "2026-11-15" }, ex, { logo: "/logo.jpg" });
  assert.ok(html.includes(t.reportTitle));
  for (const s of ex.sections) assert.ok(html.includes(s.title), s.title);
  assert.ok(html.includes("3 × 10 mm") && html.includes("Trempat (ESG / templat)"));
  assert.ok(html.includes("1. Placa rectangular simplement recolzada als 4 costats") && html.includes("5. Eina de predimensionament"));
  assert.ok(html.includes("taula 11.4"));
  assert.ok(html.includes("Resum de les comprovacions") && html.includes("Compleixen totes les comprovacions (7)."));
});
test("report in Spanish: every text translated, notes too", () => {
  const variants = [ex, computePavimentVidre({ L1: 4, L2: 1.5, vidre: "recuit", n: 1 })];
  for (const r of variants) {
    const html = buildCalculHtml({ tipus: "paviment-vidre", num: "CE-26-020", data: "2026-11-15" }, r, { logo: "/logo.jpg" }, "es");
    for (const es of ["Cálculo de pavimento de vidrio pisable", "Entrada de datos del pavimento de vidrio", "Coeficientes de placa (tablas de Roark)",
      "E.L.U. · laminado intacto (sin colaboración entre láminas)", "Post-rotura · lámina superior rota", "Hipótesis y limitaciones",
      "1. Placa rectangular simplemente apoyada en los 4 lados", "5. Herramienta de predimensionado", "Tensión por lámina · puntual + peso propio",
      "a = máx(L1, L2)", "Resumen de las comprobaciones"])
      assert.ok(html.includes(es), es);
    for (const ca of ["Hipòtesis", "làmina", "Làmines", "Càrrega", "Costat", "Fletxa", "vidre ", "Resum de les", "màx(", "taula 11.4"]) assert.ok(!html.includes(ca), ca);
  }
  const html = buildCalculHtml({ tipus: "paviment-vidre", num: "CE-26-020", data: "2026-11-15" }, variants[1], { logo: "/logo.jpg" }, "es");
  assert.ok(html.includes("Recocido (float)") && html.includes("Fuera de rango (a/b &gt; 2)") && html.includes("Coeficientes de carga puntual tomados para a/b = 2 (verificar)"));
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
