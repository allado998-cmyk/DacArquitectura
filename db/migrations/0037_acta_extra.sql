-- DacArquitectura — acta: next-visit date/time + flexible signatures list.
-- Temes categories (pendent/executat/tractat) live in the temes jsonb.
-- Idempotent: safe to re-run.

alter table public.acta add column if not exists propera_data date;
alter table public.acta add column if not exists propera_hora text;
alter table public.acta add column if not exists signatures jsonb not null default '[]';
