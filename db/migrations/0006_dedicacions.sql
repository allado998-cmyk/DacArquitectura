-- DacArquitectura — Dedicació (time worked per expedient).
-- Idempotent: safe to re-run.

create table if not exists public.dedicacions (
  id bigserial primary key,
  expedient_id bigint not null references public.expedients(id) on delete cascade,
  data date not null default current_date,
  hores numeric(6, 2) not null default 0,
  tasca text,           -- "doing what" (often a Despesa Directa concept)
  comentari text,
  created_at timestamptz not null default now()
);

create index if not exists idx_dedicacions_expedient on public.dedicacions(expedient_id);
create index if not exists idx_dedicacions_data on public.dedicacions(data);
