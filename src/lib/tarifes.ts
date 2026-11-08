// Tarifes mínimes of «Base de Dades»: the formulas of David's spreadsheets
// («Tarifa Mínima Benzina», «Tarifa Mínima Hora»). Inputs live in
// public.tarifa_minima (db/migrations/0048_tarifes.sql); results are always
// computed here, never stored. Values are kept unrounded, like Excel: only the
// display rounds (0,063 €/km, 35,43 €/hora).

import type { TarifaMinima } from "@/types/db";

// The values of the sheets, used when the row is missing.
export const TARIFA_MINIMA_DEFAULT: TarifaMinima = {
  benzina_any: 2026,
  preu_litre: "1.392",
  consum_100km: "4.5",
  desgast_km: "0.26",
  hora_any: 2026,
  sou: "4700",
  lloguer: "1035.05",
  lloguer_iva: "21",
  dies_mes: "21",
  hores_dia: "8",
  certificats_any: 2026,
  dificultat_min: "15",
  dificultat_max: "25",
};

export interface BenzinaInputs {
  preu_litre: number;
  consum_100km: number;
  desgast_km: number;
}

// Mínim cost benzina km = preu litre × consum cada 100 km / 100.
export function tarifaBenzina(t: BenzinaInputs) {
  const benzinaKm = (t.preu_litre * t.consum_100km) / 100;
  return { benzinaKm, totalKm: benzinaKm + t.desgast_km };
}

export interface HoraInputs {
  sou: number;
  lloguer: number; // sense IVA
  lloguer_iva: number; // %
  dies_mes: number;
  hores_dia: number;
}

// Lloguer amb IVA = lloguer × (1 + IVA); total = sou + lloguer amb IVA;
// hores mínimes mes = dies × hores per dia; mínim cost hora = total / hores.
export function tarifaHora(t: HoraInputs) {
  const lloguerAmbIva = t.lloguer * (1 + t.lloguer_iva / 100);
  const total = t.sou + lloguerAmbIva;
  const hores = t.dies_mes * t.hores_dia;
  return { lloguerAmbIva, total, hores, costHora: hores > 0 ? total / hores : null };
}

// (*) Dificultat afegida: the fee raised by min% … max%.
export function ambDificultat(preu: number, minPct: number, maxPct: number): [number, number] {
  return [preu * (1 + minPct / 100), preu * (1 + maxPct / 100)];
}
