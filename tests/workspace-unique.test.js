import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import pg from "pg";

const ADMIN_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic";
const DATABASE_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic_unique";
process.env.SQL_DRIVER = "pg";
process.env.DATABASE_URL = DATABASE_URL;

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
    where datname = 'botomatic_unique' and pid <> pg_backend_pid()
  `);
  await admin.query("drop database if exists botomatic_unique");
  await admin.query("create database botomatic_unique");
  await admin.end();
  const sql = createSql(DATABASE_URL);
  for (const statement of statements) await sql.query(statement);
  await sql.pool.end();
  resetSqlCache();
}

test("two workspaces can share a bot slug, project slug, post id, and human email", async () => {
  await resetDatabase();
  const { getSql } = await import("../lib/db.js");
  const { listBots, findPost, insertPost } = await import("../lib/posts.js");
  const { projectBySlug, createProject } = await import("../lib/projects.js");
  const { listHumans, rememberHuman } = await import("../lib/humans.js");
  const sql = getSql();
  await sql`insert into workspaces (id, name, slug) values ('ws-ada', 'Ada', 'ada')`;

  await sql`
    insert into bots (slug, name, color, avatar, description, workspace_id) values
      ('dexter', 'Martin Dexter', '#111111', 'square-lime', 'Martin', 'ws-martin'),
      ('dexter', 'Ada Dexter', '#222222', 'cloud-pink', 'Ada', 'ws-ada')
  `;
  const martinBots = await listBots("ws-martin");
  const adaBots = await listBots("ws-ada");
  assert.deepEqual(martinBots.map((bot) => bot.name), ["Martin Dexter"]);
  assert.deepEqual(adaBots.map((bot) => bot.name), ["Ada Dexter"]);

  const martinProject = await createProject({
    prepared: { name: "Side quest", slug: "side-quest", description: "", color: "#fff", emoji: "" },
    email: "marty.hungerford3181@gmail.com",
    workspaceId: "ws-martin"
  });
  const adaProject = await createProject({
    prepared: { name: "Side quest", slug: "side-quest", description: "", color: "#000", emoji: "" },
    email: "ada@example.com",
    workspaceId: "ws-ada"
  });
  assert.equal(martinProject.ok, true);
  assert.equal(adaProject.ok, true);
  assert.equal((await projectBySlug("side-quest", "ws-martin")).name, "Side quest");
  assert.equal((await projectBySlug("side-quest", "ws-ada")).id, adaProject.id);
  assert.notEqual(martinProject.id, adaProject.id);

  await insertPost({
    id: "hello-note",
    type: "message",
    from: "human",
    text: "martin hello",
    createdAt: "2026-11-09T00:00:00Z",
    workspaceId: "ws-martin"
  });
  await insertPost({
    id: "hello-note",
    type: "message",
    from: "human",
    text: "ada hello",
    createdAt: "2026-11-09T00:00:01Z",
    workspaceId: "ws-ada"
  });
  const martinPost = await findPost("hello-note", "ws-martin");
  const adaPost = await findPost("hello-note", "ws-ada");
  assert.equal(martinPost.workspace_id, "ws-martin");
  assert.equal(adaPost.workspace_id, "ws-ada");
  const visible = await sql`
    select body from posts where id = 'hello-note' and workspace_id = 'ws-ada'
  `;
  assert.equal(visible.length, 1);
  assert.equal(visible[0].body, "ada hello");

  const { insertComment, threadFor, toggleReaction } = await import("../lib/posts.js");
  const { rememberMentions, listMentionIndex } = await import("../lib/mention-store.js");
  await insertComment({
    id: "cmt-martin",
    postId: "hello-note",
    authorKind: "human",
    authorName: "Martin",
    authorEmail: "marty.hungerford3181@gmail.com",
    text: "martin comment",
    createdAt: "2026-11-09T00:02:00Z",
    workspaceId: "ws-martin"
  });
  await insertComment({
    id: "cmt-ada",
    postId: "hello-note",
    authorKind: "human",
    authorName: "Ada",
    authorEmail: "ada@example.com",
    text: "ada comment",
    createdAt: "2026-11-09T00:02:01Z",
    workspaceId: "ws-ada"
  });
  await toggleReaction({ postId: "hello-note", actor: "human:shared", emoji: "👀", workspaceId: "ws-martin" });
  await toggleReaction({ postId: "hello-note", actor: "human:shared", emoji: "👀", workspaceId: "ws-ada" });
  await rememberMentions("post", "hello-note", "ping @dexter", { email: "marty.hungerford3181@gmail.com" }, "ws-martin");
  await rememberMentions("post", "hello-note", "ping @dexter", { email: "ada@example.com" }, "ws-ada");

  const martinThread = await threadFor(["hello-note"], "ws-martin");
  const adaThread = await threadFor(["hello-note"], "ws-ada");
  assert.deepEqual(martinThread.comments["hello-note"].map((comment) => comment.text), ["martin comment"]);
  assert.deepEqual(adaThread.comments["hello-note"].map((comment) => comment.text), ["ada comment"]);
  assert.deepEqual(martinThread.reactions["hello-note"].map((reaction) => reaction.actor), ["human:shared"]);
  assert.equal(adaThread.reactions["hello-note"].length, 1);
  const martinMentions = await listMentionIndex(["hello-note"], "ws-martin");
  const adaMentions = await listMentionIndex(["hello-note"], "ws-ada");
  assert.deepEqual(martinMentions.postsById["hello-note"], ["dexter"]);
  assert.deepEqual(adaMentions.postsById["hello-note"], ["dexter"]);
  const mentionRows = await sql`select workspace_id from post_mentions where post_id = 'hello-note' order by workspace_id`;
  assert.deepEqual(mentionRows.map((row) => row.workspace_id), ["ws-ada", "ws-martin"]);

  await rememberHuman({ email: "ada@example.com", name: "Ada Martin", workspaceId: "ws-martin" });
  await rememberHuman({ email: "ada@example.com", name: "Ada Home", workspaceId: "ws-ada" });
  await sql`
    insert into workspace_members (workspace_id, email, role)
    values ('ws-ada', 'ada@example.com', 'member')
    on conflict (workspace_id, email) do nothing
  `;
  const martinPeople = await listHumans("ws-martin");
  const adaPeople = await listHumans("ws-ada");
  assert.equal(martinPeople.find((person) => person.email === "ada@example.com").name, "Ada Martin");
  assert.equal(adaPeople.find((person) => person.email === "ada@example.com").name, "Ada Home");

  await assert.rejects(
    sql`insert into bots (slug, name, color, avatar, description, workspace_id) values ('dexter', 'Again', '#111111', 'square-lime', 'no', 'ws-martin')`
  );
  await assert.rejects(
    () => insertPost({
      id: "hello-note",
      type: "message",
      from: "human",
      text: "again",
      createdAt: "2026-11-09T00:03:00Z",
      workspaceId: "ws-martin"
    }),
    /already exists/
  );

  const { createSql, resetSqlCache } = await import("../lib/db.js");
  const again = createSql(DATABASE_URL);
  for (const statement of statements) await again.query(statement);
  await again.pool.end();
  resetSqlCache();
  const kept = await findPost("hello-note", "ws-martin");
  assert.equal(kept.workspace_id, "ws-martin");
  const stillAda = await (await import("../lib/db.js")).getSql()`
    select name from bots where slug = 'dexter' and workspace_id = 'ws-ada'
  `;
  assert.equal(stillAda[0].name, "Ada Dexter");
});
