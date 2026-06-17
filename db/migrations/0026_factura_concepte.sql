-- DacArquitectura — Optional breakdown of a factura's base into concept lines.
-- When present, factura.preu is the sum of these. Idempotent: safe to re-run.

create table if not exists public.factura_concepte (
  id bigserial primary key,
  factura_id bigint not null references public.factura(id) on delete cascade,
  descripcio text,
  import numeric(14, 2) not null default 0,
  ordre integer not null default 0
);
create index if not exists idx_factura_concepte on public.factura_concepte(factura_id);
