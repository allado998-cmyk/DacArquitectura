// Everything the Descàrregues documents list, read in one go (parallel
// queries, one wake-up of the database per run). The columns and orders are
// the pages' own, so each PDF matches what the page would print.
import { sql } from "@/lib/db";
import { loadHonorarisLlista, type HonorariRow } from "@/lib/honoraris-llista";
import { listOf, LIST_PATHS, valoracioFavorable } from "@/lib/ite/model";
import type { IteObj } from "@/lib/ite/xml";
import type { DedicacioStatsRow } from "@/lib/llistats/dedicacio";
import type { ExpedientLlistaRow, ExpedientStatsRow } from "@/lib/llistats/expedients";
import type { FacturaLlistaRow } from "@/lib/llistats/facturacio";
import type { ActaLlistaRow, IteLlistaRow, PropostaLlistaRow } from "@/lib/llistats/llistes";
import type { Client, ClientContacte } from "@/types/db";

export type ExpedientRow = ExpedientLlistaRow & ExpedientStatsRow;
export type DedicacioRow = DedicacioStatsRow & { id: number };
export type IteRow = IteLlistaRow & { any: string }; // year of the inspection, or of creation before it

export interface Dades {
  expedients: ExpedientRow[];
  dedicacions: DedicacioRow[];
  actes: ActaLlistaRow[];
  ites: IteRow[];
  honoraris: HonorariRow[];
  propostes: PropostaLlistaRow[];
  factures: FacturaLlistaRow[]; // emeses only
  suplits: { factura_id: number; import: string }[];
  clients: Pick<Client, "id" | "nom" | "nif" | "ciutat" | "codi_postal">[];
  clientStats: { client_id: number; n: number; oberts: number }[];
  contactes: (Pick<ClientContacte, "id" | "client_id" | "nom" | "professio" | "telefon" | "telefons_extra" | "mail" | "client_nom">)[];
}

export async function carregarDades(): Promise<Dades> {
  const [expedients, dedicacions, actes, ites, honoraris, propostes, factures, suplits, clients, clientStats, contactes] = await Promise.all([
    sql`
      select e.id, e.num_expedient, e.projecte, c.nom as client_nom, e.ciutat, e.estat, e.categoria,
             t.nom as tipologia_nom, e.tipus, e.web, e.pressupost::text as pressupost,
             coalesce(public.calcul_planned_hores(e.calcul_id), 0)::text as planned_hores,
             to_char(e.data_tancament, 'YYYY-MM-DD') as data_tancament
      from public.expedients e
      left join public.clients c on c.id = e.client_id
      left join public.tipologies t on t.id = e.tipologia_id
      order by e.num_expedient desc
    ` as unknown as Promise<ExpedientRow[]>,
    sql`
      select d.id, d.expedient_id, to_char(d.data, 'YYYY-MM-DD') as data, d.hores::text as hores,
             e.categoria, c.nom as client_nom
      from public.dedicacions d
      left join public.expedients e on e.id = d.expedient_id
      left join public.clients c on c.id = e.client_id
      order by d.data desc, d.id desc
    ` as unknown as Promise<DedicacioRow[]>,
    sql`
      select a.num, a.tipus, a.acta_num, to_char(a.data, 'YYYY-MM-DD') as data, a.projecte, a.client,
             e.num_expedient as expedient_num
      from public.acta a
      left join public.expedients e on e.id = a.expedient_id
      order by a.num desc nulls last, a.id desc
    ` as unknown as Promise<ActaLlistaRow[]>,
    sql`
      select i.nom, i.adreca, to_char(i.data_inspeccio, 'YYYY-MM-DD') as data_inspeccio,
             to_char(coalesce(i.data_inspeccio, (i.created_at at time zone 'Europe/Madrid')::date), 'YYYY') as any,
             e.num_expedient as expedient_num, c.nom as client_nom, i.dades
      from public.ite_informe i
      left join public.expedients e on e.id = i.expedient_id
      left join public.clients c on c.id = i.client_id
      order by coalesce(i.data_inspeccio, (i.created_at at time zone 'Europe/Madrid')::date) desc, i.id desc
    ` as unknown as Promise<(Omit<IteRow, "deficiencies" | "favorable"> & { dades: IteObj })[]>,
    loadHonorarisLlista(),
    sql`
      select d.num, to_char(d.data, 'YYYY-MM-DD') as data, d.descripcio, d.estat, c.nom as client_nom,
             coalesce((select sum(preu) from public.proposta_doc_servei where doc_id = d.id), 0)::text as total
      from public.proposta_doc d
      left join public.clients c on c.id = d.client_id
      order by d.num desc nulls last, d.id desc
    ` as unknown as Promise<PropostaLlistaRow[]>,
    sql`
      select f.id, f.num, f.estat, to_char(f.data, 'YYYY-MM-DD') as data, c.nom as client_nom, c.nif,
             e.num_expedient as expedient_num, f.preu::text as preu, coalesce(f.iva_pct, 21)::text as iva_pct, f.pagada
      from public.factura f
      left join public.clients c on c.id = f.client_id
      left join public.expedients e on e.id = f.expedient_id
      where f.estat = 'emesa'
      order by f.num desc nulls last, f.id desc
    ` as unknown as Promise<FacturaLlistaRow[]>,
    sql`select factura_id, import::text as import from public.factura_suplit order by ordre, id` as unknown as Promise<Dades["suplits"]>,
    sql`select id, nom, nif, ciutat, codi_postal from public.clients order by nom` as unknown as Promise<Dades["clients"]>,
    sql`
      select client_id, count(*)::int as n, count(*) filter (where estat = 'obert')::int as oberts
      from public.expedients
      where client_id is not null
      group by client_id
    ` as unknown as Promise<Dades["clientStats"]>,
    sql`
      select cc.id, cc.client_id, cc.nom, cc.professio, cc.telefon, cc.telefons_extra, cc.mail, c.nom as client_nom
      from public.client_contactes cc
      left join public.clients c on c.id = cc.client_id
      order by lower(nullif(cc.nom, '')) asc nulls last, cc.id
    ` as unknown as Promise<Dades["contactes"]>,
  ]);

  return {
    expedients,
    dedicacions,
    actes,
    // The report itself says how many deficiencies it has and whether it is
    // favourable; before the inspection there is nothing to assess yet.
    ites: ites.map(({ dades, ...i }) => ({
      ...i,
      deficiencies: listOf(dades, LIST_PATHS.deficiencies).length,
      favorable: i.data_inspeccio ? valoracioFavorable(dades) : null,
    })),
    honoraris,
    propostes,
    factures,
    suplits,
    clients,
    clientStats,
    contactes,
  };
}
