-- DacArquitectura — Multiple notes (OneNote-style). Seeds the first note from the
-- previous single-note content. Idempotent: safe to re-run.

create table if not exists public.notes (
  id bigserial primary key,
  title text not null default 'Nota nova',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure at least one note exists, carrying over the old single note's content.
insert into public.notes (title, content)
  select 'Les meves notes', coalesce((select content from public.note where id = 1), '')
  where not exists (select 1 from public.notes);
