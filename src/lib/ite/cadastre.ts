// "Obtenir dades del Cadastre", like the portal's button: the Spanish
// Catastro's public service (no key) gives, for the 14 characters of the
// cadastral reference, the address, the year of construction and every unit
// with its floor, door, use and built surface. From that we fill the address,
// the year, the built surface (sum of the units, what the portal uses) and the
// floors table. Parsing is pure; the request is made by a server action.
import { catId, findCat, type Cataleg } from "./cataleg";
import { municipiFor, nomInforme, tipusViaFor, titleCase, viaWordFromCatastro } from "./defaults";
import { getAt, listOf, newPlanta, setAt, LIST_PATHS } from "./model";
import { isObj, javaDouble, type IteObj } from "./xml";

export const CATASTRO_URL = "https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/Consulta_DNPRC";

export interface CadastreUnitat {
  planta: string; // Catastro code: "PR", "01", "LC", "BJ"…
  porta: string; // "01", "2A"…
  us: string; // "Residencial", "Comercial"…
  superficie: number;
}

export interface CadastreDades {
  viaCodi: string; // Catastro street type ("CL")
  viaWord: string; // our word ("carrer")
  nomVia: string;
  numero: string;
  codiPostal: string;
  municipi: string;
  provincia: string;
  codiIne: string;
  anyConstruccio: number | null;
  superficieConstruida: number;
  unitats: CadastreUnitat[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function unitFrom(u: any): { dir: any; dp: string; loint: any; debi: any; dt: any } {
  const lourb = u?.dt?.locs?.lous?.lourb ?? {};
  return { dir: lourb.dir ?? {}, dp: String(lourb.dp ?? ""), loint: lourb.loint ?? {}, debi: u?.debi ?? {}, dt: u?.dt ?? {} };
}

export function parseCadastre(json: unknown): CadastreDades {
  const r = (json as any)?.consulta_dnprcResult ?? json;
  const errs = r?.lerr?.err ?? r?.lerr;
  if (errs) {
    const list = Array.isArray(errs) ? errs : [errs];
    throw new Error(list.map((e: any) => e?.des).filter(Boolean).join(" ") || "El Cadastre no ha trobat aquesta referència.");
  }
  const units: any[] = r?.lrcdnp?.rcdnp ?? (r?.bico?.bi ? [r.bico.bi] : []);
  if (!units.length) throw new Error("El Cadastre no ha retornat cap immoble per a aquesta referència.");
  const first = unitFrom(units[0]);
  const loine = first.dt.loine ?? {};
  const unitats: CadastreUnitat[] = units.map((u) => {
    const x = unitFrom(u);
    return {
      planta: String(x.loint.pt ?? ""),
      porta: String(x.loint.pu ?? ""),
      us: String(x.debi.luso ?? ""),
      superficie: Number(String(x.debi.sfc ?? "0").replace(",", ".")) || 0,
    };
  });
  const anys = units.map((u) => Number(unitFrom(u).debi.ant)).filter((n) => Number.isFinite(n) && n > 1000);
  const viaCodi = String(first.dir.tv ?? "");
  return {
    viaCodi,
    viaWord: viaWordFromCatastro(viaCodi),
    nomVia: String(first.dir.nv ?? ""),
    numero: String(first.dir.pnp ?? ""),
    codiPostal: first.dp,
    municipi: String(first.dt.nm ?? ""),
    provincia: String(first.dt.np ?? ""),
    codiIne: loine.cp && loine.cm ? `${String(loine.cp).padStart(2, "0")}${String(loine.cm).padStart(3, "0")}` : "",
    anyConstruccio: anys.length ? Math.min(...anys) : null,
    superficieConstruida: unitats.reduce((s, u) => s + u.superficie, 0),
    unitats,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const ORDINALS = ["", "Primer", "Segon", "Tercer", "Quart", "Cinquè", "Sisè", "Setè", "Vuitè", "Novè", "Desè", "Onzè", "Dotzè", "Tretzè", "Catorzè", "Quinzè"];
const PLANTES: Record<string, string> = {
  BJ: "Planta baixa", "00": "Planta baixa", PB: "Planta baixa", LC: "Planta baixa", EN: "Entresòl", PR: "Principal",
  AT: "Àtic", SA: "Sobreàtic", SM: "Semisoterrani", SS: "Soterrani", ST: "Soterrani", SO: "Soterrani", "-1": "Soterrani",
};

function plantaRank(pt: string): number {
  const p = pt.toUpperCase();
  if (/^-\d+$/.test(p)) return -10 + Number(p);
  if (["SS", "ST", "SO"].includes(p)) return -2;
  if (p === "SM") return -1;
  if (["BJ", "00", "PB", "LC"].includes(p)) return 0;
  if (p === "EN") return 1;
  if (p === "PR") return 2;
  if (/^\d+$/.test(p)) return 2 + Number(p);
  if (p === "AT") return 100;
  if (p === "SA") return 101;
  return 50;
}

export function plantaLabel(pt: string): string {
  const p = pt.toUpperCase();
  if (PLANTES[p]) return PLANTES[p];
  if (/^\d+$/.test(p)) return ORDINALS[Number(p)] ?? `Planta ${Number(p)}`;
  if (/^-\d+$/.test(p)) return `Soterrani ${p.slice(1)}`;
  return `Planta ${pt}`;
}

export function portaLabel(pu: string): string {
  const p = pu.toUpperCase().trim();
  const m = /^0*(\d+)\s*([A-Z]*)$/.exec(p);
  if (m) return `${m[1]}a${m[2] ? ` ${m[2]}` : ""}`;
  if (/^(IZ|IZQ|ES)$/.test(p)) return "Esquerra";
  if (/^(DR|DE|DCH|DT)$/.test(p)) return "Dreta";
  if (/^(CE|CT|CN)$/.test(p)) return "Centre";
  return p;
}

export type TipusUnitat = "habitatge" | "local" | "parquing";

export function tipusUnitat(us: string): TipusUnitat {
  if (/residen/i.test(us)) return "habitatge";
  if (/aparca|estacion|garaj/i.test(us)) return "parquing";
  return "local";
}

// One row per unit, like the portal's table ("Principal 1a", "Local 2").
export function plantesFromCadastre(d: CadastreDades): IteObj[] {
  const sorted = d.unitats.slice().sort((a, b) => plantaRank(a.planta) - plantaRank(b.planta) || a.porta.localeCompare(b.porta, "ca", { numeric: true }));
  return sorted.map((u) => {
    const tipus = tipusUnitat(u.us);
    const label =
      u.planta.toUpperCase() === "LC" || (tipus === "local" && plantaRank(u.planta) === 0)
        ? `Local ${Number(u.porta) || u.porta} planta baixa`
        : `${plantaLabel(u.planta)} ${portaLabel(u.porta)}`.trim();
    return newPlanta(label, tipus === "habitatge" ? 1 : 0, tipus === "local" ? 1 : 0, tipus === "parquing");
  });
}

export interface CadastreApply {
  adreca?: boolean;
  any?: boolean;
  superficie?: boolean;
  plantes?: boolean; // replaces the floors table
  nom?: boolean; // renames the report after the address
}

export function applyCadastre(doc: IteObj, d: CadastreDades, cataleg: Cataleg, what: CadastreApply): IteObj {
  let out = doc;
  if (what.adreca) {
    const tv = tipusViaFor(cataleg, d.viaWord);
    const cur = getAt(out, "edifici.referenciaCadastral");
    const rc: IteObj = isObj(cur) ? { ...cur } : { id: "null" };
    if (tv) rc.tipusVia = catId(tv);
    else delete rc.tipusVia;
    rc.nomVia = d.nomVia;
    rc.numero = d.numero;
    if (d.codiPostal) rc.codiPostal = d.codiPostal;
    rc.municipi = d.municipi;
    rc.provincia = d.provincia;
    if (d.codiIne) rc.codiIne = d.codiIne;
    rc.adrecaCorrecta = rc.adrecaCorrecta ?? "false";
    rc.adrecaIncorrecta = rc.adrecaIncorrecta ?? "false";
    out = setAt(out, "edifici.referenciaCadastral", rc);
  }
  if (what.any && d.anyConstruccio) out = setAt(out, "edifici.edificiDescripcio.anyConstruccio", String(d.anyConstruccio));
  if (what.superficie && d.superficieConstruida > 0) {
    out = setAt(out, "edifici.edificiDescripcio.superficieConstruida", javaDouble(d.superficieConstruida));
    const font = (cataleg.font_superficies ?? []).find((o) => o.codi === "CADASTRE") ?? findCat(cataleg, "font_superficies", "51");
    if (font) out = setAt(out, "edifici.edificiDescripcio.fontInformacioSup", structuredClone(font));
  }
  if (what.plantes) out = setAt(out, LIST_PATHS.plantes, plantesFromCadastre(d));
  if (what.nom) {
    const muni = municipiFor(cataleg, d.municipi);
    out = setAt(out, "nom", nomInforme(d.viaWord, d.nomVia, d.numero, muni ? String(muni.nom ?? d.municipi) : titleCase(d.municipi)));
  }
  return out;
}

export function teFilesDePlantes(doc: IteObj): boolean {
  return listOf(doc, LIST_PATHS.plantes).length > 0;
}
