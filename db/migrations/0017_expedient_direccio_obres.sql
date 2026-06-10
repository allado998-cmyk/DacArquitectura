-- DacArquitectura — Expedients: "Direcció d'obres" flag. Idempotent.

alter table public.expedients
  add column if not exists direccio_obres boolean not null default false;
