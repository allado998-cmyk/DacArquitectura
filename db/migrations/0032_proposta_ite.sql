-- DacArquitectura — ITE càlcul variant of a proposta (Inspecció Tècnica
-- d'Edificis). Instead of despeses directes/indirectes it uses a "Relació
-- d'entitats" table. Idempotent: safe to re-run.

alter table public.propostes
  add column if not exists es_ite boolean not null default false,
  add column if not exists ut_habitatges numeric(12, 2) not null default 0,
  add column if not exists ut_locals_200 numeric(12, 2) not null default 0,
  add column if not exists ut_locals_400 numeric(12, 2) not null default 0,
  add column if not exists ut_locals_600 numeric(12, 2) not null default 0,
  add column if not exists ut_locals_800 numeric(12, 2) not null default 0,
  add column if not exists ut_locals_1000 numeric(12, 2) not null default 0,
  add column if not exists ite_descompte_pct numeric(6, 2) not null default 0,
  add column if not exists ite_iva_pct numeric(6, 2) not null default 21,
  add column if not exists ite_comissio_activa boolean not null default false,
  add column if not exists ite_comissio_pct numeric(6, 2) not null default 10;
