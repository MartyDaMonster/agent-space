import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import pg from "pg";
import { inviteIdFromReturnPath } from "../lib/invite-claim.js";
import { readInviteCookie, signInviteCookie } from "../lib/invite-cookie.js";

const ADMIN_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic";
const DATABASE_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic_claim";
process.env.SQL_DRIVER = "pg";
process.env.DATABASE_URL = DATABASE_URL;
process.env.AUTH_SECRET = "claim-test-secret";
process.env.ALLOWED_EMAILS = "marty.hungerford3181@gmail.com,marty.j.hungerford@gmail.com";

const statements = readFileSync(new URL("../scripts/migrate.sql", import.meta.url), "utf8")
  .split(/;\s*(?:\n|$)/)
  .map((statement) => statement.trim())
  .filter((statement) => statement && !statement.startsWith("--"));

async function resetDatabase() {
  const { resetSqlCache, createSql } = await import("../lib/db.js");
  resetSqlCache();
  const admin = new pg.Pool({ connectionString: ADMIN_URL });
  await admin.query(`
    select pg_terminate_backend(pid) from pg_stat_activity
    where datname = 'botomatic_claim' and pid <> pg_backend_pid()
  `);
  await admin.query("drop database if exists botomatic_claim");
  await admin.query("create database botomatic_claim");
  await admin.end();
  const sql = createSql(DATABASE_URL);
  for (const statement of statements) await sql.query(statement);
  await sql.pool.end();
  resetSqlCache();
}

test("a signed invite cookie cannot be swapped for another id", () => {
  const token = signInviteCookie("inv-ada", "claim-test-secret");
  assert.equal(readInviteCookie(token, "claim-test-secret"), "inv-ada");
  assert.equal(readInviteCookie(token), "");
  const swapped = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
  assert.equal(readInviteCookie(swapped, "claim-test-secret"), "");
  assert.equal(readInviteCookie("", "claim-test-secret"), "");
  assert.equal(inviteIdFromReturnPath("https://botomatic.dev/join/inv-ada/github"), "inv-ada");
  assert.equal(inviteIdFromReturnPath("/join/inv-ada/github?repo=waiting"), "inv-ada");
  assert.equal(inviteIdFromReturnPath("/login"), "");
  assert.equal(inviteIdFromReturnPath("/join/preview/github"), "");
});

test("only the invited email or GitHub login can claim a link, and expired or revoked links do not", async () => {
  await resetDatabase();
  const { getSql } = await import("../lib/db.js");
  const { claimInviteLink, authorizeGithubSignIn } = await import("../lib/invite-claim.js");
  const sql = getSql();
  await sql`
    insert into workspace_invites (id, email, invitee_name, status, created_by, expires_at, own_workspace)
    values ('inv-ada', 'ada@example.com', 'Ada', 'pending', 'martin', now() + interval '48 hours', true)
  `;
  await sql`
    insert into workspace_invites (id, email, status, created_by, expires_at, own_workspace)
    values ('inv-old', 'old@example.com', 'pending', 'martin', now() - interval '1 hour', true)
  `;
  await sql`
    insert into workspace_invites (id, email, status, created_by, revoked_at, own_workspace)
    values ('inv-stop', 'stop@example.com', 'revoked', 'martin', now(), true)
  `;
  const cookie = signInviteCookie("inv-ada");
  const stranger = await authorizeGithubSignIn({
    email: "octocat@users.noreply.github.com",
    githubLogin: "octocat",
    githubId: "4242",
    cookieValue: cookie,
    allowed: false
  });
  assert.equal(stranger.ok, false);
  const stillPending = await sql`select status, github_user_id from workspace_invites where id = 'inv-ada'`;
  assert.equal(stillPending[0].status, "pending");
  assert.equal(stillPending[0].github_user_id, null);
  const claimed = await authorizeGithubSignIn({
    email: "Ada@Example.com",
    githubLogin: "octocat",
    githubId: "4242",
    cookieValue: cookie,
    allowed: false
  });
  assert.equal(claimed.ok, true);
  assert.equal(claimed.created, true);
  assert.equal(claimed.email, "Ada@Example.com");
  assert.equal(claimed.inviteEmail, "ada@example.com");
  assert.notEqual(claimed.workspaceId, "ws-martin");
  const member = await sql`
    select email, github_login, github_user_id, role, workspace_id
    from workspace_members where github_user_id = '4242'
  `;
  assert.equal(member.length, 1);
  assert.equal(member[0].email, "ada@example.com");
  assert.equal(member[0].github_login, "octocat");
  assert.equal(member[0].role, "owner");
  const human = await sql`
    select email, github_login, github_user_id from humans where github_user_id = '4242'
  `;
  assert.equal(human[0].email, "ada@example.com");
  assert.equal(human[0].github_login, "octocat");
  const invite = await sql`select status, github_user_id from workspace_invites where id = 'inv-ada'`;
  assert.equal(invite[0].status, "accepted");
  assert.equal(invite[0].github_user_id, "4242");

  const again = await claimInviteLink("inv-ada", { githubId: "7777", githubLogin: "eve" });
  assert.equal(again.ok, false);
  assert.equal(again.status, 409);
  const outsiders = await sql`select email from workspace_members where github_user_id = '7777'`;
  assert.equal(outsiders.length, 0);
  const retry = await authorizeGithubSignIn({
    email: "Ada@Example.com",
    githubLogin: "octocat",
    githubId: "4242",
    cookieValue: cookie,
    allowed: false
  });
  assert.equal(retry.ok, true);
  assert.equal(retry.created, false);
  assert.equal(retry.email, "Ada@Example.com");
  assert.equal(retry.inviteEmail, "ada@example.com");

  const expired = await claimInviteLink("inv-old", { githubId: "8", githubLogin: "old" });
  assert.equal(expired.ok, false);
  assert.equal(expired.status, 404);
  const revoked = await claimInviteLink("inv-stop", { githubId: "9", githubLogin: "stop" });
  assert.equal(revoked.ok, false);
  assert.equal(revoked.status, 404);
  await sql`
    insert into workspace_invites (id, email, invitee_name, status, created_by, expires_at, own_workspace)
    values ('inv-path', 'path@example.com', 'Path', 'pending', 'martin', now() + interval '48 hours', true)
  `;
  const fromReturn = await authorizeGithubSignIn({
    email: "path@example.com",
    githubLogin: "sabrinato",
    githubId: "88001",
    cookieValue: "",
    returnPath: "https://botomatic.dev/join/inv-path/github",
    allowed: false
  });
  assert.equal(fromReturn.ok, true);
  assert.equal(fromReturn.created, true);
  assert.notEqual(fromReturn.workspaceId, "ws-martin");
  const pathMember = await sql`select role from workspace_members where github_user_id = '88001'`;
  assert.equal(pathMember[0].role, "owner");

  const bare = await authorizeGithubSignIn({
    email: "stranger@example.com",
    githubLogin: "stranger",
    githubId: "000",
    cookieValue: "",
    allowed: false
  });
  assert.equal(bare.ok, false);
  const martin = await authorizeGithubSignIn({
    email: "marty.hungerford3181@gmail.com",
    githubLogin: "MartyDaMonster",
    githubId: "1",
    cookieValue: signInviteCookie("inv-old", "claim-test-secret"),
    allowed: true
  });
  assert.equal(martin.ok, true);
  assert.equal(martin.created, false);
  const untouched = await sql`select status from workspace_invites where id = 'inv-old'`;
  assert.equal(untouched[0].status, "pending");
});
