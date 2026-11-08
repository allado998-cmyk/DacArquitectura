// «Estat de càrregues» of the joist checks (biguetes d'acer estàndard, d'acer
// d'ala estreta i de fusta): the same table heads the three sheets. The load
// on a joist per metre is q · amplada (kN/ml = N/mm), times its coefficient.
//
//   upper load-bearing walls   kN/m³ · (gruix · alçària) m²
//   floor (pes propi estructural, paviments i morter, envans | ús, neu, vent)
//                               kN/m² · amplada (intereix) m
//
// The timber sheet repeats the table for the fire situation («Estat de
// càrregues proposat en cas de foc») with the same loads and its own
// coefficients; that version is built here too (mode "foc").

import { type LoadGroup, type LoadLine, G, num } from "./common";
import type { AuxImage } from "./ajuda";

export interface CarreguesDades {
  paretPes: number; // kN/m³, parets de càrrega superiors
  paretGruix: number; // m
  paretAlcada: number; // m
  gParet: number;
  amplada: number; // m, amplària de càrrega (intereix)
  pp: number; // kN/m², pes propi estructural
  cp: number; // paviments i morter
  envans: number;
  gG: number; // permanents
  us: number; // kN/m², sobrecàrregues
  neu: number;
  vent: number;
  gUs: number;
  gNeu: number;
  gVent: number;
}

// Coefficients of the fire situation (timber sheet, rows 103–111).
export interface CarreguesFocDades {
  fParet: number;
  fPp: number;
  fCp: number;
  fEnvans: number;
  fUs: number;
  fNeu: number;
  fVent: number;
}

export function carreguesDefaults(floor: { amplada: number; pp: number; cp: number; envans: number; us: number }): CarreguesDades {
  return { paretPes: 0, paretGruix: 0.15, paretAlcada: 5, gParet: 1.35, ...floor, neu: 0, vent: 0, gG: 1.35, gUs: 1.5, gNeu: 1.5, gVent: 1.5 };
}
export const CARREGUES_FOC_DEFAULT: CarreguesFocDades = { fParet: 1, fPp: 1, fCp: 1, fEnvans: 1, fUs: 0.6, fNeu: 0.2, fVent: 0.5 };

export interface EstatCarregues {
  groups: LoadGroup[];
  qEls: number; // N/mm (kN/ml), every line, unfactored
  qElu: number; // factored
  // Permanent (parets + sostre) and variable parts, without the profile line.
  cpEls: number;
  cvEls: number;
  cpElu: number;
  cvElu: number;
}

// kN/ml → kg/ml, for the conversion column.
export const kgMl = (kNml: number | null) => (kNml == null ? null : (kNml * 1000) / G);

function ln(label: string, q: number, qUnit: string, width: number | null, widthUnit: string, gamma: number, keys: { q?: string; width?: string; gamma?: string }): LoadLine {
  const unf = width == null ? q : q * width;
  return { label, q, qUnit, width, widthUnit, unf, gamma, fac: unf * gamma, qKey: keys.q, widthKey: keys.width, gammaKey: keys.gamma };
}

// mode "inicial": loads, widths and coefficients are inputs.
// mode "foc": the same loads (read-only) with the fire coefficients as inputs.
export function estatCarregues(d: CarreguesDades & Partial<CarreguesFocDades>, opts: { perfil?: LoadLine; mode?: "inicial" | "foc" } = {}): EstatCarregues {
  const foc = opts.mode === "foc";
  const f = { ...CARREGUES_FOC_DEFAULT, ...d };
  const k = <T extends string>(key: T) => (foc ? undefined : key);
  const coef = (initial: number, fire: number) => (foc ? num(fire) : num(initial));

  const area = num(d.paretGruix) * num(d.paretAlcada);
  const lParet = ln("Pes propi de les parets de càrrega superiors", num(d.paretPes), "kN/m³", area, "m²", coef(d.gParet, f.fParet), { q: k("paretPes"), gamma: foc ? "fParet" : "gParet" });

  const w = num(d.amplada);
  const gG = num(d.gG);
  const lPp = ln("Pes propi estructural", num(d.pp), "kN/m²", w, "m", coef(gG, f.fPp), { q: k("pp"), width: k("amplada"), gamma: foc ? "fPp" : "gG" });
  const lCp = ln("Càrregues permanents de paviments i morter", num(d.cp), "kN/m²", w, "m", coef(gG, f.fCp), { q: k("cp"), gamma: foc ? "fCp" : undefined });
  const lEnvans = ln("Càrregues permanents d'envans", num(d.envans), "kN/m²", w, "m", coef(gG, f.fEnvans), { q: k("envans"), gamma: foc ? "fEnvans" : undefined });
  const lUs = ln("Sobrecàrrega d'ús", num(d.us), "kN/m²", w, "m", coef(d.gUs, f.fUs), { q: k("us"), gamma: foc ? "fUs" : "gUs" });
  const lNeu = ln("Sobrecàrrega de neu", num(d.neu), "kN/m²", w, "m", coef(d.gNeu, f.fNeu), { q: k("neu"), gamma: foc ? "fNeu" : "gNeu" });
  const lVent = ln("Sobrecàrrega de vent", num(d.vent), "kN/m²", w, "m", coef(d.gVent, f.fVent), { q: k("vent"), gamma: foc ? "fVent" : "gVent" });

  const floor = [lPp, lCp, lEnvans, lUs, lNeu, lVent];
  const sum = (ls: LoadLine[], key: "unf" | "fac") => ls.reduce((a, l) => a + (l[key] ?? 0), 0);

  const groups: LoadGroup[] = [];
  if (opts.perfil) groups.push({ title: "Accions permanents · perfil d'apeuament", lines: [{ line: opts.perfil }] });
  groups.push({
    title: "Accions permanents · parets de càrrega superiors",
    lines: [
      ...(foc
        ? []
        : [
            { param: { label: "Gruix de la paret de càrrega", value: num(d.paretGruix), unit: "m", key: "paretGruix" } },
            { param: { label: "Alçària de la paret de càrrega", value: num(d.paretAlcada), unit: "m", key: "paretAlcada" } },
          ]),
      { line: lParet },
    ],
  });
  groups.push({
    title: "Càrregues del sostre",
    lines: [
      { heading: "Accions permanents" },
      { line: lPp },
      { line: lCp },
      { line: lEnvans },
      { heading: "Accions variables" },
      { line: lUs },
      { line: lNeu },
      { line: lVent },
    ],
    total: { label: "Total càrregues del sostre", q: floor.reduce((a, l) => a + (l.q ?? 0), 0), unf: sum(floor, "unf"), fac: sum(floor, "fac") },
  });

  const all = [...(opts.perfil ? [opts.perfil] : []), lParet, ...floor];
  const perm = [lParet, lPp, lCp, lEnvans];
  const vari = [lUs, lNeu, lVent];
  return {
    groups,
    qEls: sum(all, "unf"),
    qElu: sum(all, "fac"),
    cpEls: sum(perm, "unf"),
    cvEls: sum(vari, "unf"),
    cpElu: sum(perm, "fac"),
    cvElu: sum(vari, "fac"),
  };
}

// Help images of the three joist checks (public/calculs/ajuda/biguetes-*).
export const AJUDA_BIGUETES = {
  torras: { src: "/calculs/ajuda/biguetes-acer-ala-estreta-torras.jpg", short: "Catàleg Torras", title: "Bigues laminades d'ala estreta · Torras Herrería y Construcciones (dimensions, pes, Ix, Wx)" },
  classes: { src: "/calculs/ajuda/biguetes-fusta-classes.jpg", short: "Classes resistents", title: "Fusta: classes resistents de coníferes (resistències, mòduls d'elasticitat i densitats)" },
  gammaM: { src: "/calculs/ajuda/biguetes-fusta-gamma-m.jpg", short: "γM", title: "Fusta: coeficients parcials de seguretat del material γM" },
  kmod: { src: "/calculs/ajuda/biguetes-fusta-kmod.jpg", short: "kmod", title: "Fusta: valors de càlcul de les propietats del material i factor kmod" },
  fletxes: { src: "/calculs/ajuda/biguetes-fusta-fletxes.jpg", short: "Fletxes CTE", title: "Exigències de fletxes (CTE DB SE 4.3.3.1)" },
  psi: { src: "/calculs/ajuda/biguetes-fusta-psi.jpg", short: "Coeficients ψ", title: "Valors dels coeficients de simultaneïtat ψ" },
  betaN: { src: "/calculs/ajuda/biguetes-fusta-beta-n.jpg", short: "βn", title: "Fusta: velocitat nominal de carbonització βn" },
  seccioReduida: { src: "/calculs/ajuda/biguetes-fusta-seccio-reduida.jpg", short: "Secció reduïda", title: "Fusta: mètode de la secció reduïda (eficaç), def = dchar,n + k0 · d0" },
} satisfies Record<string, AuxImage>;
