export interface Tipologia {
  id: number;
  nom: string;
  ordre: number;
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

export interface Tasca {
  id: number;
  nom: string;
}

export interface ClientContacte {
  id: number;
  client_id: number | null;
  nom: string | null;
  telefon: string | null;
  mail: string | null;
  comentari: string | null;
  ordre: number;
  client_nom?: string | null; // joined (Contactes tab)
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
  num_proposta: string; // YY-NNNN
  data: string; // ISO date
  projecte: string | null; // free text
  client_id: number | null;
  contacte_prescriptor: string | null;
  preu_hora_default: string;
  despeses_indirectes_pct: string; // percentage
  benefici_pct: string; // percentage
  total_honoraris_override: string | null;
  // ITE variant
  es_ite: boolean;
  ut_habitatges: string;
  ut_locals_200: string;
  ut_locals_400: string;
  ut_locals_600: string;
  ut_locals_800: string;
  ut_locals_1000: string;
  ite_descompte_pct: string;
  ite_iva_pct: string;
  ite_comissio_activa: boolean;
  ite_comissio_pct: string;
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
  tipologia_id: number | null;
  tipologia_nom: string | null; // joined
  tipus: ExpedientTipus;
  direccio_obres: boolean;
  web: boolean;
  pressupost: string; // numeric arrives as string from neon
  pressupost_origen: "manual" | "calcul" | "proposta";
  calcul_id: number | null;
  proposta_doc_id: number | null;
  planned_hores?: string | null; // joined: planned hours from the linked càlcul
  data_inici: string | null; // ISO date, planning start
  data_final: string | null; // ISO date, forecast end (not the close date)
  data_tancament: string | null; // ISO date, set when closed
  created_at: string;
  updated_at: string;
}

export interface Dedicacio {
  id: number;
  expedient_id: number | null; // null when logged against an internal activity
  activitat: string | null; // non-expedient work, e.g. "Treball de web"
  num_expedient?: string | null; // joined
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

export type PropostaDocEstat = "pendent" | "acceptada" | "rebutjada";

export interface PropostaDoc {
  id: number;
  num: string; // PH-YY-NNN
  data: string; // ISO date
  descripcio: string | null;
  adreca: string | null;
  ciutat: string | null;
  codi_postal: string | null;
  client_id: number | null;
  calcul_id: number | null;
  estat: PropostaDocEstat;
  hidden_inclusions: number[]; // indices into FIXED_INCLUSIONS that are hidden
  hidden_exclusions: number[]; // indices into FIXED_EXCLUSIONS that are hidden
  created_at: string;
  updated_at: string;
}

export interface PropostaDocServei {
  id: number;
  doc_id: number;
  descripcio: string | null;
  preu: string;
  ordre: number;
}

export interface PropostaDocLinia {
  id: number;
  doc_id: number;
  text: string | null;
  ordre: number;
}

export interface PropostaDocPagament {
  id: number;
  doc_id: number;
  descripcio: string | null;
  import: string | null;
  ordre: number;
}

export interface Factura {
  id: number;
  num: string | null; // YY-XXX (null while "propera")
  estat: "propera" | "emesa";
  client_id: number | null;
  client_nom?: string | null;
  nif?: string | null; // from client
  client_carrer?: string | null; // from client
  client_ciutat?: string | null; // from client
  client_codi_postal?: string | null; // from client
  data: string | null; // ISO date
  expedient_id: number | null;
  expedient_num?: string | null;
  expedient_projecte?: string | null;
  expedient_categoria?: string | null; // from linked expedient
  expedient_tipus?: "privat" | "public" | null; // from linked expedient
  expedient_tipologia?: string | null; // tipologia nom, from linked expedient
  concepte: string | null; // free-text invoice concept
  lang: "ca" | "es"; // generated document language
  preu: string;
  iva_pct: string; // VAT rate, default 21
  pagada: boolean;
  suplits_total?: string; // joined sum
  created_at: string;
  updated_at: string;
}

export interface FacturaSuplit {
  id: number;
  factura_id: number;
  descripcio: string | null;
  import: string;
  ordre: number;
}

export interface FacturaConcepte {
  id: number;
  factura_id: number;
  descripcio: string | null;
  import: string;
  ordre: number;
}

export interface ClientStats {
  client_id: number;
  n: number;
  oberts: number;
  pressupost_total: string;
  pressupost_obert: string;
}
