// The tools ChatGPT and Claude actually see. ChatGPT loads only the first few
// thousand tokens of tool definitions, so a small router stands in front of
// every action: `cerca` to find things, `dac_actions` for the menu and the
// JSON Schema of each action, `dac_read` and `dac_change` to run them.
import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { sql } from "@/lib/db";
import { actionDetail, actionMenu, actionNames, errorResult, getAction, textResult, type ToolText } from "./core";
import { asUser, guard, GuardError, logUsage, runChange, runRead } from "./shared";
import { matchExpedients } from "./data";
import { addFitxerSchema } from "./tools/actes";

async function safe(ctx: ServerContext, fn: (a: ReturnType<typeof guard>) => Promise<ToolText>): Promise<ToolText> {
  try {
    return await fn(guard(ctx));
  } catch (e) {
    if (e instanceof GuardError) return errorResult(e.message);
    console.error("mcp tool error", e);
    return errorResult(e instanceof Error ? e.message : String(e));
  }
}

export function registerRouter(server: McpServer): void {
  server.registerTool(
    "cerca",
    {
      title: "Cerca ràpida",
      description:
        "Cerca per text a expedients (número, projecte, client, ciutat), clients, contactes, propostes, factures i actes. Comença aquí per trobar ids.",
      inputSchema: z.object({ q: z.string().min(1).max(200).describe("Text o número a cercar") }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ q }, ctx) =>
      safe(ctx, (a) =>
        asUser(a, async () => {
          // Accent-insensitive "contains", plus expedient numbers in any usual form.
          const like = `%${q.trim()}%`;
          const [byRef, clients, contactes, propostes, factures, actes] = await Promise.all([
            matchExpedients(q, 15),
            sql`select id, nom, nif, ciutat from public.clients
                where public.dac_fold(concat_ws(' ', nom, nif, ciutat)) like public.dac_fold(${like}) order by nom limit 10`,
            sql`select k.id, k.nom, k.telefon, k.mail, c.nom as client_nom from public.client_contactes k left join public.clients c on c.id = k.client_id
                where public.dac_fold(concat_ws(' ', k.nom, k.mail, k.telefon)) like public.dac_fold(${like}) order by k.nom limit 10`,
            sql`select d.id, d.num, d.descripcio, d.estat, c.nom as client_nom from public.proposta_doc d left join public.clients c on c.id = d.client_id
                where public.dac_fold(concat_ws(' ', d.num, d.descripcio, c.nom, d.adreca)) like public.dac_fold(${like}) order by d.num desc limit 10`,
            sql`select f.id, f.num, f.estat, f.concepte, c.nom as client_nom, f.preu::text as base, f.pagada from public.factura f left join public.clients c on c.id = f.client_id
                where public.dac_fold(concat_ws(' ', f.num, f.concepte, c.nom)) like public.dac_fold(${like}) order by f.num desc nulls last limit 10`,
            sql`select a.id, a.num, a.tipus, to_char(a.data,'YYYY-MM-DD') as data, e.num_expedient, a.projecte from public.acta a
                left join public.expedients e on e.id = a.expedient_id
                where public.dac_fold(concat_ws(' ', a.num, e.num_expedient, a.projecte, a.client, a.lloc)) like public.dac_fold(${like}) order by a.data desc nulls last limit 10`,
          ]);
          const expedients = byRef.map((e) => ({ id: e.id, num_expedient: e.num_expedient, projecte: e.projecte, client_nom: e.client_nom, estat: e.estat }));
          const counts = { expedients: expedients.length, clients: (clients as unknown[]).length, contactes: (contactes as unknown[]).length, propostes: (propostes as unknown[]).length, factures: (factures as unknown[]).length, actes: (actes as unknown[]).length };
          void logUsage(a, "cerca", null, "done", { q, counts });
          const total = Object.values(counts).reduce((s, n) => s + n, 0);
          if (total === 0) {
            return textResult(`Cap resultat per «${q}». Prova amb menys paraules, només el número de l'expedient (p. ex. "120") o una part del nom.`, { q, counts });
          }
          return textResult(`Resultats per «${q}»`, { expedients, clients, contactes, propostes, factures, actes });
        }),
      ),
  );

  server.registerTool(
    "dac_actions",
    {
      title: "Accions disponibles",
      description:
        "Sense arguments: menú d'accions per domini (expedients, dedicacio, planificacio, clients, facturacio, propostes, honoraris, actes, notes). Amb action: la seva descripció, notes i JSON Schema dels args.",
      inputSchema: z.object({ action: z.string().max(60).optional() }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ action }, ctx) =>
      safe(ctx, async () => {
        if (!action) return textResult("Accions. Fes servir dac_read per a les lectures i dac_change per als canvis.", actionMenu());
        const detail = actionDetail(action);
        if (!detail) return errorResult(`Acció desconeguda: ${action}`, { disponibles: Object.values(actionMenu()).flatMap((d) => [...d.read, ...d.change]).map((s) => s.split(" — ")[0]) });
        return textResult(`Acció ${action}`, detail);
      }),
  );

  server.registerTool(
    "dac_read",
    {
      title: "Llegir dades",
      description: "Executa una acció de lectura amb els seus args (vegeu dac_actions). Només llegeix.",
      inputSchema: z.object({
        action: z.enum(actionNames("read")),
        args: z.record(z.string(), z.unknown()).default({}),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ action, args }, ctx) =>
      safe(ctx, (a) => {
        const def = getAction(action);
        if (!def || def.kind !== "read") return Promise.resolve(errorResult(`Acció de lectura desconeguda: ${action}`));
        return runRead(def, args, a);
      }),
  );

  server.registerTool(
    "dac_change",
    {
      title: "Fer un canvi",
      description:
        "Executa una acció de canvi. Primer amb confirm=false: retorna una previsualització (res desat). Mostra-la a l'usuari i, només si ho confirma, repeteix la crida amb confirm=true i la idempotency_key suggerida.",
      inputSchema: z.object({
        action: z.enum(actionNames("change")),
        args: z.record(z.string(), z.unknown()).default({}),
        confirm: z.boolean().default(false).describe("false = previsualitzar; true = desar"),
        idempotency_key: z.string().min(6).max(128).optional().describe("Obligatòria amb confirm=true; reutilitza-la si cal reintentar"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ action, args, confirm, idempotency_key }, ctx) =>
      safe(ctx, (a) => {
        const def = getAction(action);
        if (!def || def.kind !== "change") return Promise.resolve(errorResult(`Acció de canvi desconeguda: ${action}`));
        return runChange(def, args, { confirm, idempotencyKey: idempotency_key }, a);
      }),
  );

  // ChatGPT only fills chat attachments into top-level arguments listed in
  // _meta["openai/fileParams"], so this one action is its own tool.
  server.registerTool(
    "acta_afegir_fitxer",
    {
      title: "Afegir foto o fitxer a una acta",
      description:
        "Afegeix a una acta una foto, un PDF o un àudio adjuntat al xat de ChatGPT (fitxer) o des d'un enllaç https públic (url). Si el fitxer no arriba (Claude, app mòbil), fes servir dac_read acta_enllac_fotos per donar a l'usuari un enllaç de pujada. Igual que dac_change: primer confirm=false, després confirm=true amb la idempotency_key suggerida.",
      inputSchema: addFitxerSchema.extend({
        confirm: z.boolean().default(false),
        idempotency_key: z.string().min(6).max(128).optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      _meta: { "openai/fileParams": ["fitxer"] },
    },
    async ({ confirm, idempotency_key, ...args }, ctx) =>
      safe(ctx, (a) => {
        const def = getAction("add_acta_fitxer");
        if (!def || def.kind !== "change") return Promise.resolve(errorResult("Acció no disponible."));
        return runChange(def, args, { confirm, idempotencyKey: idempotency_key }, a);
      }),
  );
}
