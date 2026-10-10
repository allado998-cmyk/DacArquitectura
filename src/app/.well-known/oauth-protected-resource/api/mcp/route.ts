// RFC 9728 path-based variant: /.well-known/oauth-protected-resource/api/mcp
import { corsPreflight, protectedResourceHandler } from "@/lib/mcp/well-known";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = protectedResourceHandler;
export const OPTIONS = corsPreflight;
