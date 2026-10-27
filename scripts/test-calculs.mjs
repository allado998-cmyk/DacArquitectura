#!/usr/bin/env node
// Checks the Càlculs engine (src/lib/calculs) against David's spreadsheets:
// each calculation runs with the inputs of his example and is compared with
// the values Excel computed (read from the cells, not the rounded display).
// Where the app corrects the spreadsheet on purpose (see the header of
// paret.ts) the expected value is the corrected one, and both are printed.
//
//   node scripts/test-calculs.mjs
import { register } from "node:module";
import assert from "node:assert/strict";

register("./mcp-test-hooks.mjs", import.meta.url);

const { computeParet } = await import("../src/lib/calculs/paret.ts");
const { computeBiga } = await import("../src/lib/calculs/biga.ts");
const { computePilar } = await import("../src/lib/calculs/pilar.ts");
const { computeSoldadura } = await import("../src/lib/calculs/soldadura.ts");
const { verdict } = await import("../src/lib/calculs/common.ts");
const { perfilProps, soldaduraPer, FAMILIES } = await import("../src/lib/calculs/perfils.ts");

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

// Value of the first row whose label starts with `label` (optionally inside a block).
function val(result, label, block) {
  for (const s of result.sections)
    for (const b of s.blocks) {
      if (block && b.title !== block) continue;
      for (const r of b.rows) if (r.label.startsWith(label)) return r;
    }
  throw new Error(`row not found: ${label}`);
}
function near(actual, expected, rel = 1e-4, what = "") {
  const ok = Math.abs(actual - expected) <= Math.abs(expected) * rel + 1e-9;
  assert.ok(ok, `${what} expected ≈ ${expected}, got ${actual}`);
}
const G = 9.81;

console.log("Paret de càrrega (Justificació de Càlcul Estintolament Paret de Càrrega.xls)");
const paretInputs = {
  ppPerfil: 0.6, // the sheet uses 0,3 kN/ml per profile
  sostres: [
    { nom: "Sostre tipus 1", nombre: 5.5, amplada: 3.57, pp: 1.7, cp: 2, envans: 1, gG: 1.35, us: 2, neu: 0, vent: 0, gUs: 1.5, gNeu: 1.5, gVent: 1.5 },
    { nom: "Sostre tipus 2", nombre: 1, amplada: 3.57, pp: 1.7, cp: 2, envans: 0, gG: 1.35, us: 1, neu: 0.4, vent: 0, gUs: 1.5, gNeu: 1.5, gVent: 1.5 },
    { nom: "Sostre tipus 3", nombre: 1, amplada: 0, pp: 0, cp: 0, envans: 0, gG: 1.35, us: 0, neu: 0, vent: 0, gUs: 1.5, gNeu: 1.5, gVent: 1.5 },
  ],
};
const paret = computeParet(paretInputs);
const loads = paret.sections.find((s) => s.loads).loads;
const qElu = loads.totalFac;
const L = 2400;
const rN = (qElu * L) / 2;

test("estat de càrregues: Q ELS 198,9615 · Q ELU 275,238225 kN/ml", () => {
  near(loads.totalUnf, 198.9615, 1e-9, "Q ELS");
  near(qElu, 275.238225, 1e-9, "Q ELU");
});
test("perfil 2 × UPN 320: Ix, Wx, Aa", () => {
  near(val(paret, "Moment d'inèrcia", "Característiques del perfil").value, 217400000, 1e-9, "Ix");
  near(val(paret, "Mòdul resistent", "Característiques del perfil").value, 1358000, 1e-9, "Wx");
  near(val(paret, "Àrea de l'ànima", "Característiques del perfil").value, 6888, 1e-9, "Aa");
});
test("E.L.S. / E.L.U. / coeficients de seguretat", () => {
  near(val(paret, "Capacitat de càrrega per deformació").value, 253.6333333);
  near(val(paret, "Deformació del perfil").value, 1.882668945);
  near(val(paret, "Amb aquesta deformació").value, 1274.785993);
  near(val(paret, "Capacitat de càrrega per moment flector").value, 493.9814815);
  near(val(paret, "Moment flector màxim de càlcul", "Estats límits últims (E.L.U.)").value, 198171522);
  near(val(paret, "Tensió per moment flector", "Estats límits últims (E.L.U.)").value, 145.9289558);
  near(val(paret, "Capacitat de càrrega per esforç tallant").value, 867.9499047);
  near(val(paret, "Tensió per esforç tallant", "Estats límits últims (E.L.U.)").value, 47.95091028);
  near(val(paret, "Fórmula combinada").value, 167.9080985);
  near(val(paret, "Per deformació").value, 1.274785993);
  near(val(paret, "Per moment flector").value, 2.482799343);
  near(val(paret, "Per esforç tallant").value, 4.362401292);
});
test("checks compare against the total load (the sheet used floor type 1)", () => {
  const r = val(paret, "Capacitat de càrrega per deformació");
  assert.equal(r.check.limit, loads.totalUnf);
  assert.equal(val(paret, "Capacitat de càrrega per moment flector").check.limit, qElu);
});
test("fàbrica de suport: fd = 2,819602506 N/mm²", () => near(val(paret, "Resistència de càlcul a compressió").value, 2.819602506));
test("reacció V = Q ELU · L / 2 (sheet: 324.010,44 N, ~2 % lower)", () => {
  const r = val(paret, "Esforç tallant a cada extrem");
  near(r.value, rN, 1e-12);
  console.log(`      app ${rN.toFixed(2)} N · sheet 324010.44 N`);
});
test("opció A: connectors (sheet SB 1.643,54 · SP 110,10 kg/cm², with V/10 and π = 3,14)", () => {
  const vKg = rN / G;
  const sb = val(paret, "Tensió en el connector").value;
  const sp = val(paret, "Tensió en la paret de càrrega de suport").value;
  near(sb, vKg / (10 * ((Math.PI * 1.6 * 1.6) / 4)), 1e-9, "SB");
  near(sp, vKg / (10 * 30), 1e-9, "SP");
  console.log(`      app SB ${sb.toFixed(2)} · SP ${sp.toFixed(2)} kg/cm²`);
  assert.equal(val(paret, "Tensió en la paret de càrrega de suport").check.ok, false); // NO! in the sheet too
});
test("opció B: daus (sheet σ1 2,1601 · σ2 0,91746 · σ 3,0775 N/mm²)", () => {
  near(val(paret, "Tensió de la paret sense estintolament").value, 0.91746075);
  near(val(paret, "Increment de tensió per l'estintolament").value, rN / 150000, 1e-9);
  assert.equal(val(paret, "Tensió total a la paret").check.ok, false); // NO! in the sheet too
});
test("opció C: brancals 1 × UPN 140 (sheet 158,83 N/mm²)", () => {
  near(val(paret, "Secció del perfil").value, 2040, 1e-9, "S");
  near(val(paret, "Tensió al perfil").value, rN / 2040, 1e-9);
});
test("esnelles: tensió de treball 2,446562 · Q 73,39686 kN · σ 265,04 (NO!) · τ 109,22", () => {
  near(val(paret, "Tensió de treball").value, 2.446562);
  near(val(paret, "Càrrega puntual a cada esnella").value, 73.39686);
  near(val(paret, "Moment flector màxim de càlcul", "Comprovació tensional de les esnelles · perfil travesser amb càrrega puntual").value, 23853979.5);
  const s = val(paret, "Tensió per moment flector", "Comprovació tensional de les esnelles · perfil travesser amb càrrega puntual");
  near(s.value, 265.0442167);
  assert.equal(s.check.ok, false);
  const t = val(paret, "Tensió per esforç tallant", "Comprovació tensional de les esnelles · perfil travesser amb càrrega puntual");
  near(t.value, 109.2215179);
  assert.equal(t.check.ok, true);
  assert.equal(val(paret, "Amplària de l'ala superior").value, 100); // HEB 100 b, from the catalogue
});
test("self-weight from the catalogue when not typed: 2 × 59,5 kg/m", () => {
  const r = computeParet({ ...paretInputs, ppPerfil: null });
  const first = r.sections.find((s) => s.loads).loads.groups[0].lines[0].line;
  near(first.q, (2 * 59.5 * G) / 1000, 1e-12);
});
test("disabling an option drops its checks", () => {
  const all = verdict(paret);
  const noA = verdict(computeParet({ ...paretInputs, optA: false }));
  assert.equal(noA.total, all.total - 2);
});

console.log("Biga (Justificació Comprovació Recolzament Biga amb Daus o Connectors.xls)");
const biga = computeBiga({});
test("fd 1,603074636 N/mm² = 16,34123 kg/cm²", () => {
  const r = val(biga, "Resistència de càlcul a compressió");
  near(r.value, 1.603074636);
  near(r.alt.value, 16.34122973);
});
test("dau: σ = 13,05666667 kg/cm² (OK)", () => {
  const r = val(biga, "Tensió al dau");
  near(r.value, 13.05666667);
  assert.equal(r.check.ok, true);
});
test("connectors: SB ≈ 243,64 (π instead of 3,14) · SP 16,3208 kg/cm²", () => {
  near(val(biga, "Tensió en el connector").value, 243.6430135, 1e-3);
  const sp = val(biga, "Tensió en la paret de càrrega de suport");
  near(sp.value, 16.32083333);
  assert.equal(sp.check.ok, true);
});

console.log("Pilar (Justificació Comprovació Recolzament Base Pilar Estintolament.xls)");
const pilar = computePilar({});
test("Lef ≈ 31,77 cm (cot 60° exact instead of 0,577)", () => near(val(pilar, "Longitud efectiva").value, 31.77, 2e-4));
test("σ ≈ 14,2923 kg/cm² < 16,3412 (OK)", () => {
  const r = val(pilar, "Tensió a la base");
  near(r.value, 14.29230931, 2e-4);
  near(r.check.limit, 16.34122973);
  assert.equal(r.check.ok, true);
});

console.log("Soldadures (Justificació Comprovació Compatibilitat Soldadures.xls)");
test("catalogue thicknesses: UPN 140 e 7 / e1 10 · IPN 140 e 5,7 / e1 8,6", () => {
  const u = perfilProps("UPN 140");
  const i = perfilProps("IPN 140");
  assert.deepEqual([u.tw, u.tf, i.tw, i.tf], [7, 10, 5.7, 8.6]);
});
test("weld table lookups used in the sheet", () => {
  const pick = (t) => {
    const r = soldaduraPer(t);
    return [r.aMax, r.aMin];
  };
  assert.deepEqual(pick(8.6), [6, 3.5]);
  assert.deepEqual(pick(10), [7, 4]);
  assert.deepEqual(pick(7), [4.5, 2.5]);
  assert.deepEqual(pick(5.7), [4, 2.5]);
  assert.equal(soldaduraPer(3.8), null);
  assert.equal(soldaduraPer(36.5), null);
});
test("UPN 140 + IPN 140: the four pairs of the sheet, all compatible", () => {
  const w = computeSoldadura({ perfil1: "UPN 140", perfil2: "IPN 140" }).sections.find((s) => s.welds).welds;
  const got = w.map((c) => [c.a.t, c.b.t, c.range]);
  assert.deepEqual(got, [
    [10, 8.6, [4, 6]],
    [10, 5.7, [4, 4]],
    [7, 8.6, [3.5, 4.5]],
    [7, 5.7, [2.5, 4]],
  ]);
  assert.ok(w.every((c) => c.ok));
});
test("incompatible and out-of-table pairs", () => {
  const w = computeSoldadura({ perfil1: "Xapa", gruix1: 4, perfil2: "HEB 300" }).sections.find((s) => s.welds).welds;
  assert.equal(w.length, 2);
  assert.equal(w[0].ok, false); // 4 mm plate (a ≤ 2,5) on a 19 mm flange (a ≥ 6)
  const o = computeSoldadura({ perfil1: "IPE 80", perfil2: "IPE 80" }).sections.find((s) => s.welds).welds;
  assert.equal(o.find((c) => c.a.t === 3.8 && c.b.t === 3.8).ok, false);
});

console.log("Catàleg");
test("every calculation profile has the values the checks need", () => {
  for (const f of FAMILIES.filter((f) => ["ipe", "ipn", "heb", "hea", "hem", "upn"].includes(f.key)))
    for (const r of f.rows) {
      const p = perfilProps(r.name);
      for (const k of ["h", "b", "tw", "tf", "h1", "A", "Ix", "Wx", "p"]) assert.ok(typeof p[k] === "number" && p[k] > 0, `${r.name}: ${k} = ${p[k]}`);
    }
});
test("every errata note points at an existing row and column", () => {
  for (const f of FAMILIES)
    for (const key of Object.keys(f.errata ?? {})) {
      const [row, col] = key.split("|");
      assert.ok(f.rows.some((r) => r.name === row), `${f.key}: no row ${row}`);
      assert.ok(col === "name" || f.columns.some((c) => c.key === col), `${f.key}: no column ${col}`);
    }
});
test("profile names are unique", () => {
  const seen = new Set();
  for (const f of FAMILIES) for (const r of f.rows) {
    assert.ok(!seen.has(r.name), `duplicate ${r.name}`);
    seen.add(r.name);
  }
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
