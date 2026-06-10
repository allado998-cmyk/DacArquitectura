-- DacArquitectura — Facturació (invoices). Idempotent: safe to re-run.

create table if not exists public.factura (
  id bigserial primary key,
  num text unique,                 -- YY-XXX
  client_id bigint references public.clients(id) on delete set null,
  data date,                       -- invoice date
  expedient_id bigint references public.expedients(id) on delete set null,
  preu numeric(14, 2) not null default 0,
  pagada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists factura_set_updated_at on public.factura;
create trigger factura_set_updated_at
  before update on public.factura
  for each row execute function public.set_updated_at();

create table if not exists public.factura_suplit (
  id bigserial primary key,
  factura_id bigint not null references public.factura(id) on delete cascade,
  descripcio text,
  import numeric(14, 2) not null default 0,
  ordre integer not null default 0
);
create index if not exists idx_factura_suplit on public.factura_suplit(factura_id);
