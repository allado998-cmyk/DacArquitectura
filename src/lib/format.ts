const eurFormatter = new Intl.NumberFormat("ca-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const eurFormatter4 = new Intl.NumberFormat("ca-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const numberFormatter = new Intl.NumberFormat("ca-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatEur(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (n == null || isNaN(n)) return "—";
  return eurFormatter.format(n);
}

export function formatEurPrecise(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (n == null || isNaN(n)) return "—";
  return eurFormatter4.format(n);
}

export function formatNumber(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (n == null || isNaN(n)) return "—";
  return numberFormatter.format(n);
}

// Parse "1.234,56" (Catalan) and "1234.56" (server) into a Number.
export function parseLocaleNumber(input: string): number {
  if (input == null) return NaN;
  const trimmed = input.trim();
  if (!trimmed) return NaN;
  // If there's a comma but no dot, treat comma as decimal separator.
  // If there's both, dots are thousand separators.
  let normalised = trimmed;
  if (trimmed.includes(",")) {
    normalised = trimmed.replace(/\./g, "").replace(",", ".");
  }
  return parseFloat(normalised);
}

export function todayIso(): string {
  // YYYY-MM-DD in the server's local time (UTC on Vercel).
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDataCa(iso: string): string {
  // 2026-05-28 → 28/05/2026
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
