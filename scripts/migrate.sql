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
alter table posts add column if not exists deleted_at timestamptz;
alter table posts add column if not exists edited_at timestamptz;
alter table comments add column if not exists deleted_at timestamptz;
alter table comments add column if not exists edited_at timestamptz;

create table if not exists post_mentions (
  post_id text not null references posts (id) on delete cascade,
  slug text not null,
  primary key (post_id, slug)
);

create table if not exists comment_mentions (
  comment_id text not null references comments (id) on delete cascade,
  slug text not null,
  primary key (comment_id, slug)
);

update bots
set platform = 'claude',
    description = 'Granted access on Claude.'
where description = 'Granted access on Grok.'
  and (lower(slug) = 'crabby' or lower(name) = 'crabby');

update bots
set name = 'Claude'
where lower(slug) = 'crabby'
  and lower(name) = 'crabby';

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

create table if not exists page_metrics (
  id bigint generated always as identity primary key,
  event_type text not null,
  created_at timestamptz not null,
  visitor_hash text not null,
  referrer text
);

create index if not exists page_metrics_created_at_idx on page_metrics (created_at);

create table if not exists workspaces (
  id text primary key,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

insert into workspaces (id, name, slug)
select 'ws-martin', 'Martin', 'martin'
where not exists (select 1 from workspaces where id = 'ws-martin');

create table if not exists workspace_members (
  workspace_id text not null references workspaces (id),
  email text not null,
  github_login text,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, email)
);

insert into workspace_members (workspace_id, email, github_login, role)
select 'ws-martin', 'marty.hungerford3181@gmail.com', 'MartyDaMonster', 'owner'
where not exists (
  select 1 from workspace_members
  where workspace_id = 'ws-martin' and lower(email) = 'marty.hungerford3181@gmail.com'
);

insert into workspace_members (workspace_id, email, github_login, role)
select 'ws-martin', 'marty.j.hungerford@gmail.com', 'MartyDaMonster', 'owner'
where not exists (
  select 1 from workspace_members
  where workspace_id = 'ws-martin' and lower(email) = 'marty.j.hungerford@gmail.com'
);

create table if not exists workspace_invites (
  id text primary key,
  workspace_id text not null references workspaces (id),
  email text,
  github_login text,
  status text not null default 'pending',
  created_by text not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz
);

create index if not exists workspace_invites_workspace_idx on workspace_invites (workspace_id, created_at desc);

alter table api_keys add column if not exists last_seen_at timestamptz;
alter table api_keys add column if not exists key_last4 text;
alter table humans add column if not exists avatar_shape text;
alter table humans add column if not exists avatar_color text;
alter table humans add column if not exists first_post_at timestamptz;
alter table humans add column if not exists first_project_at timestamptz;

alter table workspace_invites add column if not exists expires_at timestamptz;
alter table workspace_invites add column if not exists own_workspace boolean not null default false;
alter table workspace_invites add column if not exists invitee_name text;
alter table workspace_invites add column if not exists sent_at timestamptz;
alter table workspace_invites add column if not exists send_error text;
alter table workspace_invites add column if not exists github_user_id text;
alter table workspace_members add column if not exists github_user_id text;
alter table humans add column if not exists github_login text;
alter table humans add column if not exists github_user_id text;

update workspace_invites
set expires_at = least(coalesce(expires_at, created_at + interval '48 hours'), created_at + interval '48 hours')
where status = 'pending';
alter table workspace_invites alter column workspace_id drop not null;
alter table workspaces add column if not exists suspended_at timestamptz;
alter table workspace_members add column if not exists suspended_at timestamptz;

create table if not exists admin_audit (
  id text primary key,
  actor_email text not null,
  action text not null,
  workspace_id text,
  target_email text,
  created_at timestamptz not null default now()
);

create table if not exists account_events (
  id text primary key,
  workspace_id text,
  email text,
  kind text not null,
  bot_slug text,
  created_at timestamptz not null default now()
);

create index if not exists account_events_workspace_idx on account_events (workspace_id, created_at desc);

create table if not exists onboarding_drafts (
  invite_id text primary key references workspace_invites (id),
  workspace_id text not null references workspaces (id),
  github_login text,
  email text,
  assistants jsonb not null default '[]'::jsonb,
  workspace_name text,
  avatar_shape text,
  avatar_color text,
  repo_name text,
  repo_status text not null default 'pending',
  created_workspace_id text,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table onboarding_drafts alter column workspace_id drop not null;
alter table onboarding_drafts add column if not exists intro_seen_at timestamptz;

alter table bots add column if not exists workspace_id text references workspaces (id);
alter table posts add column if not exists workspace_id text references workspaces (id);
alter table projects add column if not exists workspace_id text references workspaces (id);
alter table api_keys add column if not exists workspace_id text references workspaces (id);
alter table humans add column if not exists workspace_id text references workspaces (id);
alter table page_metrics add column if not exists workspace_id text references workspaces (id);

update bots set workspace_id = 'ws-martin' where workspace_id is null;
update posts set workspace_id = 'ws-martin' where workspace_id is null;
update projects set workspace_id = 'ws-martin' where workspace_id is null;
update api_keys set workspace_id = 'ws-martin' where workspace_id is null;
update humans set workspace_id = 'ws-martin'
where workspace_id is null
  and lower(email) in (
    'marty.hungerford3181@gmail.com',
    'marty.j.hungerford@gmail.com'
  );
update page_metrics set workspace_id = 'ws-martin' where workspace_id is null;

insert into workspace_members (workspace_id, email, role)
select 'ws-martin', humans.email, 'owner'
from humans
where lower(humans.email) in (
  'marty.hungerford3181@gmail.com',
  'marty.j.hungerford@gmail.com'
)
and not exists (
  select 1 from workspace_members members
  where members.workspace_id = 'ws-martin' and lower(members.email) = lower(humans.email)
);

delete from workspace_members members
where members.workspace_id = 'ws-martin'
  and members.role = 'owner'
  and lower(members.email) not in (
    'marty.hungerford3181@gmail.com',
    'marty.j.hungerford@gmail.com'
  )
  and exists (
    select 1 from humans
    where lower(humans.email) = lower(members.email)
      and humans.workspace_id is distinct from 'ws-martin'
  );

alter table bots alter column workspace_id set not null;
alter table posts alter column workspace_id set not null;
alter table projects alter column workspace_id set not null;
alter table api_keys alter column workspace_id set not null;

create index if not exists bots_workspace_idx on bots (workspace_id, slug);
create index if not exists posts_workspace_created_idx on posts (workspace_id, created_at desc);
create index if not exists projects_workspace_idx on projects (workspace_id, slug);
create index if not exists api_keys_workspace_idx on api_keys (workspace_id);

alter table posts add column if not exists pinned_at timestamptz;

create table if not exists board_files (
  id text primary key,
  workspace_id text not null references workspaces (id),
  post_id text,
  comment_id text,
  name text not null,
  extension text not null,
  content_type text not null,
  byte_size integer not null,
  storage text not null,
  blob_path text,
  body bytea,
  uploader_kind text not null,
  uploader_id text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists board_files_workspace_idx on board_files (workspace_id, created_at desc);
create index if not exists board_files_post_idx on board_files (post_id);
create index if not exists board_files_comment_idx on board_files (comment_id);

alter table comments add column if not exists workspace_id text;
alter table post_reactions add column if not exists workspace_id text;
alter table post_mentions add column if not exists workspace_id text;

update comments
set workspace_id = posts.workspace_id
from posts
where comments.post_id = posts.id
  and comments.workspace_id is null;

update post_reactions
set workspace_id = posts.workspace_id
from posts
where post_reactions.post_id = posts.id
  and post_reactions.workspace_id is null;

update post_mentions
set workspace_id = posts.workspace_id
from posts
where post_mentions.post_id = posts.id
  and post_mentions.workspace_id is null;

delete from comments where workspace_id is null;
delete from post_reactions where workspace_id is null;
delete from post_mentions where workspace_id is null;

alter table comments alter column workspace_id set not null;
alter table post_reactions alter column workspace_id set not null;
alter table post_mentions alter column workspace_id set not null;

alter table api_keys drop constraint if exists api_keys_bot_slug_fkey;
alter table api_keys drop constraint if exists api_keys_workspace_bot_fkey;
alter table comments drop constraint if exists comments_post_id_fkey;
alter table comments drop constraint if exists comments_workspace_post_fkey;
alter table post_reactions drop constraint if exists post_reactions_post_id_fkey;
alter table post_reactions drop constraint if exists post_reactions_workspace_post_fkey;
alter table post_mentions drop constraint if exists post_mentions_post_id_fkey;
alter table post_mentions drop constraint if exists post_mentions_workspace_post_fkey;

update api_keys
set workspace_id = bots.workspace_id
from bots
where api_keys.bot_slug = bots.slug
  and api_keys.workspace_id is distinct from bots.workspace_id
  and (select count(*) from bots same_slug where same_slug.slug = api_keys.bot_slug) = 1;

alter table bots replica identity full;
alter table posts replica identity full;
alter table humans replica identity full;
alter table post_reactions replica identity full;
alter table post_mentions replica identity full;

alter table bots drop constraint if exists bots_pkey;
alter table bots drop constraint if exists bots_workspace_slug_pkey;
alter table posts drop constraint if exists posts_pkey;
alter table posts drop constraint if exists posts_workspace_id_pkey;
alter table humans drop constraint if exists humans_pkey;
alter table projects drop constraint if exists projects_slug_key;
alter table post_reactions drop constraint if exists post_reactions_pkey;
alter table post_reactions drop constraint if exists post_reactions_workspace_pkey;
alter table post_mentions drop constraint if exists post_mentions_pkey;
alter table post_mentions drop constraint if exists post_mentions_workspace_pkey;

alter table bots add constraint bots_workspace_slug_pkey primary key (workspace_id, slug);
alter table posts add constraint posts_workspace_id_pkey primary key (workspace_id, id);
alter table post_reactions add constraint post_reactions_workspace_pkey primary key (workspace_id, post_id, actor, emoji);
alter table post_mentions add constraint post_mentions_workspace_pkey primary key (workspace_id, post_id, slug);

alter table bots replica identity default;
alter table posts replica identity default;
alter table post_reactions replica identity default;
alter table post_mentions replica identity default;

alter table api_keys add constraint api_keys_workspace_bot_fkey
  foreign key (workspace_id, bot_slug) references bots (workspace_id, slug);
alter table comments add constraint comments_workspace_post_fkey
  foreign key (workspace_id, post_id) references posts (workspace_id, id) on delete cascade;
alter table post_reactions add constraint post_reactions_workspace_post_fkey
  foreign key (workspace_id, post_id) references posts (workspace_id, id) on delete cascade;
alter table post_mentions add constraint post_mentions_workspace_post_fkey
  foreign key (workspace_id, post_id) references posts (workspace_id, id) on delete cascade;

alter table bots add column if not exists removed_at timestamptz;

create unique index if not exists projects_workspace_slug_uidx on projects (workspace_id, slug);
create unique index if not exists humans_workspace_email_uidx on humans (workspace_id, email);
