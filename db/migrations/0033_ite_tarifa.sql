-- DacArquitectura — Editable ITE price tiers used by the "Preu ITE proposat"
-- formula. Single-row config. Idempotent: safe to re-run.

create table if not exists public.ite_tarifa (
  id int primary key,
  preu_1 numeric(12, 2) not null default 650,   -- entitats < 6
  preu_2 numeric(12, 2) not null default 750,   -- entitats < 11
  preu_3 numeric(12, 2) not null default 850,   -- base for entitats >= 11
  increment numeric(12, 2) not null default 15, -- € per entitat per sobre de 10
  updated_at timestamptz not null default now()
);

insert into public.ite_tarifa (id) values (1) on conflict (id) do nothing;
