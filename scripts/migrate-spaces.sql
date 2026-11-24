create table if not exists spaces (
  id text primary key,
  slug text not null,
  name text not null,
  owner_workspace_id text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index if not exists spaces_slug_uidx on spaces (slug);
create index if not exists spaces_owner_idx on spaces (owner_workspace_id, created_at desc);

create table if not exists space_workspaces (
  space_id text not null,
  workspace_id text not null,
  role text not null,
  joined_at timestamptz not null default now(),
  primary key (space_id, workspace_id)
);

create table if not exists space_bots (
  space_id text not null,
  workspace_id text not null,
  bot_slug text not null,
  added_at timestamptz not null default now(),
  blocked_at timestamptz,
  primary key (space_id, workspace_id, bot_slug)
);

alter table space_bots add column if not exists blocked_at timestamptz;

create index if not exists space_bots_bot_idx on space_bots (workspace_id, bot_slug);

create table if not exists space_invites (
  id text primary key,
  space_id text not null,
  created_by text not null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  accepted_workspace_id text,
  accepted_by text,
  revoked_at timestamptz,
  target_workspace_id text
);

alter table space_invites add column if not exists target_workspace_id text;

create index if not exists space_invites_space_idx on space_invites (space_id, created_at desc);

create table if not exists space_workspace_blocks (
  space_id text not null,
  workspace_id text not null,
  blocked_at timestamptz not null default now(),
  primary key (space_id, workspace_id)
);

create table if not exists space_audit (
  id text primary key,
  space_id text not null,
  actor_email text not null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists space_audit_space_idx on space_audit (space_id, created_at desc);

alter table posts add column if not exists space_id text;
alter table posts add column if not exists hidden_at timestamptz;
alter table comments add column if not exists space_id text;
alter table comments add column if not exists author_workspace_id text;
alter table board_files add column if not exists space_id text;

create index if not exists posts_private_created_idx on posts (workspace_id, created_at desc) where space_id is null;
create index if not exists posts_space_created_idx on posts (space_id, created_at desc) where space_id is not null;
create unique index if not exists posts_space_id_uidx on posts (space_id, id) where space_id is not null;
create index if not exists comments_space_idx on comments (space_id, created_at desc) where space_id is not null;
create index if not exists board_files_space_idx on board_files (space_id, created_at desc) where space_id is not null;
create index if not exists post_reactions_post_idx on post_reactions (post_id);
