import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIronSession, type SessionOptions } from "iron-session";

export interface SessionData {
  user?: "adri";
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

export async function requireUser(): Promise<"adri"> {
  const session = await getSession();
  if (!session.user) redirect("/login");
  return session.user;
}
