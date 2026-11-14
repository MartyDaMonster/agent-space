import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import pg from "pg";
import { decideAccess } from "../lib/access.js";
import { newKeyId, tokenHash } from "../lib/keys.js";

const ADMIN_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic";
const DATABASE_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic_remove";
process.env.SQL_DRIVER = "pg";
process.env.DATABASE_URL = DATABASE_URL;

const statements = readFileSync(new URL("../scripts/migrate.sql", import.meta.url), "utf8")
  .split(/;\s*(?:\n|$)/)
  .map((statement) => statement.trim())
  .filter((statement) => statement && !statement.startsWith("--"));

const ada = { user: { email: "ada@example.com", name: "Ada", githubId: "88021", githubLogin: "ada" } };
const sam = { user: { email: "sam@example.com", name: "Sam", githubId: "88022", githubLogin: "sam" } };
const martin = { user: { email: "marty.hungerford3181@gmail.com", name: "Martin", githubId: "150204025", githubLogin: "martydamonster" } };

test("a workspace member can remove a bot, and another workspace cannot", async () => {
  const { resetSqlCache, createSql, getSql } = await import("../lib/db.js");
  resetSqlCache();
  const admin = new pg.Pool({ connectionString: ADMIN_URL });
  await admin.query(`
    select pg_terminate_backend(pid) from pg_stat_activity
    where datname = 'botomatic_remove' and pid <> pg_backend_pid()
  `);
  await admin.query("drop database if exists botomatic_remove");
  await admin.query("create database botomatic_remove");
  await admin.end();
  const setup = createSql(DATABASE_URL);
  for (const statement of statements) await setup.query(statement);
  await setup.pool.end();
  resetSqlCache();

  const sql = getSql();
  await sql`insert into workspaces (id, name, slug) values ('ws-ada', 'Ada', 'ada')`;
  await sql`
    insert into workspace_members (workspace_id, email, github_login, github_user_id, role)
    values
      ('ws-ada', 'ada@example.com', 'ada', '88021', 'owner'),
      ('ws-ada', 'sam@example.com', 'sam', '88022', 'member')
  `;
  await sql`
    insert into bots (slug, name, color, avatar, description, workspace_id) values
      ('crabby', 'Crabby', '#8A5CFF', 'crab-cyan', 'Ada bot', 'ws-ada'),
      ('dexter', 'Dexter', '#111111', 'square-lime', 'Martin bot', 'ws-martin')
  `;
  const token = "btm_remove_bot_secret";
  await sql`
    insert into api_keys (id, bot_slug, key_hash, label, workspace_id)
    values (${newKeyId()}::uuid, 'crabby', ${tokenHash(token)}, 'Crabby', 'ws-ada')
  `;
  await sql`
    insert into posts (id, type, from_slug, body, created_at, reactions, author_kind, workspace_id)
    values ('note-crabby', 'message', 'crabby', 'hello', now(), '{}'::jsonb, 'bot', 'ws-ada')
  `;
  await sql`
    insert into comments (id, post_id, workspace_id, author_kind, author_slug, author_name, body, created_at)
    values ('cmt-crabby', 'note-crabby', 'ws-ada', 'bot', 'crabby', 'Crabby', 'on it', now())
  `;

  const { botFromAuthorization } = await import("../lib/bot-auth.js");
  const { listBots } = await import("../lib/posts.js");
  const { removeWorkspaceBot } = await import("../lib/remove-bot.js");
  const { workspaceActor } = await import("../lib/workspace-session.js");

  assert.equal((await botFromAuthorization(`Bearer ${token}`)).slug, "crabby");
  assert.equal((await removeWorkspaceBot(null, "crabby")).status, 401);
  assert.equal((await removeWorkspaceBot(await workspaceActor(ada), "dexter")).status, 404);
  assert.equal((await listBots("ws-martin")).some((bot) => bot.slug === "dexter"), true);

  const removed = await removeWorkspaceBot(await workspaceActor(sam), "crabby");
  assert.equal(removed.ok, true);
  assert.equal(removed.name, "Crabby");
  assert.equal(await botFromAuthorization(`Bearer ${token}`), null);
  assert.equal((await listBots("ws-ada")).some((bot) => bot.slug === "crabby"), false);
  const post = await sql`
    select from_slug, body, author_name from posts where id = 'note-crabby' and workspace_id = 'ws-ada'
  `;
  assert.equal(post[0].from_slug, "crabby");
  assert.equal(post[0].body, "hello");
  assert.equal(post[0].author_name, "Crabby");
  const comment = await sql`
    select author_name, body from comments where id = 'cmt-crabby' and workspace_id = 'ws-ada'
  `;
  assert.equal(comment[0].author_name, "Crabby");
  assert.equal(comment[0].body, "on it");
  const key = await sql`select revoked_at from api_keys where bot_slug = 'crabby' and workspace_id = 'ws-ada'`;
  assert.ok(key[0].revoked_at);
  assert.equal((await removeWorkspaceBot(await workspaceActor(ada), "crabby")).status, 404);

  assert.equal(decideAccess({ pathname: "/api/bots/crabby", hasSession: true }).human, true);
  assert.equal(decideAccess({ pathname: "/api/bots/crabby", hasSession: false }).status, 401);
  assert.equal(decideAccess({ pathname: "/api/bots", hasSession: true }).status, 401);
  const page = readFileSync(new URL("../app/(board)/bots/page.js", import.meta.url), "utf8");
  const dialog = readFileSync(new URL("../components/RemoveBot.js", import.meta.url), "utf8");
  assert.match(page, /RemoveBot/);
  assert.match(dialog, /Remove \{name\}\?/);
  assert.match(dialog, /Their key stops working/);
  assert.match(dialog, /Posts and comments stay, with their name/);
  assert.match(dialog, />Cancel</);
  assert.match(dialog, />Remove</);
});
