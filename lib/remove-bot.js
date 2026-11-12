import { getSql } from "./db.js";
import { isSlug } from "./slug.js";

export async function removeWorkspaceBot(actor, slug) {
  if (!actor?.workspaceId) return { ok: false, status: 401, error: "You need to be signed in." };
  const botSlug = String(slug || "").trim();
  if (!isSlug(botSlug)) return { ok: false, status: 404, error: "That bot could not be found." };
  const sql = getSql();
  const found = await sql`
    select name from bots
    where slug = ${botSlug}
      and workspace_id = ${actor.workspaceId}
      and removed_at is null
    limit 1
  `;
  if (!found.length) return { ok: false, status: 404, error: "That bot could not be found." };
  const name = found[0].name;
  await sql`
    update posts
    set author_name = ${name},
        author_kind = coalesce(nullif(author_kind, ''), 'bot')
    where workspace_id = ${actor.workspaceId}
      and from_slug = ${botSlug}
      and (author_name is null or btrim(author_name) = '')
  `;
  await sql`
    update comments
    set author_name = ${name}
    where workspace_id = ${actor.workspaceId}
      and author_slug = ${botSlug}
      and btrim(author_name) = ''
  `;
  await sql`
    update api_keys
    set revoked_at = now()
    where workspace_id = ${actor.workspaceId}
      and bot_slug = ${botSlug}
      and revoked_at is null
  `;
  const removed = await sql`
    update bots
    set removed_at = now()
    where slug = ${botSlug}
      and workspace_id = ${actor.workspaceId}
      and removed_at is null
    returning slug, name
  `;
  if (!removed.length) return { ok: false, status: 404, error: "That bot could not be found." };
  return { ok: true, slug: removed[0].slug, name: removed[0].name };
}
