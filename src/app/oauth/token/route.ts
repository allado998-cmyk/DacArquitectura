// OAuth 2.1 token endpoint: authorization_code (with PKCE) and refresh_token.
import { consumeCode, findLiveToken, issueTokens } from "@/lib/mcp/oauth-db";
import { resolveClient } from "@/lib/mcp/clients";
import { oauthError, pkceMatches, SCOPE } from "@/lib/mcp/oauth-core";
import { corsPreflight } from "@/lib/mcp/well-known";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readParams(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") ?? "";
  const text = await req.text();
  if (text.length > 16 * 1024) return {};
  if (ct.includes("application/json")) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj ?? {})) if (typeof v === "string") out[k] = v;
      return out;
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(text).entries());
}

function tokenResponse(tokens: { access_token: string; refresh_token: string; expires_in: number }, scope: string | null): Response {
  return Response.json(
    { ...tokens, token_type: "Bearer", scope: scope ?? SCOPE },
    { headers: { "Cache-Control": "no-store", Pragma: "no-cache", "Access-Control-Allow-Origin": "*" } },
  );
}

export async function POST(req: Request): Promise<Response> {
  const p = await readParams(req);
  const grant = p.grant_type;

  if (grant === "authorization_code") {
    const { code, code_verifier, redirect_uri, client_id } = p;
    if (!code || !code_verifier) return oauthError("invalid_request", "code and code_verifier are required");
    const row = await consumeCode(code);
    if (!row) return oauthError("invalid_grant", "unknown or already used code");
    if (row.expired) return oauthError("invalid_grant", "code expired");
    if (client_id && client_id !== row.client_id) return oauthError("invalid_grant", "client_id does not match the code");
    if (redirect_uri && redirect_uri !== row.redirect_uri) return oauthError("invalid_grant", "redirect_uri does not match the code");
    if (!pkceMatches(code_verifier, row.code_challenge)) return oauthError("invalid_grant", "PKCE verification failed");

    const client = await resolveClient(row.client_id);
    const tokens = await issueTokens({ client_id: row.client_id, client_name: client?.name ?? null, usuari: row.usuari, scope: row.scope });
    return tokenResponse(tokens, row.scope);
  }

  if (grant === "refresh_token") {
    const { refresh_token, client_id } = p;
    if (!refresh_token) return oauthError("invalid_request", "refresh_token is required");
    const row = await findLiveToken(refresh_token, "refresh");
    if (!row) return oauthError("invalid_grant", "unknown, expired or revoked refresh token");
    if (client_id && client_id !== row.client_id) return oauthError("invalid_grant", "client_id does not match the token");
    const tokens = await issueTokens(
      { client_id: row.client_id, client_name: row.client_name, usuari: row.usuari, scope: row.scope },
      refresh_token,
    );
    return tokenResponse(tokens, row.scope);
  }

  return oauthError("unsupported_grant_type", "use authorization_code or refresh_token");
}

export const OPTIONS = corsPreflight;
