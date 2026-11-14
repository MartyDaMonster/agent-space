import { randomBytes } from "node:crypto";
import { getSql } from "./db.js";
import { allowInviteAction } from "./human-rate.js";
import { REAUTH_ERROR, requireFreshAuth } from "./session-policy.js";
import { slugFromName } from "./slug.js";
import { spaceAccess } from "./space-access.js";

export const SPACE_CAP = 5;
export const SPACE_WRITE_LIMIT = 20;

function newId(prefix) {
  return `${prefix}-${randomBytes(9).toString("hex")}`;
}

function cleanName(name) {
  const text = String(name || "").trim().replace(/\s+/g, " ");
  if (!text || text.length > 80) return "";
  return text;
}

async function audit(spaceId, email, action, detail = "") {
  const sql = getSql();
  await sql`
    insert into space_audit (id, space_id, actor_email, action, detail)
    values (${newId("saud")}, ${spaceId}, ${String(email || "").toLowerCase()}, ${action}, ${detail || null})
  `;
}

async function uniqueSlug(name) {
  const base = slugFromName(name) || "space";
  const sql = getSql();
  for (let n = 0; n < 20; n += 1) {
    const slug = n === 0 ? base : `${base}-${n + 1}`;
    const rows = await sql`select 1 from spaces where slug = ${slug} limit 1`;
    if (!rows.length) return slug;
  }
  return `${base}-${randomBytes(3).toString("hex")}`;
}

export async function createSpace({ workspaceId, email, role, name }) {
  if (role !== "owner") return { ok: false, status: 404 };
  const title = cleanName(name);
  if (!title) return { ok: false, status: 400, error: "Give the space a name." };
  const sql = getSql();
  const counted = await sql`
    select count(*)::int as n from spaces where owner_workspace_id = ${workspaceId}
  `;
  if (Number(counted[0]?.n || 0) >= SPACE_CAP) {
    return { ok: false, status: 400, error: "This workspace already has 5 spaces." };
  }
  const id = newId("spc");
  const slug = await uniqueSlug(title);
  await sql`
    insert into spaces (id, slug, name, owner_workspace_id, created_by)
    values (${id}, ${slug}, ${title}, ${workspaceId}, ${String(email || "").toLowerCase()})
  `;
  await sql`
    insert into space_workspaces (space_id, workspace_id, role)
    values (${id}, ${workspaceId}, ${"owner"})
  `;
  await audit(id, email, "space.created", title);
  return { ok: true, space: { id, slug, name: title } };
}

export async function listSpacesForWorkspace(workspaceId) {
  if (!workspaceId) return [];
  const sql = getSql();
  const rows = await sql`
    select spaces.id, spaces.slug, spaces.name, spaces.archived_at, space_workspaces.role,
           others.name as shared_name
    from space_workspaces
    join spaces on spaces.id = space_workspaces.space_id
    join workspaces on workspaces.id = space_workspaces.workspace_id
    left join space_workspaces other_links
      on other_links.space_id = spaces.id
     and other_links.workspace_id <> ${workspaceId}
    left join workspaces others on others.id = other_links.workspace_id
    where space_workspaces.workspace_id = ${workspaceId}
      and workspaces.suspended_at is null
    order by spaces.created_at desc, others.name asc
  `;
  const byId = new Map();
  for (const row of rows) {
    const current = byId.get(row.id) || {
      id: row.id,
      slug: row.slug,
      name: row.name,
      archived: Boolean(row.archived_at),
      role: row.role,
      sharedWith: []
    };
    if (row.shared_name && !current.sharedWith.includes(row.shared_name)) current.sharedWith.push(row.shared_name);
    byId.set(row.id, current);
  }
  return [...byId.values()];
}

export async function renameSpace({ access, email, name }) {
  if (!access?.canModerate) return { ok: false, status: 404 };
  const title = cleanName(name);
  if (!title) return { ok: false, status: 400, error: "Give the space a name." };
  const sql = getSql();
  await sql`update spaces set name = ${title} where id = ${access.space.id}`;
  await audit(access.space.id, email, "space.renamed", title);
  return { ok: true, name: title };
}

export async function archiveSpace({ access, session, email }) {
  if (!access?.canModerate) return { ok: false, status: 404 };
  const fresh = requireFreshAuth(session);
  if (!fresh.ok) return { ok: false, status: 401, error: fresh.error || REAUTH_ERROR };
  const sql = getSql();
  await sql`update spaces set archived_at = coalesce(archived_at, now()) where id = ${access.space.id}`;
  await audit(access.space.id, email, "space.archived");
  return { ok: true };
}

export async function createSpaceInvite({ access, session, email }) {
  if (!access?.canModerate) return { ok: false, status: 404 };
  const fresh = requireFreshAuth(session);
  if (!fresh.ok) return { ok: false, status: 401, error: fresh.error || REAUTH_ERROR };
  if (access.space.archivedAt) return { ok: false, status: 400, error: "This space is archived." };
  if (!allowInviteAction(email)) return { ok: false, status: 429, error: "Too many invites. Try again in a minute." };
  const sql = getSql();
  const id = newId("sinv");
  const expires = new Date(Date.now() + 48 * 60 * 60 * 1000);
  await sql`
    insert into space_invites (id, space_id, created_by, status, expires_at)
    values (${id}, ${access.space.id}, ${String(email || "").toLowerCase()}, ${"pending"}, ${expires})
  `;
  await audit(access.space.id, email, "space.invite.created", id);
  return { ok: true, inviteId: id, path: `/join/space/${id}` };
}

export async function revokeSpaceInvite({ access, session, email, inviteId }) {
  if (!access?.canModerate) return { ok: false, status: 404 };
  const fresh = requireFreshAuth(session);
  if (!fresh.ok) return { ok: false, status: 401, error: fresh.error || REAUTH_ERROR };
  const sql = getSql();
  const rows = await sql`
    update space_invites
    set status = 'revoked', revoked_at = coalesce(revoked_at, now())
    where id = ${inviteId}
      and space_id = ${access.space.id}
      and status = 'pending'
      and revoked_at is null
    returning id
  `;
  if (!rows.length) return { ok: false, status: 404 };
  await audit(access.space.id, email, "space.invite.revoked", inviteId);
  return { ok: true };
}

export async function previewSpaceInvite(inviteId) {
  const sql = getSql();
  const rows = await sql`
    select spaces.name as space_name, workspaces.name as owner_name, space_invites.expires_at
    from space_invites
    join spaces on spaces.id = space_invites.space_id
    join workspaces on workspaces.id = spaces.owner_workspace_id
    where space_invites.id = ${inviteId}
      and space_invites.status = 'pending'
      and space_invites.revoked_at is null
      and space_invites.expires_at > now()
    limit 1
  `;
  if (!rows.length) return null;
  return {
    spaceName: rows[0].space_name,
    ownerName: rows[0].owner_name,
    expiresAt: new Date(rows[0].expires_at).toISOString()
  };
}

export async function acceptSpaceInvite({ inviteId, workspaceId, email, role }) {
  if (role !== "owner" || !workspaceId) return { ok: false, status: 404 };
  const sql = getSql();
  const pending = await sql`
    select space_invites.id, space_invites.space_id, spaces.slug, spaces.owner_workspace_id, spaces.archived_at
    from space_invites
    join spaces on spaces.id = space_invites.space_id
    where space_invites.id = ${inviteId}
    limit 1
  `;
  const invite = pending[0];
  if (!invite || invite.archived_at) return { ok: false, status: 404 };
  if (invite.owner_workspace_id === workspaceId) return { ok: false, status: 404 };
  const paused = await sql`
    select workspaces.suspended_at as workspace_paused, workspace_members.suspended_at as member_paused
    from workspaces
    join workspace_members on workspace_members.workspace_id = workspaces.id
    where workspaces.id = ${workspaceId}
      and lower(workspace_members.email) = ${String(email || "").toLowerCase()}
    limit 1
  `;
  if (!paused.length || paused[0].workspace_paused || paused[0].member_paused) return { ok: false, status: 404 };
  const claimed = await sql`
    update space_invites
    set status = 'accepted',
        accepted_workspace_id = ${workspaceId},
        accepted_by = ${String(email || "").toLowerCase()}
    where id = ${inviteId}
      and status = 'pending'
      and revoked_at is null
      and expires_at > now()
    returning id
  `;
  if (!claimed.length) return { ok: false, status: 404 };
  await sql`
    insert into space_workspaces (space_id, workspace_id, role)
    values (${invite.space_id}, ${workspaceId}, ${"member"})
    on conflict (space_id, workspace_id) do nothing
  `;
  await audit(invite.space_id, email, "space.invite.accepted", workspaceId);
  return { ok: true, slug: invite.slug };
}

export async function spaceParticipants(spaceId) {
  const sql = getSql();
  const workspaces = await sql`
    select workspaces.id, workspaces.name, workspaces.slug, space_workspaces.role
    from space_workspaces
    join workspaces on workspaces.id = space_workspaces.workspace_id
    where space_workspaces.space_id = ${spaceId}
      and workspaces.suspended_at is null
    order by space_workspaces.role desc, workspaces.name asc
  `;
  const bots = await sql`
    select bots.slug, bots.name, bots.workspace_id, workspaces.slug as workspace_slug, workspaces.name as workspace_name
    from space_bots
    join space_workspaces
      on space_workspaces.space_id = space_bots.space_id
     and space_workspaces.workspace_id = space_bots.workspace_id
    join bots on bots.workspace_id = space_bots.workspace_id and bots.slug = space_bots.bot_slug
    join workspaces on workspaces.id = space_bots.workspace_id
    where space_bots.space_id = ${spaceId}
      and bots.removed_at is null
      and workspaces.suspended_at is null
    order by workspaces.name asc, bots.name asc
  `;
  const posters = await sql`
    select distinct posts.author_name
    from posts
    where posts.space_id = ${spaceId}
      and posts.author_kind = 'human'
      and posts.deleted_at is null
      and posts.author_name is not null
      and posts.author_name <> ''
    order by posts.author_name asc
  `;
  return {
    workspaces: workspaces.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      role: row.role
    })),
    bots: bots.map((row) => ({
      slug: row.slug,
      name: row.name,
      workspaceId: row.workspace_id,
      workspaceSlug: row.workspace_slug,
      workspaceName: row.workspace_name,
      qualified: `${row.workspace_slug}/${row.slug}`
    })),
    posters: posters.map((row) => ({ name: row.author_name }))
  };
}

export async function ownBotsForSpace(workspaceId) {
  const sql = getSql();
  const rows = await sql`
    select slug, name
    from bots
    where workspace_id = ${workspaceId} and removed_at is null
    order by name asc
  `;
  return rows;
}

export async function setSpaceBots({ access, email, slugs }) {
  if (!access?.ok || access.viewer?.role !== "owner") return { ok: false, status: 404 };
  if (access.space.archivedAt) return { ok: false, status: 400, error: "This space is archived." };
  const workspaceId = access.viewer.workspaceId;
  const wanted = [...new Set((slugs || []).map((slug) => String(slug || "").trim().toLowerCase()).filter(Boolean))];
  const sql = getSql();
  const owned = await sql`
    select slug from bots
    where workspace_id = ${workspaceId} and removed_at is null and slug = any(${wanted.length ? wanted : [""]})
  `;
  const allowed = new Set(owned.map((row) => row.slug));
  if (wanted.some((slug) => !allowed.has(slug))) return { ok: false, status: 404 };
  const current = await sql`
    select bot_slug from space_bots
    where space_id = ${access.space.id} and workspace_id = ${workspaceId}
  `;
  const have = new Set(current.map((row) => row.bot_slug));
  for (const slug of wanted) {
    if (have.has(slug)) continue;
    await sql`
      insert into space_bots (space_id, workspace_id, bot_slug)
      values (${access.space.id}, ${workspaceId}, ${slug})
      on conflict do nothing
    `;
    await audit(access.space.id, email, "space.bot.added", `${workspaceId}/${slug}`);
  }
  for (const slug of have) {
    if (wanted.includes(slug)) continue;
    await sql`
      delete from space_bots
      where space_id = ${access.space.id} and workspace_id = ${workspaceId} and bot_slug = ${slug}
    `;
    await audit(access.space.id, email, "space.bot.removed", `${workspaceId}/${slug}`);
  }
  return { ok: true };
}

export async function removeSpaceBot({ access, session, email, workspaceId, slug }) {
  if (!access?.canModerate) return { ok: false, status: 404 };
  const fresh = requireFreshAuth(session);
  if (!fresh.ok) return { ok: false, status: 401, error: fresh.error || REAUTH_ERROR };
  const sql = getSql();
  const rows = await sql`
    delete from space_bots
    where space_id = ${access.space.id}
      and workspace_id = ${workspaceId}
      and bot_slug = ${String(slug || "").trim().toLowerCase()}
    returning bot_slug
  `;
  if (!rows.length) return { ok: false, status: 404 };
  await audit(access.space.id, email, "space.bot.removed", `${workspaceId}/${slug}`);
  return { ok: true };
}

export async function removeSpaceWorkspace({ access, session, email, workspaceId }) {
  if (!access?.canModerate) return { ok: false, status: 404 };
  const fresh = requireFreshAuth(session);
  if (!fresh.ok) return { ok: false, status: 401, error: fresh.error || REAUTH_ERROR };
  if (!workspaceId || workspaceId === access.space.ownerWorkspaceId) return { ok: false, status: 404 };
  const sql = getSql();
  const rows = await sql`
    delete from space_workspaces
    where space_id = ${access.space.id} and workspace_id = ${workspaceId} and role <> 'owner'
    returning workspace_id
  `;
  if (!rows.length) return { ok: false, status: 404 };
  await sql`
    delete from space_bots
    where space_id = ${access.space.id} and workspace_id = ${workspaceId}
  `;
  await audit(access.space.id, email, "space.workspace.removed", workspaceId);
  return { ok: true };
}

export async function setSpacePostHidden({ access, email, postId, hidden }) {
  if (!access?.canModerate) return { ok: false, status: 404 };
  const sql = getSql();
  const rows = await sql`
    update posts
    set hidden_at = ${hidden ? new Date().toISOString() : null}
    where id = ${postId} and space_id = ${access.space.id} and deleted_at is null
    returning id
  `;
  if (!rows.length) return { ok: false, status: 404 };
  await audit(access.space.id, email, hidden ? "space.post.hidden" : "space.post.unhidden", postId);
  return { ok: true };
}

export async function selectedBotSlugs(spaceId, workspaceId) {
  const sql = getSql();
  const rows = await sql`
    select bot_slug from space_bots
    where space_id = ${spaceId} and workspace_id = ${workspaceId}
  `;
  return rows.map((row) => row.bot_slug);
}

export async function pendingSpaceInvites(spaceId) {
  const sql = getSql();
  const rows = await sql`
    select id, expires_at
    from space_invites
    where space_id = ${spaceId} and status = 'pending' and revoked_at is null and expires_at > now()
    order by created_at desc
  `;
  return rows.map((row) => ({ id: row.id, path: `/join/space/${row.id}` }));
}

export async function spaceWriteAllowed({ spaceId, workspaceId, slug }) {
  const sql = getSql();
  const rows = await sql`
    select (
      select count(*)::int from posts
      where space_id = ${spaceId}
        and workspace_id = ${workspaceId}
        and from_slug = ${slug}
        and deleted_at is null
        and created_at > now() - interval '1 hour'
    ) + (
      select count(*)::int from comments
      where space_id = ${spaceId}
        and author_workspace_id = ${workspaceId}
        and author_slug = ${slug}
        and deleted_at is null
        and created_at > now() - interval '1 hour'
    ) as n
  `;
  return Number(rows[0]?.n || 0) < SPACE_WRITE_LIMIT;
}

export async function loadSpaceForViewer(viewer, slug) {
  return spaceAccess(viewer, slug);
}

export function viewerFromSession(session, workspaceId, role) {
  return {
    kind: "human",
    workspaceId,
    email: String(session?.user?.email || "").trim().toLowerCase(),
    githubId: String(session?.user?.githubId || "").trim(),
    role
  };
}
