// OAuth state lives in the real database regardless of which user is involved:
// a token must be verifiable before we know whose it is. (The demo account's
// *data* still goes to DEMO_DATABASE_URL — see lib/db.ts.)
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { AppUser } from "@/lib/auth";
import { ACCESS_TOKEN_TTL_S, CODE_TTL_S, REFRESH_TOKEN_TTL_S, randomToken, sha256 } from "./oauth-core";

let client: NeonQueryFunction<false, false> | null = null;
function db(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    client = neon(url);
  }
  return client;
}

export interface OAuthClientRow {
  id: string;
  client_name: string | null;
  redirect_uris: string[];
}

export async function insertClient(row: { id: string; client_name: string | null; redirect_uris: string[]; metadata: unknown }) {
  await db()`
    insert into public.mcp_oauth_client (id, client_name, redirect_uris, metadata)
    values (${row.id}, ${row.client_name}, ${JSON.stringify(row.redirect_uris)}::jsonb, ${JSON.stringify(row.metadata ?? {})}::jsonb)
  `;
}

export async function getClient(id: string): Promise<OAuthClientRow | null> {
  const rows = (await db()`select id, client_name, redirect_uris from public.mcp_oauth_client where id = ${id}`) as OAuthClientRow[];
  return rows[0] ?? null;
}

export async function insertCode(row: {
  code: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  usuari: AppUser;
  scope: string | null;
  resource: string | null;
}) {
  await db()`
    insert into public.mcp_oauth_code (code_hash, client_id, redirect_uri, code_challenge, usuari, scope, resource, expires_at)
    values (${sha256(row.code)}, ${row.client_id}, ${row.redirect_uri}, ${row.code_challenge}, ${row.usuari}, ${row.scope}, ${row.resource},
            now() + make_interval(secs => ${CODE_TTL_S}))
  `;
  await db()`delete from public.mcp_oauth_code where created_at < now() - interval '2 days'`;
}

// True when this sign-in (same client and PKCE challenge) already produced a
// code that the client exchanged: the page was submitted a second time.
export async function challengeAlreadyUsed(clientId: string, codeChallenge: string): Promise<boolean> {
  const rows = (await db()`
    select 1 from public.mcp_oauth_code
    where client_id = ${clientId} and code_challenge = ${codeChallenge} and used_at is not null limit 1
  `) as unknown[];
  return rows.length > 0;
}

export interface CodeRow {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  usuari: AppUser;
  scope: string | null;
  resource: string | null;
  expired: boolean;
}

// Single use: the row is marked used as it is read, and a used code is never
// returned again.
export async function consumeCode(code: string): Promise<CodeRow | null> {
  const rows = (await db()`
    update public.mcp_oauth_code set used_at = now()
    where code_hash = ${sha256(code)} and used_at is null
    returning client_id, redirect_uri, code_challenge, usuari, scope, resource, (expires_at < now()) as expired
  `) as CodeRow[];
  return rows[0] ?? null;
}

export interface IssuedTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface TokenMeta {
  client_id: string;
  client_name: string | null;
  usuari: AppUser;
  scope: string | null;
}

async function insertToken(kind: "access" | "refresh", token: string, ttl: number, meta: TokenMeta) {
  await db()`
    insert into public.mcp_oauth_token (token_hash, kind, client_id, client_name, usuari, scope, expires_at)
    values (${sha256(token)}, ${kind}, ${meta.client_id}, ${meta.client_name}, ${meta.usuari}, ${meta.scope},
            now() + make_interval(secs => ${ttl}))
  `;
}

// The refresh token is not rotated: a lost response can never lock a client out.
export async function issueTokens(meta: TokenMeta, existingRefresh?: string): Promise<IssuedTokens> {
  const access = randomToken(32);
  await insertToken("access", access, ACCESS_TOKEN_TTL_S, meta);
  let refresh = existingRefresh;
  if (!refresh) {
    refresh = randomToken(32);
    await insertToken("refresh", refresh, REFRESH_TOKEN_TTL_S, meta);
  }
  return { access_token: access, refresh_token: refresh, expires_in: ACCESS_TOKEN_TTL_S };
}

export interface TokenRow {
  token_hash: string;
  kind: "access" | "refresh";
  client_id: string;
  client_name: string | null;
  usuari: AppUser;
  scope: string | null;
  expires_at_s: number;
}

export async function findLiveToken(token: string, kind: "access" | "refresh"): Promise<TokenRow | null> {
  const rows = (await db()`
    select token_hash, kind, client_id, client_name, usuari, scope, extract(epoch from expires_at)::float8 as expires_at_s
    from public.mcp_oauth_token
    where token_hash = ${sha256(token)} and kind = ${kind} and revoked_at is null and expires_at > now()
  `) as TokenRow[];
  return rows[0] ?? null;
}

export async function touchToken(tokenHash: string, userAgent: string | null) {
  await db()`
    update public.mcp_oauth_token set last_used_at = now(), last_user_agent = ${userAgent?.slice(0, 300) ?? null}
    where token_hash = ${tokenHash}
  `;
}

export async function revokeToken(token: string) {
  // Revoking a refresh token also revokes that client's access tokens.
  const rows = (await db()`
    update public.mcp_oauth_token set revoked_at = now()
    where token_hash = ${sha256(token)} and revoked_at is null
    returning kind, client_id, usuari
  `) as { kind: string; client_id: string; usuari: string }[];
  const r = rows[0];
  if (r?.kind === "refresh") {
    await db()`
      update public.mcp_oauth_token set revoked_at = now()
      where client_id = ${r.client_id} and usuari = ${r.usuari} and revoked_at is null
    `;
  }
}

export interface ConnectionRow {
  client_id: string;
  client_name: string | null;
  created_at: string;
  last_used_at: string | null;
  last_user_agent: string | null;
  tokens: number;
}

// For the /ai page: one row per client the user has connected.
export async function listConnections(usuari: AppUser): Promise<ConnectionRow[]> {
  return (await db()`
    select client_id, max(client_name) as client_name,
           to_char(min(created_at), 'DD/MM/YYYY HH24:MI') as created_at,
           to_char(max(last_used_at), 'DD/MM/YYYY HH24:MI') as last_used_at,
           (array_agg(last_user_agent order by last_used_at desc nulls last))[1] as last_user_agent,
           count(*)::int as tokens
    from public.mcp_oauth_token
    where usuari = ${usuari} and revoked_at is null and expires_at > now()
    group by client_id
    order by max(coalesce(last_used_at, created_at)) desc
  `) as ConnectionRow[];
}

export async function revokeConnection(usuari: AppUser, clientId: string) {
  await db()`
    update public.mcp_oauth_token set revoked_at = now()
    where usuari = ${usuari} and client_id = ${clientId} and revoked_at is null
  `;
}
