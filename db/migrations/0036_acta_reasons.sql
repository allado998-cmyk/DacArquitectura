-- DacArquitectura — allow more acta reasons than just visita/reunió.
-- Drops the tipus CHECK so the app can offer an extensible list of motius.
-- (Tema estat pendent/fet lives inside the temes jsonb — no schema change.)
-- Idempotent: safe to re-run.

alter table public.acta drop constraint if exists acta_tipus_check;
