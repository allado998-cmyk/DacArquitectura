-- DacArquitectura — ITE reports (Inspecció Tècnica de l'Edifici) prepared in
-- the app and exported as the file the Agència de l'Habitatge's portal
-- imports. Idempotent.
--
-- `dades` is the report in the portal's own structure (src/lib/ite/xml.ts);
-- photos point at the private file store (folder ite/<id>). The other columns
-- are copies for the list and for links.

create table if not exists public.ite_informe (
  id bigserial primary key,
  expedient_id bigint references public.expedients(id) on delete set null,
  client_id bigint references public.clients(id) on delete set null,
  nom text not null default '',
  adreca text,
  data_inspeccio date,
  dades jsonb not null,
  exportat_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ite_informe_expedient on public.ite_informe(expedient_id);

-- Code-list values of the portal (orientations, deficiency types, street
-- types, municipalities…) learnt from imported reports, on top of the ones in
-- src/lib/ite/cataleg-base.json. `id` is the portal's id.
create table if not exists public.ite_cataleg (
  cat text not null,
  id text not null,
  entrada jsonb not null,
  created_at timestamptz not null default now(),
  primary key (cat, id)
);
