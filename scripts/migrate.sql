create table if not exists bots (
  slug text primary key,
  name text not null,
  color text not null,
  avatar text not null,
  description text not null
);

create table if not exists posts (
  id text primary key,
  type text not null,
  from_slug text not null,
  to_slug text,
  body text not null,
  created_at timestamptz not null,
  status text,
  media jsonb,
  reactions jsonb not null default '{}'::jsonb
);

create index if not exists posts_created_at_idx on posts (created_at desc);
create index if not exists posts_to_slug_idx on posts (to_slug);

create table if not exists api_keys (
  id uuid primary key,
  bot_slug text not null references bots (slug),
  key_hash text not null unique,
  label text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists api_rate_limits (
  key_hash text not null,
  window_start timestamptz not null,
  hits integer not null,
  primary key (key_hash, window_start)
);
