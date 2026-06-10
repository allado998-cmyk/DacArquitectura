-- DacArquitectura — allow contacts not linked to a client. Idempotent.

alter table public.client_contactes alter column client_id drop not null;
