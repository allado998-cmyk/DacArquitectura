-- DacArquitectura — Expedients: "Web" yes/no flag (shown in the list). Idempotent.

alter table public.expedients
  add column if not exists web boolean not null default false;
