// Private upload links for an acta. Claude (and ChatGPT's phone apps) cannot
// hand chat images to the plugin, so the plugin gives the user a link to a
// small page where they pick or take photos. The link is a sealed token
// (iron-session, same secret as the login cookie) that only allows adding
// files to one acta, as one user, for a limited time. No login is needed,
// which is the point: it works on a phone that is not signed in.
import { sealData, unsealData } from "iron-session";
import { isAppUser, sessionOptions, type AppUser } from "@/lib/auth";

export const UPLOAD_LINK_TTL_S = 60 * 60 * 24; // 24 hours

interface Payload {
  k: "acta-upload";
  v: 1;
  u: AppUser;
  a: number;
}

function password(): string {
  return sessionOptions.password as string;
}

export async function createActaUploadToken(user: AppUser, actaId: number): Promise<string> {
  const payload: Payload = { k: "acta-upload", v: 1, u: user, a: actaId };
  return sealData(payload, { password: password(), ttl: UPLOAD_LINK_TTL_S });
}

export async function readActaUploadToken(token: string): Promise<{ user: AppUser; actaId: number } | null> {
  if (!token || token.length > 1000) return null;
  try {
    const d = await unsealData<Partial<Payload>>(token, { password: password(), ttl: UPLOAD_LINK_TTL_S });
    if (d?.k !== "acta-upload" || d.v !== 1 || !isAppUser(d.u) || !Number.isInteger(d.a) || (d.a as number) <= 0) return null;
    return { user: d.u, actaId: d.a as number };
  } catch {
    return null;
  }
}

export function actaUploadUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/pujar/${encodeURIComponent(token)}`;
}
