import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/auth";

const PUBLIC_PATHS = ["/login"];

// The ChatGPT / Claude plugin: the MCP endpoint, OAuth discovery and the OAuth
// endpoints must never be redirected to /login (the clients would break). They
// carry their own authentication (Bearer tokens, PKCE). /pujar/<token> is the
// acta upload page; its sealed token is the credential (src/lib/upload-link.ts).
// /api/cron/ is called by Vercel Cron with the CRON_SECRET bearer, which the
// route itself checks.
const PUBLIC_PREFIXES = ["/api/mcp", "/.well-known/", "/oauth/", "/pujar/", "/api/cron/"];

// The platform's address is dac.adriallm.com; the old dac-arquitectura.vercel.app forwards the
// pages people open in a browser to it. Everything else keeps working on the old address: the
// ChatGPT / Claude connectors were set up with it (a redirect to another domain would lose their
// sign-in), and so were upload links and the cron. A login on the way to a connector's OAuth
// page stays too, so that page is served where the connector expects it.
const OLD_HOST = "dac-arquitectura.vercel.app";
const NEW_ORIGIN = "https://dac.adriallm.com";
function forwardToNewAddress(request: NextRequest): NextResponse | null {
  const { pathname, search, searchParams } = request.nextUrl;
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  if (host !== OLD_HOST || (request.method !== "GET" && request.method !== "HEAD")) return null;
  if (pathname.startsWith("/api/") || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  if (pathname === "/login" && (searchParams.get("next") ?? "").startsWith("/oauth")) return null;
  return NextResponse.redirect(new URL(pathname + search, NEW_ORIGIN), 308);
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const forward = forwardToNewAddress(request);
  if (forward) return forward;

  if (PUBLIC_PATHS.includes(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p))) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(request, res, sessionOptions);

  if (!session.user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)",
  ],
};
