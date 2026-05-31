-- DacArquitectura — Clients: richer fields + multiple contacts.
-- Idempotent: safe to re-run. The legacy `contacte` column is kept for the
-- Honoraris module; new UI uses the fields below + client_contactes.

alter table public.clients add column if not exists nif text;
alter table public.clients add column if not exists carrer text;
alter table public.clients add column if not exists ciutat text;
alter table public.clients add column if not exists codi_postal text;

create table if not exists public.client_contactes (
  id bigserial primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  nom text,
  telefon text,
  mail text,
  ordre integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_contactes_client on public.client_contactes(client_id);
