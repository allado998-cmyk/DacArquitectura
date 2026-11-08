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
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

register("./mcp-test-hooks.mjs", import.meta.url);

const { computeParet, paretPerfilsValids } = await import("../src/lib/calculs/paret.ts");
const { computeBiga } = await import("../src/lib/calculs/biga.ts");
const { computePilar } = await import("../src/lib/calculs/pilar.ts");
const { computeSoldadura } = await import("../src/lib/calculs/soldadura.ts");
const { verdict } = await import("../src/lib/calculs/common.ts");
const { perfilProps, soldaduraPer, FAMILIES } = await import("../src/lib/calculs/perfils.ts");
const { buildCalculHtml } = await import("../src/lib/calculs/report.ts");
const { AJUDA } = await import("../src/lib/calculs/ajuda.ts");

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
test("spread to one side only (end of the wall): Lef = a + p + c · cot 60° ≈ 28,89 cm", () => {
  const one = computePilar({ costats: "1" });
  const lef = val(one, "Longitud efectiva");
  near(lef.value, 6 + 20 + 5 / Math.tan(Math.PI / 3), 1e-9);
  assert.equal(lef.formula, "Lef = a + p + c · cos 60° / sin 60°");
  assert.equal(val(pilar, "Longitud efectiva").formula, "Lef = a + p + 2 · c · cos 60° / sin 60°");
  assert.equal(lef.hint, "CTE DB SE-F figura 5.7");
  assert.deepEqual(lef.aux, [AJUDA.figura57]);
  assert.ok(val(one, "Tensió a la base").value > val(pilar, "Tensió a la base").value, "a shorter Lef means more stress");
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

test("combinations left out don't count and keep their place when the profiles change", () => {
  const all = computeSoldadura({ perfil1: "UPN 140", perfil2: "IPN 140" });
  const some = computeSoldadura({ perfil1: "UPN 140", perfil2: "IPN 140", ocultes: ["ala|ànima", "ànima|ala"] });
  const w = some.sections.find((s) => s.welds).welds;
  assert.deepEqual(w.map((c) => [c.key, c.included]), [["ala|ala", true], ["ala|ànima", false], ["ànima|ala", false], ["ànima|ànima", true]]);
  assert.deepEqual([verdict(all).total, verdict(some).total], [4, 2]);
  const other = computeSoldadura({ perfil1: "UPN 200", perfil2: "IPN 200", ocultes: ["ala|ànima"] }).sections.find((s) => s.welds).welds;
  assert.equal(other.find((c) => c.key === "ala|ànima").included, false);
});
console.log("Gola soldadura (Gola_IPE270_encastada.xlsx / Gola_IPE270_articulada.xlsx)");
const gola = (r) => r.sections.find((s) => s.key === "gola");
const golaVal = (r, label, block) => val({ sections: [gola(r)] }, label, block).value;
test("encastada, IPE 270 on a UPN 280: every value of the sheet", () => {
  // Combinations kept as in the sheet: flange–flange and web–web.
  const r = computeSoldadura({ perfil1: "IPE 270", perfil2: "UPN 280", ocultes: ["ala|ànima", "ànima|ala"], unio: "encastada", factor: 9.81, vz: 6.306, my: 3.606, nx: 0.01 });
  const g = gola(r);
  assert.equal(g.title, "Gola de soldadura · Unió encastada");
  near(val({ sections: [g] }, "Esforç tallant").alt.value, 61.86186, 1e-6, "V");
  near(val({ sections: [g] }, "Moment flector").alt.value, 35.37486, 1e-6, "M");
  near(val({ sections: [g] }, "Axial").alt.value, 0.0981, 1e-6, "N");
  near(golaVal(r, "Resistència de càlcul"), 222.78928034611442, 1e-9, "fvw,d");
  assert.deepEqual(["Cantell", "Amplada", "Gruix de l'ànima", "Gruix de les ales", "Radi"].map((l) => golaVal(r, l)), [270, 135, 6.6, 10.2, 15]);
  near(golaVal(r, "Força a l'ala per moment"), 136.16189376443418, 1e-9, "F M");
  near(golaVal(r, "Força total"), 136.21094376443418, 1e-9, "F");
  assert.deepEqual([golaVal(r, "Longitud cordó exterior"), golaVal(r, "Longitud eficaç cordó interior"), golaVal(r, "Opció 1 · longitud total")], [135, 43, 221]);
  near(golaVal(r, "Opció 1 · gola per càlcul"), 2.7664666410284604, 1e-9, "a1");
  near(golaVal(r, "Opció 2 · gola per càlcul"), 4.5288083530910352, 1e-9, "a2");
  assert.deepEqual([golaVal(r, "Opció 1 · gola segons"), golaVal(r, "Opció 2 · gola segons")], [3, 5]);
  assert.equal(golaVal(r, "Longitud eficaç cordó ànima"), 210);
  near(golaVal(r, "Gola per càlcul", "Ànima (resisteix V)"), 0.66111862576296387, 1e-9, "a web");
  assert.equal(golaVal(r, "Gola segons càlcul", "Ànima (resisteix V)"), 3);
  assert.deepEqual(["Ales · gola mínima", "Ales · gola màxima", "Ànima · gola mínima", "Ànima · gola màxima"].map((l) => golaVal(r, l)), [5, 7, 4, 4.5]);
  const finals = g.blocks.at(-1).rows;
  assert.deepEqual(finals.map((x) => [x.value, x.check.ok]), [[5, true], [5, true], [4, true]]);
  assert.ok(g.figure.svg.includes("Unió a UPN 280") && g.figure.svg.includes("135 + 2 × 43 = 221 mm"));
});
test("articulada, IPE 270 on a 10 mm plate: M = 0 whatever was typed, and every value of the sheet", () => {
  const r = computeSoldadura({ perfil1: "IPE 270", perfil2: "Xapa", gruix2: 10, unio: "articulada", vz: 3.916, my: 5, nx: 0 });
  assert.equal(gola(r).title, "Gola de soldadura · Unió articulada");
  near(val({ sections: [gola(r)] }, "Esforç tallant").alt.value, 38.41596, 1e-6, "V");
  assert.equal(golaVal(r, "Moment flector"), 0);
  assert.equal(golaVal(r, "Força total"), 0);
  assert.deepEqual([golaVal(r, "Opció 1 · gola segons"), golaVal(r, "Opció 2 · gola segons")], [3, 3]);
  near(golaVal(r, "Gola per càlcul", "Ànima (resisteix V)"), 0.41055194076875456, 1e-9, "a web");
  assert.deepEqual(["Ales · gola mínima", "Ales · gola màxima", "Ànima · gola mínima", "Ànima · gola màxima"].map((l) => golaVal(r, l)), [4, 7, 4, 4.5]);
  assert.deepEqual(gola(r).blocks.at(-1).rows.map((x) => [x.value, x.check.ok]), [[4, true], [4, true], [4, true]]);
});
test("the throat to use fails when the calculation passes the maximum compatible", () => {
  const r = computeSoldadura({ perfil1: "IPE 270", perfil2: "UPN 280", ocultes: ["ala|ànima", "ànima|ala"], unio: "encastada", vz: 6.306, my: 6, nx: 0 });
  const [o1, o2] = gola(r).blocks.at(-1).rows;
  assert.ok(o2.value > 7 && o2.check.ok === false, `opció 2 = ${o2.value}`);
  assert.ok(o1.check.ok, `opció 1 = ${o1.value}`);
});
test("gola: IPN root radius is tw; geometry can be overridden; non-I profile 1 explains instead", () => {
  assert.equal(golaVal(computeSoldadura({ perfil1: "IPN 180", perfil2: "Xapa" }), "Radi"), 6.9);
  assert.equal(golaVal(computeSoldadura({ perfil1: "IPE 270", gb: 140 }), "Longitud cordó exterior"), 140);
  const u = gola(computeSoldadura({ perfil1: "UPN 140", perfil2: "IPN 140" }));
  assert.equal(u.figure, undefined);
  assert.match(u.blocks[0].rows[1].label, /perfil en I o H/);
});
test("the chosen joint type and the drawing are in the report", () => {
  const r = computeSoldadura({ perfil1: "IPE 270", perfil2: "UPN 280", unio: "articulada", vz: 3.916 });
  const html = buildCalculHtml({ tipus: "soldadura", num: "CE-26-002", data: "2026-11-07" }, r, { logo: "/logo.jpg" });
  assert.ok(html.includes("Gola de soldadura · Unió articulada"));
  assert.ok(html.includes("Justificació gola de soldadura i compatibilitat entre soldadures"));
  assert.ok(html.includes("<svg ") && html.includes("Opció 2 · només cordó exterior"));
  const word = buildCalculHtml({ tipus: "soldadura", num: "CE-26-002", data: "2026-11-07" }, r, { logo: "/logo.jpg", figures: { gola: "data:image/png;base64,AAA" } });
  assert.ok(word.includes('src="data:image/png;base64,AAA"') && !word.includes("<svg "));
});

console.log("Informe en castellà");
const { esKnown } = await import("../src/lib/calculs/i18n.ts");
const { CALC_TYPES } = await import("../src/lib/calculs/index.ts");
// Every text a calculation can print, across its options (each select option,
// each section toggle on and off, plates where a profile input allows them).
function reportTexts(t) {
  const texts = new Set();
  const add = (v) => { if (typeof v === "string" && v.trim()) texts.add(v.trim()); };
  const collect = (r) => {
    for (const s of r.sections) {
      add(s.title);
      for (const b of s.blocks) {
        add(b.title);
        for (const row of b.rows) {
          add(row.label); add(row.formula); add(row.unit); add(row.check?.unit); add(row.alt?.unit);
          if (typeof row.value === "string" && row.input?.type !== "profile") add(row.value);
          if (row.input?.type === "select") for (const o of row.input.options) add(o.label);
        }
      }
      for (const w of s.welds ?? []) { add(w.label); add(w.note); }
      for (const g of s.loads?.groups ?? []) {
        add(g.title); add(g.total?.label);
        for (const l of g.lines) { add(l.heading); add(l.line?.label); add(l.line?.qUnit); add(l.line?.widthUnit); add(l.param?.label); add(l.param?.unit); }
      }
      if (s.figure) { add(s.figure.alt); for (const m of s.figure.svg.matchAll(/<text[^>]*>([^<]+)<\/text>/g)) add(m[1].replace(/&amp;/g, "&")); }
    }
  };
  const base = t.defaults();
  const r0 = t.compute(base);
  const toggles = r0.sections.map((x) => x.toggle).filter(Boolean);
  const allOn = { ...base, ...Object.fromEntries(toggles.map((k) => [k, true])) };
  const variants = [base, allOn, ...toggles.map((k) => ({ ...allOn, [k]: false }))];
  for (const x of t.compute(allOn).sections) for (const b of x.blocks) for (const row of b.rows) {
    if (row.input?.type === "select") for (const o of row.input.options) variants.push({ ...allOn, [row.input.key]: o.value });
    if (row.input?.type === "profile" && row.input.allowPlate) variants.push({ ...allOn, [row.input.key]: "Xapa" });
  }
  for (const v of variants) collect(t.compute(v));
  for (const k of ["tab", "reportTitle", "fileTitle", "situacioLabel"]) add(t[k]);
  return texts;
}
test("every text a calculation can print has a Spanish version", () => {
  const missing = [];
  for (const t of CALC_TYPES) for (const x of reportTexts(t)) if (esKnown(x) == null) missing.push(`${t.tipus}: ${x}`);
  assert.deepEqual(missing, []);
});
test("the Spanish report: titles, rows, weld pairs, drawing and chrome", () => {
  const r = computeSoldadura({ perfil1: "IPE 270", perfil2: "UPN 280", unio: "articulada", vz: 3.916 });
  const html = buildCalculHtml({ tipus: "soldadura", num: "CE-26-002", data: "2026-11-07" }, r, { logo: "/logo.jpg" }, "es");
  for (const es of ["Justificación garganta de soldadura y compatibilidad entre soldaduras", "Datos generales", "Garganta de soldadura · Unión articulada",
    "IPE 270 · ala con UPN 280 · ala", "Unión a UPN 280", "Opción 1 · cordón perimetral", "Cara exterior del ala", "Resumen de las comprobaciones", "comprobaciones."])
    assert.ok(html.includes(es), es);
  for (const ca of ["Dades generals", "Resum de les comprovacions", "Gola de soldadura", " amb UPN", "Unió a "]) assert.ok(!html.includes(ca), ca);
  const paret = buildCalculHtml({ tipus: "paret", num: "CE-26-001", data: "2026-11-07" }, computeParet(paretInputs), { logo: "/logo.jpg" }, "es");
  for (const es of ["Justificación de cálculo de viga de apeo de muro de carga", "Estado de cargas ponderado", "TOTAL ESTADO DE CARGAS SOBRE EL PERFIL", "Forjado tipo 1"])
    assert.ok(paret.includes(es), es);
  // Catalan stays exactly as before
  assert.ok(buildCalculHtml({ tipus: "soldadura", num: "CE-26-002", data: "2026-11-07" }, r, { logo: "/logo.jpg" }).includes("Gola de soldadura · Unió articulada"));
});

test("no annex in any report", () => {
  const calcs = [["paret", computeParet({})], ["biga", computeBiga({})], ["pilar", computePilar({})], ["soldadura", computeSoldadura({})]];
  for (const [tipus, r] of calcs) {
    const html = buildCalculHtml({ tipus, num: "CE-26-001", referencia: "26-0001", data: "2026-11-07" }, r, { logo: "/logo.jpg" });
    assert.ok(html.includes("Resum de les comprovacions"), tipus);
    assert.equal(/annex/i.test(html), false, tipus);
  }
});
test("the masonry rows carry their CTE reference and help image, in all three wall calculations", () => {
  for (const r of [computeParet({}), computeBiga({}), computePilar({})]) {
    const k = val(r, "Constant de la fàbrica");
    assert.equal(k.hint, "CTE DB SE-F annex C");
    assert.deepEqual(k.aux, [AJUDA.annexC]);
    for (const label of ["Resistència normalitzada", "Resistència del morter"]) {
      assert.equal(val(r, label).hint, "CTE DB SE-F taula 4.4");
      assert.deepEqual(val(r, label).aux, [AJUDA.taula44]);
    }
    assert.deepEqual(val(r, "Coeficient parcial de seguretat").aux, [AJUDA.taula48]);
  }
});
test("every help image exists", () => {
  for (const img of Object.values(AJUDA)) assert.ok(existsSync(join(ROOT, "public", img.src)), img.src);
});

console.log("Paret · perfils que compleixen");
test("the picker's list agrees with the checks, and takes the self-weight of each profile", () => {
  const ok = paretPerfilsValids({});
  const passes = (perfil) => computeParet({ perfil }).sections.find((s) => s.key === "comprovacio").blocks.every((b) => b.rows.every((r) => !r.check || r.check.ok));
  assert.ok(ok.size > 0 && ok.size < 150, `${ok.size} pass`);
  for (const name of ["UPN 320", "UPN 200", "IPE 80", "IPE 600", "HEB 300", "HEM 1000"]) assert.equal(ok.has(name), passes(name), name);
  assert.equal(ok.has("IPE 80"), false);
});
test("more load means fewer profiles pass; checking them all stays quick", () => {
  const t0 = performance.now();
  const base = paretPerfilsValids({});
  const ms = performance.now() - t0;
  const heavy = paretPerfilsValids({ L: 4800 });
  assert.ok(heavy.size < base.size, `${heavy.size} vs ${base.size}`);
  for (const n of heavy) assert.ok(base.has(n), n);
  assert.ok(ms < 200, `${ms.toFixed(0)} ms`);
  console.log(`    ${base.size} profiles pass the example; with L = 4,8 m, ${heavy.size} (checked in ${ms.toFixed(0)} ms)`);
});

console.log("Catàleg");
test("every calculation profile has the values the checks need", () => {
  for (const f of FAMILIES.filter((f) => ["ipe", "ipn", "heb", "hea", "hem", "upn"].includes(f.key)))
    for (const r of f.rows) {
      const p = perfilProps(r.name);
      for (const k of ["h", "b", "tw", "tf", "h1", "A", "Ix", "Wx", "p"]) assert.ok(typeof p[k] === "number" && p[k] > 0, `${r.name}: ${k} = ${p[k]}`);
    }
});
test("every catalogue image exists, and L and LD each have their own", () => {
  for (const f of FAMILIES) assert.ok(existsSync(join(ROOT, "public", f.image)), `${f.key}: ${f.image}`);
  const img = (k) => FAMILIES.find((f) => f.key === k).image;
  assert.notEqual(img("l"), img("ld"));
});
test("ZF is the last profile table", () => assert.equal(FAMILIES.at(-1).key, "zf"));
test("profile names are unique", () => {
  const seen = new Set();
  for (const f of FAMILIES) for (const r of f.rows) {
    assert.ok(!seen.has(r.name), `duplicate ${r.name}`);
    seen.add(r.name);
  }
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
