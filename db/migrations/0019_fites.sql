-- DacArquitectura — Planificació milestones ("Fites").
-- fita_tipus is a reusable catalog (name + shape); expedient_fita places one
-- on a date for an expedient. Idempotent: safe to re-run.

create table if not exists public.fita_tipus (
  id bigserial primary key,
  nom text not null unique,
  forma text not null default 'diamond',
  created_at timestamptz not null default now()
);

create table if not exists public.expedient_fita (
  id bigserial primary key,
  expedient_id bigint not null references public.expedients(id) on delete cascade,
  tipus_id bigint not null references public.fita_tipus(id) on delete cascade,
  data date not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_expedient_fita_exp on public.expedient_fita(expedient_id);
