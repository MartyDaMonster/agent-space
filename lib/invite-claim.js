import { getSql } from "./db.js";
import { newWorkspaceId } from "./ids.js";
import { readInviteCookie } from "./invite-cookie.js";

function closed(status = 404) {
  return { ok: false, status, error: "That invite is not open." };
}

export async function claimInviteLink(inviteId, identity = {}) {
  const id = String(inviteId || "").trim();
  const githubId = String(identity.githubId || identity.githubUserId || "").trim();
  const login = String(identity.githubLogin || "").trim().toLowerCase();
  if (!id || !/^\d+$/.test(githubId)) return closed();
  const sql = getSql();
  const workspaceId = newWorkspaceId();
  const slug = `space-${workspaceId.slice(3)}`;
  const rows = await sql`
    with claimed as (
      update workspace_invites
      set status = 'accepted',
          accepted_at = now(),
          own_workspace = true,
          workspace_id = ${workspaceId},
          github_login = nullif(${login}, ''),
          github_user_id = nullif(${githubId}, '')
      where id = ${id}
        and status = 'pending'
        and revoked_at is null
        and email is not null
        and btrim(email) <> ''
        and expires_at is not null
        and expires_at > now()
      returning id, email, invitee_name, github_login, github_user_id
    ),
    made as (
      insert into workspaces (id, name, slug)
      select ${workspaceId}, 'New workspace', ${slug}
      from claimed
      returning id
    ),
    joined as (
      insert into workspace_members (workspace_id, email, github_login, github_user_id, role)
      select ${workspaceId}, lower(email), nullif(${login}, ''), nullif(${githubId}, ''), 'owner'
      from claimed
      on conflict (workspace_id, email) do update
        set github_login = excluded.github_login,
            github_user_id = excluded.github_user_id
    ),
    person as (
      insert into humans (email, name, workspace_id, github_login, github_user_id)
      select
        lower(email),
        coalesce(nullif(invitee_name, ''), lower(email)),
        ${workspaceId},
        nullif(${login}, ''),
        nullif(${githubId}, '')
      from claimed
      on conflict (workspace_id, email) do update
        set github_login = excluded.github_login,
            github_user_id = excluded.github_user_id
    ),
    drafted as (
      update onboarding_drafts
      set created_workspace_id = ${workspaceId},
          email = (select lower(email) from claimed),
          github_login = nullif(${login}, ''),
          updated_at = now()
      where invite_id = ${id}
        and exists (select 1 from claimed)
      returning invite_id
    )
    select id, lower(email) as email, invitee_name, github_login, github_user_id from claimed
  `;
  if (rows.length) {
    return {
      ok: true,
      email: rows[0].email,
      invite: {
        id: rows[0].id,
        email: rows[0].email,
        githubLogin: rows[0].github_login || login,
        githubUserId: rows[0].github_user_id || githubId,
        status: "accepted",
        workspaceId,
        ownWorkspace: true
      },
      membership: {
        workspaceId,
        email: rows[0].email,
        githubLogin: rows[0].github_login || login,
        githubUserId: rows[0].github_user_id || githubId,
        role: "owner"
      }
    };
  }
  const current = await sql`
    select status from workspace_invites where id = ${id} limit 1
  `;
  if (current[0]?.status === "accepted") return closed(409);
  return closed(404);
}

export async function memberForGithub({ githubId = "" } = {}) {
  const id = String(githubId || "").trim();
  if (!/^\d+$/.test(id)) return null;
  const sql = getSql();
  const rows = await sql`
    select workspace_id, email, github_login, github_user_id
    from workspace_members
    where github_user_id = ${id}
    order by created_at asc
    limit 1
  `;
  if (!rows.length) return null;
  return {
    workspaceId: rows[0].workspace_id,
    email: rows[0].email,
    githubLogin: rows[0].github_login || "",
    githubUserId: rows[0].github_user_id || ""
  };
}

export async function authorizeGithubSignIn({
  email = "",
  githubLogin = "",
  githubId = "",
  cookieValue = "",
  allowed = false
} = {}) {
  if (allowed) return { ok: true, email, inviteEmail: "", created: false };
  const inviteId = readInviteCookie(cookieValue);
  if (inviteId) {
    const claimed = await claimInviteLink(inviteId, { githubId, githubLogin });
    if (claimed.ok) {
      return {
        ok: true,
        email,
        inviteEmail: claimed.email,
        workspaceId: claimed.membership.workspaceId,
        created: true
      };
    }
  }
  const existing = await memberForGithub({ githubId });
  if (!existing) return { ok: false, created: false };
  return {
    ok: true,
    email,
    inviteEmail: existing.email,
    workspaceId: existing.workspaceId,
    created: false
  };
}
