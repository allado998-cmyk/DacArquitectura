-- DacArquitectura — A contacte can have several phones and mails.
-- `telefon` / `mail` stay as the main ones (what the tables, the actes and the
-- plugin read); any others go in these lists. Idempotent: safe to re-run.

alter table public.client_contactes
  add column if not exists telefons_extra text[] not null default '{}',
  add column if not exists mails_extra text[] not null default '{}';
