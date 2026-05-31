-- DacArquitectura — Honoraris propostes: free-text projecte, % based
-- indirectes/benefici, and a YY-NNNN proposal number.
-- Idempotent: safe to re-run.

-- projecte: free text (was a FK to projectes)
alter table public.propostes add column if not exists projecte text;
update public.propostes p
  set projecte = pr.nom
  from public.projectes pr
  where p.projecte_id = pr.id and p.projecte is null;
alter table public.propostes drop column if exists projecte_id;

-- percentages instead of absolute amounts
alter table public.propostes add column if not exists despeses_indirectes_pct numeric(6, 2) not null default 0;
alter table public.propostes add column if not exists benefici_pct numeric(6, 2) not null default 0;

-- YY-NNNN proposal number
alter table public.propostes add column if not exists num_proposta text;
with ordered as (
  select id,
         to_char(data, 'YY') as yy,
         row_number() over (partition by to_char(data, 'YY') order by id) as rn
  from public.propostes
  where num_proposta is null
)
update public.propostes p
  set num_proposta = o.yy || '-' || lpad(o.rn::text, 4, '0')
  from ordered o
  where o.id = p.id;
create unique index if not exists idx_propostes_num on public.propostes(num_proposta);

-- projectes catalog is no longer used anywhere
drop table if exists public.projectes;
