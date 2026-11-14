import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import pg from "pg";
import { encode } from "next-auth/jwt";
import { tokenHash } from "../lib/keys.js";
import { acceptStoredInvite, revokeStoredInvite } from "../lib/invites.js";
import { acceptInvite } from "../lib/workspace.js";
import { createSql, getSql, resetSqlCache } from "../lib/db.js";

const ADMIN_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic";
const DATABASE_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic_isolation";
const AUTH_SECRET = "isolation-test-secret";
process.env.SQL_DRIVER = "pg";
process.env.DATABASE_URL = DATABASE_URL;
process.env.AUTH_SECRET = AUTH_SECRET;
process.env.ALLOWED_EMAILS = "marty.hungerford3181@gmail.com,marty.j.hungerford@gmail.com,ada@example.com,eve@example.com";

const statements = readFileSync(new URL("../scripts/migrate.sql", import.meta.url), "utf8")
  .split(/;\s*(?:\n|$)/)
  .map((statement) => statement.trim())
  .filter((statement) => statement && !statement.startsWith("--"));

async function recreateDatabase() {
  resetSqlCache();
  const admin = new pg.Pool({ connectionString: ADMIN_URL });
  await admin.query(`
    select pg_terminate_backend(pid) from pg_stat_activity
    where datname = 'botomatic_isolation' and pid <> pg_backend_pid()
  `);
  await admin.query("drop database if exists botomatic_isolation");
  await admin.query("create database botomatic_isolation");
  await admin.end();
}

async function applyMigration() {
  const sql = createSql(DATABASE_URL);
  for (const statement of statements) await sql.query(statement);
  await sql.pool.end();
  resetSqlCache();
}

async function sessionCookie(email, name) {
  const token = await encode({
    token: { name, email, sub: email },
    secret: AUTH_SECRET,
    salt: "authjs.session-token"
  });
  return `authjs.session-token=${token}`;
}

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3111"], {
      env: { ...process.env, SQL_DRIVER: "pg", DATABASE_URL, AUTH_SECRET, AUTH_TRUST_HOST: "true" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let log = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Next did not start.\n${log}`));
    }, 60000);
    const onData = (chunk) => {
      log += chunk.toString();
      if (log.includes("Ready")) {
        clearTimeout(timer);
        resolve(child);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) => {
      if (code && code !== 0 && !log.includes("Ready")) {
        clearTimeout(timer);
        reject(new Error(`Next exited ${code}.\n${log}`));
      }
    });
  });
}

test("a migration rerun does not make another tenant an owner of Martin's workspace", async () => {
  await recreateDatabase();
  await applyMigration();
  const sql = getSql();
  await sql`
    insert into workspaces (id, name, slug) values ('ws-ada', 'Ada', 'ada')
  `;
  await sql`
    insert into humans (email, name, workspace_id) values ('ada@example.com', 'Ada', 'ws-ada')
  `;
  await sql`
    insert into workspace_members (workspace_id, email, role) values ('ws-ada', 'ada@example.com', 'member')
  `;
  await applyMigration();
  const afterRerun = getSql();
  const added = await afterRerun`
    select role from workspace_members
    where workspace_id = 'ws-martin' and lower(email) = 'ada@example.com'
  `;
  assert.equal(added.length, 0);
  await afterRerun`
    insert into workspace_members (workspace_id, email, role)
    values ('ws-martin', 'ada@example.com', 'owner')
  `;
  await afterRerun`
    insert into humans (email, name) values ('guest@example.com', 'Guest')
  `;
  await applyMigration();
  const cleanedSql = getSql();
  const cleaned = await cleanedSql`
    select role from workspace_members
    where workspace_id = 'ws-martin' and lower(email) = 'ada@example.com'
  `;
  const adaHome = await cleanedSql`
    select role from workspace_members
    where workspace_id = 'ws-ada' and lower(email) = 'ada@example.com'
  `;
  const martin = await cleanedSql`
    select role from workspace_members
    where workspace_id = 'ws-martin' and lower(email) = 'marty.hungerford3181@gmail.com'
  `;
  const guest = await cleanedSql`
    select workspace_id from humans where lower(email) = 'guest@example.com'
  `;
  const guestMember = await cleanedSql`
    select role from workspace_members where lower(email) = 'guest@example.com'
  `;
  assert.equal(cleaned.length, 0);
  assert.equal(adaHome[0].role, "member");
  assert.equal(martin[0].role, "owner");
  assert.equal(guest[0].workspace_id, null);
  assert.equal(guestMember.length, 0);
});

test("accepting an invite is atomic and does not survive a revoke", async () => {
  await recreateDatabase();
  await applyMigration();
  const sql = getSql();
  await sql`insert into workspaces (id, name, slug) values ('ws-ada', 'Ada', 'ada')`;
  await sql`
    insert into workspace_invites (id, workspace_id, email, status, created_by, expires_at)
    values ('inv-race', 'ws-ada', 'race@example.com', 'pending', 'owner', now() + interval '48 hours')
  `;
  const locker = await sql.pool.connect();
  await locker.query("begin");
  await locker.query("select id from workspace_invites where id = 'inv-race' for update");
  const pending = acceptStoredInvite("ws-ada", "inv-race", { email: "race@example.com", githubId: "4242" });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const waiting = await sql`
      select pid from pg_stat_activity
      where wait_event_type = 'Lock' and pid <> pg_backend_pid()
    `;
    if (waiting.length) break;
    if (attempt === 49) throw new Error("The accept did not wait on the invite row.");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  await locker.query("update workspace_invites set status = 'revoked', revoked_at = now() where id = 'inv-race'");
  await locker.query("commit");
  locker.release();
  const result = await pending;
  const members = await sql`
    select email from workspace_members where lower(email) = 'race@example.com'
  `;
  const invite = await sql`select status from workspace_invites where id = 'inv-race'`;
  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
  assert.equal(result.invite, undefined);
  assert.equal(members.length, 0);
  assert.equal(invite[0].status, "revoked");
});

test("a second accept does not duplicate membership, and the wrong person learns nothing", async () => {
  await recreateDatabase();
  await applyMigration();
  const sql = getSql();
  await sql`insert into workspaces (id, name, slug) values ('ws-ada', 'Ada', 'ada')`;
  await sql`
    insert into workspace_invites (id, workspace_id, email, github_login, status, created_by, expires_at)
    values ('inv-ada', 'ws-ada', 'ada@example.com', 'ada', 'pending', 'owner', now() + interval '48 hours')
  `;
  const [first, second] = await Promise.all([
    acceptStoredInvite("ws-ada", "inv-ada", { email: "ada@example.com", githubId: "1", githubLogin: "ada" }),
    acceptStoredInvite("ws-ada", "inv-ada", { email: "ada@example.com", githubId: "1", githubLogin: "ada" })
  ]);
  const wins = [first, second].filter((result) => result.ok);
  assert.equal(wins.length, 1);
  const members = await sql`
    select workspace_id, role from workspace_members
    where lower(email) = 'ada@example.com'
  `;
  assert.equal(members.length, 1);
  assert.equal(members[0].role, "owner");
  assert.notEqual(members[0].workspace_id, "ws-ada");
  assert.notEqual(members[0].workspace_id, "ws-martin");
  const eve = await acceptStoredInvite("ws-ada", "inv-ada", { email: "eve@example.com", githubLogin: "eve", githubId: "2" });
  assert.equal(eve.ok, false);
  assert.equal(eve.status, 409);
  assert.equal(JSON.stringify(eve).includes("ada@example.com"), false);
  const replay = acceptInvite({
    id: "inv-ada",
    workspaceId: "ws-ada",
    email: "ada@example.com",
    githubLogin: "ada",
    status: "accepted",
    createdBy: "owner"
  }, { email: "eve@example.com", githubLogin: "eve" });
  assert.equal(replay.ok, false);
  assert.equal(JSON.stringify(replay).includes("ada@example.com"), false);
});

test("a revoke that loses the race does not report the invite revoked", async () => {
  await recreateDatabase();
  await applyMigration();
  const sql = getSql();
  await sql`insert into workspaces (id, name, slug) values ('ws-ada', 'Ada', 'ada')`;
  await sql`
    insert into workspace_invites (id, workspace_id, email, status, created_by, expires_at)
    values ('inv-revoke', 'ws-ada', 'ada@example.com', 'pending', 'owner', now() + interval '48 hours')
  `;
  const locker = await sql.pool.connect();
  await locker.query("begin");
  await locker.query("select id from workspace_invites where id = 'inv-revoke' for update");
  const pending = revokeStoredInvite("ws-ada", "inv-revoke");
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const waiting = await sql`
      select pid from pg_stat_activity
      where wait_event_type = 'Lock' and pid <> pg_backend_pid()
    `;
    if (waiting.length) break;
    if (attempt === 49) throw new Error("The revoke did not wait on the invite row.");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  await locker.query("update workspace_invites set status = 'accepted', accepted_at = now() where id = 'inv-revoke'");
  await locker.query("commit");
  locker.release();
  const result = await pending;
  const invite = await sql`select status from workspace_invites where id = 'inv-revoke'`;
  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.equal(invite[0].status, "accepted");
});

test("routes cannot read, rename, comment, or notify across workspaces", async () => {
  await recreateDatabase();
  await applyMigration();
  const sql = getSql();
  const martinHash = tokenHash("btm_martin_test");
  const adaHash = tokenHash("btm_ada_test");
  await sql`insert into workspaces (id, name, slug) values ('ws-ada', 'Ada', 'ada')`;
  await sql`
    insert into humans (email, name, workspace_id) values
      ('ada@example.com', 'Ada', 'ws-ada'),
      ('marty.hungerford3181@gmail.com', 'Martin', 'ws-martin')
    on conflict (workspace_id, email) do update set name = excluded.name
  `;
  await sql`
    insert into workspace_members (workspace_id, email, role) values ('ws-ada', 'ada@example.com', 'member')
    on conflict do nothing
  `;
  await sql`
    insert into bots (slug, name, color, avatar, description, workspace_id) values
      ('martinbot', 'Martin Bot', '#111111', 'square-lime', 'Martin', 'ws-martin'),
      ('adabot', 'Ada Bot', '#222222', 'cloud-pink', 'Ada', 'ws-ada')
  `;
  await sql`
    insert into api_keys (id, bot_slug, key_hash, label, workspace_id) values
      ('11111111-1111-4111-8111-111111111111', 'martinbot', ${martinHash}, 'Martin', 'ws-martin'),
      ('22222222-2222-4222-8222-222222222222', 'adabot', ${adaHash}, 'Ada', 'ws-ada')
  `;
  await sql`
    insert into projects (id, name, slug, description, created_by, workspace_id)
    values ('prj-martin', 'Martin Project', 'martin-project', '', 'marty.hungerford3181@gmail.com', 'ws-martin'),
      ('prj-ada', 'Ada Project', 'ada-project', '', 'ada@example.com', 'ws-ada')
  `;
  await sql`
    insert into posts (
      id, type, from_slug, body, created_at, reactions, author_kind, workspace_id
    ) values (
      'note-martin-secret', 'message', 'martinbot', 'martin secret note', now(), '{}'::jsonb, 'bot', 'ws-martin'
    )
  `;
  const server = await startServer();
  try {
    const adaAuth = { authorization: "Bearer btm_ada_test" };
    const posts = await fetch("http://127.0.0.1:3111/api/posts", { headers: adaAuth });
    const postBody = await posts.json();
    assert.equal(posts.status, 200);
    assert.equal(JSON.stringify(postBody).includes("note-martin-secret"), false);
    assert.equal(JSON.stringify(postBody).includes("martin secret"), false);
    const bots = await fetch("http://127.0.0.1:3111/api/bots", { headers: adaAuth });
    const botBody = await bots.json();
    assert.equal(bots.status, 200);
    assert.deepEqual(botBody.bots.map((bot) => bot.slug), ["adabot"]);
    const comment = await fetch("http://127.0.0.1:3111/api/posts/note-martin-secret/comments", {
      method: "POST",
      headers: { ...adaAuth, "content-type": "application/json" },
      body: JSON.stringify({ text: "hello from the other workspace" })
    });
    assert.equal(comment.status, 404);
    const rename = await fetch("http://127.0.0.1:3111/api/projects/martin-project", {
      method: "PATCH",
      headers: { ...adaAuth, "content-type": "application/json" },
      body: JSON.stringify({ name: "Stolen" })
    });
    assert.equal(rename.status, 404);
    const renamed = await sql`select name from projects where id = 'prj-martin'`;
    assert.equal(renamed[0].name, "Martin Project");
    const adaCookieEarly = await sessionCookie("ada@example.com", "Ada");
    const martinCookieEarly = await sessionCookie("marty.hungerford3181@gmail.com", "Martin");
    const eveCookieEarly = await sessionCookie("eve@example.com", "Eve");
    const adaRenamesMartin = await fetch("http://127.0.0.1:3111/api/projects/martin-project", {
      method: "PATCH",
      headers: { cookie: adaCookieEarly, "content-type": "application/json" },
      body: JSON.stringify({ name: "Stolen by Ada" })
    });
    assert.equal(adaRenamesMartin.status, 404);
    const martinRenamesAda = await fetch("http://127.0.0.1:3111/api/projects/ada-project", {
      method: "PATCH",
      headers: { cookie: martinCookieEarly, "content-type": "application/json" },
      body: JSON.stringify({ name: "Stolen by Martin" })
    });
    assert.equal(martinRenamesAda.status, 404);
    const eveRenames = await fetch("http://127.0.0.1:3111/api/projects/martin-project", {
      method: "PATCH",
      headers: { cookie: eveCookieEarly, "content-type": "application/json" },
      body: JSON.stringify({ name: "Stolen by Eve" })
    });
    assert.equal(eveRenames.status, 401);
    const adaRenamesOwn = await fetch("http://127.0.0.1:3111/api/projects/ada-project", {
      method: "PATCH",
      headers: { cookie: adaCookieEarly, "content-type": "application/json" },
      body: JSON.stringify({ name: "Ada Named" })
    });
    assert.equal(adaRenamesOwn.status, 200);
    const names = await sql`select id, name from projects order by id`;
    assert.deepEqual(names, [
      { id: "prj-ada", name: "Ada Named" },
      { id: "prj-martin", name: "Martin Project" }
    ]);
    const note = await fetch("http://127.0.0.1:3111/api/posts", {
      method: "POST",
      headers: { ...adaAuth, "content-type": "application/json" },
      body: JSON.stringify({ id: "note-ada-everyone", type: "message", text: "@everyone @martinbot" })
    });
    const noteBody = await note.json();
    assert.equal(note.status, 201, JSON.stringify(noteBody));
    const mentions = await sql`
      select slug from post_mentions where post_id = 'note-ada-everyone' order by slug
    `;
    assert.deepEqual(mentions.map((row) => row.slug), ["ada"]);
    const martinCookie = await sessionCookie("marty.hungerford3181@gmail.com", "Martin");
    const created = await fetch("http://127.0.0.1:3111/api/workspaces/ws-ada/invites", {
      method: "POST",
      headers: { cookie: martinCookie, "content-type": "application/json" },
      body: JSON.stringify({ email: "ada@example.com" })
    });
    assert.equal(created.status, 404);
    const ownerCreated = await fetch("http://127.0.0.1:3111/api/workspaces/ws-martin/invites", {
      method: "POST",
      headers: { cookie: martinCookie, "content-type": "application/json" },
      body: JSON.stringify({ email: "ada@example.com" })
    });
    const ownerText = await ownerCreated.text();
    assert.equal(ownerCreated.status, 404);
    assert.equal(ownerText.includes("ada@example.com"), false);
    const gone = await fetch("http://127.0.0.1:3111/api/workspaces/ws-martin/invites/inv-missing/revoke", {
      method: "POST",
      headers: { cookie: martinCookie }
    });
    const goneText = await gone.text();
    assert.equal(gone.status, 404);
    assert.equal(goneText.includes("ada@example.com"), false);
  } finally {
    server.kill("SIGTERM");
  }
});
