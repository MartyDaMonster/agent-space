import { randomBytes } from "node:crypto";
import { getSql } from "./db.js";
import { revokeStoredInvite } from "./invites.js";
import { canResend, inviteState, martinAdmin } from "./admin-panel.js";
import { MARTIN_EMAILS, MARTIN_GITHUB } from "./workspace.js";

function deny() {
  return { ok: false, status: 404, error: "Not found." };
}

export function guardMartin(session) {
  if (!martinAdmin(session)) return deny();
  return { ok: true, email: String(session?.user?.email || session?.user?.githubLogin || "martin").toLowerCase() };
}

async function audit(actor, action, workspaceId = "", targetEmail = "") {
  const sql = getSql();
  await sql`
    insert into admin_audit (id, actor_email, action, workspace_id, target_email)
    values (${`aud-${randomBytes(6).toString("hex")}`}, ${actor}, ${action}, ${workspaceId || null}, ${targetEmail || null})
  `;
}

export async function listAdminInvites(session) {
  const gate = guardMartin(session);
  if (!gate.ok) return gate;
  const sql = getSql();
  const rows = await sql`
    select invites.id, invites.workspace_id, invites.email, invites.github_login, invites.status,
           invites.created_at, invites.expires_at, workspaces.name as workspace_name
    from workspace_invites invites
    left join workspaces on workspaces.id = invites.workspace_id
    order by invites.created_at desc
  `;
  return {
    ok: true,
    invites: rows.map((row) => {
      const invite = {
        id: row.id,
        workspaceId: row.workspace_id,
        workspaceName: row.workspace_name || "New workspace",
        email: row.email || "",
        githubLogin: row.github_login || "",
        status: row.status,
        createdAt: row.created_at,
        expiresAt: row.expires_at
      };
      return { ...invite, state: inviteState(invite) };
    })
  };
}

export async function createAdminInvite(session, { email = "", githubLogin = "" } = {}) {
  const gate = guardMartin(session);
  if (!gate.ok) return gate;
  const cleanEmail = String(email || "").trim().toLowerCase();
  const login = String(githubLogin || "").trim().replace(/^@/, "");
  if (!cleanEmail && !login) return { ok: false, status: 400, error: "An invite needs an email or a GitHub login." };
  if (cleanEmail && !cleanEmail.includes("@")) return { ok: false, status: 400, error: "That email is not usable." };
  const id = `inv-${randomBytes(6).toString("hex")}`;
  const sql = getSql();
  await sql`
    insert into workspace_invites (id, workspace_id, email, github_login, status, created_by, expires_at, own_workspace)
    values (${id}, null, ${cleanEmail || null}, ${login || null}, 'pending', ${gate.email}, now() + interval '14 days', true)
  `;
  await audit(gate.email, "invite.created", "", cleanEmail || login);
  return {
    ok: true,
    invite: { id, email: cleanEmail, githubLogin: login, workspaceId: "", ownWorkspace: true, status: "pending" }
  };
}

export async function resendAdminInvite(session, inviteId) {
  const gate = guardMartin(session);
  if (!gate.ok) return gate;
  const sql = getSql();
  const rows = await sql`
    select id, workspace_id, email, github_login, status, expires_at, created_at
    from workspace_invites where id = ${inviteId} limit 1
  `;
  if (!rows.length) return deny();
  const state = inviteState({
    status: rows[0].status,
    expiresAt: rows[0].expires_at
  });
  if (!canResend(state)) return { ok: false, status: 409, error: "That invite cannot be resent." };
  await sql`
    update workspace_invites
    set status = 'pending', expires_at = now() + interval '14 days', created_at = now(), revoked_at = null
    where id = ${inviteId}
  `;
  await audit(gate.email, "invite.resent", rows[0].workspace_id, rows[0].email || rows[0].github_login);
  return { ok: true };
}

export async function revokeAdminInvite(session, inviteId) {
  const gate = guardMartin(session);
  if (!gate.ok) return gate;
  const sql = getSql();
  const rows = await sql`
    select workspace_id, email, github_login, own_workspace
    from workspace_invites where id = ${inviteId} limit 1
  `;
  if (!rows.length) return deny();
  if (rows[0].own_workspace || !rows[0].workspace_id) {
    const revoked = await sql`
      update workspace_invites
      set status = 'revoked', revoked_at = now()
      where id = ${inviteId} and status = 'pending' and own_workspace = true
      returning id
    `;
    if (!revoked.length) return { ok: false, status: 409, error: "That invite is not open." };
    await audit(gate.email, "invite.revoked", "", rows[0].email || rows[0].github_login);
    return { ok: true };
  }
  const revoked = await revokeStoredInvite(rows[0].workspace_id, inviteId);
  if (!revoked.ok) return { ok: false, status: revoked.status, error: revoked.error };
  await audit(gate.email, "invite.revoked", rows[0].workspace_id, rows[0].email || rows[0].github_login);
  return { ok: true };
}

export async function listPeople(session) {
  const gate = guardMartin(session);
  if (!gate.ok) return gate;
  const sql = getSql();
  const people = await sql`
    select workspaces.id as workspace_id, workspaces.name as workspace_name, workspaces.created_at,
           workspaces.suspended_at as workspace_paused,
           members.email, members.github_login, members.created_at as joined_at,
           members.suspended_at as member_paused,
           (select count(*)::int from bots where bots.workspace_id = workspaces.id) as bots,
           (select count(*)::int from posts where posts.workspace_id = workspaces.id and posts.deleted_at is null) as posts,
           (select count(*)::int from comments where comments.workspace_id = workspaces.id and comments.deleted_at is null) as comments,
           (select coalesce(sum(byte_size), 0)::bigint from board_files
             where board_files.workspace_id = workspaces.id and board_files.deleted_at is null) as storage_bytes,
           (select max(created_at) from account_events where account_events.workspace_id = workspaces.id) as last_active
    from workspaces
    join workspace_members members
      on members.workspace_id = workspaces.id and members.role = 'owner'
    order by members.created_at desc
  `;
  const events = await sql`
    select workspace_id, email, kind, bot_slug, created_at
    from account_events
    order by created_at desc
    limit 200
  `;
  const keys = await sql`
    select id, workspace_id, bot_slug, revoked_at
    from api_keys
    order by created_at desc
  `;
  return {
    ok: true,
    people: people.map((row) => ({
      workspaceId: row.workspace_id,
      workspaceName: row.workspace_name,
      email: row.email,
      githubLogin: row.github_login || "",
      joinedAt: row.joined_at,
      lastActive: row.last_active,
      bots: row.bots,
      posts: row.posts,
      comments: row.comments,
      storageBytes: Number(row.storage_bytes || 0),
      paused: Boolean(row.workspace_paused || row.member_paused),
      owner: MARTIN_EMAILS.includes(String(row.email || "").toLowerCase())
        || String(row.github_login || "").toLowerCase() === MARTIN_GITHUB,
      activity: events
        .filter((event) => event.workspace_id === row.workspace_id)
        .slice(0, 8)
        .map((event) => ({
          kind: event.kind,
          botSlug: event.bot_slug || "",
          at: event.created_at
        })),
      keys: keys
        .filter((key) => key.workspace_id === row.workspace_id && !key.revoked_at)
        .map((key) => ({ id: key.id, slug: key.bot_slug }))
    }))
  };
}

export async function setSuspension(session, { workspaceId, email = "", resume = false, scope = "workspace" }) {
  const gate = guardMartin(session);
  if (!gate.ok) return gate;
  const sql = getSql();
  const stamp = resume ? null : new Date();
  if (scope === "person") {
    const rows = await sql`
      update workspace_members
      set suspended_at = ${stamp}
      where workspace_id = ${workspaceId} and lower(email) = ${String(email || "").toLowerCase()}
      returning email
    `;
    if (!rows.length) return deny();
  } else {
    const rows = await sql`
      update workspaces set suspended_at = ${stamp} where id = ${workspaceId} returning id
    `;
    if (!rows.length) return deny();
  }
  await audit(gate.email, `${scope}.${resume ? "resumed" : "suspended"}`, workspaceId, email);
  return { ok: true };
}

export async function revokeAdminKey(session, { workspaceId, keyId }) {
  const gate = guardMartin(session);
  if (!gate.ok) return gate;
  const sql = getSql();
  const rows = await sql`
    update api_keys
    set revoked_at = now()
    where id = ${keyId}::uuid and workspace_id = ${workspaceId} and revoked_at is null
    returning bot_slug
  `;
  if (!rows.length) return deny();
  await audit(gate.email, "botkey.revoked", workspaceId, rows[0].bot_slug);
  return { ok: true };
}

export async function listAudit(session) {
  const gate = guardMartin(session);
  if (!gate.ok) return gate;
  const sql = getSql();
  const rows = await sql`
    select id, actor_email, action, workspace_id, target_email, created_at
    from admin_audit
    order by created_at desc
    limit 40
  `;
  return {
    ok: true,
    audit: rows.map((row) => ({
      id: row.id,
      at: row.created_at,
      action: row.action,
      targetEmail: row.target_email || "",
      workspaceId: row.workspace_id || ""
    }))
  };
}
