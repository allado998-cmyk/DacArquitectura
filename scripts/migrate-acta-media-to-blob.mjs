#!/usr/bin/env node
// One-off: moves acta photos, PDFs and audios that are still stored inside the
// database as base64 data URIs to the private Blob store, and replaces each one
// with its /fitxers/ ref (see src/lib/fitxers-shared.ts). Run it after the code
// that reads refs is deployed.
//
//   node --env-file=.env.local scripts/migrate-acta-media-to-blob.mjs --db=demo|real
//        [--dry-run]          only count what would move
//        [--only=12,15]       just these actes
//        [--backup=DIR]       first save each acta's original lists to DIR/acta-<id>.json.gz
//        [--vacuum]           afterwards, give the freed space back (VACUUM FULL public.acta)
//
// Safe to re-run: actes with nothing left in base64 are skipped. An acta edited
// while its files were being copied is left as it was (its copies are deleted)
// and reported, so it can be retried.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { randomBytes } from "node:crypto";
import { neon, Pool, neonConfig } from "@neondatabase/serverless";
import { put, del } from "@vercel/blob";
import ws from "ws";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true]; }));
if (args.db !== "demo" && args.db !== "real") {
  console.error("Pass --db=demo or --db=real");
  process.exit(1);
}
const url = args.db === "real" ? process.env.DATABASE_URL : process.env.DEMO_DATABASE_URL;
const area = args.db === "real" ? "dac" : "demo";
if (!url || !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("DATABASE_URL / DEMO_DATABASE_URL and BLOB_READ_WRITE_TOKEN must be set");
  process.exit(1);
}
const sql = neon(url);
const dry = !!args["dry-run"];
const only = typeof args.only === "string" ? args.only.split(",").map(Number).filter(Number.isInteger) : null;

const DATA_URL = /^data:([\w.+/-]+)(?:;[^,;]*)*;base64,/;
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif", "application/pdf": "pdf" };
const isData = (s) => typeof s === "string" && s.startsWith("data:");
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

// Same rules as safeFileName in src/lib/fitxers-shared.ts.
function safeFileName(name, fallback) {
  const clean = (name ?? "").normalize("NFC").replace(/[\\/:*?"<>|#%{}^~[\]`\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().replace(/^\.+/, "");
  if (!clean) return fallback;
  if (clean.length <= 120) return clean;
  const ext = /\.[A-Za-z0-9]{1,8}$/.exec(clean)?.[0] ?? "";
  return clean.slice(0, 120 - ext.length) + ext;
}
const refFor = (pathname, bytes) => `/fitxers/${pathname.split("/").map(encodeURIComponent).join("/")}?mida=${bytes}`;

async function store(actaId, dataUrl, name, uploaded) {
  const m = DATA_URL.exec(dataUrl);
  if (!m) return dataUrl; // not a data URI we understand: leave it
  const bytes = Buffer.from(dataUrl.slice(m[0].length), "base64");
  const pathname = `${area}/actes/${actaId}/${randomBytes(9).toString("base64url")}/${safeFileName(name, `fitxer.${EXT[m[1]] ?? "bin"}`)}`;
  await put(pathname, bytes, { access: "private", contentType: m[1], addRandomSuffix: false });
  uploaded.push(pathname);
  return refFor(pathname, bytes.length);
}

const [{ size: sizeBefore }] = await sql`select pg_size_pretty(pg_total_relation_size('public.acta')) as size`;
const candidates = await sql`
  select id,
         (select count(*) from jsonb_array_elements_text(coalesce(fotografies,'[]'::jsonb)) f where f like 'data:%')::int as fotos,
         (select count(*) from jsonb_array_elements(coalesce(documents,'[]'::jsonb)) d where d->>'dataUrl' like 'data:%')::int as docs,
         (select count(*) from jsonb_array_elements(coalesce(audios,'[]'::jsonb)) a where a->>'dataUrl' like 'data:%')::int as audios,
         (coalesce(length(fotografies::text),0) + coalesce(length(documents::text),0) + coalesce(length(audios::text),0))::bigint as chars
  from public.acta
  where fotografies::text like '%"data:%' or documents::text like '%"data:%' or audios::text like '%"data:%'
  order by id`;
for (const c of candidates) c.id = Number(c.id);
const todo = only ? candidates.filter((c) => only.includes(c.id)) : candidates;
const totals = todo.reduce((t, c) => ({ fotos: t.fotos + c.fotos, docs: t.docs + c.docs, audios: t.audios + c.audios, bytes: t.bytes + Number(c.chars) * 0.75 }), { fotos: 0, docs: 0, audios: 0, bytes: 0 });
console.log(`${args.db} database, area "${area}/": table acta is ${sizeBefore}`);
console.log(`${todo.length} actes to move: ${totals.fotos} photos, ${totals.docs} PDFs, ${totals.audios} audios, about ${mb(totals.bytes)} of files`);
if (dry || !todo.length) process.exit(0);

if (args.backup) await mkdir(args.backup, { recursive: true });
let moved = 0, skipped = 0;
for (const [i, c] of todo.entries()) {
  const [row] = await sql`select id, updated_at::text as updated_at, fotografies, documents, audios from public.acta where id = ${c.id}`;
  if (!row) continue;
  if (args.backup) {
    await writeFile(join(args.backup, `acta-${row.id}.json.gz`), gzipSync(JSON.stringify({ id: row.id, fotografies: row.fotografies, documents: row.documents, audios: row.audios })));
  }
  const uploaded = [];
  try {
    const fotografies = [];
    for (const f of row.fotografies ?? []) fotografies.push(isData(f) ? await store(row.id, f, `foto.${EXT[DATA_URL.exec(f)?.[1]] ?? "jpg"}`, uploaded) : f);
    const documents = [];
    for (const d of row.documents ?? []) documents.push(isData(d?.dataUrl) ? { ...d, dataUrl: await store(row.id, d.dataUrl, d.name, uploaded) } : d);
    const audios = [];
    for (const a of row.audios ?? []) audios.push(isData(a?.dataUrl) ? { ...a, dataUrl: await store(row.id, a.dataUrl, a.name, uploaded) } : a);
    const updated = await sql`
      update public.acta
         set fotografies = ${JSON.stringify(fotografies)}::jsonb, documents = ${JSON.stringify(documents)}::jsonb, audios = ${JSON.stringify(audios)}::jsonb
       where id = ${row.id} and updated_at::text = ${row.updated_at}
      returning id`;
    if (!updated.length) {
      await del(uploaded);
      skipped++;
      console.log(`  acta ${row.id}: changed while copying, left as it was (retry later)`);
      continue;
    }
    moved++;
    console.log(`  [${i + 1}/${todo.length}] acta ${row.id}: ${uploaded.length} files moved`);
  } catch (e) {
    if (uploaded.length) await del(uploaded).catch(() => {});
    skipped++;
    console.log(`  acta ${row.id}: failed (${e instanceof Error ? e.message : e}), left as it was`);
  }
}
console.log(`done: ${moved} actes moved, ${skipped} left as they were`);

if (args.vacuum) {
  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: url });
  console.log("VACUUM FULL public.acta …");
  await pool.query("vacuum (full, analyze) public.acta");
  await pool.end();
}
const [{ size: sizeAfter }] = await sql`select pg_size_pretty(pg_total_relation_size('public.acta')) as size`;
console.log(`table acta: ${sizeBefore} → ${sizeAfter}`);
