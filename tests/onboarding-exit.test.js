import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import pg from "pg";

const ADMIN_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic";
const DATABASE_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic_exit";
process.env.SQL_DRIVER = "pg";
process.env.DATABASE_URL = DATABASE_URL;

const statements = readFileSync(new URL("../scripts/migrate.sql", import.meta.url), "utf8")
  .split(/;\s*(?:\n|$)/)
  .map((statement) => statement.trim())
  .filter((statement) => statement && !statement.startsWith("--"));

test("completing or skipping onboarding creates zero bots and goes to add a bot", async () => {
  const { resetSqlCache, createSql, getSql } = await import("../lib/db.js");
  resetSqlCache();
  const admin = new pg.Pool({ connectionString: ADMIN_URL });
  await admin.query(`
    select pg_terminate_backend(pid) from pg_stat_activity
    where datname = 'botomatic_exit' and pid <> pg_backend_pid()
  `);
  await admin.query("drop database if exists botomatic_exit");
  await admin.query("create database botomatic_exit");
  await admin.end();
  const setup = createSql(DATABASE_URL);
  for (const statement of statements) await setup.query(statement);
  await setup.pool.end();
  resetSqlCache();

  const { claimInviteLink } = await import("../lib/invite-claim.js");
  const { completeEducationalOnboarding, ADD_BOT_PATH } = await import("../lib/onboarding-exit.js");
  const sql = getSql();
  await sql`insert into workspaces (id, name, slug) values ('ws-exit', 'Exit Workspace', 'exit-workspace')`;
  await sql`
    insert into workspace_invites (id, workspace_id, email, invitee_name, status, created_by, expires_at, own_workspace)
    values ('inv-exit', 'ws-exit', 'ada@example.com', 'Ada Lovelace', 'pending', 'Martin', now() + interval '48 hours', true)
  `;
  const claimer = { user: { email: "ada@example.com", name: "Ada Lovelace", githubLogin: "ada", githubId: "88021" } };
  const claimed = await claimInviteLink("inv-exit", { githubId: "88021", githubLogin: "ada" });
  assert.equal(claimed.ok, true);
  const workspaceId = claimed.membership.workspaceId;
  const before = await sql`select count(*)::int as n from bots where workspace_id = ${workspaceId}`;
  const finished = await completeEducationalOnboarding("inv-exit", claimer);
  const skipped = await completeEducationalOnboarding("inv-exit", claimer);
  const after = await sql`select count(*)::int as n from bots where workspace_id = ${workspaceId}`;
  assert.equal(before[0].n, 0);
  assert.equal(after[0].n, 0);
  assert.equal(finished.redirectTo, ADD_BOT_PATH);
  assert.equal(skipped.redirectTo, "/admin");
  const intro = readFileSync(new URL("../app/join/actions.js", import.meta.url), "utf8");
  const slides = readFileSync(new URL("../components/Onboarding.js", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../components/AppShell.js", import.meta.url), "utf8");
  assert.match(intro, /completeEducationalOnboarding/);
  assert.match(intro, /ADD_BOT_PATH/);
  assert.match(slides, /name="next" value="\/admin"/);
  assert.match(slides, />Next</);
  assert.match(shell, /Sign out</);
  assert.match(shell, /Sign out of all devices/);
  assert.match(readFileSync(new URL("../app/join/[inviteId]/github/page.js", import.meta.url), "utf8"), /redirect\(ADD_BOT_PATH\)/);
});
