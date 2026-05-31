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
