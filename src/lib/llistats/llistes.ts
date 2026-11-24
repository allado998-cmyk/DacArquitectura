// The plain lists: Actes, Càlculs d'honoraris, Propostes, Clients, Contactes
// and ITE — the columns and rows each «PDF» button prints and the Descàrregues
// page files.

import { actaReasonLabel } from "@/lib/acta-doc";
import { formatDataCa, formatEur } from "@/lib/format";
import type { Client, ClientContacte, PropostaDocEstat } from "@/types/db";
import { dataCa, type PdfDoc } from "./doc";

const num = (v: string | null | undefined) => parseFloat(v ?? "") || 0;

// ============================================================================
// Actes
// ============================================================================

export interface ActaLlistaRow {
  num: string | null;
  tipus: string;
  acta_num: string | null;
  expedient_num: string | null;
  projecte: string | null;
  client: string | null;
  data: string | null;
}

export function actesListDoc(rows: ActaLlistaRow[], subtitle: string): PdfDoc {
  return {
    title: "Actes",
    subtitle,
    landscape: true,
    blocks: [
      {
        kind: "table",
        table: {
          columns: [{ label: "Núm" }, { label: "Motiu" }, { label: "Acta nº" }, { label: "Expedient" }, { label: "Projecte" }, { label: "Client" }, { label: "Data", align: "right" }],
          rows: rows.map((a) => [a.num ?? "", actaReasonLabel(a.tipus), a.acta_num ?? "", a.expedient_num ?? "", a.projecte ?? "", a.client ?? "", dataCa(a.data)]),
        },
      },
    ],
  };
}

// ============================================================================
// Càlculs d'honoraris
// ============================================================================

export interface HonorariLlistaRow {
  id: number;
  num_proposta: string | null;
  data: string;
  projecte: string | null;
  client_nom: string | null;
  total: string;
}

export function honorarisListDoc(rows: HonorariLlistaRow[], subtitle: string): PdfDoc {
  const totalSum = rows.reduce((s, r) => s + num(r.total), 0);
  return {
    title: "Càlculs d'honoraris",
    subtitle,
    landscape: true,
    blocks: [
      {
        kind: "table",
        table: {
          columns: [{ label: "Núm." }, { label: "Data" }, { label: "Projecte" }, { label: "Client" }, { label: "Preu", align: "right" }],
          rows: rows.map((r) => [`CH-${r.num_proposta ?? r.id}`, formatDataCa(r.data), r.projecte ?? "—", r.client_nom ?? "—", formatEur(r.total)]),
          total: ["Total", "", "", `${rows.length}`, formatEur(totalSum)],
        },
      },
    ],
  };
}

// ============================================================================
// Propostes d'honoraris
// ============================================================================

export const PROPOSTA_ESTAT_META: Record<PropostaDocEstat, { label: string; bg: string; text: string; color: string }> = {
  pendent: { label: "Pendent", bg: "#fef9c3", text: "#854d0e", color: "#eab308" },
  acceptada: { label: "Acceptada", bg: "#dcfce7", text: "#15803d", color: "#16a34a" },
  rebutjada: { label: "Rebutjada", bg: "#fee2e2", text: "#b91c1c", color: "#dc2626" },
};

export interface PropostaLlistaRow {
  num: string;
  data: string;
  descripcio: string | null;
  client_nom: string | null;
  total: string;
  estat: PropostaDocEstat;
}

export function propostesListDoc(rows: PropostaLlistaRow[], subtitle: string): PdfDoc {
  return {
    title: "Propostes d'honoraris",
    subtitle,
    landscape: true,
    blocks: [
      {
        kind: "table",
        table: {
          columns: [{ label: "Núm." }, { label: "Data" }, { label: "Descripció" }, { label: "Client" }, { label: "Import", align: "right" }, { label: "Estat" }],
          rows: rows.map((r) => [r.num, formatDataCa(r.data), r.descripcio ?? "—", r.client_nom ?? "—", formatEur(r.total), PROPOSTA_ESTAT_META[r.estat].label]),
        },
      },
    ],
  };
}

// ============================================================================
// Clients i contactes (Base de Dades)
// ============================================================================

// By name as Catalan sorts it; nameless last.
export const byNom = (a: { nom: string | null }, b: { nom: string | null }) => (a.nom ?? "￿").localeCompare(b.nom ?? "￿", "ca");

export interface ClientLlistaInfo {
  contactes: number;
  oberts: number; // open expedients
  expedients: number;
}

export function clientsListDoc(rows: Pick<Client, "id" | "nom" | "nif" | "ciutat" | "codi_postal">[], info: (clientId: number) => ClientLlistaInfo, subtitle: string): PdfDoc {
  return {
    title: "Clients",
    subtitle,
    landscape: false,
    blocks: [
      {
        kind: "table",
        table: {
          columns: [{ label: "Nom" }, { label: "NIF/CIF" }, { label: "Ciutat" }, { label: "CP" }, { label: "Contactes", align: "right" }, { label: "Oberts", align: "right" }, { label: "Exp.", align: "right" }],
          rows: rows.map((c) => {
            const i = info(c.id);
            return [c.nom, c.nif ?? "—", c.ciutat ?? "—", c.codi_postal ?? "—", String(i.contactes), String(i.oberts), String(i.expedients)];
          }),
        },
      },
    ],
  };
}

export function contactesListDoc(rows: Pick<ClientContacte, "nom" | "professio" | "telefon" | "telefons_extra" | "mail" | "client_nom">[], subtitle: string): PdfDoc {
  return {
    title: "Contactes",
    subtitle,
    landscape: true,
    blocks: [
      {
        kind: "table",
        table: {
          columns: [{ label: "Nom" }, { label: "Professió" }, { label: "Telèfon 1" }, { label: "Telèfon 2" }, { label: "Mail" }, { label: "Client" }],
          rows: rows.map((c) => [c.nom ?? "—", c.professio ?? "—", c.telefon ?? "—", c.telefons_extra[0] ?? "—", c.mail ?? "—", c.client_nom ?? "—"]),
        },
      },
    ],
  };
}

// ============================================================================
// ITE (informes d'inspecció tècnica)
// ============================================================================

export interface IteLlistaRow {
  expedient_num: string | null;
  nom: string;
  adreca: string | null;
  client_nom: string | null;
  data_inspeccio: string | null;
  deficiencies: number;
  // The report's final assessment (favourable when every deficiency is minor);
  // null before the inspection, when it would say nothing yet.
  favorable: boolean | null;
}

export function iteListDoc(rows: IteLlistaRow[], subtitle: string, empty = "Cap informe."): PdfDoc {
  return {
    title: "Informes ITE",
    subtitle,
    landscape: true,
    blocks: [
      {
        kind: "table",
        table: {
          columns: [
            { label: "Expedient", mono: true },
            { label: "Informe" },
            { label: "Adreça" },
            { label: "Propietat" },
            { label: "Inspecció", align: "right" },
            { label: "Deficiències", align: "right" },
            { label: "Valoració" },
          ],
          rows: rows.map((i) => [
            i.expedient_num ?? "—",
            i.nom || "(sense nom)",
            i.adreca ?? "—",
            i.client_nom ?? "—",
            dataCa(i.data_inspeccio) || "—",
            String(i.deficiencies),
            i.favorable == null ? "—" : i.favorable ? "Favorable" : "Desfavorable",
          ]),
          empty,
        },
      },
    ],
  };
}
