-- DacArquitectura — Càlculs estructurals (justificacions de càlcul).
-- One row per calculation, replacing David's spreadsheets:
--   paret:     Justificació de Càlcul Estintolament Paret de Càrrega
--   biga:      Justificació Comprovació Recolzament Biga amb Daus o Connectors
--   pilar:     Justificació Comprovació Recolzament Base Pilar Estintolament
--   soldadura: Justificació Comprovació Compatibilitat Soldadures
-- The header ("Dades generals") is stored in columns so lists can show it; the
-- calculation inputs live in `dades` (shape per tipus, see src/lib/calculs).
-- Idempotent: safe to re-run.

create table if not exists public.calcul_estructural (
  id bigserial primary key,
  num text unique,                              -- CE-YY-NNN
  tipus text not null check (tipus in ('paret', 'biga', 'pilar', 'soldadura')),
  expedient_id bigint references public.expedients(id) on delete set null,
  client_id bigint references public.clients(id) on delete set null,
  referencia text,                              -- "Referència DAC"
  projecte text,
  adreca text,
  ciutat text,
  client text,
  arquitecte text,
  situacio text,                                -- planta / paret de càrrega / base paviment
  element text,                                 -- "Referència element"
  data date,
  versio text,
  dades jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_calcul_estructural_expedient on public.calcul_estructural(expedient_id);
create index if not exists idx_calcul_estructural_tipus on public.calcul_estructural(tipus);
