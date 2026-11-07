-- DacArquitectura — A contacte's profession (arquitecte, aparellador, …),
-- shown as a column and a filter in Base de Dades → Contactes. Idempotent.

alter table public.client_contactes
  add column if not exists professio text;
