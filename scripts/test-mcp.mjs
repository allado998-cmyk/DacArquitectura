#!/usr/bin/env node
// Unit tests for the ChatGPT / Claude plugin. No database, network or server:
// Next.js and the database are stubbed by scripts/mcp-test-hooks.mjs, and the
// router is mounted on a real MCP server behind mcp-handler's HTTP handler.
//
//   node scripts/test-mcp.mjs
import { register } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

register("./mcp-test-hooks.mjs", import.meta.url);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0;
const failures = [];
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  ✗ ${name}\n    ${e?.stack ?? e}`);
  }
}

// --- fake database -----------------------------------------------------------
// Pattern-matches the SQL the tools send and records the writes.
const db = { writes: [], usage: new Map(), nextId: 100 };
const EXPEDIENT = {
  id: 7, num_expedient: "26-0007", projecte: "Casa Vila", client_id: 3, client_nom: "Promocions Vila SL", ciutat: "Girona",
  estat: "obert", categoria: "re", tipologia_id: null, tipologia_nom: null, tipus: "privat", direccio_obres: true, web: false,
  pressupost: "12000.00", pressupost_origen: "manual", calcul_id: null, proposta_doc_id: null, data_inici: "2026-09-01", data_final: "2026-12-20",
  data_tancament: null, created_at: "2026-09-01", updated_at: "2026-09-01",
};
globalThis.__fakeSql = async (text, params) => {
  const q = text.replace(/\s+/g, " ").trim().toLowerCase();
  if (q.startsWith("insert into public.mcp_usage") && q.includes("returning id")) {
    // values (usuari, client_id, 'dac_change', action, key, 'pending'): 4 bound params
    const [usuari, , action, key] = params;
    const k = `${usuari}:${key}`;
    if (db.usage.has(k)) return [];
    const row = { id: db.nextId++, action, status: "pending", result: null };
    db.usage.set(k, row);
    return [{ id: row.id }];
  }
  if (q.startsWith("insert into public.mcp_usage")) return [];
  if (q.startsWith("select action, status, result from public.mcp_usage")) {
    const row = db.usage.get(`${params[0]}:${params[1]}`);
    return row ? [row] : [];
  }
  if (q.startsWith("update public.mcp_usage set status")) {
    for (const row of db.usage.values()) if (row.id === params[2]) Object.assign(row, { status: params[0], result: JSON.parse(params[1]) });
    return [];
  }
  if (q.startsWith("delete from public.mcp_usage")) return [];
  if (/^(insert|update|delete)\b/.test(q)) {
    db.writes.push({ text: q, params });
    return [];
  }
  if (q.includes("match_expedients:number")) return params[0] === 7 && (params[1] === null || params[1] === "26") ? [EXPEDIENT] : [];
  if (q.includes("match_expedients:text")) return params.every((w) => /casa|vila|girona/i.test(w)) ? [EXPEDIENT] : [];
  if (q.includes("from public.expedients e") && q.includes("where e.id = $1")) return params[0] === 7 ? [EXPEDIENT] : [];
  if (q.includes("from public.expedients e") && q.includes("where e.num_expedient = $1")) return params[0] === "26-0007" ? [EXPEDIENT] : [];
  if (q.includes("from public.expedients e")) return [{ ...EXPEDIENT, hores: "12.5" }];
  if (q.startsWith("select id, nom from public.tasca")) return [{ id: 1, nom: "Visita direcció d'obres" }, { id: 2, nom: "Projecte" }];
  if (q.startsWith("select max(id)::int as id from public.dedicacions")) return [{ id: 55 }];
  if (q.includes("from public.dedicacions d") && q.includes("where d.id = $1")) {
    return [{ id: 55, expedient_id: 7, activitat: null, num_expedient: "26-0007", projecte: "Casa Vila", client_nom: "Promocions Vila SL", data: "2026-10-10", hores: "2", tasca: "Visita direcció d'obres", comentari: null }];
  }
  return [];
};

// --- modules -----------------------------------------------------------------
const oauth = await import("../src/lib/mcp/oauth-core.ts");
const core = await import("../src/lib/mcp/core.ts");
const shared = await import("../src/lib/mcp/shared.ts");
const mcp = await import("../src/lib/mcp/index.ts");
const { createMcpHandler } = await import("mcp-handler");

console.log("oauth-core");
await test("PKCE S256 matches its own challenge and rejects others", () => {
  const verifier = "a".repeat(43);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  assert.equal(oauth.pkceMatches(verifier, challenge), true);
  assert.equal(oauth.pkceMatches("b".repeat(43), challenge), false);
  assert.equal(oauth.pkceMatches("short", challenge), false);
});
await test("redirect URIs: https ok, http only on loopback, no fragments", () => {
  assert.equal(oauth.isAllowedRedirectUri("https://chatgpt.com/connector_platform_oauth_redirect"), true);
  assert.equal(oauth.isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback"), true);
  assert.equal(oauth.isAllowedRedirectUri("http://localhost:6274/oauth/callback"), true);
  assert.equal(oauth.isAllowedRedirectUri("http://127.0.0.1:3333/cb"), true);
  assert.equal(oauth.isAllowedRedirectUri("http://evil.example/cb"), false);
  assert.equal(oauth.isAllowedRedirectUri("https://ok.example/cb#frag"), false);
  assert.equal(oauth.isAllowedRedirectUri("javascript:alert(1)"), false);
  assert.equal(oauth.isAllowedRedirectUri("not a url"), false);
});
await test("client metadata validation", () => {
  assert.equal(oauth.validateClientMetadata({ redirect_uris: ["https://a.example/cb"], client_name: " ChatGPT " }).ok, true);
  assert.equal(oauth.validateClientMetadata({ redirect_uris: [] }).ok, false);
  assert.equal(oauth.validateClientMetadata({ redirect_uris: ["http://a.example/cb"] }).ok, false);
  // Requested auth methods and grant types are overridden, not rejected.
  assert.equal(oauth.validateClientMetadata({ redirect_uris: ["https://a.example/cb"], token_endpoint_auth_method: "client_secret_post", grant_types: ["authorization_code", "refresh_token", "client_credentials"] }).ok, true);
  assert.equal(oauth.validateClientMetadata({ redirect_uris: ["https://a.example/cb", "javascript:x"] }).ok, false);
});
await test("CIMD client ids are https URLs with a path", () => {
  assert.equal(oauth.isCimdClientId("https://claude.ai/.well-known/oauth-client"), true);
  assert.equal(oauth.isCimdClientId("https://example.com/"), false);
  assert.equal(oauth.isCimdClientId("dac_abc"), false);
});
await test("discovery documents point at the same origin", () => {
  const as = oauth.authorizationServerMetadata("https://dac.example");
  assert.equal(as.issuer, "https://dac.example");
  assert.equal(as.token_endpoint, "https://dac.example/oauth/token");
  assert.deepEqual(as.code_challenge_methods_supported, ["S256"]);
  assert.equal(as.client_id_metadata_document_supported, true);
  const pr = oauth.protectedResourceMetadata("https://dac.example");
  assert.equal(pr.resource, "https://dac.example/api/mcp");
  assert.deepEqual(pr.authorization_servers, ["https://dac.example"]);
});
await test("public origin honours proxy headers and APP_URL", () => {
  const req = new Request("http://localhost:3000/api/mcp", { headers: { "x-forwarded-host": "dac.example", "x-forwarded-proto": "https" } });
  assert.equal(oauth.publicOrigin(req), "https://dac.example");
  assert.equal(oauth.publicOrigin(new Request("http://localhost:3000/x", { headers: { host: "localhost:3000" } })), "http://localhost:3000");
  process.env.APP_URL = "https://fixed.example/";
  assert.equal(oauth.publicOrigin(req), "https://fixed.example");
  delete process.env.APP_URL;
});
await test("client kind from user agent", () => {
  assert.equal(oauth.clientKindFromUserAgent("openai-mcp/1.0"), "chatgpt");
  assert.equal(oauth.clientKindFromUserAgent("Claude-User"), "claude");
  assert.equal(oauth.clientKindFromUserAgent("curl/8"), "other");
});

console.log("registry");
await test("actions registered with unique names and valid JSON Schemas", () => {
  const all = core.listActions();
  assert.ok(all.length >= 40, `only ${all.length} actions`);
  assert.equal(new Set(all.map((a) => a.name)).size, all.length);
  for (const a of all) {
    const d = core.actionDetail(a.name);
    assert.equal(d.args_schema.type, "object", a.name);
    assert.ok(a.description.length > 10, a.name);
  }
  const menu = core.actionMenu();
  for (const dom of ["expedients", "dedicacio", "planificacio", "clients", "facturacio", "propostes", "honoraris", "actes", "notes"]) assert.ok(menu[dom], dom);
});
await test("every change action declares plan and commit; deletes are marked destructive", () => {
  for (const a of core.listActions("change")) {
    assert.equal(typeof a.plan, "function", a.name);
    assert.equal(typeof a.commit, "function", a.name);
    if (a.name.startsWith("delete_")) assert.equal(a.destructive, true, a.name);
  }
});

await test("results keep codes with leading zeros and turn amounts into numbers", () => {
  const out = JSON.parse(JSON.stringify({ acta_num: "04", codi_postal: "08001", telefon: "600123123", pressupost: "12000.00", total: "488.0444444444444444", hores: "2.5", n: "0", odd: "007" }, core.jsonReplacer));
  assert.deepEqual(out, { acta_num: "04", codi_postal: "08001", telefon: "600123123", pressupost: 12000, total: 488.0444, hores: 2.5, n: 0, odd: "007" });
});

console.log("acta-plan");
const plan = await import("../src/lib/mcp/acta-plan.ts");
const people = ["David Lladó (DL)", "Joan March (JM)", "Marta Puig", "Marc Pujol (MPJ)"];
await test("responsables resolve by exact name, initials and partial name", () => {
  assert.deepEqual(plan.resolvePerson("david llado (dl)", people), { match: "exact", value: "David Lladó (DL)" });
  assert.deepEqual(plan.resolvePerson("DL", people), { match: "initials", value: "David Lladó (DL)" });
  assert.deepEqual(plan.resolvePerson("jm", people), { match: "initials", value: "Joan March (JM)" });
  assert.deepEqual(plan.resolvePerson("MP", people), { match: "initials", value: "Marta Puig" });
  assert.deepEqual(plan.resolvePerson("Joan", people), { match: "partial", value: "Joan March (JM)" });
  assert.equal(plan.resolvePerson("Mar", people).match, "ambiguous");
  assert.deepEqual(plan.resolvePerson("Constructora Riu", people), { match: "none", value: "Constructora Riu" });
});
await test("buildTema keeps unchanged fields, resolves responsables and maps categories", () => {
  const notes = { errors: [], warnings: [] };
  const base = { titol: "Fonaments", text: "Revisar armat", responsable: "David Lladó (DL)", estat: "fet" };
  const t = plan.buildTema(base, { responsables: ["JM", "Constructora"] }, people, "Tema 0", notes);
  assert.equal(t.titol, "Fonaments");
  assert.equal(t.text, "Revisar armat");
  assert.equal(t.estat, "executat");
  assert.deepEqual(t.responsables, ["Joan March (JM)", "Constructora"]);
  assert.equal(t.responsable, "Joan March (JM) & Constructora");
  assert.equal(notes.warnings.length, 1);
  const fresh = plan.buildTema(null, { text: "Nou" }, people, "x", notes);
  assert.equal(fresh.estat, "pendent");
});
await test("list edits: modify and remove by original index, then append", () => {
  const notes = { errors: [], warnings: [] };
  const r = plan.applyListOps(["a", "b", "c", "d"], { modify: [{ index: 2, v: "C" }], remove: [0, 3], add: ["e"] }, (cur, p) => p.v, "L", notes);
  assert.deepEqual(r.list, ["b", "C", "e"]);
  assert.equal(notes.errors.length, 0);
  const bad = { errors: [], warnings: [] };
  plan.applyListOps(["a"], { modify: [{ index: 5, v: "x" }], remove: [0] }, (c, p) => p.v, "L", bad);
  assert.equal(bad.errors.length, 1);
  const mixed = { errors: [], warnings: [] };
  plan.applyListOps(["a"], { replace: ["z"], add: ["y"] }, (c) => c, "L", mixed);
  assert.equal(mixed.errors.length, 1);
  assert.deepEqual(plan.applyListOps(["a"], {}, (c) => c, "L", mixed), { list: ["a"], touched: false });
});
await test("motius and categories come from the document generator", () => {
  assert.deepEqual(plan.MOTIUS, ["visita", "reunio", "coordinacio", "altres"]);
  assert.deepEqual(plan.CATEGORIES, ["pendent", "executat", "tractat"]);
});

console.log("media");
const media = await import("../src/lib/mcp/media.ts");
await test("file types are read from their first bytes", () => {
  const b = (...xs) => { const out = new Uint8Array(16); xs.forEach((x, i) => (out[i] = typeof x === "string" ? x.charCodeAt(0) : x)); return out; };
  const str = (s, pad = 16) => { const out = new Uint8Array(pad); [...s].forEach((c, i) => (out[i] = c.charCodeAt(0))); return out; };
  assert.equal(media.sniff(b(0xff, 0xd8, 0xff, 0xe0)).mime, "image/jpeg");
  assert.equal(media.sniff(b(0x89, "P", "N", "G")).kind, "foto");
  assert.equal(media.sniff(str("%PDF-1.7")).kind, "document");
  assert.equal(media.sniff(str("OggS")).kind, "audio");
  assert.equal(media.sniff(str("ID3")).mime, "audio/mpeg");
  assert.equal(media.sniff(str("RIFF....WEBP")).kind, "foto");
  assert.equal(media.sniff(str("RIFF....WAVE")).kind, "audio");
  assert.equal(media.sniff(str("....ftypheic")).mime, "image/heic");
  assert.equal(media.sniff(str("....ftypM4A ")).kind, "audio");
  assert.equal(media.sniff(str("<html><body>")), null);
});
await test("private and loopback addresses are refused", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.107", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
    assert.equal(media.isPrivateAddress(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "140.82.112.3", "2606:4700::1111"]) assert.equal(media.isPrivateAddress(ip), false, ip);
});
await test("downloads refuse non-https, IP literals and local hosts", async () => {
  for (const url of ["http://example.com/a.jpg", "https://127.0.0.1/a.jpg", "https://localhost/a.jpg", "https://user:pw@example.com/a.jpg", "https://example.com:8443/a.jpg", "not a url"]) {
    await assert.rejects(media.downloadPublic(url), undefined, url);
  }
});

console.log("shared");
await test("guard takes the user only from the verified token", () => {
  assert.deepEqual(shared.guard({ http: { authInfo: { token: "t", clientId: "c1", scopes: [], extra: { usuari: "demo" } } } }), { user: "demo", clientId: "c1" });
  assert.throws(() => shared.guard({ http: { authInfo: { token: "t", clientId: "c1", scopes: [], extra: { usuari: "root" } } } }), shared.GuardError);
  assert.throws(() => shared.guard({}), shared.GuardError);
});
await test("callAction turns redirect() into the target URL", async () => {
  const { redirect } = await import("next/navigation");
  const r = await shared.callAction(async () => redirect("/honoraris/42"));
  assert.equal(r.redirectedTo, "/honoraris/42");
  assert.equal(shared.idFromRedirect(r.redirectedTo), 42);
  assert.equal(shared.idFromRedirect("/propostes/9?x=1"), 9);
  assert.equal(shared.idFromRedirect("/honoraris"), null);
});

console.log("router over HTTP");
const handler = createMcpHandler((server) => mcp.registerAll(server), { serverInfo: { name: "test", version: "0" }, instructions: mcp.SERVER_INSTRUCTIONS, capabilities: { tools: {} } });
let rpcId = 0;
async function rpc(method, params, auth = { token: "t", clientId: "test-client", scopes: ["dac"], extra: { usuari: "adri" } }) {
  const req = new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  if (auth) req.auth = auth;
  const res = await handler(req);
  const ct = res.headers.get("content-type") ?? "";
  const body = await res.text();
  assert.ok(res.ok, `${method} -> ${res.status} ${body.slice(0, 300)}`);
  if (ct.includes("text/event-stream")) {
    const data = body.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim());
    return JSON.parse(data[data.length - 1]);
  }
  return JSON.parse(body);
}
const textOf = (r) => r.result.content.map((c) => c.text).join("\n");

await test("tools/list shows the router tools within the budget", async () => {
  const r = await rpc("tools/list", {});
  const names = r.result.tools.map((t) => t.name);
  assert.deepEqual(names, ["cerca", "dac_actions", "dac_read", "dac_change", "acta_afegir_fitxer"]);
  const fitxer = r.result.tools.find((t) => t.name === "acta_afegir_fitxer");
  assert.deepEqual(fitxer._meta?.["openai/fileParams"], ["fitxer"]);
  assert.equal(fitxer.inputSchema.properties.fitxer.type, "object");
  assert.deepEqual(fitxer.inputSchema.properties.fitxer.required, ["download_url", "file_id"]);
  const weight = core.toolListWeight(r.result.tools);
  console.log(`    tools/list weighs ${weight} characters`);
  assert.ok(weight < core.TOOL_LIST_BUDGET_CHARS, `tool list too heavy: ${weight}`);
  const change = r.result.tools.find((t) => t.name === "dac_change");
  assert.ok(change.inputSchema.properties.action.enum.includes("create_dedicacio"));
  assert.equal(change.annotations.destructiveHint, true);
  assert.equal(r.result.tools.find((t) => t.name === "dac_read").annotations.readOnlyHint, true);
});
await test("dac_actions returns the menu and a schema", async () => {
  const menu = await rpc("tools/call", { name: "dac_actions", arguments: {} });
  assert.match(textOf(menu), /create_dedicacio/);
  const detail = await rpc("tools/call", { name: "dac_actions", arguments: { action: "create_dedicacio" } });
  const json = JSON.parse(textOf(detail).split("\n").slice(1).join("\n"));
  assert.equal(json.tool, "dac_change");
  assert.equal(json.args_schema.properties.hores.type, "number");
});
await test("a call without a valid token is refused", async () => {
  const r = await rpc("tools/call", { name: "dac_read", arguments: { action: "list_expedients", args: {} } }, null);
  assert.equal(r.result.isError, true);
  assert.match(textOf(r), /Sessió no vàlida/);
});
await test("dac_read runs a read action and returns JSON", async () => {
  const r = await rpc("tools/call", { name: "dac_read", arguments: { action: "list_expedients", args: { estat: "obert" } } });
  assert.notEqual(r.result.isError, true, textOf(r));
  assert.match(textOf(r), /26-0007/);
});
await test("dac_read rejects bad args with the schema hint", async () => {
  const r = await rpc("tools/call", { name: "dac_read", arguments: { action: "list_expedients", args: { estat: "weird" } } });
  assert.equal(r.result.isError, true);
  assert.match(textOf(r), /dac_actions/);
});
await test("dac_change previews without writing, then saves once per idempotency key", async () => {
  db.writes.length = 0;
  const args = { expedient_num: "26-0007", hores: 2, tasca: "Visita direcció d'obres", data: "2026-10-10" };
  const preview = await rpc("tools/call", { name: "dac_change", arguments: { action: "create_dedicacio", args } });
  const ptext = textOf(preview);
  assert.match(ptext, /^PREVISUALITZACIÓ/);
  assert.match(ptext, /26-0007 — Casa Vila/);
  assert.equal(db.writes.length, 0, "preview must not write");
  const key = /idempotency_key="([a-f0-9]+)"/.exec(ptext)?.[1];
  assert.ok(key, "preview suggests a key");

  const noKey = await rpc("tools/call", { name: "dac_change", arguments: { action: "create_dedicacio", args, confirm: true } });
  assert.equal(noKey.result.isError, true);
  assert.equal(db.writes.length, 0);

  const saved = await rpc("tools/call", { name: "dac_change", arguments: { action: "create_dedicacio", args, confirm: true, idempotency_key: key } });
  assert.match(textOf(saved), /^DESAT/, textOf(saved));
  assert.equal(db.writes.filter((w) => w.text.startsWith("insert into public.dedicacions")).length, 1);

  const again = await rpc("tools/call", { name: "dac_change", arguments: { action: "create_dedicacio", args, confirm: true, idempotency_key: key } });
  assert.match(textOf(again), /^JA FET/);
  assert.equal(db.writes.filter((w) => w.text.startsWith("insert into public.dedicacions")).length, 1, "replay must not write again");

  const other = await rpc("tools/call", { name: "dac_change", arguments: { action: "delete_dedicacio", args: { id: 55 }, confirm: true, idempotency_key: key } });
  assert.equal(other.result.isError, true);
  assert.match(textOf(other), /create_dedicacio/);
});
await test("expedient references: short numbers and names resolve, unknown ones explain", async () => {
  const data = await import("../src/lib/mcp/data.ts");
  assert.deepEqual(data.parseExpedientRef("26-0120"), { kind: "number", yy: "26", n: 120 });
  assert.deepEqual(data.parseExpedientRef("26-120"), { kind: "number", yy: "26", n: 120 });
  assert.deepEqual(data.parseExpedientRef("26 0120"), { kind: "number", yy: "26", n: 120 });
  assert.deepEqual(data.parseExpedientRef("260120"), { kind: "number", yy: "26", n: 120 });
  assert.deepEqual(data.parseExpedientRef("exp. 120"), { kind: "number", yy: null, n: 120 });
  assert.deepEqual(data.parseExpedientRef("120"), { kind: "number", yy: null, n: 120 });
  assert.deepEqual(data.parseExpedientRef("Casa Vila"), { kind: "text", text: "Casa Vila" });
  const viaShort = await data.resolveExpedient({ expedient_num: "26-7" });
  assert.equal(viaShort.expedient?.id, 7);
  const viaName = await data.resolveExpedient({ expedient_num: "casa vila" });
  assert.equal(viaName.expedient?.id, 7);
  const none = await data.resolveExpedient({ expedient_num: "Torre Eiffel" });
  assert.equal(none.expedient, null);
  assert.match(none.error, /No s'ha trobat cap expedient per «Torre Eiffel»/);
});
await test("a read that cannot resolve its reference comes back as an error", async () => {
  const r = await rpc("tools/call", { name: "dac_read", arguments: { action: "get_expedient", args: { num: "Torre Eiffel" } } });
  assert.equal(r.result.isError, true);
  assert.match(textOf(r), /Torre Eiffel/);
});
await test("a preview with errors cannot be confirmed", async () => {
  db.writes.length = 0;
  const args = { expedient_num: "99-9999", hores: 1 };
  const preview = await rpc("tools/call", { name: "dac_change", arguments: { action: "create_dedicacio", args } });
  assert.equal(preview.result.isError, true);
  assert.match(textOf(preview), /No s'ha trobat cap expedient/);
  const saved = await rpc("tools/call", { name: "dac_change", arguments: { action: "create_dedicacio", args, confirm: true, idempotency_key: "abcdef123456" } });
  assert.equal(saved.result.isError, true);
  assert.equal(db.writes.length, 0);
});

console.log("source checks");
await test("tool modules never write SQL directly: writes go through the app's server actions", async () => {
  const dir = join(ROOT, "src", "lib", "mcp", "tools");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".ts"));
  for (const f of [...files.map((f) => join(dir, f)), join(ROOT, "src", "lib", "mcp", "data.ts"), join(ROOT, "src", "lib", "mcp", "router.ts")]) {
    const src = (await readFile(f, "utf8")).replace(/\r\n/g, "\n");
    assert.doesNotMatch(src, /\b(insert\s+into|update\s+public\.|delete\s+from)\b/i, `${f} writes SQL directly`);
  }
});
await test("auth helpers consult the acting user before cookies", async () => {
  const src = (await readFile(join(ROOT, "src", "lib", "auth.ts"), "utf8")).replace(/\r\n/g, "\n");
  assert.match(src, /export async function requireUser[\s\S]*?getActingUser\(\)[\s\S]*?getSession\(\)/);
  assert.match(src, /export async function isDemoSession[\s\S]*?getActingUser\(\)[\s\S]*?cookies\(\)/);
});
await test("middleware keeps the plugin paths public", async () => {
  const src = await readFile(join(ROOT, "middleware.ts"), "utf8");
  for (const p of ["/api/mcp", "/.well-known/", "/oauth/"]) assert.ok(src.includes(`"${p}"`), p);
});
await test("the migration creates the OAuth and usage tables", async () => {
  const src = await readFile(join(ROOT, "db", "migrations", "0040_mcp.sql"), "utf8");
  for (const t of ["mcp_oauth_client", "mcp_oauth_code", "mcp_oauth_token", "mcp_usage"]) assert.match(src, new RegExp(`create table if not exists public\\.${t}`));
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
