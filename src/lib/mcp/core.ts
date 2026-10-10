// Pure building blocks for the plugin's actions: types, the registry and
// small helpers. Nothing here touches the database or Next.js, so tests can
// import it directly.
import { z } from "zod";
import type { AppUser } from "@/lib/auth";

export type ActionKind = "read" | "change";

export interface ActionCtx {
  user: AppUser;
  clientId: string;
}

export interface Plan {
  // One or two sentences a person can approve ("Crear dedicació de 2 h a 26-0012 — Casa X el 2026-10-10").
  summary: string;
  // What will be written, with references resolved to names.
  details?: unknown;
  // Any error blocks the save; the model must fix the arguments and preview again.
  errors?: string[];
  // Warnings are shown but do not block.
  warnings?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObject = z.ZodObject<any>;

export interface ReadAction<S extends AnyObject = AnyObject> {
  kind: "read";
  name: string;
  domain: string;
  description: string;
  notes?: string[];
  schema: S;
  run(args: z.infer<S>, ctx: ActionCtx): Promise<unknown>;
}

export interface ChangeAction<S extends AnyObject = AnyObject> {
  kind: "change";
  name: string;
  domain: string;
  description: string;
  notes?: string[];
  schema: S;
  // Deletes rows that cannot be recovered from the chat.
  destructive?: boolean;
  // Reads only. Resolves references, validates, and describes the change.
  plan(args: z.infer<S>, ctx: ActionCtx): Promise<Plan>;
  // Writes, through the website's own server actions. Only runs when the plan has no errors.
  commit(args: z.infer<S>, plan: Plan, ctx: ActionCtx): Promise<unknown>;
}

export type ActionDef = ReadAction | ChangeAction;

const registry: ActionDef[] = [];
const byName = new Map<string, ActionDef>();

export function registerAction<S extends AnyObject>(def: ReadAction<S> | ChangeAction<S>): void {
  if (byName.has(def.name)) throw new Error(`duplicate action: ${def.name}`);
  if (!/^[a-z][a-z0-9_]{2,40}$/.test(def.name)) throw new Error(`bad action name: ${def.name}`);
  registry.push(def as unknown as ActionDef);
  byName.set(def.name, def as unknown as ActionDef);
}

export function getAction(name: string): ActionDef | undefined {
  return byName.get(name);
}

export function listActions(kind?: ActionKind): ActionDef[] {
  return kind ? registry.filter((a) => a.kind === kind) : registry.slice();
}

export function actionNames(kind: ActionKind): [string, ...string[]] {
  const names = listActions(kind).map((a) => a.name);
  if (names.length === 0) throw new Error(`no ${kind} actions registered`);
  return names as [string, ...string[]];
}

// The menu the model sees from `dac_actions` without arguments.
export function actionMenu(): Record<string, { read: string[]; change: string[] }> {
  const out: Record<string, { read: string[]; change: string[] }> = {};
  for (const a of registry) {
    const d = (out[a.domain] ??= { read: [], change: [] });
    d[a.kind].push(`${a.name} — ${a.description}`);
  }
  return out;
}

export function actionDetail(name: string): unknown {
  const a = byName.get(name);
  if (!a) return null;
  return {
    action: a.name,
    kind: a.kind,
    tool: a.kind === "read" ? "dac_read" : "dac_change",
    domain: a.domain,
    description: a.description,
    destructive: a.kind === "change" ? !!a.destructive : false,
    notes: a.notes ?? [],
    args_schema: z.toJSONSchema(a.schema, { io: "input" }),
  };
}

// Schema atoms ---------------------------------------------------------------

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
export const id = z.number().int().positive();
export const idOrNull = z.number().int().positive().nullable();
export const money = z.number().finite();
export const shortText = z.string().max(500);
export const longText = z.string().max(20000);

// Result formatting ----------------------------------------------------------

// A type alias (not an interface) so it is assignable to the SDK's
// CallToolResult, which carries an index signature.
export type ToolText = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export function textResult(summary: string, data?: unknown): ToolText {
  const text = data === undefined ? summary : `${summary}\n${JSON.stringify(data, jsonReplacer)}`;
  return { content: [{ type: "text", text }] };
}

export function errorResult(message: string, data?: unknown): ToolText {
  const text = data === undefined ? `ERROR: ${message}` : `ERROR: ${message}\n${JSON.stringify(data, jsonReplacer)}`;
  return { content: [{ type: "text", text }], isError: true };
}

// Fields that hold codes, not quantities: "04", "08001" or "600123123" must
// reach the model exactly as stored.
const TEXT_KEYS = new Set([
  "acta_num", "num", "num_expedient", "num_proposta", "expedient_num", "referencia", "codi_postal",
  "telefon", "nif", "hora", "propera_hora", "nom", "titol", "text", "descripcio", "concepte", "comentari", "file_id",
]);

// Neon returns numerics as strings; show them as numbers (at most 4 decimals)
// where they parse cleanly and carry no leading zero.
export function jsonReplacer(key: string, value: unknown): unknown {
  if (typeof value !== "string" || TEXT_KEYS.has(key)) return value;
  if (!/^-?(0|[1-9]\d{0,14})(\.\d+)?$/.test(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : value;
}

// Misc -----------------------------------------------------------------------

export function num(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Characters of the tools/list JSON. ChatGPT reads only the first ~5,000
// tokens of tool definitions, so the visible tools must stay small.
export const TOOL_LIST_BUDGET_CHARS = 9000;

export function toolListWeight(tools: unknown[]): number {
  return JSON.stringify(tools).length;
}

export function suggestedIdempotencyKey(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Removes HTML tags from note content for compact reading.
export function stripHtml(html: string, max = 4000): string {
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > max ? `${text.slice(0, max)}… [truncat]` : text;
}
