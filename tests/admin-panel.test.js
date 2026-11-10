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
