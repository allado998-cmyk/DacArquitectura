-- DacArquitectura — Expedients: link an honoraris càlcul and/or a proposta,
-- and choose where the pressupost comes from. Idempotent: safe to re-run.

alter table public.expedients
  add column if not exists calcul_id bigint references public.propostes(id) on delete set null;
alter table public.expedients
  add column if not exists proposta_doc_id bigint references public.proposta_doc(id) on delete set null;
alter table public.expedients
  add column if not exists pressupost_origen text not null default 'manual'
    check (pressupost_origen in ('manual', 'calcul', 'proposta'));
