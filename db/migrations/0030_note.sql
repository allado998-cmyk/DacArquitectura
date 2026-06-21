-- DacArquitectura — Notes: a single rich-text notepad document.
-- Idempotent: safe to re-run.

create table if not exists public.note (
  id int primary key,
  content text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.note (id, content) values (1, '') on conflict (id) do nothing;
