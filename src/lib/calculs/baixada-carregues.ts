// Baixada de càrregues i comprovació de la tensió a la paret de càrrega: the
// floors and the wall's own weight brought down to the base of a load-bearing
// wall (kN per metre of wall), then the compressive stress on the masonry
// against its design strength (CTE DB SE-F). Port of David's
// OK-BAIXADA DE CÀRREGUES COMPROVACIÓ TENSIÓ PARET.xls.
//
//   each floor line   q (kN/m²) · amplada (m) · nombre de plantes → kN/ml, × γ
//   own weight        pes (kN/m³) · gruix (m) · alçària (m)       → kN/ml, × γ
//   σ = Q · L / (t · L)  (N/mm²)  <  fd = K · fb^0,65 · fm^0,25 / γM
//
// Differences from the spreadsheet, on purpose:
// - The floors are a list (dades.sostres, the Sostre of paret.ts), so the
//   editor can rename them, change «Nombre» and add or remove floors. Every
//   floor has the same lines (pes propi, paviments, envans, plaques
//   fotovoltaiques | ús, neu, vent), the unused ones at 0; the sheet listed
//   only the lines each floor used. As in the sheet, each line is already
//   multiplied by the number of floors («Nº plantes»), and one width
//   (amplada) applies to every line of a floor (the sheet linked them to the
//   first one).
// - «Increment de càrrega fotovoltaica» adds up the photovoltaic line of every
//   floor (the sheet took the roof's, G19). Same 2,49 % for the example.
// - The stress is the load on the length considered over its area,
//   Q · L / (t · L); the sheet divided the load on 1 m by the area of the
//   typed length (Q · 1000 / A). Same result while L = 1000 mm.
// - kg conversions use G = 9,81, as in the rest of the app; the sheet used
//   ×0,10197 for kg/ml and /9,8065 for kg/cm². Example: 7.895,54 → 7.892,97
//   and 11.038,30 → 11.034,71 kg/ml; σ 5,2639 → 5,2620 and 7,3591 → 7,3565
//   kg/cm²; fd 13,6226 → 13,6177 kg/cm². The sheet's N/ml rows are not
//   repeated (kN/ml = N/mm). Every value in kN and N/mm² is the sheet's.
// - fk is shown before fd (the sheet's «Tensió fk», no majorada / minorada):
//   the same CTE DB SE-F formula as fabricaFd.
// - The own-weight group has no total row (one line, the same value).
// - "Sobrecàrrea de Neu" → «Sobrecàrrega de neu».

import { type CalcResult, type LoadGroup, type LoadLine, type Row, type Section, G, NMM2_TO_KGCM2, check, div, fabricaFd, fabricaRows, num } from "./common";
import { AJUDA } from "./ajuda";
import type { Sostre } from "./paret";

export interface BaixadaCarreguesDades {
  sostres: Sostre[]; // the floors above the wall (fv: plaques fotovoltaiques)
  paretGruix: number; // m
  paretAlcada: number; // m
  paretPes: number; // kN/m³
  gParet: number;
  k: number;
  fb: number; // N/mm²
  fm: number; // N/mm²
  gM: number;
  gruixMm: number | null; // mm, for the stress; null → paretGruix
  longitud: number; // mm of wall considered
}

function sostre(nom: string, nombre: number, loads: Partial<Sostre>): Sostre {
  return { nom, nombre, amplada: 0, pp: 0, cp: 0, envans: 0, fv: 0, gG: 1.35, us: 0, neu: 0, vent: 0, gUs: 1.5, gNeu: 1.5, gVent: 1.5, ...loads };
}

// Defaults: the example of David's sheet.
export function baixadaCarreguesDefaults(): BaixadaCarreguesDades {
  return {
    sostres: [
      sostre("Forjats tipus", 6, { amplada: 2, pp: 2, us: 2 }),
      sostre("Forjat coberta", 1, { amplada: 2, pp: 2, cp: 2, fv: 1, neu: 0.4 }),
    ],
    paretGruix: 0.15,
    paretAlcada: 6.9,
    paretPes: 18,
    gParet: 1.35,
    k: 0.6,
    fb: 10,
    fm: 5,
    gM: 3,
    gruixMm: null,
    longitud: 1000,
  };
}

// A floor line: q · amplada · nombre (kN/ml), unfactored and × γ.
function line(label: string, q: number, width: number, n: number, gamma: number, keys: { q: string; width?: string; gamma?: string }): LoadLine {
  const unf = q * width * n;
  return { label, q, qUnit: "kN/m²", width, widthUnit: "m", unf, gamma, fac: unf * gamma, qKey: keys.q, widthKey: keys.width, gammaKey: keys.gamma };
}

const sum = (ls: LoadLine[], key: "q" | "unf" | "fac") => ls.reduce((a, l) => a + (l[key] ?? 0), 0);
const kgMl = (kNml: number | null) => (kNml == null ? null : (kNml * 1000) / G);
const kgCm2 = (nmm2: number | null) => (nmm2 == null ? null : nmm2 * NMM2_TO_KGCM2);
const pct = (v: number | null) => (v == null ? null : v * 100);

export function computeBaixadaCarregues(raw: Partial<BaixadaCarreguesDades>): CalcResult {
  const d = { ...baixadaCarreguesDefaults(), ...raw } as BaixadaCarreguesDades;
  const dd = d as unknown as Record<string, unknown>;
  const sostres = Array.isArray(d.sostres) ? d.sostres : [];

  // ---- Baixada de càrregues ----
  const groups: LoadGroup[] = [];
  const fotovoltaica: LoadLine[] = [];
  sostres.forEach((s, i) => {
    const w = num(s.amplada);
    const n = num(s.nombre);
    const gG = num(s.gG);
    const lFv = line("Pes propi de les plaques fotovoltaiques", num(s.fv), w, n, gG, { q: "fv" });
    fotovoltaica.push(lFv);
    const lines = [
      { heading: "Accions permanents" },
      { line: line("Pes propi estructural", num(s.pp), w, n, gG, { q: "pp", width: "amplada", gamma: "gG" }) },
      { line: line("Càrregues permanents de paviments i morter", num(s.cp), w, n, gG, { q: "cp" }) },
      { line: line("Càrregues permanents d'envans", num(s.envans), w, n, gG, { q: "envans" }) },
      { line: lFv },
      { heading: "Accions variables" },
      { line: line("Sobrecàrrega d'ús", num(s.us), w, n, num(s.gUs), { q: "us", gamma: "gUs" }) },
      { line: line("Sobrecàrrega de neu", num(s.neu), w, n, num(s.gNeu), { q: "neu", gamma: "gNeu" }) },
      { line: line("Sobrecàrrega de vent", num(s.vent), w, n, num(s.gVent), { q: "vent", gamma: "gVent" }) },
    ];
    const ls = lines.map((l) => l.line).filter((l): l is LoadLine => !!l);
    groups.push({
      title: s.nom || `Sostre tipus ${i + 1}`,
      count: n,
      lines,
      sostreIndex: i,
      total: { label: `Estat de càrregues ${s.nom || `sostre tipus ${i + 1}`}`, q: sum(ls, "q"), unf: sum(ls, "unf"), fac: sum(ls, "fac") },
    });
  });

  const gruix = num(d.paretGruix);
  const area = gruix * num(d.paretAlcada); // m² per metre of wall
  const pes = num(d.paretPes);
  const unfParet = pes * area;
  const lParet: LoadLine = {
    label: "Pes propi de la paret de càrrega",
    q: pes,
    qUnit: "kN/m³",
    width: area,
    widthUnit: "m²",
    unf: unfParet,
    gamma: num(d.gParet),
    fac: unfParet * num(d.gParet),
    qKey: "paretPes",
    gammaKey: "gParet",
  };
  const paret: LoadGroup = {
    title: "Accions permanents · paret de càrrega",
    aux: [AJUDA.pesFabriques],
    lines: [
      { param: { label: "Gruix de la paret de càrrega", value: gruix, unit: "m", key: "paretGruix" } },
      { param: { label: "Alçària de la paret de càrrega", value: num(d.paretAlcada), unit: "m", key: "paretAlcada" } },
      { line: lParet },
    ],
  };
  const floorsUnf = groups.reduce((a, g) => a + (g.total?.unf ?? 0), 0);
  const floorsFac = groups.reduce((a, g) => a + (g.total?.fac ?? 0), 0);
  groups.push(paret);

  const qEls = floorsUnf + unfParet; // kN/ml = N/mm
  const qElu = floorsFac + (lParet.fac ?? 0);
  const qFv = sum(fotovoltaica, "fac");

  const carregues: Section = {
    key: "carregues",
    title: "Baixada de càrregues",
    enabled: true,
    blocks: [],
    loads: { groups, totalUnf: qEls, totalFac: qElu, totalLabel: "Càrrega total a la base de la paret" },
  };

  const resultats: Section = {
    key: "resultats",
    title: "Resultats a la base de la paret",
    enabled: true,
    blocks: [
      {
        rows: [
          { label: "Càrrega total sense majorar", sym: "Q ELS", value: qEls, unit: "kN/ml", alt: { value: kgMl(qEls), unit: "kg/ml" } },
          { label: "Càrrega total majorada", sym: "Q ELU", value: qElu, unit: "kN/ml", alt: { value: kgMl(qElu), unit: "kg/ml" } },
          { label: "Càrrega majorada de les plaques fotovoltaiques", sym: "Q ELU fv", value: qFv, unit: "kN/ml", alt: { value: kgMl(qFv), unit: "kg/ml" } },
          {
            label: "Increment de càrrega fotovoltaica",
            formula: "Q ELU fv / Q ELU",
            value: pct(div(qFv, qElu)),
            unit: "%",
            hint: "Part de la càrrega majorada a la base que aporten les plaques fotovoltaiques",
          },
        ],
      },
    ],
  };

  // ---- Resistència de la fàbrica ----
  const fkRaw = num(d.k) * Math.pow(num(d.fb), 0.65) * Math.pow(num(d.fm), 0.25);
  const fk = Number.isFinite(fkRaw) ? fkRaw : null;
  const fd = fabricaFd(num(d.k), num(d.fb), num(d.fm), num(d.gM));
  const fkRow: Row = { label: "Resistència característica a compressió", formula: "fk = K · fb^0,65 · fm^0,25", sym: "fk", value: fk, unit: "N/mm²", alt: { value: kgCm2(fk), unit: "kg/cm²" } };
  const fabrica: Section = {
    key: "fabrica",
    title: "Resistència a compressió de la fàbrica",
    enabled: true,
    blocks: [{ rows: fabricaRows(dd, fd).flatMap((r) => (r.sym === "fd" ? [fkRow, { ...r, formula: "fd = fk / γM" }] : [r])) }],
  };

  // ---- Tensió a la base ----
  const tAuto = gruix * 1000;
  const t = d.gruixMm == null ? tAuto : num(d.gruixMm);
  const L = num(d.longitud);
  const A = t * L; // mm²
  const sEls = div(qEls * L, A); // N/mm · mm / mm²
  const sElu = div(qElu * L, A);
  const tensio: Section = {
    key: "tensio",
    title: "Càrrega repartida i tensió a la fàbrica",
    enabled: true,
    blocks: [
      {
        rows: [
          {
            label: "Gruix de la paret de càrrega",
            sym: "t",
            value: t,
            unit: "mm",
            decimals: 0,
            input: { type: "num", key: "gruixMm", decimals: 0, auto: tAuto },
            alt: { value: t / 10, unit: "cm" },
            hint: "Per defecte, el de la baixada de càrregues",
          },
          { label: "Longitud de paret considerada", sym: "L", value: L, unit: "mm", decimals: 0, input: { type: "num", key: "longitud", decimals: 0 }, alt: { value: L / 10, unit: "cm" }, hint: "Normalment 1.000 mm (1 m de paret)" },
          { label: "Àrea de la secció", formula: "A = t · L", sym: "A", value: A, unit: "mm²", decimals: 0, alt: { value: A / 100, unit: "cm²" } },
        ],
      },
      {
        title: "Resultats tensió paret",
        rows: [
          { label: "Tensió sense majorar", formula: "σ ELS = Q ELS · L / A", sym: "σ ELS", value: sEls, unit: "N/mm²", alt: { value: kgCm2(sEls), unit: "kg/cm²" } },
          { label: "Tensió majorada", formula: "σ ELU = Q ELU · L / A", sym: "σ ELU", value: sElu, unit: "N/mm²", alt: { value: kgCm2(sElu), unit: "kg/cm²" }, check: check(sElu, "<", fd, "N/mm²") },
          { label: "Aprofitament de la paret", formula: "σ ELU / fd", value: pct(div(sElu, fd)), unit: "%" },
        ],
      },
    ],
  };

  return { sections: [carregues, resultats, fabrica, tensio] };
}
