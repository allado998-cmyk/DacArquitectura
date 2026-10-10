// OAuth 2.0 Dynamic Client Registration (RFC 7591). ChatGPT and Claude call
// this once to obtain a client_id; only public clients with PKCE are accepted.
import { insertClient } from "@/lib/mcp/oauth-db";
import { oauthError, randomToken, SCOPE, validateClientMetadata } from "@/lib/mcp/oauth-core";
import { corsPreflight } from "@/lib/mcp/well-known";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 16 * 1024;

export async function POST(req: Request): Promise<Response> {
  const text = await req.text();
  if (text.length > MAX_BODY) return oauthError("invalid_client_metadata", "registration body too large");
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    return oauthError("invalid_client_metadata", "body must be a JSON object");
  }
  if (!body || typeof body !== "object") return oauthError("invalid_client_metadata", "body must be a JSON object");

  const v = validateClientMetadata(body);
  if (!v.ok) return oauthError(/redirect_uri/.test(v.error) ? "invalid_redirect_uri" : "invalid_client_metadata", v.error);

  const id = `dac_${randomToken(18)}`;
  await insertClient({ id, client_name: v.value.client_name, redirect_uris: v.value.redirect_uris, metadata: body });

  return Response.json(
    {
      client_id: id,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: v.value.client_name ?? undefined,
      redirect_uris: v.value.redirect_uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: SCOPE,
    },
    { status: 201, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } },
  );
}

export const OPTIONS = corsPreflight;
