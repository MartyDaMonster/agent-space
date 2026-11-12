import { getSql } from "./db.js";
import { sessionInvited } from "./access.js";
import { identityWorkspace } from "./workspace.js";

function sessionIdentity(session) {
  return {
    email: String(session?.user?.email || "").trim().toLowerCase(),
    githubId: String(session?.user?.githubId || "").trim()
  };
}

export async function boardAccess(session) {
  const workspaceId = await workspaceIdForSession(session);
  const invited = sessionInvited(session);
  if (!workspaceId) return invited ? "ok" : "none";
  const { email, githubId } = sessionIdentity(session);
  const sql = getSql();
  const rows = await sql`
    select
      (select suspended_at from workspaces where id = ${workspaceId}) as workspace_paused,
      (select suspended_at from workspace_members
        where workspace_id = ${workspaceId}
          and (
            (${githubId} <> '' and github_user_id = ${githubId})
            or (${githubId} = '' and ${email} <> '' and lower(email) = ${email})
          )
        limit 1) as member_paused
  `;
  if (rows[0]?.workspace_paused || rows[0]?.member_paused) return "paused";
  if (invited) return "ok";
  const member = await sql`
    select 1 from workspace_members
    where workspace_id = ${workspaceId}
      and (
        (${githubId} <> '' and github_user_id = ${githubId})
        or (${githubId} = '' and ${email} <> '' and lower(email) = ${email})
      )
    limit 1
  `;
  return member.length ? "ok" : "none";
}

export async function sessionHasBoard(session) {
  return (await boardAccess(session)) === "ok";
}

export async function workspaceIdForSession(session) {
  const { email, githubId } = sessionIdentity(session);
  const direct = identityWorkspace({ email: githubId ? "" : email, githubId });
  if (direct) return direct;
  if (githubId) {
    if (!/^\d+$/.test(githubId)) return null;
    const sql = getSql();
    const rows = await sql`
      select workspace_id from workspace_members
      where github_user_id = ${githubId}
      order by workspace_id asc
      limit 1
    `;
    return rows[0]?.workspace_id || null;
  }
  if (!email) return null;
  const sql = getSql();
  const rows = await sql`
    select workspace_id from workspace_members
    where lower(email) = ${email}
    order by created_at asc
    limit 1
  `;
  return rows[0]?.workspace_id || null;
}

export async function workspaceActor(session) {
  if (!session?.user) return null;
  const workspaceId = await workspaceIdForSession(session);
  if (!workspaceId) return null;
  const role = await workspaceRole(session, workspaceId);
  if (role !== "owner" && role !== "member") return null;
  return { session, workspaceId, role };
}

export async function writeActor(session) {
  const actor = await workspaceActor(session);
  if (!actor) return { ok: false, status: 401, error: "You need to be signed in." };
  if ((await boardAccess(session)) !== "ok") {
    return { ok: false, status: 403, error: "This account is paused." };
  }
  return { ok: true, actor };
}

export async function workspaceRole(session, workspaceId) {
  if (!workspaceId) return null;
  const { email, githubId } = sessionIdentity(session);
  if (identityWorkspace({ email: githubId ? "" : email, githubId }) === workspaceId) return "owner";
  const sql = getSql();
  if (githubId) {
    if (!/^\d+$/.test(githubId)) return null;
    const rows = await sql`
      select role from workspace_members
      where workspace_id = ${workspaceId} and github_user_id = ${githubId}
      limit 1
    `;
    return rows[0]?.role || null;
  }
  if (!email) return null;
  const rows = await sql`
    select role from workspace_members
    where workspace_id = ${workspaceId} and lower(email) = ${email}
    limit 1
  `;
  return rows[0]?.role || null;
}
