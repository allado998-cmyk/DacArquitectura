// File names for exported documents, following the office's quality codes:
//   FE75.01-02 Acta de Projecte-261699-03-261009
//     (expedient number / acta number / date as YYMMDD)
//   FE72.01-02 Proposta d'Honoraris-2611-Ajuntament de Barcelona Estudi de …
//     (proposal number / project, from the description)
//   FE72.01-08 Model de Factura-26006-DO Salón Jardín Torre Melina …
//     (invoice number / invoice name, from the concept)
// The same name is used for the Word download and as the print window title,
// which browsers offer as the file name when saving as PDF.

// Characters Windows does not allow in file names, plus control characters.
const INVALID = /[\\/:*?"<>|\u0000-\u001f]/g;

export function safeFileName(s: string, max = 180): string {
  return s
    .replace(INVALID, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .replace(/[.\s]+$/, "");
}

// First non-empty line of a free-text field, for use in a name.
export function firstLine(s: string | null | undefined, max = 120): string {
  const line = (s ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);
  return (line ?? "").slice(0, max).trim();
}

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

// "2026-10-09" -> "261009"
export function yymmdd(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[1].slice(2)}${m[2]}${m[3]}` : "";
}

function join(prefix: string, parts: string[]): string {
  return safeFileName([prefix, ...parts.filter(Boolean)].join("-"));
}

// Expedient "26-1699" -> "261699"; acta nº kept as written ("03").
export function actaFileName(a: { expedientNum?: string | null; referencia?: string | null; actaNum?: string | null; data?: string | null }): string {
  const exp = digits(a.expedientNum) || digits(a.referencia);
  const num = (a.actaNum ?? "").trim() || "00";
  return join("FE75.01-02 Acta de Projecte", [exp, num, yymmdd(a.data)]);
}

// Proposal "PH-26-011" -> "2611" (year + number without leading zeros).
export function propostaNumForFile(num: string | null | undefined): string {
  const m = /(\d{2})-(\d+)\s*$/.exec(num ?? "");
  return m ? `${m[1]}${parseInt(m[2], 10)}` : digits(num);
}

export function propostaFileName(num: string | null | undefined, descripcio: string | null | undefined): string {
  return join("FE72.01-02 Proposta d'Honoraris", [propostaNumForFile(num), firstLine(descripcio)]);
}

// Invoice "26-006" -> "26006".
export function facturaFileName(num: string | null | undefined, concepte: string | null | undefined): string {
  return join("FE72.01-08 Model de Factura", [digits(num), firstLine(concepte)]);
}
