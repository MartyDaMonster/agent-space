import { getSql } from "./db.js";
import { claimInviteLink } from "./invite-claim.js";
import { createInviteRecord, revokeInvite } from "./workspace.js";

function mapInvite(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    email: row.email || "",
    githubLogin: row.github_login || "",
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}

export async function insertInvite({ id, workspaceId, email, githubLogin, createdBy }) {
  const prepared = createInviteRecord({ id, workspaceId: workspaceId || "new", email, githubLogin, createdBy });
  if (!prepared.ok) return prepared;
  const sql = getSql();
  const invite = prepared.invite;
  await sql`
    insert into workspace_invites (id, workspace_id, email, github_login, status, created_by, expires_at, own_workspace)
    values (
      ${invite.id},
      null,
      ${invite.email || null},
      ${invite.githubLogin || null},
      'pending',
      ${invite.createdBy},
      now() + interval '48 hours',
      true
    )
  `;
  return { ok: true, invite: { ...invite, workspaceId: "", ownWorkspace: true } };
}

export async function loadInvite(workspaceId, inviteId) {
  const sql = getSql();
  const rows = await sql`
    select id, workspace_id, email, github_login, status, created_by, created_at
    from workspace_invites
    where id = ${inviteId} and workspace_id = ${workspaceId}
    limit 1
  `;
  return mapInvite(rows[0]);
}

export async function revokeStoredInvite(workspaceId, inviteId) {
  const sql = getSql();
  const rows = await sql`
    update workspace_invites
    set status = 'revoked', revoked_at = now()
    where id = ${inviteId} and workspace_id = ${workspaceId} and status = 'pending'
    returning id, workspace_id, email, github_login, status, created_by, created_at
  `;
  if (rows.length) return { ok: true, invite: mapInvite(rows[0]) };
  const current = await loadInvite(workspaceId, inviteId);
  if (!current) return { ok: false, status: 404, error: "That invite is not open." };
  if (current.status === "revoked") return { ok: true, invite: current };
  if (current.status === "accepted") return { ok: false, status: 409, error: "That invite was already accepted." };
  return { ok: false, status: 409, error: "That invite is not open." };
}

export async function acceptStoredInvite(_workspaceId, inviteId, identity = {}) {
  return claimInviteLink(inviteId, identity);
}
