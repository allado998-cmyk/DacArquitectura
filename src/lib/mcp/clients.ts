// Resolves an OAuth client by id: either one that registered itself here
// (Dynamic Client Registration, stored in the database) or a Client ID
// Metadata Document (the client_id is an https URL serving its metadata).
import { getClient } from "./oauth-db";
import { isCimdClientId, validateClientMetadata } from "./oauth-core";

export interface ResolvedClient {
  id: string;
  name: string | null;
  redirect_uris: string[];
}

const CIMD_TTL_MS = 10 * 60 * 1000;
const CIMD_MAX_BYTES = 64 * 1024;
const cimdCache = new Map<string, { at: number; value: ResolvedClient }>();

export async function resolveClient(clientId: string): Promise<ResolvedClient | null> {
  if (!clientId || clientId.length > 2048) return null;
  if (isCimdClientId(clientId)) return fetchCimd(clientId);
  const row = await getClient(clientId);
  return row ? { id: row.id, name: row.client_name, redirect_uris: row.redirect_uris } : null;
}

function isPublicHostname(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return false; // IPv4 literal
  if (hostname.includes(":") || hostname.startsWith("[")) return false; // IPv6 literal
  return hostname.includes(".");
}

async function fetchCimd(url: string): Promise<ResolvedClient | null> {
  const cached = cimdCache.get(url);
  if (cached && Date.now() - cached.at < CIMD_TTL_MS) return cached.value;

  const u = new URL(url);
  if (!isPublicHostname(u.hostname) || u.port) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" }, redirect: "manual" });
    if (!res.ok) return null;
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > CIMD_MAX_BYTES) return null;
    const text = await res.text();
    if (text.length > CIMD_MAX_BYTES) return null;
    const meta = JSON.parse(text) as Record<string, unknown>;
    if (meta.client_id !== url) return null;
    const v = validateClientMetadata(meta);
    if (!v.ok) return null;
    const value: ResolvedClient = { id: url, name: v.value.client_name ?? u.hostname, redirect_uris: v.value.redirect_uris };
    if (cimdCache.size > 100) cimdCache.clear();
    cimdCache.set(url, { at: Date.now(), value });
    return value;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
