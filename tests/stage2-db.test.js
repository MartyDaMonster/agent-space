import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import pg from "pg";
import { tokenHash } from "../lib/keys.js";

const ADMIN_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic";
const DATABASE_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic_stage2";
process.env.SQL_DRIVER = "pg";
process.env.DATABASE_URL = DATABASE_URL;

const statements = readFileSync(new URL("../scripts/migrate.sql", import.meta.url), "utf8")
  .split(/;\s*(?:\n|$)/)
  .map((statement) => statement.trim())
  .filter((statement) => statement && !statement.startsWith("--"));

const ada = { user: { email: "ada@example.com", name: "Ada", githubLogin: "ada" } };
const eve = { user: { email: "eve@example.com", name: "Eve", githubLogin: "eve" } };

async function resetDatabase() {
  const { resetSqlCache, createSql } = await import("../lib/db.js");
  resetSqlCache();
  const admin = new pg.Pool({ connectionString: ADMIN_URL });
  await admin.query(`
    select pg_terminate_backend(pid) from pg_stat_activity
    where datname = 'botomatic_stage2' and pid <> pg_backend_pid()
  `);
  await admin.query("drop database if exists botomatic_stage2");
  await admin.query("create database botomatic_stage2");
  await admin.end();
  const sql = createSql(DATABASE_URL);
  for (const statement of statements) await sql.query(statement);
  await sql.pool.end();
  resetSqlCache();
}

test("invite, onboarding, and bot routes stay inside one workspace", async () => {
  await resetDatabase();
  const { getSql } = await import("../lib/db.js");
  const { listPosts } = await import("../lib/posts.js");
  const {
    saveAssistantChoice,
    bindDraftToSession,
    ensureBots,
    botsForDraft,
    regenerateBotKey,
    finishOnboardingDraft,
    inviteCard
  } = await import("../lib/stage2-store.js");
  const sql = getSql();
  await sql`insert into workspaces (id, name, slug) values ('ws-ada', 'Example Workspace', 'example-workspace')`;
  await sql`
    insert into workspace_members (workspace_id, email, role)
    values ('ws-ada', 'owner@example.com', 'owner')
  `;
  await sql`
    insert into posts (id, type, from_slug, body, created_at, workspace_id)
    values ('martin-secret', 'message', 'human', 'martin only', now(), 'ws-martin')
  `;
  await sql`
    insert into workspace_invites (id, workspace_id, email, status, created_by, expires_at)
    values ('inv-ada', 'ws-ada', 'ada@example.com', 'pending', 'Alex Example', now() + interval '48 hours')
  `;
  await sql`
    insert into workspace_invites (id, workspace_id, email, status, created_by, expires_at)
    values ('inv-eve', 'ws-martin', 'eve@example.com', 'pending', 'Martin', now() + interval '48 hours')
  `;

  const card = await inviteCard("inv-ada");
  assert.equal(card.workspaceName, "Example Workspace");
  assert.equal(card.workspaceId, "ws-ada");
  const saved = await saveAssistantChoice("inv-ada", ["claude", "grok"]);
  assert.equal(saved.ok, true);
  const { claimInviteLink } = await import("../lib/invite-claim.js");
  const claimer = { user: { email: "ada@example.com", name: "Ada", githubLogin: "octocat", githubId: "42" } };
  const claimed = await claimInviteLink("inv-ada", { githubId: "42", githubLogin: "octocat", email: "ada@example.com" });
  assert.equal(claimed.ok, true);
  assert.equal(claimed.email, "ada@example.com");
  const wrong = await bindDraftToSession("inv-ada", eve);
  assert.equal(wrong.status, 404);
  const byLogin = await bindDraftToSession("inv-ada", { user: { githubLogin: "Octocat", email: "other@example.com" } });
  assert.equal(byLogin.ok, true);
  const bound = await bindDraftToSession("inv-ada", claimer);
  assert.equal(bound.ok, true);

  const created = await ensureBots("inv-ada", claimer);
  assert.equal(created.ok, true);
  const { sessionInvited } = await import("../lib/access.js");
  const { workspaceActor } = await import("../lib/workspace-session.js");
  assert.equal(sessionInvited(claimer), false);
  const writer = await workspaceActor(claimer);
  assert.ok(writer);
  assert.equal(writer.role, "owner");
  assert.equal(writer.workspaceId, created.workspaceId);
  assert.notEqual(writer.workspaceId, "ws-martin");
  const stranger = await workspaceActor({ user: { email: "eve@example.com", githubLogin: "eve", githubId: "99" } });
  assert.equal(stranger, null);
  const martin = await workspaceActor({ user: { email: "marty.hungerford3181@gmail.com", githubId: "150204025", githubLogin: "MartyDaMonster" } });
  assert.equal(martin.workspaceId, "ws-martin");
  assert.equal(martin.role, "owner");
  assert.notEqual(created.workspaceId, "ws-martin");
  assert.equal(created.revealed.length, 2);
  assert.equal(created.revealed.some((item) => item.token.includes(" ")), false);
  const stored = await sql`
    select key_hash, key_last4 from api_keys where workspace_id = ${created.workspaceId}
  `;
  assert.equal(stored.some((row) => row.key_hash === created.revealed[0].token), false);
  assert.equal(stored.some((row) => row.key_hash === tokenHash(created.revealed[0].token)), true);

  const eveBots = await botsForDraft("inv-ada", eve);
  assert.equal(eveBots.status, 404);
  const eveKey = await regenerateBotKey("inv-ada", eve, "claude");
  assert.equal(eveKey.status, 404);
  const adaPosts = await listPosts({ workspaceId: created.workspaceId });
  const martinPosts = await listPosts({ workspaceId: "ws-martin" });
  assert.equal(adaPosts.length, 0);
  assert.equal(martinPosts[0].text, "martin only");
  const member = await sql`
    select workspace_id from workspace_members where lower(email) = 'ada@example.com'
  `;
  assert.deepEqual(member.map((row) => row.workspace_id), [created.workspaceId]);

  await sql`
    update api_keys set last_seen_at = now()
    where workspace_id = ${created.workspaceId}
  `;
  await sql`update workspace_members set suspended_at = now() where lower(email) = 'ada@example.com'`;
  const { botFromAuthorization } = await import("../lib/bot-auth.js");
  const stillLive = await botFromAuthorization(`Bearer ${created.revealed[0].token}`);
  assert.equal(stillLive.slug, created.revealed[0].slug);
  const pausedKey = await regenerateBotKey("inv-ada", claimer, "claude");
  assert.equal(pausedKey.ok, false);
  assert.equal(pausedKey.status, 403);
  assert.equal(pausedKey.error, "This account is paused.");
  const pausedFinish = await finishOnboardingDraft("inv-ada", claimer);
  assert.equal(pausedFinish.ok, false);
  await sql`update workspace_members set suspended_at = null where lower(email) = 'ada@example.com'`;
  const done = await finishOnboardingDraft("inv-ada", claimer);
  assert.equal(done.ok, true);
  assert.equal(done.workspaceId, created.workspaceId);
  assert.equal(done.sourceWorkspaceId, "ws-ada");
  const eveFinish = await finishOnboardingDraft("inv-ada", eve);
  assert.equal(eveFinish.status, 404);
  const missing = await inviteCard("inv-nope");
  assert.equal(missing, null);
});

test("an invitee reaches a new workspace without the GitHub App", async () => {
  await resetDatabase();
  for (const key of ["GITHUB_APP_ID", "GITHUB_APP_SLUG", "GITHUB_APP_CLIENT_ID", "GITHUB_APP_CLIENT_SECRET", "GITHUB_APP_PRIVATE_KEY"]) {
    delete process.env[key];
  }
  const { githubAppConfigured } = await import("../lib/stage2.js");
  assert.equal(githubAppConfigured(), false);
  const martin = { user: { email: "marty.hungerford3181@gmail.com", githubLogin: "MartyDaMonster", authAt: Math.floor(Date.now() / 1000) } };
  const { createAdminInvite } = await import("../lib/admin-store.js");
  const { getSql } = await import("../lib/db.js");
  const {
    saveAssistantChoice,
    bindDraftToSession,
    saveWorkspaceStep,
    ensureBots,
    finishOnboardingDraft
  } = await import("../lib/stage2-store.js");
  const { claimInviteLink } = await import("../lib/invite-claim.js");
  const created = await createAdminInvite(martin, {
    name: "Ada",
    email: "ada@example.com"
  });
  assert.equal(created.ok, true);
  const claimer = { user: { email: "ada@example.com", name: "Ada", githubLogin: "octocat", githubId: "99" } };
  assert.equal((await saveAssistantChoice(created.invite.id, ["claude", "grok"])).ok, true);
  const claimed = await claimInviteLink(created.invite.id, {
    githubId: "99",
    githubLogin: "octocat",
    email: "ada@example.com"
  });
  assert.equal(claimed.ok, true);
  assert.equal(claimed.email, "ada@example.com");
  assert.equal(claimed.membership.githubLogin, "octocat");
  assert.equal((await bindDraftToSession(created.invite.id, claimer)).ok, true);
  const sql = getSql();
  const named = await sql`select name, slug from workspaces where id = ${claimed.membership.workspaceId}`;
  assert.equal(named[0].name, "Ada's workspace");
  assert.equal(named[0].slug, "ada-s-workspace");
  const unnamed = await saveWorkspaceStep(created.invite.id, claimer, { shape: "cloud", color: "pink" });
  assert.equal(unnamed.ok, true);
  assert.equal(unnamed.draft.workspaceName, "Ada's workspace");
  assert.equal((await saveWorkspaceStep(created.invite.id, claimer, {
    name: "Ada space",
    shape: "square",
    color: "lime"
  })).ok, true);
  const bots = await ensureBots(created.invite.id, claimer);
  assert.equal(bots.ok, true);
  assert.notEqual(bots.workspaceId, "ws-martin");
  const early = await finishOnboardingDraft(created.invite.id, claimer);
  assert.equal(early.ok, false);
  await sql`update api_keys set last_seen_at = now() where workspace_id = ${bots.workspaceId}`;
  const done = await finishOnboardingDraft(created.invite.id, claimer);
  assert.equal(done.ok, true);
  assert.equal(done.workspaceId, bots.workspaceId);
  const members = await sql`select workspace_id from workspace_members where lower(email) = 'ada@example.com'`;
  assert.deepEqual(members.map((row) => row.workspace_id), [bots.workspaceId]);
  const posts = await sql`select id from posts where workspace_id = ${bots.workspaceId}`;
  assert.equal(posts.length, 0);
});
