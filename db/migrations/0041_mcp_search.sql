-- DacArquitectura — plugin: accent-insensitive search + single-use sign-in pages.
-- Idempotent: safe to re-run.

-- Lower-case and strip Catalan/Spanish accents (and the "·" of l·l) so that
-- "reforc", "Reforç" and "REFORÇ" compare equal. Pure function, no extension.
create or replace function public.dac_fold(t text) returns text
language sql immutable parallel safe as $$
  select translate(lower(coalesce(t, '')), 'àáâäãèéêëìíîïòóôöõùúûüçñ·', 'aaaaaeeeeiiiiooooouuuucn')
$$;

-- Authorization codes are kept (marked used) instead of deleted, so a sign-in
-- page submitted twice can say "already connected" instead of handing the
-- client a second code it will reject.
alter table public.mcp_oauth_code add column if not exists used_at timestamptz;
create index if not exists idx_mcp_oauth_code_challenge on public.mcp_oauth_code(client_id, code_challenge);
