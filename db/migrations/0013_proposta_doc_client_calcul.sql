-- DacArquitectura — Proposta doc: link a client + an honoraris càlcul, add codi postal.
-- Idempotent: safe to re-run.

alter table public.proposta_doc add column if not exists client_id bigint references public.clients(id) on delete set null;
alter table public.proposta_doc add column if not exists calcul_id bigint references public.propostes(id) on delete set null;
alter table public.proposta_doc add column if not exists codi_postal text;
