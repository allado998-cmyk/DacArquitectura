// Runs tool calls as the token's user and implements preview → confirm with
// idempotency keys. Every write goes through the website's own server actions.
import type { ServerContext } from "@modelcontextprotocol/server";
import { isAppUser } from "@/lib/auth";
import { runAsActingUser } from "@/lib/acting-user";
import { sql } from "@/lib/db";
import {
  errorResult,
  suggestedIdempotencyKey,
  textResult,
  type ActionCtx,
  type ChangeAction,
  type Plan,
  type ReadAction,
  type ToolText,
} from "./core";

export class GuardError extends Error {}

// The only place the acting user is decided: from the verified token.
export function guard(ctx: ServerContext): ActionCtx {
  const info = ctx.http?.authInfo;
  const usuari = info?.extra?.usuari;
  if (!info || !isAppUser(usuari)) throw new GuardError("Sessió no vàlida: torna a connectar el plugin.");
  return { user: usuari, clientId: info.clientId };
}

export function asUser<T>(a: ActionCtx, fn: () => Promise<T>): Promise<T> {
  return runAsActingUser(a.user, fn);
}

// Server actions end with redirect() or notFound(), which throw. Catch them
// and hand back the URL so callers can read the new row's id from it.
export async function callAction<T>(fn: () => Promise<T>): Promise<{ value?: T; redirectedTo?: string; notFound?: boolean }> {
  try {
    return { value: await fn() };
  } catch (e) {
    const digest = (e as { digest?: unknown })?.digest;
    if (typeof digest === "string") {
      if (digest.startsWith("NEXT_REDIRECT")) {
        // NEXT_REDIRECT;<type>;<url>;<status>;
        const parts = digest.split(";");
        return { redirectedTo: parts[2] ?? "" };
      }
      if (digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest.startsWith("NEXT_NOT_FOUND")) return { notFound: true };
    }
    throw e;
  }
}

export function idFromRedirect(url: string | undefined): number | null {
  if (!url) return null;
  const m = /\/(\d+)\/?(?:[?#].*)?$/.exec(url);
  return m ? parseInt(m[1], 10) : null;
}

// Usage log ------------------------------------------------------------------
// Rows go to the acting user's database (the demo account logs to the demo
// database), so these must run inside asUser().

export async function logUsage(a: ActionCtx, tool: string, action: string | null, status: string, result?: unknown) {
  try {
    await sql`
      insert into public.mcp_usage (usuari, client_id, tool, action, status, result)
      values (${a.user}, ${a.clientId}, ${tool}, ${action}, ${status}, ${result === undefined ? null : JSON.stringify(result)}::jsonb)
    `;
  } catch (e) {
    console.error("mcp_usage insert failed", e);
  }
}

type Claim =
  | { state: "new"; id: number }
  | { state: "done"; result: unknown }
  | { state: "pending" }
  | { state: "other_action"; action: string | null };

async function claimIdempotency(a: ActionCtx, action: string, key: string): Promise<Claim> {
  const inserted = (await sql`
    insert into public.mcp_usage (usuari, client_id, tool, action, idempotency_key, status)
    values (${a.user}, ${a.clientId}, 'dac_change', ${action}, ${key}, 'pending')
    on conflict (usuari, idempotency_key) where idempotency_key is not null do nothing
    returning id
  `) as { id: number }[];
  if (inserted[0]) return { state: "new", id: inserted[0].id };

  const existing = (await sql`
    select action, status, result from public.mcp_usage where usuari = ${a.user} and idempotency_key = ${key}
  `) as { action: string | null; status: string; result: unknown }[];
  const row = existing[0];
  if (!row) return { state: "pending" };
  if (row.action !== action) return { state: "other_action", action: row.action };
  if (row.status === "pending") return { state: "pending" };
  return { state: "done", result: row.result };
}

async function finishIdempotency(id: number, status: "done" | "failed", result: unknown) {
  await sql`update public.mcp_usage set status = ${status}, result = ${JSON.stringify(result)}::jsonb where id = ${id}`;
}

async function releaseIdempotency(id: number) {
  await sql`delete from public.mcp_usage where id = ${id} and status = 'pending'`;
}

// Runners --------------------------------------------------------------------

export async function runRead(def: ReadAction, rawArgs: unknown, a: ActionCtx): Promise<ToolText> {
  const parsed = def.schema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return errorResult(`Arguments invàlids per a ${def.name}. Consulta dac_actions(action="${def.name}").`, parsed.error.issues);
  }
  // The args are logged (shortened) so a lookup that found nothing can be
  // diagnosed later from mcp_usage.
  const args = JSON.stringify(parsed.data).slice(0, 500);
  return asUser(a, async () => {
    try {
      const data = await def.run(parsed.data, a);
      const notFound = data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string" ? (data as { error: string }).error : null;
      if (notFound) {
        void logUsage(a, "dac_read", def.name, "not_found", { args, error: notFound });
        return errorResult(notFound);
      }
      void logUsage(a, "dac_read", def.name, "done", { args });
      return textResult(`OK ${def.name}`, data);
    } catch (e) {
      void logUsage(a, "dac_read", def.name, "failed", { args, error: String(e) });
      throw e;
    }
  });
}

export async function runChange(
  def: ChangeAction,
  rawArgs: unknown,
  opts: { confirm: boolean; idempotencyKey?: string },
  a: ActionCtx,
): Promise<ToolText> {
  const parsed = def.schema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return errorResult(`Arguments invàlids per a ${def.name}. Consulta dac_actions(action="${def.name}").`, parsed.error.issues);
  }
  const args = parsed.data;

  return asUser(a, async () => {
    if (!opts.confirm) {
      const plan = await def.plan(args, a);
      void logUsage(a, "dac_change", def.name, plan.errors?.length ? "preview_error" : "preview");
      if (plan.errors?.length) {
        return errorResult(`PREVISUALITZACIÓ — no es pot desar. Corregeix i torna a previsualitzar.`, {
          summary: plan.summary,
          errors: plan.errors,
          warnings: plan.warnings ?? [],
          details: plan.details,
        });
      }
      return textResult(
        `PREVISUALITZACIÓ — res desat encara. Mostra aquest resum a l'usuari i, només si ho confirma, torna a cridar dac_change amb els mateixos action/args, confirm=true i idempotency_key="${suggestedIdempotencyKey()}".`,
        { summary: plan.summary, warnings: plan.warnings ?? [], details: plan.details },
      );
    }

    const key = (opts.idempotencyKey ?? "").trim();
    if (key.length < 6 || key.length > 128) {
      return errorResult("Per desar cal idempotency_key (6–128 caràcters). Fes primer una previsualització amb confirm=false.");
    }

    const claim = await claimIdempotency(a, def.name, key);
    if (claim.state === "done") return textResult("JA FET — aquesta idempotency_key ja s'havia desat; no s'ha tornat a escriure res.", claim.result);
    if (claim.state === "pending") return errorResult("Aquesta idempotency_key encara s'està processant. Torna-ho a provar en uns segons.");
    if (claim.state === "other_action") return errorResult(`Aquesta idempotency_key ja es va fer servir per a l'acció ${claim.action}. Fes servir una clau nova.`);

    try {
      const plan = await def.plan(args, a);
      if (plan.errors?.length) {
        await finishIdempotency(claim.id, "failed", { errors: plan.errors });
        return errorResult("No s'ha desat: la validació ha fallat.", { summary: plan.summary, errors: plan.errors, warnings: plan.warnings ?? [] });
      }
      const result = await def.commit(args, plan, a);
      const stored = { summary: plan.summary, result };
      await finishIdempotency(claim.id, "done", stored);
      return textResult(`DESAT. ${plan.summary}`, { result, warnings: plan.warnings ?? [] });
    } catch (e) {
      await releaseIdempotency(claim.id).catch(() => {});
      const msg = e instanceof Error ? e.message : String(e);
      return errorResult(`No s'ha pogut desar: ${msg}`);
    }
  });
}
