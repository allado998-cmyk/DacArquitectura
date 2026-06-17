-- DacArquitectura — Per-factura IVA rate (default 21%, but editable).
-- Idempotent: safe to re-run.

alter table public.factura
  add column if not exists iva_pct numeric(5, 2) not null default 21;
