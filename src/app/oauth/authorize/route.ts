// OAuth 2.1 authorization endpoint. GET shows the sign-in / consent page;
// POST checks the credentials (or the existing session) and redirects back to
// the client with an authorization code.
import { getSession, isAppUser, passwordFor, type AppUser } from "@/lib/auth";
import { resolveClient, type ResolvedClient } from "@/lib/mcp/clients";
import { challengeAlreadyUsed, insertCode } from "@/lib/mcp/oauth-db";
import { isAllowedRedirectUri, publicOrigin, randomToken, SCOPE } from "@/lib/mcp/oauth-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AuthzParams {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  state: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string;
  resource: string;
}

const KEYS: (keyof AuthzParams)[] = ["response_type", "client_id", "redirect_uri", "state", "code_challenge", "code_challenge_method", "scope", "resource"];

function pick(src: { get(k: string): string | null }): AuthzParams {
  const out = {} as AuthzParams;
  for (const k of KEYS) out[k] = (src.get(k) ?? "").slice(0, 2048);
  return out;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

function html(body: string, status = 200): Response {
  const page = `<!doctype html>
<html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>DacArquitectura — Autoritzar accés</title>
<style>
  :root{color-scheme:light}
  body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f6f4;color:#1c1c1a;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px}
  .card{background:#fff;border:1px solid #e4e4df;border-radius:12px;padding:28px;max-width:420px;width:100%;box-shadow:0 1px 2px rgba(0,0,0,.04)}
  img{height:40px;display:block;margin:0 auto 18px}
  h1{font-size:18px;margin:0 0 6px;text-align:center}
  p{font-size:14px;color:#5c5c57;margin:0 0 16px;text-align:center;line-height:1.45}
  label{display:block;font-size:12px;font-weight:600;color:#44443f;margin:12px 0 4px}
  input[type=text],input[type=password]{width:100%;box-sizing:border-box;border:1px solid #d6d6d0;border-radius:8px;padding:9px 10px;font-size:14px}
  button{width:100%;margin-top:18px;background:#1c1c1a;color:#fff;border:0;border-radius:8px;padding:10px;font-size:14px;font-weight:600;cursor:pointer}
  button:hover{background:#000}
  .muted{font-size:12px;color:#8a8a84;text-align:center;margin-top:14px}
  .muted a{color:#5c5c57}
  .err{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:8px;padding:8px 10px;font-size:13px;margin-top:10px}
  .who{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;border-radius:8px;padding:10px;font-size:14px;text-align:center}
  ul{font-size:13px;color:#5c5c57;padding-left:18px;margin:0 0 6px}
</style></head><body><div class="card">${body}</div></body></html>`;
  return new Response(page, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Frame-Options": "DENY" } });
}

function errorPage(title: string, detail: string): Response {
  return html(`<img src="/logo.jpg" alt="DAC arquitectura"><h1>${esc(title)}</h1><p>${esc(detail)}</p>`, 400);
}

function redirectWithError(redirectUri: string, state: string, error: string, description: string): Response {
  const u = new URL(redirectUri);
  u.searchParams.set("error", error);
  u.searchParams.set("error_description", description);
  if (state) u.searchParams.set("state", state);
  return Response.redirect(u.toString(), 302);
}

// Validates client and redirect_uri. Anything wrong with them must be shown
// here, never bounced to an unverified redirect_uri.
async function checkClient(p: AuthzParams): Promise<{ client: ResolvedClient; redirectUri: string } | Response> {
  if (!p.client_id) return errorPage("Petició invàlida", "Falta el paràmetre client_id.");
  const client = await resolveClient(p.client_id);
  if (!client) return errorPage("Client desconegut", "Aquest client no està registrat. Torna a afegir el plugin des de ChatGPT o Claude.");
  let redirectUri = p.redirect_uri;
  if (!redirectUri && client.redirect_uris.length === 1) redirectUri = client.redirect_uris[0];
  if (!redirectUri || !client.redirect_uris.includes(redirectUri) || !isAllowedRedirectUri(redirectUri)) {
    return errorPage("redirect_uri no permesa", "L'adreça de retorn no coincideix amb la registrada pel client.");
  }
  return { client, redirectUri };
}

function checkRequest(p: AuthzParams, redirectUri: string): Response | null {
  if (p.response_type !== "code") return redirectWithError(redirectUri, p.state, "unsupported_response_type", "only response_type=code is supported");
  if (!p.code_challenge || p.code_challenge_method !== "S256") {
    return redirectWithError(redirectUri, p.state, "invalid_request", "PKCE with code_challenge_method=S256 is required");
  }
  if (p.scope && p.scope.split(/\s+/).some((s) => s && s !== SCOPE && s !== "openid" && s !== "profile" && s !== "email")) {
    return redirectWithError(redirectUri, p.state, "invalid_scope", `supported scope: ${SCOPE}`);
  }
  if (p.resource) {
    try {
      const r = new URL(p.resource);
      if (r.pathname.replace(/\/+$/, "") !== "/api/mcp") return redirectWithError(redirectUri, p.state, "invalid_target", "unknown resource");
    } catch {
      return redirectWithError(redirectUri, p.state, "invalid_target", "resource must be a URL");
    }
  }
  return null;
}

function hidden(p: AuthzParams): string {
  return KEYS.map((k) => `<input type="hidden" name="${k}" value="${esc(p[k])}">`).join("");
}

function consentPage(p: AuthzParams, client: ResolvedClient, sessionUser: AppUser | undefined, opts: { error?: string; forceLogin?: boolean }): Response {
  const who = client.name ?? "Una aplicació";
  const intro = `<img src="/logo.jpg" alt="DAC arquitectura">
<h1>${esc(who)} vol accedir a DacArquitectura</h1>
<p>Podrà consultar i modificar expedients, dedicació, actes, honoraris, propostes, factures i notes en nom teu.
Cada canvi es previsualitza i només es desa quan el confirmes al xat.</p>`;
  const cancel = (() => {
    try {
      const u = new URL(p.redirect_uri);
      u.searchParams.set("error", "access_denied");
      if (p.state) u.searchParams.set("state", p.state);
      return `<a href="${esc(u.toString())}">Cancel·lar</a>`;
    } catch {
      return "";
    }
  })();
  const err = opts.error ? `<div class="err">${esc(opts.error)}</div>` : "";

  if (sessionUser && !opts.forceLogin) {
    return html(`${intro}
<form method="post" action="/oauth/authorize" onsubmit="var b=this.querySelector('button');b.disabled=true;b.textContent='Connectant…';">${hidden(p)}<input type="hidden" name="mode" value="session">
<div class="who">Sessió iniciada com a <strong>${esc(sessionUser)}</strong>${sessionUser === "demo" ? " (dades de demostració)" : ""}</div>
${err}
<button type="submit">Autoritzar</button></form>
<p class="muted"><a href="?${esc(new URLSearchParams({ ...p, login: "1" }).toString())}">Entrar amb un altre usuari</a> · ${cancel}</p>`);
  }

  return html(`${intro}
<form method="post" action="/oauth/authorize" onsubmit="var b=this.querySelector('button');b.disabled=true;b.textContent='Connectant…';">${hidden(p)}<input type="hidden" name="mode" value="password">
<label for="usuari">Usuari</label><input id="usuari" type="text" name="usuari" autocomplete="username" required autofocus>
<label for="password">Contrasenya</label><input id="password" type="password" name="password" autocomplete="current-password" required>
${err}
<button type="submit">Entrar i autoritzar</button></form>
<p class="muted">${cancel}</p>`);
}

// Shown when a sign-in page that was already completed is submitted or
// reloaded: the client finished that sign-in, so a second code would only make
// it report an error.
function alreadyConnectedPage(client: ResolvedClient): Response {
  const who = client.name ?? "L'aplicació";
  return html(`<img src="/logo.jpg" alt="DAC arquitectura"><h1>Ja està connectat</h1>
<p>${esc(who)} ja té accés a DacArquitectura. Pots tancar aquesta pestanya i tornar al xat.</p>`);
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const p = pick(url.searchParams);
  const checked = await checkClient(p);
  if (checked instanceof Response) return checked;
  p.redirect_uri = checked.redirectUri;
  const bad = checkRequest(p, checked.redirectUri);
  if (bad) return bad;
  if (await challengeAlreadyUsed(checked.client.id, p.code_challenge)) return alreadyConnectedPage(checked.client);

  let sessionUser: AppUser | undefined;
  try {
    sessionUser = (await getSession()).user;
  } catch {
    sessionUser = undefined;
  }
  return consentPage(p, checked.client, sessionUser, { forceLogin: url.searchParams.get("login") === "1" });
}

// Very small in-memory brake on password guessing (per serverless instance).
const attempts = new Map<string, { n: number; at: number }>();
function tooManyAttempts(key: string): boolean {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now - a.at > 10 * 60 * 1000) {
    attempts.set(key, { n: 1, at: now });
    return false;
  }
  a.n += 1;
  return a.n > 10;
}

export async function POST(req: Request): Promise<Response> {
  // Same-origin only: the form is ours, and a cross-site POST never carries
  // the session cookie anyway (SameSite=Lax), but be explicit.
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return errorPage("Petició rebutjada", "Origen no permès.");
  const origin = req.headers.get("origin");
  if (origin && origin !== publicOrigin(req) && origin !== new URL(req.url).origin) return errorPage("Petició rebutjada", "Origen no permès.");

  const form = await req.formData();
  const p = pick({ get: (k) => (typeof form.get(k) === "string" ? (form.get(k) as string) : null) });
  const checked = await checkClient(p);
  if (checked instanceof Response) return checked;
  p.redirect_uri = checked.redirectUri;
  const bad = checkRequest(p, checked.redirectUri);
  if (bad) return bad;
  if (await challengeAlreadyUsed(checked.client.id, p.code_challenge)) return alreadyConnectedPage(checked.client);

  let usuari: AppUser | undefined;
  const mode = String(form.get("mode") ?? "");
  if (mode === "session") {
    try {
      usuari = (await getSession()).user;
    } catch {
      usuari = undefined;
    }
    if (!usuari) return consentPage(p, checked.client, undefined, { error: "La sessió ha caducat. Torna a entrar." });
  } else {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
    if (tooManyAttempts(ip)) return consentPage(p, checked.client, undefined, { error: "Massa intents. Espera uns minuts." });
    const u = String(form.get("usuari") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const expected = passwordFor(u);
    if (!isAppUser(u) || !expected || password !== expected) {
      return consentPage(p, checked.client, undefined, { error: "Usuari o contrasenya incorrectes." });
    }
    usuari = u;
  }

  const code = randomToken(32);
  await insertCode({
    code,
    client_id: checked.client.id,
    redirect_uri: checked.redirectUri,
    code_challenge: p.code_challenge,
    usuari,
    scope: p.scope || SCOPE,
    resource: p.resource || null,
  });

  const back = new URL(checked.redirectUri);
  back.searchParams.set("code", code);
  if (p.state) back.searchParams.set("state", p.state);
  return new Response(null, { status: 303, headers: { Location: back.toString(), "Cache-Control": "no-store" } });
}
