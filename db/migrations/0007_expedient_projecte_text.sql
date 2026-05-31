-- DacArquitectura — Expedients: projecte back to free text, add closing date.
-- Idempotent: safe to re-run.

alter table public.expedients drop column if exists projecte_id;
alter table public.expedients add column if not exists projecte text;
alter table public.expedients add column if not exists data_tancament date;
