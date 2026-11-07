-- DacArquitectura — Files attached to an expedient («Fitxers adjunts»).
-- The files themselves live in the private Vercel Blob store; each row keeps
-- the original name, the size and where the file is (pathname). Idempotent.

create table if not exists public.expedient_fitxers (
  id bigserial primary key,
  expedient_id bigint not null references public.expedients(id) on delete cascade,
  nom text not null,
  mida bigint not null,
  tipus text,
  pathname text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_expedient_fitxers_expedient on public.expedient_fitxers(expedient_id);
