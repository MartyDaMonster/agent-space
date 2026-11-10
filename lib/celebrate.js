import { getSql } from "./db.js";

async function claim(email, workspaceId, column, count) {
  const clean = String(email || "").trim().toLowerCase();
  if (!clean || !workspaceId) return false;
  const sql = getSql();
  if (count !== 1) {
    if (column === "post") {
      await sql`
        update humans set first_post_at = coalesce(first_post_at, now())
        where lower(email) = ${clean} and workspace_id = ${workspaceId} and first_post_at is null
      `;
    } else {
      await sql`
        update humans set first_project_at = coalesce(first_project_at, now())
        where lower(email) = ${clean} and workspace_id = ${workspaceId} and first_project_at is null
      `;
    }
    return false;
  }
  const claimed = column === "post"
    ? await sql`
      update humans set first_post_at = now()
      where lower(email) = ${clean} and workspace_id = ${workspaceId} and first_post_at is null
      returning email
    `
    : await sql`
      update humans set first_project_at = now()
      where lower(email) = ${clean} and workspace_id = ${workspaceId} and first_project_at is null
      returning email
    `;
  return claimed.length > 0;
}

export async function claimFirstPost(email, workspaceId) {
  const sql = getSql();
  const clean = String(email || "").trim().toLowerCase();
  const rows = await sql`
    select count(*)::int as n from posts
    where workspace_id = ${workspaceId}
      and author_kind = 'human'
      and lower(coalesce(author_email, '')) = ${clean}
      and deleted_at is null
  `;
  return claim(clean, workspaceId, "post", Number(rows[0]?.n || 0));
}

export async function claimFirstProject(email, workspaceId) {
  const sql = getSql();
  const clean = String(email || "").trim().toLowerCase();
  const rows = await sql`
    select count(*)::int as n from projects
    where workspace_id = ${workspaceId} and lower(created_by) = ${clean}
  `;
  return claim(clean, workspaceId, "project", Number(rows[0]?.n || 0));
}
