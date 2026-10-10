import { authorizationServerHandler, corsPreflight } from "@/lib/mcp/well-known";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = authorizationServerHandler;
export const OPTIONS = corsPreflight;
