-- DacArquitectura — initial schema.
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

-- updated_at helper.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================================
-- Catalogs (managed in Parameters tab)
-- =========================================================================

create table if not exists public.projectes (
  id bigserial primary key,
  nom text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id bigserial primary key,
  nom text not null,
  contacte text,
  created_at timestamptz not null default now()
);

create table if not exists public.concepte_despesa_directa (
  id bigserial primary key,
  nom text not null unique,
  actiu boolean not null default true,
  ordre integer not null default 0
);

create table if not exists public.concepte_altra_despesa (
  id bigserial primary key,
  nom text not null unique,
  preu_unitat_default numeric(12, 4) not null default 0,
  actiu boolean not null default true,
  ordre integer not null default 0
);

-- =========================================================================
-- Propostes
-- =========================================================================

create table if not exists public.propostes (
  id bigserial primary key,
  data date not null default current_date,
  projecte_id bigint references public.projectes(id) on delete set null,
  client_id bigint references public.clients(id) on delete set null,
  contacte_prescriptor text,
  preu_hora_default numeric(12, 4) not null default 28.27,
  despeses_indirectes numeric(12, 2) not null default 0,
  benefici numeric(12, 2) not null default 0,
  total_honoraris_override numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists propostes_set_updated_at on public.propostes;
create trigger propostes_set_updated_at
  before update on public.propostes
  for each row execute function public.set_updated_at();

create table if not exists public.proposta_despesa_directa_line (
  id bigserial primary key,
  proposta_id bigint not null references public.propostes(id) on delete cascade,
  concepte_id bigint not null references public.concepte_despesa_directa(id) on delete restrict,
  hores numeric(10, 2) not null default 0,
  preu_hora numeric(12, 4) not null default 28.27,
  ordre integer not null default 0
);

create index if not exists idx_pdd_line_proposta on public.proposta_despesa_directa_line(proposta_id);

create table if not exists public.proposta_altra_despesa_line (
  id bigserial primary key,
  proposta_id bigint not null references public.propostes(id) on delete cascade,
  concepte_id bigint not null references public.concepte_altra_despesa(id) on delete restrict,
  unitats numeric(10, 2) not null default 0,
  preu_unitat numeric(12, 4) not null default 0,
  ordre integer not null default 0
);

create index if not exists idx_pad_line_proposta on public.proposta_altra_despesa_line(proposta_id);
