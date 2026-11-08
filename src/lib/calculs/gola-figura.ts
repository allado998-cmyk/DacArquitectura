// Drawing of the two flange-weld options of «Gola soldadura i compatibilitat»,
// redrawn from David's sheet with the real numbers: option 1 welds the outer
// face and both inner faces of each flange (perimeter), option 2 only the
// outer face; the web is welded on both sides in both. Plain SVG markup, so it
// shows in the editor, prints in the PDF and is turned into a PNG for Word.

import { type Figure, fmt } from "./common";

export interface GolaFiguraDades {
  peca2: string; // what the profile is welded to, e.g. "UPN 280" or "xapa 10 mm"
  h: number;
  b: number;
  tw: number;
  tf: number;
  r: number;
  lExt: number; // mm, outer flange weld
  lInt: number; // mm, each inner flange weld
  lTotal: number; // mm, option 1 per flange
  aAles1: number | null; // mm, throat to use
  aAles2: number | null;
  aAnima: number | null;
}

const W = 1000;
const H = 660;
const ORANGE = "#d4572a";
const GREEN = "#1d9a72";
const INK = "#1f2933";
const MUTED = "#5b6670";
// The opening tag is one plain string on purpose: written as a template with the
// constants above substituted in, the production compiler dropped everything after
// the last substitution (the tag came out cut and the drawing empty).
const OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 660" width="1000" height="660" font-family="Segoe UI, Helvetica, Arial, sans-serif" role="img" aria-label="Opcions de soldadura de les ales i l’ànima" style="width:100%;height:auto;max-width:640px;display:block;margin:0 auto;">' +
  '<rect width="1000" height="660" fill="#fff"/>';

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const mm = (n: number | null, d = 1) => (n == null ? "—" : `${fmt(n, d)} mm`);

function panel(cx: number, d: GolaFiguraDades, perimetral: boolean): string {
  // Profile drawn to scale inside a 300 × 380 box; very thin parts are thickened to stay visible.
  const s = Math.min(380 / d.h, 300 / d.b);
  const hh = d.h * s;
  const bb = d.b * s;
  const tf = Math.max(d.tf * s, 9);
  const tw = Math.max(d.tw * s, 7);
  const r = d.r * s;
  const top = 100;
  const bot = top + hh;
  const L = cx - bb / 2;
  const R = cx + bb / 2;
  const wl = cx - tw / 2;
  const wr = cx + tw / 2;
  const outline = [
    [L, top], [R, top], [R, top + tf], [wr, top + tf], [wr, bot - tf], [R, bot - tf], [R, bot], [L, bot], [L, bot - tf], [wl, bot - tf], [wl, top + tf], [L, top + tf],
  ].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  const line = (x1: number, y1: number, x2: number, y2: number, color: string, width: number, dash = "") =>
    `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="${width}" stroke-linecap="${dash ? "butt" : "round"}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;

  let welds = "";
  // outer faces of both flanges (both options)
  welds += line(L - 2, top - 7, R + 2, top - 7, ORANGE, 8);
  welds += line(L - 2, bot + 7, R + 2, bot + 7, ORANGE, 8);
  if (perimetral) {
    // inner faces, from each flange tip to the root fillet
    const inL = wl - r - 4;
    const inR = wr + r + 4;
    for (const y of [top + tf + 7, bot - tf - 7]) {
      welds += line(L + 3, y, Math.max(L + 10, inL), y, ORANGE, 7, "14 7");
      welds += line(Math.min(R - 10, inR), y, R - 3, y, ORANGE, 7, "14 7");
    }
  }
  // web, both sides, between the root fillets
  const wTop = top + tf + r + 10;
  const wBot = bot - tf - r - 10;
  welds += line(wl - 9, wTop, wl - 9, wBot, GREEN, 7);
  welds += line(wr + 9, wTop, wr + 9, wBot, GREEN, 7);

  const frame = `<rect x="${(cx - 175).toFixed(1)}" y="${top - 30}" width="350" height="${(hh + 60).toFixed(1)}" rx="6" fill="none" stroke="#b9bfc6" stroke-dasharray="6 5"/>`;
  const label = `<text x="${cx}" y="${top - 44}" text-anchor="middle" font-size="20" fill="${MUTED}">Unió a ${esc(d.peca2)}</text>`;
  const ty = bot + 64;
  const title = perimetral ? "Opció 1 · cordó perimetral" : "Opció 2 · només cordó exterior";
  const ala = perimetral ? `Ala: ${fmt(d.lExt, 0)} + 2 × ${fmt(d.lInt, 0)} = ${fmt(d.lTotal, 0)} mm` : `Ala: ${fmt(d.lExt, 0)} mm`;
  const gola = `a ales = ${mm(perimetral ? d.aAles1 : d.aAles2)} · a ànima = ${mm(d.aAnima)}`;
  const text =
    `<text x="${cx}" y="${ty}" text-anchor="middle" font-size="24" font-weight="700" fill="${INK}">${esc(title)}</text>` +
    `<text x="${cx}" y="${ty + 32}" text-anchor="middle" font-size="20" fill="${MUTED}">${esc(ala)}</text>` +
    `<text x="${cx}" y="${ty + 60}" text-anchor="middle" font-size="20" fill="${MUTED}">${esc(gola)}</text>`;
  return frame + label + `<polygon points="${outline}" fill="#fff" stroke="${INK}" stroke-width="2"/>` + welds + text;
}

export function golaFigure(d: GolaFiguraDades): Figure {
  const legendY = H - 28;
  const legend =
    `<line x1="120" y1="${legendY}" x2="180" y2="${legendY}" stroke="${ORANGE}" stroke-width="8" stroke-linecap="round"/>` +
    `<text x="192" y="${legendY + 7}" font-size="19" fill="${MUTED}">Cara exterior d’ala</text>` +
    `<line x1="420" y1="${legendY}" x2="480" y2="${legendY}" stroke="${ORANGE}" stroke-width="7" stroke-dasharray="14 7"/>` +
    `<text x="492" y="${legendY + 7}" font-size="19" fill="${MUTED}">Cara interior d’ala</text>` +
    `<line x1="710" y1="${legendY}" x2="770" y2="${legendY}" stroke="${GREEN}" stroke-width="7" stroke-linecap="round"/>` +
    `<text x="782" y="${legendY + 7}" font-size="19" fill="${MUTED}">Ànima (2 cares)</text>`;
  const svg =
    OPEN +
    panel(250, d, true) +
    panel(750, d, false) +
    legend +
    `</svg>`;
  return { svg, width: W, height: H, alt: "Opcions de soldadura: cordó perimetral o només exterior" };
}
