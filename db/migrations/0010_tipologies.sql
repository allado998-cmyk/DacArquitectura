-- DacArquitectura — Tipologia catalog for expedients (managed in Base de Dades).
-- Idempotent: safe to re-run.

create table if not exists public.tipologies (
  id bigserial primary key,
  nom text not null unique,
  ordre integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.expedients
  add column if not exists tipologia_id bigint references public.tipologies(id) on delete set null;
create index if not exists idx_expedients_tipologia on public.expedients(tipologia_id);

-- Starter set (editable in Base de Dades).
insert into public.tipologies (nom, ordre) values
  ('Habitatge unifamiliar',       10),
  ('Habitatge plurifamiliar',     20),
  ('Reforma',                     30),
  ('Rehabilitació',               40),
  ('Ampliació',                   50),
  ('Local comercial',             60),
  ('Oficines',                    70),
  ('Nau industrial / magatzem',   80),
  ('Equipament',                  90),
  ('Hoteler / turisme',          100),
  ('Restauració (bar/restaurant)', 110),
  ('Interiorisme',               120),
  ('Piscina',                    130),
  ('Urbanització / espai públic', 140),
  ('Legalització',               150),
  ('Certificat energètic',       160),
  ('ITE / inspecció',            170),
  ('Informe / dictamen',         180),
  ('Llicència d''activitat',     190),
  ('Altres',                     200)
on conflict (nom) do nothing;
