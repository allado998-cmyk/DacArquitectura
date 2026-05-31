-- DacArquitectura — Expedients: rename visibilitat → tipus and turn
-- projecte/client free text into lookups against the Base de Dades catalogs.
-- Idempotent: safe to re-run.

-- visibilitat → tipus
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'expedients' and column_name = 'visibilitat'
  ) then
    alter table public.expedients rename column visibilitat to tipus;
  end if;
end $$;

-- projecte/client text → FK lookups
alter table public.expedients drop column if exists projecte;
alter table public.expedients drop column if exists client;

alter table public.expedients
  add column if not exists projecte_id bigint references public.projectes(id) on delete set null;
alter table public.expedients
  add column if not exists client_id bigint references public.clients(id) on delete set null;

create index if not exists idx_expedients_projecte on public.expedients(projecte_id);
create index if not exists idx_expedients_client on public.expedients(client_id);
