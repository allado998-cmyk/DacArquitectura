// Module hooks for scripts/test-mcp.mjs and scripts/test-calculs.mjs: resolve
// the "@/..." alias to src/, load .ts files with Node's built-in type
// stripping, load .json imports (which src/ imports without an `type: "json"`
// attribute), and swap the modules that need a running Next.js app or a
// database for small stubs.
import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

const STUBS = {
  "next/cache": `export function revalidatePath() {} export function revalidateTag() {}`,
  "next/navigation": `
    export function redirect(url) { const e = new Error("NEXT_REDIRECT"); e.digest = "NEXT_REDIRECT;replace;" + url + ";307;"; throw e; }
    export function notFound() { const e = new Error("NEXT_NOT_FOUND"); e.digest = "NEXT_HTTP_ERROR_FALLBACK;404"; throw e; }`,
  "next/headers": `
    export async function cookies() { return { get() { return undefined; }, getAll() { return []; }, set() {}, delete() {} }; }
    export async function headers() { return new Headers(); }`,
  "next/server": `
    export function after(fn) { Promise.resolve().then(fn).catch(() => {}); }
    export class NextResponse extends Response {}`,
  "@/lib/db": `
    function run(text, params) {
      if (typeof globalThis.__fakeSql !== "function") throw new Error("fake sql not installed");
      return globalThis.__fakeSql(text, params);
    }
    function tag(strings, ...values) {
      if (Array.isArray(strings) && "raw" in strings) {
        let text = ""; strings.forEach((s, i) => { text += s; if (i < values.length) text += "$" + (i + 1); });
        return run(text, values);
      }
      return run(String(strings), values[0] ?? []);
    }
    tag.query = (text, params) => run(text, params ?? []);
    export const sql = tag;`,
};

async function exists(p) {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

async function probe(base) {
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) if (await exists(c)) return c;
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier in STUBS) return { url: `dac-stub:${specifier}`, shortCircuit: true };
  if (specifier.startsWith("@/")) {
    const found = await probe(join(SRC, specifier.slice(2)));
    if (!found) throw new Error(`cannot resolve ${specifier}`);
    return { url: pathToFileURL(found).href, shortCircuit: true };
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:") && context.parentURL.includes("/src/")) {
    const base = join(dirname(fileURLToPath(context.parentURL)), specifier);
    const found = await probe(base);
    if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith("dac-stub:")) return { format: "module", source: STUBS[url.slice("dac-stub:".length)], shortCircuit: true };
  if (url.startsWith("file:") && /\.tsx?$/.test(url)) {
    const source = await readFile(fileURLToPath(url), "utf8");
    return { format: "module-typescript", source, shortCircuit: true };
  }
  if (url.startsWith("file:") && url.endsWith(".json") && url.includes("/src/")) {
    const source = await readFile(fileURLToPath(url), "utf8");
    return { format: "module", source: `export default ${source};`, shortCircuit: true };
  }
  return nextLoad(url, context);
}
