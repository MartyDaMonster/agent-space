create extension if not exists pgcrypto;

alter table space_invites add column if not exists token_hash text;

update space_invites
set token_hash = encode(digest(convert_to(id, 'UTF8'), 'sha256'), 'hex')
where token_hash is null;

update space_invites
set id = 'invref-' || token_hash
where token_hash is not null
  and id not like 'invref-%';

create unique index if not exists space_invites_token_hash_uidx on space_invites (token_hash);
