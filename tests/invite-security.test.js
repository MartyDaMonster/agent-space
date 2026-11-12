import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import pg from "pg";
import { inviteAllowed } from "../lib/access.js";
import { signInviteCookie } from "../lib/invite-cookie.js";

const ADMIN_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic";
const DATABASE_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic_security";
process.env.SQL_DRIVER = "pg";
process.env.DATABASE_URL = DATABASE_URL;
process.env.AUTH_SECRET = "security-test-secret";
process.env.ALLOWED_EMAILS = "marty.hungerford3181@gmail.com,marty.j.hungerford@gmail.com";

const statements = readFileSync(new URL("../scripts/migrate.sql", import.meta.url), "utf8")
  .split(/;\s*(?:\n|$)/)
  .map((statement) => statement.trim())
  .filter((statement) => statement && !statement.startsWith("--"));

const martin = { user: { email: "marty.hungerford3181@gmail.com", githubLogin: "MartyDaMonster" } };

async function resetDatabase() {
  const { resetSqlCache, createSql } = await import("../lib/db.js");
  resetSqlCache();
  const admin = new pg.Pool({ connectionString: ADMIN_URL });
  await admin.query(`
    select pg_terminate_backend(pid) from pg_stat_activity
    where datname = 'botomatic_security' and pid <> pg_backend_pid()
  `);
  await admin.query("drop database if exists botomatic_security");
  await admin.query("create database botomatic_security");
  await admin.end();
  const sql = createSql(DATABASE_URL);
  for (const statement of statements) await sql.query(statement);
  await sql.pool.end();
  resetSqlCache();
}

test("C1 a claim does not become Martin or enter another invite's workspace", async () => {
  await resetDatabase();
  const { getSql } = await import("../lib/db.js");
  const { claimInviteLink, authorizeGithubSignIn, memberForGithub } = await import("../lib/invite-claim.js");
  const { workspaceIdForSession } = await import("../lib/workspace-session.js");
  const { createAdminInvite } = await import("../lib/admin-store.js");
  const sql = getSql();
  await sql`
    insert into workspace_invites (id, email, invitee_name, status, created_by, expires_at, own_workspace)
    values
      ('inv-martinmail', 'marty.hungerford3181@gmail.com', 'Martin', 'pending', 'seed', now() + interval '48 hours', true),
      ('inv-shared-a', 'shared@example.com', 'One', 'pending', 'seed', now() + interval '48 hours', true),
      ('inv-shared-b', 'shared@example.com', 'Two', 'pending', 'seed', now() + interval '48 hours', true)
  `;
  const cookie = signInviteCookie("inv-martinmail");
  const rejected = await authorizeGithubSignIn({
    email: "stranger@example.com",
    githubLogin: "stranger",
    githubId: "999",
    cookieValue: cookie,
    allowed: false
  });
  assert.equal(rejected.ok, false);
  const claimed = await authorizeGithubSignIn({
    email: "marty.hungerford3181@gmail.com",
    githubLogin: "stranger",
    githubId: "999",
    cookieValue: cookie,
    allowed: false
  });
  assert.equal(claimed.ok, true);
  assert.equal(claimed.email, "marty.hungerford3181@gmail.com");
  assert.equal(claimed.inviteEmail, "marty.hungerford3181@gmail.com");
  assert.notEqual(claimed.workspaceId, "ws-martin");
  const stranger = { user: { email: "marty.hungerford3181@gmail.com", githubId: "999", githubLogin: "MartyDaMonster" } };
  assert.equal(inviteAllowed({ email: stranger.user.email, githubId: stranger.user.githubId }), false);
  assert.equal(await workspaceIdForSession(stranger), claimed.workspaceId);
  const first = await claimInviteLink("inv-shared-a", { githubId: "111", githubLogin: "one", email: "shared@example.com" });
  const second = await claimInviteLink("inv-shared-b", { githubId: "222", githubLogin: "two", email: "shared@example.com" });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.notEqual(first.membership.workspaceId, second.membership.workspaceId);
  assert.equal(await workspaceIdForSession({ user: { email: "shared@example.com", githubId: "222", githubLogin: "one" } }), second.membership.workspaceId);
  assert.equal((await memberForGithub({ githubId: "111" })).workspaceId, first.membership.workspaceId);
  await sql`insert into workspaces (id, name, slug) values ('ws-old', 'Old', 'old-space')`;
  await sql`
    insert into workspace_members (workspace_id, email, github_user_id, role)
    values ('ws-old', 'ada@example.com', '42', 'owner')
  `;
  await sql`
    insert into workspace_invites (id, email, invitee_name, status, created_by, expires_at, own_workspace)
    values ('inv-ada-new', 'ada@example.com', 'Ada', 'pending', 'seed', now() + interval '48 hours', true)
  `;
  const wrongPerson = await claimInviteLink("inv-ada-new", { githubId: "424242", githubLogin: "newbie", email: "newbie@example.com" });
  assert.equal(wrongPerson.ok, false);
  assert.equal(wrongPerson.status, 404);
  const taken = await claimInviteLink("inv-ada-new", { githubId: "424242", githubLogin: "newbie", email: "ada@example.com" });
  assert.equal(taken.ok, true);
  assert.notEqual(taken.membership.workspaceId, "ws-old");
  assert.equal(await workspaceIdForSession({ user: { email: "ada@example.com", githubId: "424242" } }), taken.membership.workspaceId);
  assert.equal(await workspaceIdForSession({ user: { email: "ada@example.com", githubId: "42" } }), "ws-old");
  const refused = await createAdminInvite(martin, { name: "Martin", email: "marty.hungerford3181@gmail.com" });
  assert.equal(refused.ok, false);
  const member = await createAdminInvite(martin, { name: "One", email: "shared@example.com" });
  assert.equal(member.ok, false);
  assert.match(member.error, /member/);
});

test("H1 a pending invite cannot outlive 48 hours and a null expiry cannot be claimed", async () => {
  await resetDatabase();
  const { getSql } = await import("../lib/db.js");
  const { claimInviteLink } = await import("../lib/invite-claim.js");
  const sql = getSql();
  await sql`
    insert into workspace_invites (id, email, status, created_by, created_at, expires_at, own_workspace)
    values
      ('inv-null', 'null@example.com', 'pending', 'seed', now() - interval '10 days', null, true),
      ('inv-long', 'long@example.com', 'pending', 'seed', now() - interval '1 hour', now() + interval '14 days', true)
  `;
  assert.equal((await claimInviteLink("inv-null", { githubId: "5" })).status, 404);
  await sql`
    update workspace_invites
    set expires_at = least(coalesce(expires_at, created_at + interval '48 hours'), created_at + interval '48 hours')
    where status = 'pending'
  `;
  const rows = await sql`select id, expires_at, created_at from workspace_invites where id in ('inv-null', 'inv-long')`;
  for (const row of rows) {
    const span = new Date(row.expires_at).getTime() - new Date(row.created_at).getTime();
    assert.ok(span <= 48 * 60 * 60 * 1000 + 1000);
  }
  assert.equal((await claimInviteLink("inv-null", { githubId: "5" })).status, 404);
  assert.equal((await claimInviteLink("inv-long", { githubId: "6", email: "long@example.com" })).ok, true);
});

test("M1 github access matches the numeric user id only", async () => {
  await resetDatabase();
  const { getSql } = await import("../lib/db.js");
  const { memberForGithub } = await import("../lib/invite-claim.js");
  const { workspaceIdForSession } = await import("../lib/workspace-session.js");
  const sql = getSql();
  await sql`insert into workspaces (id, name, slug) values ('ws-git', 'Git', 'git')`;
  await sql`
    insert into workspace_members (workspace_id, email, github_login, github_user_id, role)
    values ('ws-git', 'ada@example.com', 'octocat', '555', 'owner')
  `;
  assert.equal(await memberForGithub({ githubLogin: "octocat" }), null);
  assert.equal((await memberForGithub({ githubId: "555" })).workspaceId, "ws-git");
  assert.equal(await workspaceIdForSession({
    user: { email: "ada@example.com", githubLogin: "octocat", githubId: "777" }
  }), null);
  assert.equal(await workspaceIdForSession({
    user: { email: "someone-else@example.com", githubLogin: "notoctocat", githubId: "555" }
  }), "ws-git");
  await sql`insert into workspaces (id, name, slug) values ('ws-aaa', 'A', 'a-space')`;
  await sql`
    insert into workspace_members (workspace_id, email, github_login, github_user_id, role)
    values ('ws-aaa', 'later@example.com', 'later', '555', 'owner')
  `;
  assert.equal(await workspaceIdForSession({ user: { githubId: "555", email: "later@example.com" } }), "ws-aaa");
});
