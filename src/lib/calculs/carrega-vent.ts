// Càrrega de vent sobre un parament: the static wind pressure
// qe = qb · ce · cp (CTE DB SE-AE, 3.3 and annex D). Port of David's
// OK-CARREGA VENT CTE.xlsx. No checks: the result is the characteristic load
// that other calculations take as an input.
//
//   qb = ½ · ρ · vb²                 dynamic pressure (D.1), vb from fig. D.1
//   F  = k · ln(max(z, Z) / L)       k, L, Z from taula D.2 (grau d'aspror)
//   ce = F · (F + 7k)                exposure coefficient (D.2)
//   cp,net                           façade: cp + |cs| (taula 3.5); free-standing
//                                    wall: EN 1991-1-4 taula 7.9 (φ = 1); or typed
//
// Differences from the spreadsheet, on purpose:
// - vb is typed in m/s and comes from the wind zone of figure D.1 (A 26 ·
//   B 27 · C 29 m/s) while left empty; the sheet typed km/h (104,4 = zone C)
//   and divided by 3,6. Same 29 m/s for the example; km/h is the conversion
//   column.
// - cp comes from a choice (façade and its slenderness h/d, free-standing wall
//   with its l/h and zone, or typed) instead of being typed beside the
//   reference tables; it can still be typed over. The description is written
//   from the choice («Façana, esbeltesa h/d = 1 (0,8 + 0,6)», the sheet's
//   text for the example) and is free text only when cp is typed by choice.
//   The net coefficient is called cp,net (EN 1991-1-4), to tell it apart from
//   the façade's pressure cp of taula 3.5.
// - Taula 3.5's first slenderness reads «h/d ≤ 0,25» (CTE: < 0,25; the sheet:
//   0,25), the value used up to 0,25.
// Every value of the example is the sheet's.

import { type CalcResult, type Row, type Section, G, fmt, num } from "./common";
import { AJUDA } from "./ajuda";

export interface CarregaVentDades {
  rho: number; // kg/m³
  zona: string; // A, B or C (CTE DB SE-AE figura D.1)
  vb: number | null; // m/s; null → from the zone
  aspror: string; // I … V (taula D.2)
  z: number; // m, height of the point above the ground
  cpOrigen: string; // "facana" | "mur" | "manual"
  esbeltesa: string; // façade: key of FACANA
  murLh: string; // free-standing wall: key of MUR
  murZona: string; // A … D
  cp: number | null; // null → from the choice (required when typed by choice)
  cpDesc: string | null; // free text, when cp is typed by choice
}

// CTE DB SE-AE figura D.1: basic wind speed of each zone (m/s).
const ZONES = [
  { zona: "A", vb: 26 },
  { zona: "B", vb: 27 },
  { zona: "C", vb: 29 },
];

// CTE DB SE-AE taula D.2: terrain roughness.
const ASPRORS = [
  { grau: "I", k: 0.156, L: 0.003, Z: 1, entorn: "Vora del mar o d'un llac (≥ 5 km d'aigua a sobrevent)" },
  { grau: "II", k: 0.17, L: 0.01, Z: 1, entorn: "Terreny rural pla sense obstacles" },
  { grau: "III", k: 0.19, L: 0.05, Z: 2, entorn: "Zona rural accidentada o amb obstacles aïllats" },
  { grau: "IV", k: 0.22, L: 0.3, Z: 5, entorn: "Zona urbana en general, industrial o forestal" },
  { grau: "V", k: 0.24, L: 1, Z: 10, entorn: "Centre de negocis de grans ciutats, amb edificis en alçada" },
];

// CTE DB SE-AE taula 3.5: façades of buildings, pressure cp and suction cs
// by slenderness in the plane parallel to the wind (h/d).
const FACANA = [
  { key: "0.25", hd: "≤ 0,25", cp: 0.7, cs: -0.3 },
  { key: "0.5", hd: "= 0,5", cp: 0.8, cs: -0.4 },
  { key: "0.75", hd: "= 0,75", cp: 0.8, cs: -0.5 },
  { key: "1", hd: "= 1", cp: 0.8, cs: -0.6 },
  { key: "1.25", hd: "= 1,25", cp: 0.8, cs: -0.7 },
  { key: "5", hd: "≥ 5", cp: 0.8, cs: -0.7 },
];

// EN 1991-1-4 taula 7.9: free-standing walls and fences, cp,net for a solid
// wall (φ = 1) in zones A, B, C, D.
const MUR = [
  { key: "3", label: "l/h ≤ 3", cp: [2.3, 1.4, 1.2, 1.2] },
  { key: "5", label: "l/h = 5", cp: [2.9, 1.8, 1.4, 1.2] },
  { key: "10", label: "l/h ≥ 10", cp: [3.4, 2.1, 1.7, 1.2] },
  { key: "retorn", label: "Amb retorns de longitud ≥ h", cp: [2.1, 1.8, 1.4, 1.2] },
];
const MUR_ZONES = [
  { zona: "A", label: "Zona A · fins a 0,3h de l'extrem lliure" },
  { zona: "B", label: "Zona B · de 0,3h a 2h" },
  { zona: "C", label: "Zona C · de 2h a 4h" },
  { zona: "D", label: "Zona D · a més de 4h" },
];

const ORIGENS = [
  { value: "facana", label: "Façana d'un edifici (CTE DB SE-AE taula 3.5)" },
  { value: "mur", label: "Mur o tanca aïllat (EN 1991-1-4 taula 7.9)" },
  { value: "manual", label: "Valor escrit a mà" },
];

// Defaults: the example of David's sheet (zone C, urban, z = 10 m, façade h/d = 1).
export function carregaVentDefaults(): CarregaVentDades {
  return {
    rho: 1.25,
    zona: "C",
    vb: null,
    aspror: "IV",
    z: 10,
    cpOrigen: "facana",
    esbeltesa: "1",
    murLh: "3",
    murZona: "A",
    cp: null,
    cpDesc: null,
  };
}

const kgfM2 = (kNm2: number | null) => (kNm2 == null ? null : (kNm2 * 1000) / G);
const mul = (...xs: (number | null)[]) => (xs.some((x) => x == null) ? null : xs.reduce<number>((a, x) => a * (x as number), 1));

export function computeCarregaVent(raw: Partial<CarregaVentDades>): CalcResult {
  const d = { ...carregaVentDefaults(), ...raw } as CarregaVentDades;

  // ---- qb ----
  const rho = num(d.rho);
  const zona = ZONES.find((x) => x.zona === String(d.zona)) ?? null;
  const vbAuto = zona?.vb ?? null;
  const vb = d.vb == null ? vbAuto : num(d.vb);
  const qb = vb == null ? null : (0.5 * rho * vb * vb) / 1000; // kN/m²

  const pressio: Section = {
    key: "qb",
    title: "Pressió dinàmica del vent (qb)",
    enabled: true,
    blocks: [
      {
        rows: [
          {
            label: "Densitat de l'aire",
            sym: "ρ",
            value: rho,
            unit: "kg/m³",
            input: { type: "num", key: "rho", decimals: 2 },
            hint: "En general 1,25 kg/m³. Segons la temperatura: 0 °C 1,29 · 10 °C 1,25 · 20 °C 1,21 · 30 °C 1,17 · 40 °C 1,13 · 50 °C 1,09 kg/m³",
          },
          {
            label: "Zona eòlica",
            value: zona ? `Zona ${zona.zona} · ${zona.vb} m/s` : null,
            input: { type: "select", key: "zona", options: ZONES.map((x) => ({ value: x.zona, label: `Zona ${x.zona} · ${x.vb} m/s` })) },
            hint: "CTE DB SE-AE figura D.1",
            aux: [AJUDA.vent],
          },
          {
            label: "Velocitat bàsica del vent",
            sym: "vb",
            value: vb,
            unit: "m/s",
            input: { type: "num", key: "vb", decimals: 2, auto: vbAuto },
            alt: { value: vb == null ? null : vb * 3.6, unit: "km/h", decimals: 1 },
          },
          { label: "Pressió dinàmica del vent", formula: "qb = ½ · ρ · vb²", sym: "qb", value: qb, unit: "kN/m²", decimals: 3, alt: { value: kgfM2(qb), unit: "kgf/m²" } },
        ],
      },
    ],
  };

  // ---- ce ----
  const a = ASPRORS.find((x) => x.grau === String(d.aspror)) ?? null;
  const z = num(d.z);
  const F = a ? a.k * Math.log(Math.max(z, a.Z) / a.L) : null;
  const ce = a && F != null ? F * (F + 7 * a.k) : null;

  const exposicio: Section = {
    key: "ce",
    title: "Coeficient d'exposició (ce)",
    enabled: true,
    blocks: [
      {
        rows: [
          {
            label: "Grau d'aspror de l'entorn",
            value: a ? `${a.grau} · ${a.entorn}` : null,
            input: { type: "select", key: "aspror", options: ASPRORS.map((x) => ({ value: x.grau, label: `${x.grau} · ${x.entorn}` })) },
            hint: "CTE DB SE-AE taula D.2",
          },
          { label: "Paràmetre k", sym: "k", value: a?.k ?? null, decimals: 3 },
          { label: "Paràmetre L", sym: "L", value: a?.L ?? null, unit: "m", decimals: 3 },
          { label: "Paràmetre Z", sym: "Z", value: a?.Z ?? null, unit: "m", decimals: 0 },
          { label: "Alçària del punt considerat sobre el terreny", sym: "z", value: z, unit: "m", input: { type: "num", key: "z", decimals: 2 }, hint: "Normalment, el punt més alt del parament" },
          { label: "Coeficient F", formula: "F = k · ln(max(z, Z) / L)", sym: "F", value: F, decimals: 4 },
          { label: "Coeficient d'exposició", formula: "ce = F · (F + 7k)", sym: "ce", value: ce, decimals: 3 },
        ],
      },
    ],
  };

  // ---- cp ----
  const origen = d.cpOrigen === "mur" || d.cpOrigen === "manual" ? d.cpOrigen : "facana";
  const rows: Row[] = [{ label: "Origen del coeficient eòlic", value: ORIGENS.find((o) => o.value === origen)?.label ?? null, input: { type: "select", key: "cpOrigen", options: ORIGENS } }];
  let cpAuto: number | null = null;
  let descAuto: string | null = null;
  if (origen === "facana") {
    const f = FACANA.find((x) => x.key === String(d.esbeltesa)) ?? null;
    cpAuto = f ? f.cp + Math.abs(f.cs) : null;
    descAuto = f ? `Façana, esbeltesa h/d ${f.hd} (${fmt(f.cp, 1)} + ${fmt(Math.abs(f.cs), 1)})` : null;
    rows.push(
      {
        label: "Esbeltesa en el pla paral·lel al vent",
        value: f ? `h/d ${f.hd}` : null,
        input: { type: "select", key: "esbeltesa", options: FACANA.map((x) => ({ value: x.key, label: `h/d ${x.hd}` })) },
        hint: "h: alçària de l'edifici · d: profunditat en la direcció del vent. Per a valors intermedis es pot interpolar i escriure el cp a mà.",
      },
      { label: "Coeficient eòlic de pressió", sym: "cp", value: f?.cp ?? null, decimals: 1 },
      { label: "Coeficient eòlic de succió", sym: "cs", value: f?.cs ?? null, decimals: 1 },
    );
  } else if (origen === "mur") {
    const m = MUR.find((x) => x.key === String(d.murLh)) ?? null;
    const zi = MUR_ZONES.findIndex((x) => x.zona === String(d.murZona));
    cpAuto = m && zi >= 0 ? m.cp[zi] : null;
    descAuto = m && zi >= 0 ? `Mur o tanca aïllat, ${m.label.charAt(0).toLowerCase()}${m.label.slice(1)}, zona ${MUR_ZONES[zi].zona}` : null;
    rows.push(
      {
        label: "Relació entre la longitud i l'alçària del mur",
        value: m?.label ?? null,
        input: { type: "select", key: "murLh", options: MUR.map((x) => ({ value: x.key, label: x.label })) },
        hint: "Per a valors intermedis es pot interpolar i escriure el cp a mà.",
      },
      {
        label: "Zona del mur",
        value: zi >= 0 ? MUR_ZONES[zi].label : null,
        input: { type: "select", key: "murZona", options: MUR_ZONES.map((x) => ({ value: x.zona, label: x.label })) },
        hint: "Mesurada des de l'extrem lliure del mur: A fins a 0,3h · B fins a 2h · C fins a 4h · D la resta. Valors per a un mur massís (φ = 1).",
      },
    );
  }
  const manual = origen === "manual";
  const cp = d.cp == null ? cpAuto : num(d.cp);
  const typedOver = !manual && d.cp != null && cpAuto != null && Math.abs(num(d.cp) - cpAuto) > 1e-9;
  const desc = manual ? (typeof d.cpDesc === "string" && d.cpDesc.trim() ? d.cpDesc : null) : descAuto && typedOver ? `${descAuto} · cp escrit a mà` : descAuto;
  rows.push(
    {
      label: "Coeficient eòlic de càlcul (valor net)",
      formula: origen === "facana" ? "cp,net = cp + |cs|" : undefined,
      sym: "cp,net",
      value: cp,
      input: manual ? { type: "num", key: "cp", decimals: 2 } : { type: "num", key: "cp", decimals: 2, auto: cpAuto },
    },
    manual
      ? { label: "Descripció / origen del cp", value: desc, input: { type: "text", key: "cpDesc", placeholder: "p. ex. coberta plana, zona F (CTE DB SE-AE taula D.4)" } }
      : { label: "Descripció / origen del cp", value: desc },
  );

  const coeficient: Section = { key: "cp", title: "Coeficient eòlic (cp)", enabled: true, blocks: [{ rows }] };

  // ---- qe ----
  const qe = mul(qb, ce, cp);
  const carrega: Section = {
    key: "qe",
    title: "Càrrega de vent (qe)",
    enabled: true,
    blocks: [
      {
        rows: [
          { label: "Pressió estàtica del vent (valor característic)", formula: "qe = qb · ce · cp,net", sym: "qe", value: qe, unit: "kN/m²", decimals: 3, alt: { value: kgfM2(qe), unit: "kgf/m²" } },
        ],
      },
    ],
    notes: ["Valor característic, sense el coeficient parcial de seguretat de les accions variables (γQ = 1,5)."],
  };

  return { sections: [pressio, exposicio, coeficient, carrega] };
}
