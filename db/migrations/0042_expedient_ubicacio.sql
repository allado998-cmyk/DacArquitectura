-- DacArquitectura — Expedients: address, Google Maps link and coordinates,
-- for the map of works. lat/lng are filled in by the app from the link (or by
-- geocoding the address) when the expedient is saved.
-- Idempotent: safe to re-run.

alter table public.expedients add column if not exists adreca text;
alter table public.expedients add column if not exists maps_url text;
alter table public.expedients add column if not exists lat double precision;
alter table public.expedients add column if not exists lng double precision;
