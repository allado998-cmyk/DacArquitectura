-- Per-concept default €/h for Despeses Directes.
-- Existing rows get the global default of 28.27 via column default.

alter table public.concepte_despesa_directa
  add column if not exists preu_hora_default numeric(12, 4) not null default 28.27;
