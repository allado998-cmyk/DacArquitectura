-- DacArquitectura — acta: attached audio messages (not printed).
-- Stored as base64 data URIs in jsonb: [{name, dataUrl}].
-- Idempotent: safe to re-run.

alter table public.acta add column if not exists audios jsonb not null default '[]';
