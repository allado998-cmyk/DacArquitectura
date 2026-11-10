// The portal's ITE file (ITE/informes/dades/<id>/<nom>.xml) as a plain JS tree,
// and back. Runs in the browser, on the server and in Node scripts.
//
// What the portal writes (worked out from a real export, see docs/ite.md):
// - One element per Java field, no attributes, no XML declaration.
// - Null fields are left out; empty lists too.
// - In every element, `version` and `id` come first, then the rest in plain
//   alphabetical order (Java String order = UTF-16 code units).
// - Lists are the same tag repeated (<deficiencies>…</deficiencies><deficiencies>…).
// - Four spaces of indentation; text is written as is (only & < > escaped),
//   line breaks inside descriptions included.
// - Doubles look like Java's Double.toString ("18.0", "0.9"), dates like
//   "2025-04-03T00:00:00".
// - The export ends with an XML signature (<Signature>) made with the portal's
//   own certificate. We read past it and never write one.
//
// Leaves are kept as the exact strings of the file, so a report read and
// written again comes out byte for byte the same (scripts/test-ite.mjs).

export type IteObj = { [key: string]: IteVal };
export type IteVal = string | IteObj | IteVal[];

// Tags that are lists in the portal's model, even when they appear once.
export const LIST_TAGS: ReadonlySet<string> = new Set([
  "deficiencies",
  "fotos",
  "edificiEnvolupants",
  "plantes",
  "inspeccions",
  "mesures",
  "entry",
  "tecnics",
]);

export const ROOT_TAG = "informeTecnic";

export function isObj(v: unknown): v is IteObj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Parsing ----------------------------------------------------------------------

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

function decode(s: string): string {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

export interface ParsedIte {
  doc: IteObj;
  rootTag: string;
  signed: boolean;
}

// Reads an ITE XML. Throws a readable error if it is not one.
export function parseIteXml(xml: string): ParsedIte {
  const src = xml.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  type Frame = { tag: string; obj: IteObj; text: string; hasChildren: boolean };
  const stack: Frame[] = [];
  let root: Frame | null = null;
  let signed = false;
  let i = 0;
  const n = src.length;

  const put = (parent: Frame, tag: string, value: IteVal) => {
    parent.hasChildren = true;
    const cur = parent.obj[tag];
    if (LIST_TAGS.has(tag)) {
      if (Array.isArray(cur)) cur.push(value);
      else parent.obj[tag] = [value];
    } else if (cur === undefined) {
      parent.obj[tag] = value;
    } else if (Array.isArray(cur)) {
      cur.push(value);
    } else {
      parent.obj[tag] = [cur, value]; // an unexpected repeat: keep both
    }
  };

  while (i < n) {
    const lt = src.indexOf("<", i);
    if (lt < 0) break;
    if (stack.length) stack[stack.length - 1].text += src.slice(i, lt);
    if (src.startsWith("<?", lt)) { i = src.indexOf("?>", lt) + 2; if (i < 2) break; continue; }
    if (src.startsWith("<!--", lt)) { i = src.indexOf("-->", lt) + 3; if (i < 3) break; continue; }
    if (src.startsWith("<![CDATA[", lt)) {
      const end = src.indexOf("]]>", lt);
      if (end < 0) throw new Error("XML mal format (CDATA sense tancar).");
      if (stack.length) stack[stack.length - 1].text += src.slice(lt + 9, end).replace(/&/g, "&amp;").replace(/</g, "&lt;");
      i = end + 3;
      continue;
    }
    const gt = src.indexOf(">", lt);
    if (gt < 0) throw new Error("XML mal format.");
    const raw = src.slice(lt + 1, gt);
    i = gt + 1;
    if (raw.startsWith("/")) {
      const tag = raw.slice(1).trim();
      const f = stack.pop();
      if (!f || f.tag !== tag) throw new Error(`XML mal format: </${tag}> inesperat.`);
      const value: IteVal = f.hasChildren ? f.obj : decode(f.text);
      if (stack.length) put(stack[stack.length - 1], f.tag, value);
      else root = f;
      continue;
    }
    const selfClose = raw.endsWith("/");
    const tag = (selfClose ? raw.slice(0, -1) : raw).trim().split(/\s/)[0];
    if (!/^[A-Za-z_][\w.:-]*$/.test(tag)) throw new Error("XML mal format.");
    // The portal's signature: skip it whole.
    if (tag === "Signature" && stack.length === 1) {
      signed = true;
      const end = src.indexOf("</Signature>", i);
      if (end < 0) throw new Error("XML mal format (signatura sense tancar).");
      i = end + "</Signature>".length;
      continue;
    }
    const frame: Frame = { tag, obj: {}, text: "", hasChildren: false };
    if (selfClose) {
      if (stack.length) put(stack[stack.length - 1], tag, "");
      else root = frame;
      continue;
    }
    stack.push(frame);
  }
  if (stack.length) throw new Error("XML incomplet.");
  if (!root || !isObj(root.obj) || !root.hasChildren) throw new Error("No és un fitxer d'informe ITE.");
  return { doc: root.obj, rootTag: root.tag, signed };
}

// Writing ----------------------------------------------------------------------

function rank(key: string): number {
  return key === "version" ? 0 : key === "id" ? 1 : 2;
}

// version, id, then Java String order.
export function compareKeys(a: string, b: string): number {
  const r = rank(a) - rank(b);
  if (r) return r;
  return a < b ? -1 : a > b ? 1 : 0;
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function writeValue(out: string[], tag: string, v: IteVal | null | undefined, depth: number): void {
  if (v === null || v === undefined) return;
  if (Array.isArray(v)) {
    for (const item of v) writeValue(out, tag, item, depth);
    return;
  }
  const pad = "    ".repeat(depth);
  if (typeof v === "string") {
    out.push(`${pad}<${tag}>${escapeText(v.replace(/\r\n?/g, "\n"))}</${tag}>\n`);
    return;
  }
  out.push(`${pad}<${tag}>\n`);
  for (const k of Object.keys(v).sort(compareKeys)) writeValue(out, k, v[k], depth + 1);
  out.push(`${pad}</${tag}>\n`);
}

// The unsigned XML, exactly as the portal lays it out.
export function serializeIteXml(doc: IteObj, rootTag = ROOT_TAG): string {
  const out: string[] = [];
  writeValue(out, rootTag, doc, 0);
  return out.join("").replace(/\n$/, "");
}

// Values -----------------------------------------------------------------------

// Java's Double.toString for the numbers an ITE holds.
export function javaDouble(n: number): string {
  if (!Number.isFinite(n)) return "0.0";
  return Number.isInteger(n) ? `${n}.0` : String(n);
}

// "2025-04-03" → "2025-04-03T00:00:00"
export function javaDate(iso: string): string {
  return `${iso.slice(0, 10)}T00:00:00`;
}

export function isoOfJavaDate(v: string | undefined | null): string {
  return v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : "";
}

// File name the portal gives the export: the report's name without accents,
// spaces or punctuation ("Inspecció Tècnica … 325 de Barcelona" →
// "InspeccioTecnica…325deBarcelona").
export function portalFileBase(nom: string): string {
  const base = nom.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "");
  return base || "InformeITE";
}
