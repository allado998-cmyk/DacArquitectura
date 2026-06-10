-- DacArquitectura — Expedients: planning dates.
-- data_inici = start, data_final = forecast end (distinct from data_tancament,
-- which is the actual closing date). Idempotent: safe to re-run.

alter table public.expedients add column if not exists data_inici date;
alter table public.expedients add column if not exists data_final date;
