// OAuth discovery documents for the plugin. Both are public and CORS-open,
// because browser-based MCP clients fetch them.
import { authorizationServerMetadata, protectedResourceMetadata, publicOrigin } from "./oauth-core";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown): Response {
  return Response.json(body, { headers: { ...CORS, "Cache-Control": "public, max-age=300" } });
}

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

export function protectedResourceHandler(req: Request): Response {
  return json(protectedResourceMetadata(publicOrigin(req)));
}

export function authorizationServerHandler(req: Request): Response {
  return json(authorizationServerMetadata(publicOrigin(req)));
}
