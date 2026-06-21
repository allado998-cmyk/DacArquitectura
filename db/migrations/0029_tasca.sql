-- DacArquitectura — Tasques catalog (lookup for the dedicació "Tasca" field).
-- Seeded from tasques already used in dedicacions. Idempotent: safe to re-run.

create table if not exists public.tasca (
  id bigserial primary key,
  nom text not null unique,
  created_at timestamptz not null default now()
);

insert into public.tasca (nom)
  select distinct btrim(tasca)
  from public.dedicacions
  where tasca is not null and btrim(tasca) <> ''
  on conflict (nom) do nothing;
