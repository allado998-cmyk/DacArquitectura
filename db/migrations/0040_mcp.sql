-- DacArquitectura — ChatGPT / Claude plugin (remote MCP server).
-- OAuth state (clients, codes, tokens) and a usage log with idempotency keys.
-- Idempotent: safe to re-run.

-- Dynamically registered OAuth clients (ChatGPT, Claude register themselves).
create table if not exists public.mcp_oauth_client (
  id text primary key,
  client_name text,
  redirect_uris jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Short-lived authorization codes (stored hashed, single use).
create table if not exists public.mcp_oauth_code (
  code_hash text primary key,
  client_id text not null,
  redirect_uri text not null,
  code_challenge text not null,
  usuari text not null,
  scope text,
  resource text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Access and refresh tokens (stored hashed).
create table if not exists public.mcp_oauth_token (
  token_hash text primary key,
  kind text not null check (kind in ('access', 'refresh')),
  client_id text not null,
  client_name text,
  usuari text not null,
  scope text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  last_user_agent text,
  revoked_at timestamptz
);
create index if not exists idx_mcp_oauth_token_usuari on public.mcp_oauth_token(usuari, kind);

-- One row per tool call. Confirmed changes carry an idempotency key, unique
-- per user, so a retried call never writes twice.
create table if not exists public.mcp_usage (
  id bigserial primary key,
  usuari text not null,
  client_id text,
  tool text not null,
  action text,
  idempotency_key text,
  status text not null default 'done', -- pending | done | failed
  result jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_mcp_usage_idem
  on public.mcp_usage(usuari, idempotency_key) where idempotency_key is not null;
create index if not exists idx_mcp_usage_created on public.mcp_usage(created_at desc);
