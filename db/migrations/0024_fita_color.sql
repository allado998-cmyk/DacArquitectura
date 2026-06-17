-- DacArquitectura — Fita milestones get a configurable colour (like forma).
-- The default keeps the historical yellow. Idempotent: safe to re-run.

alter table public.fita_tipus
  add column if not exists color text not null default '#facc15';
