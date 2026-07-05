-- DacArquitectura — acta: attached photos + attached documents (PDFs).
-- Stored as base64 data URIs in jsonb.
--   fotografies: text[] of data URIs
--   documents:   [{name, dataUrl}]
-- Idempotent: safe to re-run.

alter table public.acta add column if not exists fotografies jsonb not null default '[]';
alter table public.acta add column if not exists documents jsonb not null default '[]';
