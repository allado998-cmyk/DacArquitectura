#!/usr/bin/env node
// The portal's form against ours. Reads the JSON dumps that
// scripts/portal-inventari.js makes at the portal (one per section, kept in
// ite-proves/inventari/, git-ignored because they carry the report's values)
// and compares them with the app's fields (src/lib/ite/schema.ts) and code
// lists (cataleg-base.json): fields the portal has and we lack, labels that
// differ, dropdown options we do not know, and the portal's validation
// messages («Validar informe»). Typed values are never written to the report.
//
//   node scripts/ite-inventari.mjs [ite-proves/inventari] [--out docs/ite-inventari.md]
import { register } from "node:module";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

register("./mcp-test-hooks.mjs", import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (p) => import(pathToFileURL(join(ROOT, "src/lib/ite", p)).href);
const schema = await load("schema.ts");
const cat = await load("cataleg.ts");

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outPath = outIdx >= 0 ? args[outIdx + 1] : join(ROOT, "docs", "ite-inventari.md");
const folder = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--out") ?? join(ROOT, "ite-proves", "inventari");

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\*/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const guessName = (c) => ((c.id || c.name || "").split(":").pop() || "").replace(/_(input|hinput|focus)$/, "");

// The dumps: one row per control across pages (same id + label = same control).
const files = (await readdir(folder).catch(() => [])).filter((f) => /^ite-portal-.*\.json$/i.test(f)).sort();
if (!files.length) {
  console.error(`No ite-portal-*.json in ${folder}. Run scripts/portal-inventari.js at the portal first (docs/ite.md).`);
  process.exit(1);
}
const pages = [];
for (const f of files) pages.push({ file: f, ...JSON.parse(await readFile(join(folder, f), "utf8")) });
const portal = new Map();
for (const p of pages) {
  for (const c of p.controls ?? []) {
    const key = `${c.id || c.name}|${norm(c.etiqueta)}`;
    const row = portal.get(key) ?? { ...c, valor: undefined, valor_html: undefined, pagines: new Set() };
    row.pagines.add(p.titol);
    if (c.error) row.error = true;
    if (c.obligatori) row.obligatori = true;
    if (c.opcions && (!row.opcions || c.opcions.length > row.opcions.length)) row.opcions = c.opcions;
    portal.set(key, row);
  }
}

// Ours.
const seccioDe = new Map();
for (const s of schema.SECTIONS) for (const g of s.groups) for (const f of g.fields) seccioDe.set(f.path, `${s.title} · ${g.title}`);
const ours = schema.ALL_FIELDS.map((f) => ({ f, last: f.path.split(".").pop().toLowerCase(), label: norm(f.label) }));
const byLast = new Map();
const byLabel = new Map();
for (const o of ours) {
  byLast.set(o.last, [...(byLast.get(o.last) ?? []), o]);
  if (o.label) byLabel.set(o.label, [...(byLabel.get(o.label) ?? []), o]);
}
const cataleg = cat.buildCataleg();

// Match: by the field name inside the JSF id, then by label, then roughly.
const matched = new Map();
const used = new Set();
for (const [key, c] of portal) {
  if (c.tipus === "file") continue;
  const g = guessName(c).toLowerCase();
  const l = norm(c.etiqueta);
  // Only unambiguous matches: "Observacions" is in every section.
  const byName = byLast.get(g) ?? [];
  let o = byName.length === 1 ? byName[0] : byName.find((x) => x.label === l);
  let how = o ? "nom" : "";
  if (!o && l) {
    const same = byLabel.get(l) ?? [];
    o = same.length === 1 ? same[0] : undefined;
    how = o ? "etiqueta" : "";
  }
  if (!o && l.length > 10) {
    const near = ours.filter((x) => x.label.length > 10 && (x.label.includes(l) || l.includes(x.label)));
    o = near.length === 1 ? near[0] : undefined;
    how = o ? "aprox" : "";
  }
  if (o) {
    matched.set(key, { o, how });
    used.add(o.f.path);
  }
}

const L = [];
const h = (t) => L.push("", `## ${t}`, "");
L.push("# Formulari del portal ITE contra el de l'app", "", `Generat per \`scripts/ite-inventari.mjs\` el ${new Date().toISOString().slice(0, 10)} a partir de ${pages.length} pàgines: ${pages.map((p) => `«${p.titol}»`).join(", ")}.`);
L.push("", "Sense cap valor del formulari: només etiquetes, tipus, opcions i missatges.");

h("Resum");
const hows = [...matched.values()].reduce((a, m) => ((a[m.how] = (a[m.how] ?? 0) + 1), a), {});
L.push(`- Controls del portal: ${portal.size} (${[...portal.values()].filter((c) => c.opcions).length} amb opcions).`);
L.push(`- Coincideixen amb un camp de l'app: ${matched.size} (pel nom del camp ${hows.nom ?? 0}, per l'etiqueta ${hows.etiqueta ?? 0}, aproximats ${hows.aprox ?? 0}).`);
const nFile = [...portal.values()].filter((c) => c.tipus === "file").length;
L.push(`- Només al portal: ${portal.size - matched.size - nFile}${nFile ? ` (i ${nFile} de pujar fitxers)` : ""}. Només a l'app (no vistos en cap pàgina): ${ours.length - used.size} de ${ours.length}.`);

h("Missatges de validació («Validar informe»)");
let anyMsg = false;
for (const p of pages) {
  if (!p.missatges?.length) continue;
  anyMsg = true;
  L.push(`**${p.titol}**`, "");
  for (const m of p.missatges) L.push(`- ${m}`);
  L.push("");
}
const flagged = [...portal.entries()].filter(([, c]) => c.error);
if (flagged.length) {
  L.push("Camps marcats en error pel portal → candidats a obligatoris a l'app:", "");
  for (const [key, c] of flagged) {
    const m = matched.get(key);
    L.push(`- ${c.etiqueta || c.name} (${c.tipus})${m ? ` → \`${m.o.f.path}\`${m.o.f.required ? " (ja obligatori)" : " **→ required: true**"}` : " → sense camp a l'app"}`);
  }
}
if (!anyMsg && !flagged.length) L.push("Cap. Prem «Validar informe» al portal i torna a fer l'inventari de la pàgina on surten els avisos.");

h("Pujada de fotos");
const fileInputs = [...portal.values()].filter((c) => c.tipus === "file");
for (const c of fileInputs) {
  L.push(`- ${c.etiqueta || c.name || "(sense etiqueta)"} (${[...c.pagines].join(", ")}): ${c.multiple ? "**deixa triar diversos fitxers de cop**" : "un fitxer per vegada"}${c.accept ? `, accepta ${c.accept}` : ""}.`);
}
if (!fileInputs.length) L.push("Cap camp de fitxer a les pàgines inventariades. Si el portal obre la pujada en una finestra a part, fes-ne l'inventari amb la finestra oberta.");

h("Camps del portal que l'app no té");
const onlyPortal = [...portal.entries()].filter(([key, c]) => !matched.has(key) && c.tipus !== "file");
const byPage = new Map();
for (const [, c] of onlyPortal) {
  const pg = [...c.pagines][0];
  byPage.set(pg, [...(byPage.get(pg) ?? []), c]);
}
for (const [pg, cs] of byPage) {
  L.push(`**${pg}**`, "");
  let grup = null;
  for (const c of cs) {
    if (c.grup !== grup) {
      grup = c.grup;
      L.push(`- _${grup || "(sense grup)"}_`);
    }
    const extra = [c.opcions && `${c.opcions.length} opcions`, c.obligatori && "obligatori", c.autocomplete && "autocompletar", c.calendari && "calendari", c.visible === false && "ocult", c.desactivat && "desactivat"].filter(Boolean).join(", ");
    L.push(`  - ${c.etiqueta || "(sense etiqueta)"} — ${c.tipus}${extra ? ` (${extra})` : ""} \`${c.id || c.name}\``);
    if (c.opcions && c.opcions.length <= 12) L.push(`    - ${c.opcions.map((o) => `${o.valor || "∅"} = ${o.text}`).join(" · ")}`);
  }
  L.push("");
}
if (!onlyPortal.length) L.push("Cap.");

h("Etiquetes que no coincideixen");
let anyLabel = false;
for (const [, { o }] of matched) {
  const c = [...portal.values()].find((x) => matched.get(`${x.id || x.name}|${norm(x.etiqueta)}`)?.o === o);
  if (!c || !c.etiqueta || norm(c.etiqueta) === o.label) continue;
  anyLabel = true;
  L.push(`- \`${o.f.path}\`: app «${o.f.label}» ↔ portal «${c.etiqueta}»`);
}
if (!anyLabel) L.push("Cap.");

h("Llistes desplegables: opcions del portal que l'app no coneix");
let anyList = false;
for (const [key, { o }] of matched) {
  const c = portal.get(key);
  if (!c?.opcions) continue;
  const options = c.opcions.filter((x) => x.valor !== "" && norm(x.text) && !/^(selecciona|tria|seleccione)/.test(norm(x.text)));
  if (o.f.kind === "cat") {
    const ours = cataleg[o.f.cat ?? ""] ?? [];
    const ids = new Set(ours.map((e) => String(cat.catId(e))));
    const labels = new Set(ours.map((e) => norm(cat.catLabel(e))));
    const missing = options.filter((x) => !ids.has(String(x.valor)) && !labels.has(norm(x.text)));
    const sameIds = options.filter((x) => ids.has(String(x.valor))).length;
    anyList = true;
    L.push(`- \`${o.f.path}\` (llista \`${o.f.cat}\`): app ${ours.length}, portal ${options.length}, ${sameIds} amb el mateix id que el portal${missing.length ? `, **en falten ${missing.length}**:` : "."}`);
    for (const x of missing.slice(0, 80)) L.push(`  - ${x.valor} — ${x.text}`);
    if (missing.length > 80) L.push(`  - … i ${missing.length - 80} més`);
  } else if (o.f.kind === "radio" || o.f.kind === "tri") {
    const mine = (o.f.kind === "tri" ? schema.TRI_OPTIONS : o.f.options ?? []).map((x) => norm(x.label));
    const diff = options.filter((x) => !mine.includes(norm(x.text)));
    if (diff.length) {
      anyList = true;
      L.push(`- \`${o.f.path}\`: opcions del portal que no diem igual: ${diff.map((x) => `${x.valor} = «${x.text}»`).join(", ")} (app: ${(o.f.kind === "tri" ? schema.TRI_OPTIONS : o.f.options ?? []).map((x) => `«${x.label}»`).join(", ")})`);
    }
  }
}
if (!anyList) L.push("Cap llista coincident amb opcions a les pàgines inventariades.");

h("Camps de l'app no vistos en cap pàgina");
const notSeen = ours.filter((o) => !used.has(o.f.path));
const bySec = new Map();
for (const o of notSeen) bySec.set(seccioDe.get(o.f.path), [...(bySec.get(seccioDe.get(o.f.path)) ?? []), o]);
for (const [sec, os] of bySec) L.push(`- **${sec}** (${os.length}): ${os.map((o) => o.f.label).join(" · ")}`);
L.push("", "Poden ser pàgines encara no inventariades, camps que el portal amaga fins que es respon una pregunta, o camps que al portal es diuen d'una altra manera.");

await writeFile(outPath, L.join("\n") + "\n");
console.log(`${outPath}: ${portal.size} controls del portal, ${matched.size} coincideixen, ${onlyPortal.length} només al portal, ${notSeen.length} només a l'app.`);
