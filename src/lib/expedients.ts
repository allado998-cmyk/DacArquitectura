// Shared metadata + colour system for Expedients, reused across the register,
// the stats dashboard and the Dedicació page.

import type { ExpedientCategoria, ExpedientEstat, ExpedientTipus } from "@/types/db";

export interface Swatch {
  color: string; // strong colour (dot / bar)
  bg: string; // soft background (badge)
  text: string; // readable text on bg
}

export interface CategoriaMeta extends Swatch {
  code: ExpedientCategoria;
  label: string;
  short: string;
}

export const CATEGORIES: CategoriaMeta[] = [
  { code: "re", label: "Rehabilitació", short: "RE", color: "#ef4444", bg: "#fef2f2", text: "#b91c1c" },
  { code: "co", label: "Consultoria", short: "CO", color: "#3b82f6", bg: "#eff6ff", text: "#1d4ed8" },
  { code: "ed", label: "Edificació", short: "ED", color: "#10b981", bg: "#ecfdf5", text: "#047857" },
  { code: "rec", label: "Reconstrucció", short: "REC", color: "#f59e0b", bg: "#fffbeb", text: "#b45309" },
  { code: "do", label: "Docència", short: "DO", color: "#14b8a6", bg: "#f0fdfa", text: "#0f766e" },
];

export const CATEGORY_BY_CODE: Record<string, CategoriaMeta> = Object.fromEntries(
  CATEGORIES.map((c) => [c.code, c]),
);

export const TIPUS: Record<ExpedientTipus, Swatch & { label: string }> = {
  privat: { label: "Privat", color: "#ec4899", bg: "#fce7f3", text: "#be185d" }, // pink
  public: { label: "Públic", color: "#a855f7", bg: "#f3e8ff", text: "#7e22ce" }, // purple
};

export const ESTAT: Record<ExpedientEstat, Swatch & { label: string }> = {
  obert: { label: "Obert", color: "#dc2626", bg: "#fee2e2", text: "#b91c1c" }, // red
  tancat: { label: "Tancat", color: "#16a34a", bg: "#dcfce7", text: "#15803d" }, // green
};

// Tipologies are a user-managed catalog, so colours are assigned deterministically
// from a palette (stable per name) to look like the categoria badges.
export const TIPOLOGIA_PALETTE: Swatch[] = [
  { color: "#ef4444", bg: "#fef2f2", text: "#b91c1c" },
  { color: "#f59e0b", bg: "#fffbeb", text: "#b45309" },
  { color: "#10b981", bg: "#ecfdf5", text: "#047857" },
  { color: "#14b8a6", bg: "#f0fdfa", text: "#0f766e" },
  { color: "#0ea5e9", bg: "#f0f9ff", text: "#0369a1" },
  { color: "#3b82f6", bg: "#eff6ff", text: "#1d4ed8" },
  { color: "#6366f1", bg: "#eef2ff", text: "#4338ca" },
  { color: "#8b5cf6", bg: "#f5f3ff", text: "#6d28d9" },
  { color: "#a855f7", bg: "#faf5ff", text: "#7e22ce" },
  { color: "#ec4899", bg: "#fdf2f8", text: "#be185d" },
];

export function tipologiaSwatch(key: string): Swatch {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TIPOLOGIA_PALETTE[h % TIPOLOGIA_PALETTE.length];
}
