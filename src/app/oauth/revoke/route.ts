// OAuth 2.0 token revocation (RFC 7009). Always answers 200, as the RFC asks.
import { revokeToken } from "@/lib/mcp/oauth-db";
import { corsPreflight } from "@/lib/mcp/well-known";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const text = await req.text();
  let token = "";
  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    try {
      token = String((JSON.parse(text) as { token?: unknown }).token ?? "");
    } catch {
      token = "";
    }
  } else {
    token = new URLSearchParams(text).get("token") ?? "";
  }
  if (token && token.length < 512) await revokeToken(token);
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}

export const OPTIONS = corsPreflight;
