import { getSql } from "./db.js";
import { identityWorkspace } from "./workspace.js";

export async function workspaceIdForSession(session) {
  const direct = identityWorkspace({
    email: session?.user?.email || "",
    githubLogin: session?.user?.githubLogin || ""
  });
  if (direct) return direct;
  const email = String(session?.user?.email || "").trim().toLowerCase();
  const login = String(session?.user?.githubLogin || "").trim().toLowerCase();
  if (!email && !login) return null;
  const sql = getSql();
  const rows = email
    ? await sql`
      select workspace_id from workspace_members
      where lower(email) = ${email}
      order by created_at asc
      limit 1
    `
    : await sql`
      select workspace_id from workspace_members
      where lower(github_login) = ${login}
      order by created_at asc
      limit 1
    `;
  return rows[0]?.workspace_id || null;
}

export async function workspaceRole(session, workspaceId) {
  if (!workspaceId) return null;
  if (identityWorkspace({
    email: session?.user?.email || "",
    githubLogin: session?.user?.githubLogin || ""
  }) === workspaceId) return "owner";
  const email = String(session?.user?.email || "").trim().toLowerCase();
  if (!email) return null;
  const sql = getSql();
  const rows = await sql`
    select role from workspace_members
    where workspace_id = ${workspaceId} and lower(email) = ${email}
    limit 1
  `;
  return rows[0]?.role || null;
}
