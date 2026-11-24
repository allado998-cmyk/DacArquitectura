#!/usr/bin/env node
// Runs the Descàrregues generator (src/lib/descarregues/generar.ts) on the
// database of .env.local, but writes into a local folder instead of the file
// store: to look at the PDFs after changing a list, without touching the
// files the app serves.
//
//   node --env-file=.env.local scripts/descarregues.mjs [folder] [--demo]
//
// --demo reads DEMO_DATABASE_URL (the demo account's fake data). The folder
// (by default dac-descarregues in the system temp folder) gets the same layout
// as the store: <area>/descarregues/index.json and <area>/descarregues/<run>/…
// A second run replaces the first one's folder, as in the store.
import { register } from "node:module";
import { createReadStream } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";

register("./mcp-test-hooks.mjs", import.meta.url);

const demo = process.argv.includes("--demo");
const OUT = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? join(tmpdir(), "dac-descarregues");
const url = demo ? process.env.DEMO_DATABASE_URL : process.env.DATABASE_URL;
if (!url) {
  console.error(`Falta ${demo ? "DEMO_DATABASE_URL" : "DATABASE_URL"} (node --env-file=.env.local …).`);
  process.exit(1);
}

// The real database behind the scripts' sql stub (ids as numbers, as src/lib/db.ts does).
const { neon, types } = await import("@neondatabase/serverless");
types.setTypeParser(20, (v) => parseInt(v, 10));
const client = neon(url);
globalThis.__fakeSql = (text, params) => client.query(text, params);

// The file store, as a folder.
const file = (pathname) => join(OUT, ...pathname.split("/"));
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}
globalThis.__fakeBlob = {
  async put(pathname, body) {
    await mkdir(dirname(file(pathname)), { recursive: true });
    await writeFile(file(pathname), body);
    return { pathname };
  },
  async get(pathname) {
    const s = await stat(file(pathname)).catch(() => null);
    if (!s) return null;
    return { statusCode: 200, stream: Readable.toWeb(createReadStream(file(pathname))), blob: { pathname, size: s.size, uploadedAt: s.mtime } };
  },
  async list({ prefix }) {
    const blobs = (await walk(OUT))
      .map((p) => relative(OUT, p).split(sep).join("/"))
      .filter((p) => p.startsWith(prefix))
      .map((pathname) => ({ pathname }));
    return { blobs, hasMore: false };
  },
  async del(pathnames) {
    for (const p of [].concat(pathnames)) await rm(file(p), { force: true });
  },
};

const { runAsActingUser } = await import(pathToFileURL(join(import.meta.dirname, "../src/lib/acting-user.ts")).href);
const { generarDescarregues } = await import(pathToFileURL(join(import.meta.dirname, "../src/lib/descarregues/generar.ts")).href);

const r = await runAsActingUser(demo ? "demo" : "adri", () => generarDescarregues());
console.log(`${r.pdfs} PDF (${(r.bytes / 1024).toFixed(0)} KB) i el zip (${(r.zipBytes / 1024).toFixed(0)} KB) en ${r.ms} ms`);
console.log(`→ ${join(OUT, r.area, "descarregues", r.carpeta)}${r.esborrats ? ` (esborrats ${r.esborrats} fitxers de la generació anterior)` : ""}`);
