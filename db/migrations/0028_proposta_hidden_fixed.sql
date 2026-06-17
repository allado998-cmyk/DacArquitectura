-- DacArquitectura — Allow hiding the built-in (fixed) inclusions/exclusions per
-- proposta. Stored as indices into FIXED_INCLUSIONS / FIXED_EXCLUSIONS so it is
-- language-independent. Idempotent: safe to re-run.

alter table public.proposta_doc
  add column if not exists hidden_inclusions integer[] not null default '{}',
  add column if not exists hidden_exclusions integer[] not null default '{}';
