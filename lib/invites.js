import { getSql } from "./db.js";
import { acceptInvite, createInviteRecord, revokeInvite } from "./workspace.js";

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

export async function listInvites(workspaceId) {
  const sql = getSql();
  const rows = await sql`
    select id, workspace_id, email, github_login, status, created_by, created_at
    from workspace_invites
    where workspace_id = ${workspaceId}
    order by created_at desc
  `;
  return rows.map(mapInvite);
}

export async function insertInvite({ id, workspaceId, email, githubLogin, createdBy }) {
  const prepared = createInviteRecord({ id, workspaceId, email, githubLogin, createdBy });
  if (!prepared.ok) return prepared;
  const sql = getSql();
  const invite = prepared.invite;
  await sql`
    insert into workspace_invites (id, workspace_id, email, github_login, status, created_by)
    values (
      ${invite.id},
      ${invite.workspaceId},
      ${invite.email || null},
      ${invite.githubLogin || null},
      'pending',
      ${invite.createdBy}
    )
  `;
  return { ok: true, invite };
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
  const current = await loadInvite(workspaceId, inviteId);
  const decision = revokeInvite(current, workspaceId);
  if (!decision.ok) return decision;
  if (current.status === "revoked") return decision;
  const sql = getSql();
  await sql`
    update workspace_invites
    set status = 'revoked', revoked_at = now()
    where id = ${inviteId} and workspace_id = ${workspaceId} and status = 'pending'
  `;
  return decision;
}

export async function acceptStoredInvite(workspaceId, inviteId, identity) {
  const current = await loadInvite(workspaceId, inviteId);
  const decision = acceptInvite(current, identity);
  if (!decision.ok || current?.status === "accepted") return decision;
  const sql = getSql();
  await sql`
    update workspace_invites
    set status = 'accepted', accepted_at = now()
    where id = ${inviteId} and workspace_id = ${workspaceId} and status = 'pending'
  `;
  const memberEmail = decision.membership.email;
  if (memberEmail) {
    await sql`
      insert into workspace_members (workspace_id, email, github_login, role)
      values (${workspaceId}, ${memberEmail}, ${decision.membership.githubLogin || null}, 'member')
      on conflict (workspace_id, email) do nothing
    `;
  }
  return decision;
}
