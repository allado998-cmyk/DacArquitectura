-- DacArquitectura — "Propostes" (Proposta d'Honoraris document generator).
-- Separate from the Honoraris "càlcul" (public.propostes).
-- Idempotent: safe to re-run.

create table if not exists public.proposta_doc (
  id bigserial primary key,
  num text unique,                 -- PH-XXXX
  data date not null default current_date,
  descripcio text,
  adreca text,
  ciutat text,
  estat text not null default 'pendent'
    check (estat in ('pendent', 'acceptada', 'rebutjada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists proposta_doc_set_updated_at on public.proposta_doc;
create trigger proposta_doc_set_updated_at
  before update on public.proposta_doc
  for each row execute function public.set_updated_at();

create table if not exists public.proposta_doc_servei (
  id bigserial primary key,
  doc_id bigint not null references public.proposta_doc(id) on delete cascade,
  descripcio text,
  preu numeric(12, 2) not null default 0,
  ordre integer not null default 0
);
create index if not exists idx_pds_doc on public.proposta_doc_servei(doc_id);

create table if not exists public.proposta_doc_inclusio (
  id bigserial primary key,
  doc_id bigint not null references public.proposta_doc(id) on delete cascade,
  text text,
  ordre integer not null default 0
);
create index if not exists idx_pdi_doc on public.proposta_doc_inclusio(doc_id);

create table if not exists public.proposta_doc_exclusio (
  id bigserial primary key,
  doc_id bigint not null references public.proposta_doc(id) on delete cascade,
  text text,
  ordre integer not null default 0
);
create index if not exists idx_pde_doc on public.proposta_doc_exclusio(doc_id);

create table if not exists public.proposta_doc_pagament (
  id bigserial primary key,
  doc_id bigint not null references public.proposta_doc(id) on delete cascade,
  descripcio text,
  import numeric(12, 2),
  ordre integer not null default 0
);
create index if not exists idx_pdp_doc on public.proposta_doc_pagament(doc_id);
