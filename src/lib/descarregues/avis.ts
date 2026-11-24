// After each run of the cron (Monday, Wednesday and Friday morning) the studio
// gets the e-mail «Actualització dades DAC» with the Global (ZIP) attached, as
// David asked (ticket #24). To the addresses of DESCARREGUES_AVIS (separated
// by commas), from the account of src/lib/correu.ts. Never for the demo
// account, nor for a run by hand with `?avis=0` (api/cron/descarregues).
import { correuConfigurat, enviarCorreu, type Adjunt } from "@/lib/correu";
import { fmtMida } from "@/lib/fitxers-shared";
import { diaBcn, type Manifest } from "./cataleg";
import type { Logo } from "./pdf";

export const ASSUMPTE = "Actualització dades DAC";

// Gmail takes up to 25 MB per message, base64 included: a bigger zip only gets the link.
const MAX_ADJUNT = 15 * 1024 * 1024;

export function destinataris(): string[] {
  return (process.env.DESCARREGUES_AVIS ?? "").split(/[,;\s]+/).filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// "dimecres 25 de novembre" and "06:00", in Barcelona.
function quan(d: Date): { dia: string; hora: string } {
  const timeZone = "Europe/Madrid";
  const setmana = new Intl.DateTimeFormat("ca-ES", { timeZone, weekday: "long" }).format(d);
  const data = new Intl.DateTimeFormat("ca-ES", { timeZone, day: "numeric", month: "long" }).format(d);
  const hora = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return { dia: `${setmana} ${data}`, hora };
}

// The page, through the login (which comes back to it) in case the session has expired.
function enllac(origin?: string): string | null {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const base = prod ? `https://${prod}` : origin;
  return base ? `${base}/login?next=${encodeURIComponent("/descarregues")}` : null;
}

// What happened, for the cron's log: "enviat (1)", "no enviat: …" or "error: …".
export async function enviarAvis(opts: { manifest: Manifest; zip: Uint8Array; logo?: Logo | null; origin?: string }): Promise<string> {
  const to = destinataris();
  if (!to.length) return "no enviat: DESCARREGUES_AVIS buida";
  if (!correuConfigurat()) return "no enviat: falten SMTP_USER / SMTP_PASS";

  const { manifest, zip, logo } = opts;
  const generat = new Date(manifest.generat);
  const { dia, hora } = quan(generat);
  const mida = fmtMida(zip.byteLength);
  const adjunt = zip.byteLength <= MAX_ADJUNT;
  const href = enllac(opts.origin);

  const paragrafs = [
    `Les dades de DAC s'han actualitzat avui, ${dia}, a les ${hora}.`,
    adjunt
      ? `El Global (ZIP) va adjunt a aquest correu: els ${manifest.fitxers.length} PDF de Descàrregues, per carpetes (${mida}).`
      : `El Global (ZIP) fa ${mida}, massa per adjuntar-lo a un correu: el pots baixar a Descàrregues.`,
  ];
  const peu = "Correu automàtic de DacArquitectura. Arriba cada dilluns, dimecres i divendres al matí, quan es tornen a generar els PDF.";
  const text = [
    "Hola,",
    ...paragrafs,
    ...(href ? [`Obrir Descàrregues (també hi pots baixar cada PDF per separat): ${href}`] : []),
    `--\n${peu}`,
  ].join("\n\n");

  const logoW = logo ? Math.round((40 * logo.width) / logo.height) : 0;
  const html = `<!doctype html>
<html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(ASSUMPTE)}</title></head>
<body style="margin:0;padding:0;background:#fafaf7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf7;padding:24px 12px;font-family:Helvetica,Arial,sans-serif;color:#111111;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e5e0;border-radius:10px;">
<tr><td style="padding:20px 28px;border-bottom:1px solid #e5e5e0;">${
    logo
      ? `<img src="cid:logo@dac" width="${logoW}" height="40" alt="DAC arquitectura" style="display:block;border:0;">`
      : `<span style="font-size:20px;font-weight:600;">DAC</span> <span style="font-size:15px;color:#6b6b66;">arquitectura</span>`
  }</td></tr>
<tr><td style="padding:24px 28px 8px;font-size:15px;line-height:1.55;">
<p style="margin:0 0 14px;">Hola,</p>
${paragrafs.map((p) => `<p style="margin:0 0 14px;">${esc(p)}</p>`).join("\n")}
</td></tr>
${
  href
    ? `<tr><td style="padding:6px 28px 24px;">
<a href="${esc(href)}" style="display:inline-block;background:#1f4d3f;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:11px 20px;border-radius:8px;">Obrir Descàrregues</a>
<p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:#6b6b66;">També hi pots baixar cada PDF per separat.</p>
</td></tr>`
    : ""
}
<tr><td style="padding:14px 28px;border-top:1px solid #e5e5e0;font-size:12px;line-height:1.5;color:#6b6b66;">${esc(peu)}</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  const adjunts: Adjunt[] = [];
  if (logo) adjunts.push({ filename: "logo.jpg", content: Buffer.from(logo.data), contentType: "image/jpeg", cid: "logo@dac" });
  if (adjunt) adjunts.push({ filename: `DAC Descàrregues ${diaBcn(generat)}.zip`, content: Buffer.from(zip), contentType: "application/zip" });

  try {
    await enviarCorreu({ to, subject: ASSUMPTE, html, text, adjunts });
    return `enviat (${to.length})`;
  } catch (e) {
    console.error("descarregues: el correu no s'ha pogut enviar", e);
    return `error: ${e instanceof Error ? e.message : String(e)}`;
  }
}
