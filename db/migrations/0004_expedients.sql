-- DacArquitectura — Expedients (project file register).
-- Idempotent: safe to re-run.

create table if not exists public.expedients (
  id bigserial primary key,
  num_expedient text not null unique,       -- format YY-NNNN, e.g. 26-0001
  projecte text,
  client text,
  ciutat text,
  estat text not null default 'obert'
    check (estat in ('obert', 'tancat')),
  categoria text
    check (categoria in ('re', 'co', 'ed', 'rec', 'do')),
  visibilitat text not null default 'privat'
    check (visibilitat in ('public', 'privat')),
  pressupost numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists expedients_set_updated_at on public.expedients;
create trigger expedients_set_updated_at
  before update on public.expedients
  for each row execute function public.set_updated_at();

create index if not exists idx_expedients_estat on public.expedients(estat);
create index if not exists idx_expedients_categoria on public.expedients(categoria);
create index if not exists idx_expedients_ciutat on public.expedients(ciutat);
