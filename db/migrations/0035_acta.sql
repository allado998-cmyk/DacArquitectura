-- DacArquitectura — Actes (meeting minutes / site-visit reports).
-- Related to an expedient and optionally to a dedicació (visita d'obra / reunió).
-- Idempotent: safe to re-run.

create table if not exists public.acta (
  id bigserial primary key,
  num text unique,                              -- ACT-XXX
  tipus text not null default 'visita'
    check (tipus in ('visita', 'reunio')),
  expedient_id bigint references public.expedients(id) on delete set null,
  dedicacio_id bigint references public.dedicacions(id) on delete set null,
  acta_num text default '00',                   -- "Acta nº" within the project
  data date,
  hora text,
  lloc text,
  projecte text,
  referencia text,
  ubicacio text,
  client text,
  assistents jsonb not null default '[]',       -- [{present, nom, empresa}]
  temes jsonb not null default '[]',            -- [{titol, text, responsable}]
  propera_visita text,
  sig_do text,
  sig_de text,
  sig_adj_empresa text,
  sig_adj_persona text,
  sig_prom_empresa text,
  sig_prom_persona text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_acta_expedient on public.acta(expedient_id);
