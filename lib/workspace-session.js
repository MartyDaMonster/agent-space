import { getSql } from "./db.js";
import { sessionInvited } from "./access.js";
import { identityWorkspace } from "./workspace.js";

function sessionIdentity(session) {
  return {
    email: String(session?.user?.email || "").trim().toLowerCase(),
    login: String(session?.user?.githubLogin || "").trim().toLowerCase(),
    githubId: String(session?.user?.githubId || "").trim()
  };
}

export async function boardAccess(session) {
  const workspaceId = await workspaceIdForSession(session);
  const invited = sessionInvited(session);
  if (!workspaceId) return invited ? "ok" : "none";
  const { email, login, githubId } = sessionIdentity(session);
  const sql = getSql();
  const rows = await sql`
    select
      (select suspended_at from workspaces where id = ${workspaceId}) as workspace_paused,
      (select suspended_at from workspace_members
        where workspace_id = ${workspaceId}
          and (
            (${email} <> '' and lower(email) = ${email})
            or (${githubId} <> '' and github_user_id = ${githubId})
            or (${login} <> '' and github_login is not null and lower(github_login) = ${login})
          )
        limit 1) as member_paused
  `;
  if (rows[0]?.workspace_paused || rows[0]?.member_paused) return "paused";
  if (invited) return "ok";
  const member = await sql`
    select 1 from workspace_members
    where workspace_id = ${workspaceId}
      and (
        (${email} <> '' and lower(email) = ${email})
        or (${githubId} <> '' and github_user_id = ${githubId})
        or (${login} <> '' and github_login is not null and lower(github_login) = ${login})
      )
    limit 1
  `;
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
  const { email, login, githubId } = sessionIdentity(session);
  if (!email && !login && !githubId) return null;
  const sql = getSql();
  const rows = await sql`
    select workspace_id from workspace_members
    where (${githubId} <> '' and github_user_id = ${githubId})
       or (${email} <> '' and lower(email) = ${email})
       or (${login} <> '' and github_login is not null and lower(github_login) = ${login})
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
  const { email, login, githubId } = sessionIdentity(session);
  if (!email && !login && !githubId) return null;
  const sql = getSql();
  const rows = await sql`
    select role from workspace_members
    where workspace_id = ${workspaceId}
      and (
        (${email} <> '' and lower(email) = ${email})
        or (${githubId} <> '' and github_user_id = ${githubId})
        or (${login} <> '' and github_login is not null and lower(github_login) = ${login})
      )
    limit 1
  `;
  return rows[0]?.role || null;
}
