// Drawing of the composite section of «Suma d'inèrcies», with the real numbers:
// piece 1 on top and piece 2 under it, on the tension side (the sheets measure
// y down to the «fibra traccionada» of piece 2), both to the same scale; the
// centroids G1 and G2, the new centroid G and the distances X, d and y. Plain
// SVG markup, so it shows in the editor, prints in the PDF and becomes a PNG in
// Word (like gola-figura.ts).

import { type Figure, fmt } from "./common";

export interface Peca {
  label: string; // "IPN 140", "Pletina 300 × 10 mm"
  shape: "rect" | "I" | "U"; // plate, I / H profile, UPN
  h: number; // cm, as used in the calculation
  b: number | null; // cm; null → a profile not in the catalogue, drawn h / 2 wide
  tw?: number | null; // cm
  tf?: number | null; // cm
}

export interface SeccioFiguraDades {
  top: Peca;
  bottom: Peca;
  X: number; // cm, G1 → G2
  d: number | null; // cm, G1 → G
  y: number | null; // cm, G → fibra traccionada
  IT: number | null; // cm⁴
  WT: number | null; // cm³
}

const W = 1000;
const INK = "#1f2933";
const MUTED = "#5b6670";
const ACCENT = "#d4572a";
const FILL_TOP = "#dfe7ef";
const FILL_BOTTOM = "#f6e3cf";
// The canvas is as tall as the drawing needs. The opening tag is plain strings
// joined with + on purpose (see gola-figura.ts: the production compiler cut a
// constant-only template-literal opening tag after its last substitution).
function open(h: number): string {
  const hs = String(Math.round(h));
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ' + hs + '" width="1000" height="' + hs + '"' +
    ' font-family="Segoe UI, Helvetica, Arial, sans-serif" role="img" aria-label="Secció composta i centres de gravetat"' +
    ' style="width:100%;height:auto;max-width:640px;display:block;margin:0 auto;">' +
    '<rect width="1000" height="' + hs + '" fill="#fff"/>'
  );
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const p = (n: number) => n.toFixed(1);
const cm = (n: number | null, unit = "cm") => (n == null ? "—" : `${fmt(n, 2)} ${unit}`);

function line(x1: number, y1: number, x2: number, y2: number, color: string, width: number, dash = ""): string {
  return `<line x1="${p(x1)}" y1="${p(y1)}" x2="${p(x2)}" y2="${p(y2)}" stroke="${color}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
}

function text(x: number, y: number, s: string, opts: { anchor?: string; size?: number; color?: string; weight?: number; italic?: boolean } = {}): string {
  return `<text x="${p(x)}" y="${p(y)}" text-anchor="${opts.anchor ?? "start"}" font-size="${opts.size ?? 20}" fill="${opts.color ?? INK}"${opts.weight ? ` font-weight="${opts.weight}"` : ""}${opts.italic ? ' font-style="italic"' : ""}>${esc(s)}</text>`;
}

// Outline of a piece, centred on cx, between y = top and y = top + h·s (px).
function outline(pc: Peca, cx: number, top: number, s: number, fill: string): string {
  const hh = Math.max(pc.h * s, 4);
  const bb = (pc.b ?? pc.h / 2) * s;
  const bot = top + hh;
  const L = cx - bb / 2;
  const R = cx + bb / 2;
  let pts: number[][];
  if (pc.shape === "rect") {
    pts = [[L, top], [R, top], [R, bot], [L, bot]];
  } else {
    const tf = Math.min(Math.max((pc.tf ?? pc.h / 14) * s, 3), hh / 3);
    const tw = Math.min(Math.max((pc.tw ?? pc.h / 20) * s, 3), bb / 2);
    if (pc.shape === "U") {
      pts = [[L, top], [R, top], [R, top + tf], [L + tw, top + tf], [L + tw, bot - tf], [R, bot - tf], [R, bot], [L, bot]];
    } else {
      const wl = cx - tw / 2;
      const wr = cx + tw / 2;
      pts = [[L, top], [R, top], [R, top + tf], [wr, top + tf], [wr, bot - tf], [R, bot - tf], [R, bot], [L, bot], [L, bot - tf], [wl, bot - tf], [wl, top + tf], [L, top + tf]];
    }
  }
  return `<polygon points="${pts.map(([x, y]) => `${p(x)},${p(y)}`).join(" ")}" fill="${fill}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
}

// A vertical dimension from y1 to y2 at x, with ticks and a letter beside it.
function dim(x: number, y1: number, y2: number, letter: string, color: string): string {
  const mid = (y1 + y2) / 2;
  return (
    line(x, y1, x, y2, color, 2) +
    line(x - 8, y1, x + 8, y1, color, 2) +
    line(x - 8, y2, x + 8, y2, color, 2) +
    text(x + 10, mid + 7, letter, { size: 22, color, italic: true, weight: 600 })
  );
}

export function seccioFigure(f: SeccioFiguraDades): Figure | undefined {
  const { top, bottom } = f;
  const total = top.h + bottom.h;
  const wide = Math.max(top.b ?? top.h / 2, bottom.b ?? bottom.h / 2);
  if (!(total > 0) || !(wide > 0) || !Number.isFinite(f.X)) return undefined;

  // Scale: the section fits a 500 × 430 px box, with the piece labels on its
  // left and the dimensions on its right.
  const s = Math.min(430 / total, 500 / wide);
  const cx = 525;
  const y0 = 50;
  const y1 = y0 + Math.max(top.h * s, 4); // joint
  const yBot = y1 + Math.max(bottom.h * s, 4); // fibra traccionada
  const halfW = (wide * s) / 2;
  const R = cx + halfW;
  const gy1 = y0 + (top.h / 2) * s;
  const gy2 = gy1 + f.X * s;
  const gy = f.d == null ? null : gy1 + f.d * s;
  const low = Math.max(yBot, gy2, gy ?? 0);
  const H = low + 136;

  const xX = R + 70;
  const xD = R + 120;
  const xY = R + 170;
  const axisL = cx - halfW - 24;

  let svg = open(H);
  svg += outline(top, cx, y0, s, FILL_TOP);
  svg += outline(bottom, cx, y1, s, FILL_BOTTOM);

  // Piece labels on the left (clear of the axes), at mid-height of each piece.
  svg += text(axisL - 10, (y0 + y1) / 2 + 7, `1 · ${top.label}`, { anchor: "end", size: 19 });
  svg += text(axisL - 10, (y1 + yBot) / 2 + 7, `2 · ${bottom.label}`, { anchor: "end", size: 19 });

  // Centroid axes.
  svg += line(axisL, gy1, xD + 8, gy1, MUTED, 1.5, "8 6");
  svg += text(R + 12, gy1 - 6, "G1", { size: 18, color: MUTED });
  svg += line(axisL, gy2, xX + 8, gy2, MUTED, 1.5, "8 6");
  svg += text(R + 12, gy2 - 6, "G2", { size: 18, color: MUTED });
  if (gy != null) {
    svg += line(axisL, gy, xY + 8, gy, ACCENT, 2.5);
    svg += text(R + 40, gy - 8, "G", { size: 20, color: ACCENT, weight: 700 });
  }
  // Tension fibre.
  svg += line(R + 4, yBot, xY + 8, yBot, MUTED, 1.5, "3 4");
  svg += text(cx, yBot + 30, "Fibra traccionada", { anchor: "middle", size: 18, color: MUTED, italic: true });

  // Dimensions.
  svg += dim(xX, gy1, gy2, "X", INK);
  if (gy != null) {
    svg += dim(xD, gy1, gy, "d", ACCENT);
    svg += dim(xY, gy, yBot, "y", ACCENT);
  }

  // Values.
  svg += text(W / 2, low + 82, `X = ${cm(f.X)} · d = ${cm(f.d)} · y = ${cm(f.y)}`, { anchor: "middle", size: 21, color: MUTED });
  svg += text(W / 2, low + 116, `IT = ${cm(f.IT, "cm⁴")} · WT = ${cm(f.WT, "cm³")}`, { anchor: "middle", size: 22, weight: 700 });
  svg += "</svg>";
  return { svg, width: W, height: Math.round(H), alt: `Secció composta: ${top.label} + ${bottom.label}` };
}
