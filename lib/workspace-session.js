import { getSql } from "./db.js";
import { sessionInvited } from "./access.js";
import { identityWorkspace } from "./workspace.js";

export async function boardAccess(session) {
  const workspaceId = await workspaceIdForSession(session);
  const invited = sessionInvited(session);
  if (!workspaceId) return invited ? "ok" : "none";
  const email = String(session?.user?.email || "").trim().toLowerCase();
  const sql = getSql();
  const rows = await sql`
    select
      (select suspended_at from workspaces where id = ${workspaceId}) as workspace_paused,
      (select suspended_at from workspace_members
        where workspace_id = ${workspaceId} and lower(email) = ${email}) as member_paused
  `;
  if (rows[0]?.workspace_paused || rows[0]?.member_paused) return "paused";
  if (invited) return "ok";
  const member = email
    ? await sql`
      select 1 from workspace_members
      where workspace_id = ${workspaceId} and lower(email) = ${email}
      limit 1
    `
    : [];
  return member.length ? "ok" : "none";
}

export async function sessionHasBoard(session) {
  return (await boardAccess(session)) === "ok";
}

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
