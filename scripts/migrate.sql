create table if not exists bots (
  slug text primary key,
  name text not null,
  color text not null,
  avatar text not null,
  description text not null,
  platform text,
  avatar_url text
);

alter table bots add column if not exists platform text;
alter table bots add column if not exists avatar_url text;
alter table bots add column if not exists avatar_shape text;
alter table bots add column if not exists avatar_color text;

update bots
set
  avatar_shape = case avatar
    when 'square-lime' then 'square'
    when 'cloud-pink' then 'cloud'
    when 'dome-violet' then 'dome'
    when 'star-cyan' then 'star'
    when 'capsule-cyan' then 'capsule'
    when 'diamond-pink' then 'diamond'
    when 'crab-cyan' then 'crab'
    when 'sheep-lime' then 'sheep'
    when 'sun-lime' then 'sun'
    when 'moon-violet' then 'circle'
    when 'cactus-lime' then 'triangle'
    when 'ghost-cyan' then 'ghost'
    when 'octopus-pink' then 'crab'
    when 'frog-lime' then 'circle'
    when 'cat-violet' then 'cat'
    when 'mushroom-pink' then 'dome'
    when 'rocket-cyan' then 'triangle'
    when 'ufo-violet' then 'capsule'
    when 'donut-pink' then 'circle'
    when 'planet-cyan' then 'circle'
    when 'fish-lime' then 'capsule'
    when 'bee-lime' then 'circle'
    when 'snail-violet' then 'circle'
    when 'cupcake-pink' then 'dome'
    when 'slime-lime' then 'cloud'
    when 'bolt-cyan' then 'star'
    when 'leaf-lime' then 'triangle'
    when 'flower-pink' then 'flower'
    when 'penguin-cyan' then 'capsule'
    when 'whale-violet' then 'capsule'
    when 'dino-lime' then 'triangle'
    when 'robot-pink' then 'square'
    else avatar_shape
  end,
  avatar_color = case avatar
    when 'square-lime' then 'lime'
    when 'cloud-pink' then 'pink'
    when 'dome-violet' then 'violet'
    when 'star-cyan' then 'cyan'
    when 'capsule-cyan' then 'cyan'
    when 'diamond-pink' then 'pink'
    when 'crab-cyan' then 'cyan'
    when 'sheep-lime' then 'lime'
    when 'sun-lime' then 'lime'
    when 'moon-violet' then 'violet'
    when 'cactus-lime' then 'lime'
    when 'ghost-cyan' then 'cyan'
    when 'octopus-pink' then 'pink'
    when 'frog-lime' then 'lime'
    when 'cat-violet' then 'violet'
    when 'mushroom-pink' then 'pink'
    when 'rocket-cyan' then 'cyan'
    when 'ufo-violet' then 'violet'
    when 'donut-pink' then 'pink'
    when 'planet-cyan' then 'cyan'
    when 'fish-lime' then 'lime'
    when 'bee-lime' then 'lime'
    when 'snail-violet' then 'violet'
    when 'cupcake-pink' then 'pink'
    when 'slime-lime' then 'lime'
    when 'bolt-cyan' then 'cyan'
    when 'leaf-lime' then 'lime'
    when 'flower-pink' then 'pink'
    when 'penguin-cyan' then 'cyan'
    when 'whale-violet' then 'violet'
    when 'dino-lime' then 'lime'
    when 'robot-pink' then 'pink'
    else avatar_color
  end
where avatar_shape is null
  and avatar in (
    'square-lime', 'cloud-pink', 'dome-violet', 'star-cyan', 'capsule-cyan', 'diamond-pink',
    'crab-cyan', 'sheep-lime', 'sun-lime', 'moon-violet', 'cactus-lime', 'ghost-cyan',
    'octopus-pink', 'frog-lime', 'cat-violet', 'mushroom-pink', 'rocket-cyan', 'ufo-violet',
    'donut-pink', 'planet-cyan', 'fish-lime', 'bee-lime', 'snail-violet', 'cupcake-pink',
    'slime-lime', 'bolt-cyan', 'leaf-lime', 'flower-pink', 'penguin-cyan', 'whale-violet',
    'dino-lime', 'robot-pink'
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

create table if not exists humans (
  email text primary key,
  name text not null,
  image text,
  onboarded_at timestamptz
);

alter table posts add column if not exists author_kind text not null default 'bot';
alter table posts add column if not exists author_name text;
alter table posts add column if not exists author_email text;
alter table posts add column if not exists author_image text;
alter table posts add column if not exists link_url text;
alter table posts add column if not exists link_title text;
alter table posts add column if not exists link_domain text;

create table if not exists comments (
  id text primary key,
  post_id text not null references posts (id) on delete cascade,
  author_kind text not null,
  author_slug text,
  author_email text,
  author_name text not null,
  author_image text,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_post_idx on comments (post_id, created_at);

create table if not exists post_reactions (
  post_id text not null references posts (id) on delete cascade,
  actor text not null,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, actor, emoji)
);

create table if not exists projects (
  id text primary key,
  name text not null,
  slug text not null unique,
  description text not null default '',
  color text,
  emoji text,
  created_by text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

alter table posts add column if not exists project_id text references projects (id);

create index if not exists posts_project_idx on posts (project_id, created_at desc);

create table if not exists project_reads (
  email text not null,
  project_id text not null references projects (id) on delete cascade,
  seen_at timestamptz not null,
  primary key (email, project_id)
);

create table if not exists api_rate_limits (
  key_hash text not null,
  window_start timestamptz not null,
  hits integer not null,
  primary key (key_hash, window_start)
);
