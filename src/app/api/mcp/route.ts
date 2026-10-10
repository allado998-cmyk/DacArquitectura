// The remote MCP server ChatGPT and Claude connect to. Stateless Streamable
// HTTP; every request carries a Bearer token issued by /oauth/token.
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { after } from "next/server";
import { registerAll, SERVER_INSTRUCTIONS, SERVER_NAME, SERVER_VERSION } from "@/lib/mcp";
import { findLiveToken, touchToken } from "@/lib/mcp/oauth-db";
import { SCOPE } from "@/lib/mcp/oauth-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const appUrl = process.env.APP_URL?.replace(/\/+$/, "");

// mcp-handler's type only names `name` and `version`; the extra branding
// fields still reach McpServer and the clients.
const serverInfo = {
  name: SERVER_NAME,
  version: SERVER_VERSION,
  title: "DacArquitectura",
  description: "Gestió del despatx: expedients, dedicació, actes, honoraris, propostes, factures i notes.",
  ...(appUrl ? { websiteUrl: `${appUrl}/ai` } : {}),
} as { name: string; version: string };

const handler = createMcpHandler((server) => registerAll(server), {
  serverInfo,
  instructions: SERVER_INSTRUCTIONS,
  capabilities: { tools: {} },
});

async function verifyToken(req: Request, bearer?: string): Promise<AuthInfo | undefined> {
  if (!bearer || bearer.length > 512) return undefined;
  const row = await findLiveToken(bearer, "access");
  if (!row) return undefined;
  const ua = req.headers.get("user-agent");
  try {
    after(() => touchToken(row.token_hash, ua));
  } catch {
    void touchToken(row.token_hash, ua).catch(() => {});
  }
  return {
    token: bearer,
    clientId: row.client_id,
    scopes: [row.scope ?? SCOPE],
    expiresAt: Math.floor(row.expires_at_s),
    extra: { usuari: row.usuari, clientName: row.client_name },
  };
}

const authed = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
  ...(appUrl ? { resourceUrl: appUrl } : {}),
});

export { authed as GET, authed as POST, authed as DELETE };
