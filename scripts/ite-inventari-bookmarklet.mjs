#!/usr/bin/env node
// Packs scripts/portal-inventari.js into a bookmarklet: one line to paste as
// the URL of a bookmark. Clicking it on a page of the ITE portal downloads the
// inventory of that page's form (see portal-inventari.js).
//
//   node scripts/ite-inventari-bookmarklet.mjs   → scripts/portal-inventari.bookmarklet.txt
import { readFile, writeFile } from "node:fs/promises";

const src = new URL("./portal-inventari.js", import.meta.url);
const out = new URL("./portal-inventari.bookmarklet.txt", import.meta.url);
const code = (await readFile(src, "utf8"))
  .split("\n")
  .filter((l) => !/^\s*\/\//.test(l)) // whole-line comments only; strings may hold "//"
  .join("\n")
  .trim()
  .replace(/;\s*$/, "");
if (!code.startsWith("(function") || !code.endsWith("()")) throw new Error("portal-inventari.js must be a single (function(){…})() expression");
const url = "javascript:void(" + encodeURIComponent(code) + ")";
await writeFile(out, url + "\n");
console.log(`${out.pathname.replace(/^\/([A-Za-z]:)/, "$1")}: ${url.length} characters.`);
console.log("Chrome: Bookmarks → Bookmark manager → ⋮ → Add new bookmark → name «Inventari ITE», URL = the line in that file.");
