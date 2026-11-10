import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import pg from "pg";
import { newKeyId, tokenHash } from "../lib/keys.js";

const ADMIN_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic";
const DATABASE_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic_admin";
process.env.SQL_DRIVER = "pg";
process.env.DATABASE_URL = DATABASE_URL;
process.env.ALLOWED_EMAILS = "marty.hungerford3181@gmail.com,marty.j.hungerford@gmail.com";

const statements = readFileSync(new URL("../scripts/migrate.sql", import.meta.url), "utf8")
  .split(/;\s*(?:\n|$)/)
  .map((statement) => statement.trim())
  .filter((statement) => statement && !statement.startsWith("--"));

const martin = { user: { email: "marty.hungerford3181@gmail.com", githubLogin: "MartyDaMonster" } };
const ada = { user: { email: "ada@example.com", githubLogin: "ada" } };

async function resetDatabase() {
  const { resetSqlCache, createSql } = await import("../lib/db.js");
  resetSqlCache();
  const admin = new pg.Pool({ connectionString: ADMIN_URL });
  await admin.query(`
    select pg_terminate_backend(pid) from pg_stat_activity
    where datname = 'botomatic_admin' and pid <> pg_backend_pid()
  `);
  await admin.query("drop database if exists botomatic_admin");
  await admin.query("create database botomatic_admin");
  await admin.end();
  const sql = createSql(DATABASE_URL);
  for (const statement of statements) await sql.query(statement);
  await sql.pool.end();
  resetSqlCache();
}

test("admin routes reject anyone who is not on Martin's allowlist", async () => {
  await resetDatabase();
  const store = await import("../lib/admin-store.js");
  const checks = await Promise.all([
    store.listAdminInvites(ada),
    store.createAdminInvite(ada, { workspaceId: "ws-martin", email: "ada@example.com" }),
    store.resendAdminInvite(ada, "inv-missing"),
    store.revokeAdminInvite(ada, "inv-missing"),
    store.listPeople(ada),
    store.setSuspension(ada, { workspaceId: "ws-ada", scope: "workspace" }),
    store.revokeAdminKey(ada, { workspaceId: "ws-ada", keyId: "11111111-1111-1111-1111-111111111111" }),
    store.listAudit(ada)
  ]);
  assert.equal(checks.every((result) => result.status === 404), true);
});

test("suspension blocks the session and the bot key without touching another workspace", async () => {
  await resetDatabase();
  const { getSql } = await import("../lib/db.js");
  const { insertPost } = await import("../lib/posts.js");
  const { botFromAuthorization } = await import("../lib/bot-auth.js");
  const { boardAccess } = await import("../lib/workspace-session.js");
  const { setSuspension, listPeople, revokeAdminKey } = await import("../lib/admin-store.js");
  const sql = getSql();
  await sql`insert into workspaces (id, name, slug) values ('ws-ada', 'Ada', 'ada')`;
  await sql`
    insert into workspace_members (workspace_id, email, github_login, role)
    values ('ws-ada', 'ada@example.com', 'ada', 'owner')
  `;
  await sql`
    insert into bots (slug, name, color, avatar, description, workspace_id)
    values ('claude', 'Claude', '#111', 'square-lime', 'Ada', 'ws-ada'),
           ('dexter', 'Dexter', '#111', 'square-lime', 'Martin', 'ws-martin')
  `;
  const adaToken = "bmk_live_ada_secret_value";
  const martinToken = "btm_martin_secret_value";
  await sql`
    insert into api_keys (id, bot_slug, key_hash, label, workspace_id, key_last4)
    values
      (${newKeyId()}::uuid, 'claude', ${tokenHash(adaToken)}, 'Claude', 'ws-ada', 'alue'),
      (${newKeyId()}::uuid, 'dexter', ${tokenHash(martinToken)}, 'Dexter', 'ws-martin', 'alue')
  `;
  await insertPost({
    id: "ada-private",
    type: "message",
    from: "claude",
    text: "ada private note",
    createdAt: new Date().toISOString(),
    workspaceId: "ws-ada"
  });
  const before = await botFromAuthorization(`Bearer ${adaToken}`);
  assert.equal(before.slug, "claude");
  assert.equal(await boardAccess(ada), "ok");
  const paused = await setSuspension(martin, { workspaceId: "ws-ada", scope: "workspace" });
  assert.equal(paused.ok, true);
  assert.equal(await botFromAuthorization(`Bearer ${adaToken}`), null);
  assert.equal((await botFromAuthorization(`Bearer ${martinToken}`)).slug, "dexter");
  assert.equal(await boardAccess(ada), "paused");
  assert.equal(await boardAccess(martin), "ok");
  const people = await listPeople(martin);
  const adaRow = people.people.find((person) => person.workspaceId === "ws-ada");
  assert.equal(JSON.stringify(adaRow.activity).includes("ada private note"), false);
  assert.equal(adaRow.activity.some((event) => event.kind === "post"), true);
  const keyId = adaRow.keys[0].id;
  await setSuspension(martin, { workspaceId: "ws-ada", scope: "workspace", resume: true });
  assert.equal((await botFromAuthorization(`Bearer ${adaToken}`)).slug, "claude");
  const revoked = await revokeAdminKey(martin, { workspaceId: "ws-ada", keyId });
  assert.equal(revoked.ok, true);
  assert.equal(await botFromAuthorization(`Bearer ${adaToken}`), null);
  const outsider = await revokeAdminKey(ada, { workspaceId: "ws-martin", keyId });
  assert.equal(outsider.status, 404);
});

test("an admin invite opens a new workspace and never joins ws-martin", async () => {
  await resetDatabase();
  const { getSql } = await import("../lib/db.js");
  const { createAdminInvite } = await import("../lib/admin-store.js");
  const { acceptStoredInvite } = await import("../lib/invites.js");
  const { listPosts, listBots } = await import("../lib/posts.js");
  const { projectBySlug } = await import("../lib/projects.js");
  const { readFile } = await import("../lib/files.js");
  const sql = getSql();
  await sql`
    insert into projects (id, name, slug, description, created_by, workspace_id)
    values ('prj-martin', 'Martin Project', 'martin-project', '', 'marty.hungerford3181@gmail.com', 'ws-martin')
  `;
  await sql`
    insert into posts (id, type, from_slug, body, created_at, reactions, author_kind, workspace_id)
    values ('note-martin', 'message', 'dexter', 'martin only', now(), '{}'::jsonb, 'bot', 'ws-martin')
  `;
  await sql`
    insert into comments (id, post_id, workspace_id, author_kind, author_slug, author_name, body, created_at)
    values ('cmt-martin', 'note-martin', 'ws-martin', 'bot', 'dexter', 'Dexter', 'martin comment', now())
  `;
  await sql`
    insert into bots (slug, name, color, avatar, description, workspace_id)
    values ('dexter', 'Dexter', '#111', 'square-lime', 'Martin', 'ws-martin')
  `;
  await sql`
    insert into board_files (
      id, workspace_id, name, extension, content_type, byte_size, storage, body, uploader_kind, uploader_id
    ) values (
      'file_martin', 'ws-martin', 'note.txt', 'txt', 'text/plain', 4, 'neon', convert_to('note', 'utf8'), 'human', 'marty.hungerford3181@gmail.com'
    )
  `;
  const created = await createAdminInvite(martin, {
    workspaceId: "ws-martin",
    name: "New",
    email: "new@example.com",
    githubLogin: "newuser"
  });
  assert.equal(created.ok, true);
  assert.equal(created.invite.workspaceId, "");
  assert.equal(created.invite.ownWorkspace, true);
  const accepted = await acceptStoredInvite("ws-martin", created.invite.id, {
    email: "new@example.com",
    githubLogin: "newuser",
    githubId: "1001"
  });
  assert.equal(accepted.ok, true);
  const workspaceId = accepted.membership.workspaceId;
  assert.notEqual(workspaceId, "ws-martin");
  const memberships = await sql`select workspace_id from workspace_members where lower(email) = 'new@example.com'`;
  assert.deepEqual(memberships.map((row) => row.workspace_id), [workspaceId]);
  assert.equal((await listPosts({ workspaceId })).length, 0);
  assert.equal(await projectBySlug("martin-project", workspaceId), null);
  const comments = await sql`select id from comments where workspace_id = ${workspaceId}`;
  assert.equal(comments.length, 0);
  assert.equal((await listBots(workspaceId)).length, 0);
  const files = await sql`select id from board_files where workspace_id = ${workspaceId}`;
  assert.equal(files.length, 0);
  const hidden = await readFile({ id: "file_martin", workspaceId });
  assert.equal(hidden.status, 404);
  assert.equal((await listPosts({ workspaceId: "ws-martin" })).some((post) => post.id === "note-martin"), true);
  assert.ok(await projectBySlug("martin-project", "ws-martin"));
});

test("the old workspace invite route still opens a new workspace", async () => {
  await resetDatabase();
  const { getSql } = await import("../lib/db.js");
  const { insertInvite, acceptStoredInvite } = await import("../lib/invites.js");
  const sql = getSql();
  await sql`
    insert into posts (id, type, from_slug, body, created_at, reactions, author_kind, workspace_id)
    values ('note-old', 'message', 'dexter', 'stay here', now(), '{}'::jsonb, 'bot', 'ws-martin')
  `;
  const created = await insertInvite({
    id: "inv-old-route",
    workspaceId: "ws-martin",
    email: "route@example.com",
    githubLogin: "route",
    createdBy: "marty.hungerford3181@gmail.com"
  });
  assert.equal(created.ok, true);
  assert.equal(created.invite.workspaceId, "");
  assert.equal(created.invite.ownWorkspace, true);
  const accepted = await acceptStoredInvite("ws-martin", created.invite.id, {
    email: "route@example.com",
    githubLogin: "route",
    githubId: "1002"
  });
  assert.equal(accepted.ok, true);
  assert.notEqual(accepted.membership.workspaceId, "ws-martin");
  const members = await sql`select workspace_id from workspace_members where lower(email) = 'route@example.com'`;
  assert.deepEqual(members.map((row) => row.workspace_id), [accepted.membership.workspaceId]);
  const seen = await sql`select id from posts where workspace_id = ${accepted.membership.workspaceId}`;
  assert.equal(seen.length, 0);
  await sql`
    insert into workspace_invites (id, workspace_id, email, status, created_by, expires_at)
    values ('inv-legacy', 'ws-martin', 'legacy@example.com', 'pending', 'marty.hungerford3181@gmail.com', now() + interval '48 hours')
  `;
  const legacy = await acceptStoredInvite("ws-martin", "inv-legacy", { email: "legacy@example.com", githubId: "1003" });
  assert.equal(legacy.ok, true);
  assert.notEqual(legacy.membership.workspaceId, "ws-martin");
  const legacyMembers = await sql`select workspace_id from workspace_members where lower(email) = 'legacy@example.com'`;
  assert.deepEqual(legacyMembers.map((row) => row.workspace_id), [legacy.membership.workspaceId]);
});
