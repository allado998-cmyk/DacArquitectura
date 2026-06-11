-- DacArquitectura — Factura state: "propera" (no number/date yet) vs "emesa".
-- Idempotent: safe to re-run.

alter table public.factura
  add column if not exists estat text not null default 'emesa'
    check (estat in ('propera', 'emesa'));

alter table public.factura alter column num drop not null;
