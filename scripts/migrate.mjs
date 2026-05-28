#!/usr/bin/env node
// Apply every db/migrations/*.sql file in order against $DATABASE_URL.
// Uses the WebSocket Pool client because the HTTP `neon()` client only
// accepts single statements per call, and our migration files contain
// multiple statements.

import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "db", "migrations");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

await pool.query(`
  create table if not exists public._migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )
`);

const files = (await readdir(MIGRATIONS_DIR))
  .filter((f) => f.endsWith(".sql"))
  .sort();

const appliedRes = await pool.query("select name from public._migrations");
const applied = new Set(appliedRes.rows.map((r) => r.name));

for (const file of files) {
  if (applied.has(file)) {
    console.log(`✓ already applied: ${file}`);
    continue;
  }
  const body = await readFile(join(MIGRATIONS_DIR, file), "utf8");
  process.stdout.write(`→ applying ${file} ... `);
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(body);
    await client.query("insert into public._migrations (name) values ($1)", [file]);
    await client.query("commit");
    console.log("ok");
  } catch (err) {
    await client.query("rollback").catch(() => {});
    console.error("\nFAILED");
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
  }
}

await pool.end();
console.log("done.");
