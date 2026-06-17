-- DacArquitectura — Free-text comment on a contacte (optional).
-- Idempotent: safe to re-run.

alter table public.client_contactes
  add column if not exists comentari text;
