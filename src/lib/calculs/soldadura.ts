// Justificació: compatibilitat entre soldadures.
// Port of "Justificació Comprovació Compatibilitat Soldadures.xls". Two pieces
// are welded (e.g. UPN 140 and IPN 140); each has a flange (e1) and a web (e)
// thickness from the catalogue, or is a plate with a typed thickness. For
// every pair of parts (ala–ala, ala–ànima, …) the fillet-weld table gives the
// max / min throat of each part. David's rule: the max of the thinner part must
// fall within the range of the thicker one, and the min of the thicker part
// within the range of the thinner one; the throat to use is then between the
// min of the thicker and the max of the thinner. The sheet looked these up by
// hand; here they come from the tables.

import { type CalcResult, type Row, type Section, type WeldCombo, type WeldPart, num } from "./common";
import { PLATE, perfilProps, soldaduraPer } from "./perfils";

export interface SoldaduraDades {
  perfil1: string; // catalogue profile, or PLATE
  gruix1: number; // mm, plate thickness when perfil1 = PLATE
  perfil2: string;
  gruix2: number;
  ocultes: string[]; // keys of the combinations left out of the checks and the report
}

export function soldaduraDefaults(): SoldaduraDades {
  return { perfil1: "UPN 140", gruix1: 10, perfil2: "IPN 140", gruix2: 10, ocultes: [] };
}

function part(label: string, t: number | null): WeldPart {
  const row = t == null ? null : soldaduraPer(t);
  return { label, t, aMax: row?.aMax ?? null, aMin: row?.aMin ?? null };
}

// The parts of a piece, each with its role ("ala", "ànima" or "xapa").
function pieceParts(perfil: string, gruix: number): { role: string; part: WeldPart }[] {
  if (perfil === PLATE) return [{ role: "xapa", part: part(`Xapa ${String(gruix).replace(".", ",")} mm`, gruix) }];
  const p = perfilProps(perfil);
  return [
    { role: "ala", part: part(`${perfil} · ala`, p?.tf ?? null) },
    { role: "ànima", part: part(`${perfil} · ànima`, p?.tw ?? null) },
  ];
}

const within = (x: number, lo: number, hi: number) => x >= lo && x <= hi;

export function combine(a: WeldPart, b: WeldPart): WeldCombo {
  const label = `${a.label} amb ${b.label}`;
  if (a.t == null || b.t == null) return { label, a, b, thin: null, range: null, ok: false, note: "Falta el gruix d'alguna peça." };
  if (a.aMax == null || a.aMin == null || b.aMax == null || b.aMin == null) {
    return { label, a, b, thin: null, range: null, ok: false, note: "Gruix fora de la taula de soldadures (4,0 – 36,0 mm)." };
  }
  const thin = a.t <= b.t ? "a" : "b";
  const tn = thin === "a" ? a : b;
  const tk = thin === "a" ? b : a;
  // Both conditions, as David states them.
  const maxThinInThick = within(tn.aMax!, tk.aMin!, tk.aMax!);
  const minThickInThin = within(tk.aMin!, tn.aMin!, tn.aMax!);
  const ok = maxThinInThick && minThickInThin;
  return {
    label,
    a,
    b,
    thin,
    range: ok ? [tk.aMin!, tn.aMax!] : null,
    ok,
    note: ok ? undefined : "La gola màxima de la peça més prima no arriba a la mínima de la més gruixuda.",
  };
}

function pieceRows(n: 1 | 2, perfil: string, gruix: number): Row[] {
  const rows: Row[] = [{ label: `Perfil laminat en calent ${n}`, value: perfil, input: { type: "profile", key: `perfil${n}`, allowPlate: true } }];
  if (perfil === PLATE) {
    rows.push({ label: "Gruix de la xapa", sym: "t", value: gruix, unit: "mm", input: { type: "num", key: `gruix${n}`, decimals: 1 } });
  } else {
    const p = perfilProps(perfil);
    rows.push({ label: "Gruix de les ales", sym: "e1", value: p?.tf ?? null, unit: "mm" });
    rows.push({ label: "Gruix de l'ànima", sym: "e", value: p?.tw ?? null, unit: "mm" });
  }
  return rows;
}

export function computeSoldadura(raw: Partial<SoldaduraDades>): CalcResult {
  const d = { ...soldaduraDefaults(), ...raw } as SoldaduraDades;
  const g1 = num(d.gruix1);
  const g2 = num(d.gruix2);

  const dades: Section = {
    key: "perfils",
    title: "Dades dels perfils",
    enabled: true,
    blocks: [
      { title: "Dades del perfil 1", rows: pieceRows(1, d.perfil1, g1) },
      { title: "Dades del perfil 2", rows: pieceRows(2, d.perfil2, g2) },
    ],
  };

  // Every pair of parts; the user can leave some out (they don't weld there).
  const ocultes = Array.isArray(d.ocultes) ? d.ocultes : [];
  const welds: WeldCombo[] = [];
  for (const a of pieceParts(d.perfil1, g1))
    for (const b of pieceParts(d.perfil2, g2)) {
      const key = `${a.role}|${b.role}`;
      welds.push({ ...combine(a.part, b.part), key, included: !ocultes.includes(key) });
    }

  const combinacions: Section = {
    key: "combinacions",
    title: "Resultats combinacions compatibilitat de soldadures",
    enabled: true,
    blocks: [],
    welds,
  };

  return { sections: [dades, combinacions] };
}
