import { getSql } from "./db.js";
import { PROJECT_COLORS, projectNameChange } from "./project-fields.js";

export { isUnread, prepareProject, projectNameChange } from "./project-fields.js";

function newProjectId() {
  return `prj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function mapProject(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || "",
    color: row.color || PROJECT_COLORS[0],
    emoji: row.emoji || "",
    createdBy: row.created_by,
    archived: Boolean(row.archived_at),
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    seenAt: row.seen_at || null
  };
}

export async function listProjects({ email = "", includeArchived = false, workspaceId = "" } = {}) {
  const sql = getSql();
  const rows = includeArchived
    ? await sql`
      select projects.*, reads.seen_at
      from projects
      left join project_reads reads on reads.project_id = projects.id and reads.email = ${email}
      where projects.workspace_id = ${workspaceId}
      order by projects.last_activity_at desc, projects.name asc
    `
    : await sql`
      select projects.*, reads.seen_at
      from projects
      left join project_reads reads on reads.project_id = projects.id and reads.email = ${email}
      where projects.archived_at is null
        and projects.workspace_id = ${workspaceId}
      order by projects.last_activity_at desc, projects.name asc
    `;
  return rows.map(mapProject);
}

export async function projectBySlug(slug, workspaceId = "") {
  const sql = getSql();
  const rows = await sql`
    select * from projects where slug = ${slug} and workspace_id = ${workspaceId} limit 1
  `;
  return rows[0] ? mapProject(rows[0]) : null;
}

async function openSlug(base, workspaceId) {
  const sql = getSql();
  let slug = base;
  for (let n = 2; n < 30; n += 1) {
    const rows = await sql`
      select slug from projects where slug = ${slug} and workspace_id = ${workspaceId} limit 1
    `;
    if (!rows.length) return slug;
    slug = `${base}-${n}`.slice(0, 48);
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 48);
}

export async function createProject({ prepared, email, postId = "", workspaceId = "" }) {
  const sql = getSql();
  const id = newProjectId();
  const slug = await openSlug(prepared.slug, workspaceId);
  await sql`
    insert into projects (id, name, slug, description, color, emoji, created_by, workspace_id)
    values (${id}, ${prepared.name}, ${slug}, ${prepared.description}, ${prepared.color}, ${prepared.emoji}, ${email}, ${workspaceId || ""})
  `;
  if (postId) {
    const moved = await sql`
      update posts set project_id = ${id}
      where id = ${postId} and project_id is null and workspace_id = ${workspaceId}
      returning id
    `;
    if (!moved.length) {
      await sql`delete from projects where id = ${id}`;
      return { ok: false, error: "That post is already in a project." };
    }
  }
  await sql`
    insert into project_reads (email, project_id, seen_at)
    values (${email}, ${id}, now())
  `;
  return { ok: true, id, slug };
}

export async function renameProject(slug, name, workspaceId = "") {
  const change = projectNameChange(name);
  if (!change.ok) return change;
  const sql = getSql();
  const rows = await sql`
    update projects set name = ${change.name}
    where slug = ${slug} and workspace_id = ${workspaceId}
    returning slug, name
  `;
  if (!rows.length) return { ok: false, error: "That project was not found." };
  return { ok: true, slug: rows[0].slug, name: rows[0].name };
}

export async function archiveProject(slug, email, workspaceId = "") {
  const sql = getSql();
  const rows = await sql`
    update projects set archived_at = coalesce(archived_at, now())
    where slug = ${slug} and created_by = ${email} and workspace_id = ${workspaceId}
    returning slug
  `;
  return rows.length > 0;
}

export async function markProjectSeen(projectId, email) {
  const sql = getSql();
  await sql`
    insert into project_reads (email, project_id, seen_at)
    values (${email}, ${projectId}, now())
    on conflict (email, project_id) do update set seen_at = now()
  `;
}

export async function touchProject(projectId, workspaceId = "") {
  if (!projectId) return;
  const sql = getSql();
  await sql`
    update projects set last_activity_at = now()
    where id = ${projectId} and workspace_id = ${workspaceId}
  `;
}

export async function touchProjectForPost(postId, workspaceId = "") {
  const sql = getSql();
  await sql`
    update projects set last_activity_at = now()
    where workspace_id = ${workspaceId}
      and id = (select project_id from posts where id = ${postId} and workspace_id = ${workspaceId})
  `;
}
