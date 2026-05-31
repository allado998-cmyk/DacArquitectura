export interface Projecte {
  id: number;
  nom: string;
  created_at: string;
}

export interface Client {
  id: number;
  nom: string;
  nif: string | null;
  carrer: string | null;
  ciutat: string | null;
  codi_postal: string | null;
  contacte: string | null; // legacy, used by Honoraris
  created_at: string;
  contactes?: ClientContacte[]; // joined
}

export interface ClientContacte {
  id: number;
  client_id: number;
  nom: string | null;
  telefon: string | null;
  mail: string | null;
  ordre: number;
}

export interface ConcepteDespesaDirecta {
  id: number;
  nom: string;
  preu_hora_default: string; // numeric arrives as string from neon
  actiu: boolean;
  ordre: number;
}

export interface ConcepteAltraDespesa {
  id: number;
  nom: string;
  preu_unitat_default: string; // numeric arrives as string from neon
  actiu: boolean;
  ordre: number;
}

export interface Proposta {
  id: number;
  data: string; // ISO date
  projecte_id: number | null;
  client_id: number | null;
  contacte_prescriptor: string | null;
  preu_hora_default: string;
  despeses_indirectes: string;
  benefici: string;
  total_honoraris_override: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropostaDespesaDirectaLine {
  id: number;
  proposta_id: number;
  concepte_id: number;
  concepte_nom?: string; // joined
  hores: string;
  preu_hora: string;
  ordre: number;
}

export interface PropostaAltraDespesaLine {
  id: number;
  proposta_id: number;
  concepte_id: number;
  concepte_nom?: string; // joined
  unitats: string;
  preu_unitat: string;
  ordre: number;
}

export type ExpedientEstat = "obert" | "tancat";
export type ExpedientCategoria = "re" | "co" | "ed" | "rec" | "do";
export type ExpedientTipus = "public" | "privat";

export interface Expedient {
  id: number;
  num_expedient: string; // YY-NNNN
  projecte: string | null; // free text
  client_id: number | null;
  client_nom: string | null; // joined from clients
  ciutat: string | null;
  estat: ExpedientEstat;
  categoria: ExpedientCategoria | null;
  tipus: ExpedientTipus;
  pressupost: string; // numeric arrives as string from neon
  data_tancament: string | null; // ISO date, set when closed
  created_at: string;
  updated_at: string;
}

export interface Dedicacio {
  id: number;
  expedient_id: number;
  num_expedient?: string; // joined
  projecte?: string | null; // joined (expedient free text)
  categoria?: ExpedientCategoria | null; // joined
  client_id?: number | null; // joined
  client_nom?: string | null; // joined
  data: string; // ISO date
  hores: string; // numeric arrives as string from neon
  tasca: string | null;
  comentari: string | null;
  created_at: string;
}
