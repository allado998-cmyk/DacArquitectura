export interface Projecte {
  id: number;
  nom: string;
  created_at: string;
}

export interface Client {
  id: number;
  nom: string;
  contacte: string | null;
  created_at: string;
}

export interface ConcepteDespesaDirecta {
  id: number;
  nom: string;
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
