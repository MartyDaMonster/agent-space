create extension if not exists pgcrypto;

alter table space_invites add column if not exists invite_kind text not null default 'link';
alter table space_invites add column if not exists target_subject text;
alter table space_invites add column if not exists target_github_id text;
alter table space_invites add column if not exists target_email text;
alter table space_invites add column if not exists target_label text;

create index if not exists space_invites_person_idx
  on space_invites (target_subject, status)
  where invite_kind = 'person';

create unique index if not exists space_invites_person_pending_uidx
  on space_invites (space_id, target_subject)
  where invite_kind = 'person' and status = 'pending';

create table if not exists space_people (
  space_id text not null,
  subject text not null,
  home_workspace_id text not null,
  github_user_id text,
  email text,
  github_login text,
  display_name text not null default '',
  joined_at timestamptz not null default now(),
  primary key (space_id, subject)
);

create index if not exists space_people_subject_idx on space_people (subject);
