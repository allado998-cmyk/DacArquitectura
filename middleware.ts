import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/auth";

const PUBLIC_PATHS = ["/login"];

// The ChatGPT / Claude plugin: the MCP endpoint, OAuth discovery and the OAuth
// endpoints must never be redirected to /login (the clients would break). They
// carry their own authentication (Bearer tokens, PKCE). /pujar/<token> is the
// acta upload page; its sealed token is the credential (src/lib/upload-link.ts).
const PUBLIC_PREFIXES = ["/api/mcp", "/.well-known/", "/oauth/", "/pujar/"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

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
