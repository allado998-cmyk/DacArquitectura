-- DacArquitectura — Factura: free-text concept + per-invoice document language.
-- Idempotent: safe to re-run.

alter table public.factura add column if not exists concepte text;

alter table public.factura
  add column if not exists lang text not null default 'es'
    check (lang in ('ca', 'es'));
