import { getSql } from "./db.js";

function presentSpace(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    ownerWorkspaceId: row.owner_workspace_id,
    archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : ""
  };
}

function denied() {
  return { ok: false, status: 404 };
}

export function spaceChoice(request, body) {
  const query = new URL(request.url).searchParams.get("space");
  const fromQuery = typeof query === "string" ? query.trim() : "";
  const fromBody = body && typeof body.space === "string" ? body.space.trim() : "";
  if (fromQuery && fromBody && fromQuery !== fromBody) {
    return { ok: false, status: 400, error: "The space in the request does not match." };
  }
  return { ok: true, space: fromQuery || fromBody };
}

export async function spaceAccess(viewer, spaceRef, { byId = false } = {}) {
  const ref = String(spaceRef || "").trim().toLowerCase();
  if (!ref || !viewer?.workspaceId) return denied();
  if (!byId && /^spc-/.test(ref)) return denied();
  const sql = getSql();
  const spaces = byId
    ? await sql`
      select id, slug, name, owner_workspace_id, archived_at
      from spaces
      where id = ${ref}
      limit 1
    `
    : await sql`
      select id, slug, name, owner_workspace_id, archived_at
      from spaces
      where slug = ${ref}
      limit 1
    `;
  const space = spaces[0];
  if (!space) return denied();
  if (viewer.kind === "bot") {
    const slug = String(viewer.slug || "").trim().toLowerCase();
    if (!slug) return denied();
    const rows = await sql`
      select space_bots.bot_slug
      from space_bots
      join space_workspaces
        on space_workspaces.space_id = space_bots.space_id
       and space_workspaces.workspace_id = space_bots.workspace_id
      join bots
        on bots.workspace_id = space_bots.workspace_id
       and bots.slug = space_bots.bot_slug
      join workspaces on workspaces.id = space_bots.workspace_id
      where space_bots.space_id = ${space.id}
        and space_bots.workspace_id = ${viewer.workspaceId}
        and space_bots.bot_slug = ${slug}
        and space_bots.blocked_at is null
        and bots.removed_at is null
        and workspaces.suspended_at is null
      limit 1
    `;
    if (!rows.length) return denied();
    return { ok: true, space: presentSpace(space), viewer, canModerate: false };
  }
  if (viewer.kind !== "human") return denied();
  const email = String(viewer.email || "").trim().toLowerCase();
  const githubId = String(viewer.githubId || "").trim();
  const rows = await sql`
    select space_workspaces.role as space_role, workspace_members.role as member_role
    from space_workspaces
    join workspaces on workspaces.id = space_workspaces.workspace_id
    join workspace_members on workspace_members.workspace_id = space_workspaces.workspace_id
    where space_workspaces.space_id = ${space.id}
      and space_workspaces.workspace_id = ${viewer.workspaceId}
      and workspaces.suspended_at is null
      and workspace_members.suspended_at is null
      and (
        (${githubId} <> '' and workspace_members.github_user_id = ${githubId})
        or (
          ${email} <> ''
          and lower(workspace_members.email) = ${email}
          and (
            ${githubId} = ''
            or workspace_members.github_user_id is null
            or btrim(workspace_members.github_user_id) = ''
            or workspace_members.github_user_id = ${githubId}
          )
        )
      )
    limit 1
  `;
  if (rows.length) {
    const canModerate = rows[0].space_role === "owner" && rows[0].member_role === "owner";
    return {
      ok: true,
      space: presentSpace(space),
      viewer,
      canModerate,
      spaceRole: rows[0].space_role
    };
  }
  let people = [];
  try {
    people = await sql`
    select 1
    from space_people
    join workspaces on workspaces.id = space_people.home_workspace_id
    join workspace_members
      on workspace_members.workspace_id = space_people.home_workspace_id
     and (
       (
         space_people.github_user_id is not null
         and btrim(space_people.github_user_id) <> ''
         and workspace_members.github_user_id = space_people.github_user_id
       )
       or lower(workspace_members.email) = lower(space_people.email)
     )
    where space_people.space_id = ${space.id}
      and workspaces.suspended_at is null
      and workspace_members.suspended_at is null
      and (
        (${githubId} <> '' and space_people.github_user_id = ${githubId})
        or (
          ${email} <> ''
          and lower(space_people.email) = ${email}
          and (
            ${githubId} = ''
            or space_people.github_user_id is null
            or btrim(space_people.github_user_id) = ''
            or space_people.github_user_id = ${githubId}
          )
        )
      )
    limit 1
  `;
  } catch (error) {
    if (error?.code !== "42P01") throw error;
  }
  if (!people.length) return denied();
  return {
    ok: true,
    space: presentSpace(space),
    viewer,
    canModerate: false,
    spaceRole: "person"
  };
}

export function spaceWritesOpen(access) {
  if (!access?.ok) return denied();
  if (access.space.archivedAt) return { ok: false, status: 400, error: "This space is archived." };
  return { ok: true };
}
