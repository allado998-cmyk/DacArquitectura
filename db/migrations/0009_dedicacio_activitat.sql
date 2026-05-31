-- DacArquitectura — Dedicació can target a non-expedient activity
-- (e.g. "Treball de web", "Treball de factures").
-- Idempotent: safe to re-run.

alter table public.dedicacions alter column expedient_id drop not null;
alter table public.dedicacions add column if not exists activitat text;
