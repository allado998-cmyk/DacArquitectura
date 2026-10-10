import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIronSession, type SessionOptions } from "iron-session";
import { getActingUser } from "@/lib/acting-user";

// "adri" is the real account; "demo" is a read/write sandbox account that is
// routed to a separate database (see lib/db.ts) so client demos never touch
// real data.
export type AppUser = "adri" | "demo";

export const APP_USERS: readonly AppUser[] = ["adri", "demo"];

export function isAppUser(value: unknown): value is AppUser {
  return typeof value === "string" && (APP_USERS as readonly string[]).includes(value);
}

// Shared by the login form and the plugin's OAuth authorize page.
export function passwordFor(usuari: string): string | undefined {
  if (usuari === "adri") return process.env.ADRI_PASSWORD;
  if (usuari === "demo") return process.env.DEMO_PASSWORD;
  return undefined;
}

export interface SessionData {
  user?: AppUser;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_PASSWORD || "dev-only-fallback-must-be-at-least-32-chars-long-xx",
  cookieName: "dac_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function requireUser(): Promise<AppUser> {
  // A plugin (MCP) call names its user through the verified OAuth token, never
  // through cookies — those would belong to OpenAI's or Anthropic's servers.
  const acting = getActingUser();
  if (acting) return acting;

  const session = await getSession();
  if (!session.user) redirect("/login");
  return session.user;
}

// Every page runs several `sql` queries and each one needs to know which
// database to talk to, so memoise the (cheap but not free) cookie unseal on the
// sealed cookie value itself. The seal is cryptographically bound to its
// contents, so the same string always unseals to the same user.
const demoByCookie = new Map<string, boolean>();

export async function isDemoSession(): Promise<boolean> {
  const acting = getActingUser();
  if (acting) return acting === "demo";

  let raw: string | undefined;
  try {
    raw = (await cookies()).get(sessionOptions.cookieName)?.value;
  } catch {
    return false; // outside a request scope — no user, so no demo
  }
  if (!raw) return false;

  const cached = demoByCookie.get(raw);
  if (cached !== undefined) return cached;

  let demo = false;
  try {
    const session = await getSession();
    demo = session.user === "demo";
  } catch {
    demo = false;
  }

  if (demoByCookie.size > 200) demoByCookie.clear();
  demoByCookie.set(raw, demo);
  return demo;
}
