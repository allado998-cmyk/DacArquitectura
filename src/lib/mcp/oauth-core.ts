// Pure OAuth 2.1 helpers for the plugin's authorization server. No database,
// no network: everything here is unit-testable as is.
import { createHash, randomBytes } from "node:crypto";

export const SCOPE = "dac";
export const ACCESS_TOKEN_TTL_S = 60 * 60 * 24 * 30; // 30 days
export const REFRESH_TOKEN_TTL_S = 60 * 60 * 24 * 365; // 1 year (not rotated)
export const CODE_TTL_S = 60 * 10; // 10 minutes

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// PKCE S256: BASE64URL(SHA256(code_verifier)) must equal code_challenge.
export function pkceMatches(codeVerifier: string, codeChallenge: string): boolean {
  if (!codeVerifier || codeVerifier.length < 43 || codeVerifier.length > 128) return false;
  const digest = createHash("sha256").update(codeVerifier).digest("base64url");
  return digest === codeChallenge;
}

// Redirect URIs: https anywhere, or http only on the loopback host (clients
// such as the MCP Inspector run a local callback listener).
export function isAllowedRedirectUri(uri: string): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (u.username || u.password) return false;
  if (u.protocol === "https:") return true;
  if (u.protocol === "http:") return u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]";
  return false;
}

// Client ID Metadata Documents (CIMD): the client_id is itself an https URL
// that serves the client's metadata.
export function isCimdClientId(clientId: string): boolean {
  try {
    const u = new URL(clientId);
    return u.protocol === "https:" && u.pathname !== "/" && u.pathname !== "" && !u.hash && !u.username && !u.password;
  } catch {
    return false;
  }
}

export interface ClientMetadataInput {
  redirect_uris?: unknown;
  client_name?: unknown;
  token_endpoint_auth_method?: unknown;
  grant_types?: unknown;
  response_types?: unknown;
}

export interface ValidatedClientMetadata {
  redirect_uris: string[];
  client_name: string | null;
}

// Validates a registration request (RFC 7591) or a CIMD document. Only the
// redirect URIs are checked strictly. Whatever auth method or grant types a
// client asks for, it is registered as a public client using the
// authorization code with PKCE, and the response says so (RFC 7591 lets the
// server replace requested values). Rejecting them instead would break
// clients that ask for e.g. client_secret_post by default.
export function validateClientMetadata(
  meta: ClientMetadataInput,
): { ok: true; value: ValidatedClientMetadata } | { ok: false; error: string } {
  const uris = meta.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > 20) {
    return { ok: false, error: "redirect_uris must be a non-empty array" };
  }
  for (const u of uris) {
    if (typeof u !== "string" || !isAllowedRedirectUri(u)) {
      return { ok: false, error: `redirect_uri not allowed: ${String(u).slice(0, 200)}` };
    }
  }
  const name = typeof meta.client_name === "string" ? meta.client_name.trim().slice(0, 120) : "";
  return { ok: true, value: { redirect_uris: uris as string[], client_name: name || null } };
}

// RFC 8414 authorization-server metadata.
export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    scopes_supported: [SCOPE],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    client_id_metadata_document_supported: true,
    service_documentation: `${origin}/ai`,
  };
}

// RFC 9728 protected-resource metadata for the MCP endpoint.
export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "DacArquitectura",
    resource_documentation: `${origin}/ai`,
  };
}

// Public origin of the deployment, respecting proxy headers (Vercel sets
// x-forwarded-host / x-forwarded-proto). APP_URL overrides everything.
export function publicOrigin(req: Request): string {
  const env = process.env.APP_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto =
    req.headers.get("x-forwarded-proto") ?? (host && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? "http" : "https");
  if (host) return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
  return new URL(req.url).origin;
}

// Guesses which assistant is calling from the User-Agent.
export function clientKindFromUserAgent(ua: string | null | undefined): "chatgpt" | "claude" | "other" {
  const s = (ua ?? "").toLowerCase();
  if (s.includes("openai") || s.includes("chatgpt")) return "chatgpt";
  if (s.includes("claude") || s.includes("anthropic")) return "claude";
  return "other";
}

export function oauthError(error: string, description: string, status = 400): Response {
  return Response.json(
    { error, error_description: description },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
