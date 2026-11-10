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

test("a leftover post file link does not block the per-workspace post key", async () => {
  const url = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic_fkey";
  const admin = new pg.Pool({ connectionString: ADMIN_URL });
  await admin.query(`
    select pg_terminate_backend(pid) from pg_stat_activity
    where datname = 'botomatic_fkey' and pid <> pg_backend_pid()
  `);
  await admin.query("drop database if exists botomatic_fkey");
  await admin.query("create database botomatic_fkey");
  await admin.end();
  const { createSql } = await import("../lib/db.js");
  const { dropForeignKeysTo } = await import("../scripts/migrate.mjs");
  const sql = createSql(url);
  await sql.query("create table posts (id text primary key, workspace_id text not null default 'ws-martin')");
  await sql.query("insert into posts (id) values ('hello')");
  await sql.query(`
    create table post_files (
      post_id text not null references posts (id) on delete cascade,
      file_id text not null,
      primary key (post_id, file_id)
    )
  `);
  await sql.query("insert into post_files (post_id, file_id) values ('hello', 'file_1')");
  await dropForeignKeysTo(sql, "posts");
  await sql.query("alter table posts drop constraint posts_pkey");
  await sql.query("alter table posts add constraint posts_workspace_id_pkey primary key (workspace_id, id)");
  await sql.query("insert into posts (id, workspace_id) values ('hello', 'ws-ada')");
  const rows = await sql.query("select workspace_id from posts where id = 'hello' order by workspace_id");
  const kept = await sql.query("select file_id from post_files");
  assert.deepEqual(rows.map((row) => row.workspace_id), ["ws-ada", "ws-martin"]);
  assert.equal(kept[0].file_id, "file_1");
  await sql.pool.end();
});

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
  assert.equal(martinProject.slug, "side-quest");
  assert.equal(adaProject.slug, "side-quest");
  assert.equal((await projectBySlug("side-quest", "ws-martin")).name, "Side quest");
  assert.equal((await projectBySlug("side-quest", "ws-ada")).id, adaProject.id);
  assert.notEqual(martinProject.id, adaProject.id);
  const martinAgain = await createProject({
    prepared: { name: "Side quest", slug: "side-quest", description: "", color: "#fff", emoji: "" },
    email: "marty.hungerford3181@gmail.com",
    workspaceId: "ws-martin"
  });
  assert.equal(martinAgain.ok, true);
  assert.equal(martinAgain.slug, "side-quest-2");
  assert.equal((await projectBySlug("side-quest", "ws-ada")).id, adaProject.id);
  let projectClash;
  try {
    await sql`
      insert into projects (id, name, slug, created_by, workspace_id)
      values ('prj-clash', 'Side quest', 'side-quest', 'marty.hungerford3181@gmail.com', 'ws-martin')
    `;
  } catch (error) {
    projectClash = error;
  }
  const { projectTakenMessage, PROJECT_TAKEN } = await import("../lib/projects.js");
  assert.equal(projectTakenMessage(projectClash), PROJECT_TAKEN);
  assert.equal(PROJECT_TAKEN.includes("ws-ada"), false);
  assert.match(projectClash.detail, /ws-martin/);
  assert.equal(projectClash.detail.includes("ws-ada"), false);

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
  await rememberHuman({ email: "ada@example.com", name: "Ada Martin renamed", workspaceId: "ws-martin" });
  await sql`
    insert into workspace_members (workspace_id, email, role)
    values ('ws-ada', 'ada@example.com', 'member')
    on conflict (workspace_id, email) do nothing
  `;
  const martinPeople = await listHumans("ws-martin");
  const adaPeople = await listHumans("ws-ada");
  assert.equal(martinPeople.find((person) => person.email === "ada@example.com").name, "Ada Martin renamed");
  assert.equal(adaPeople.find((person) => person.email === "ada@example.com").name, "Ada Home");
  let emailClash;
  try {
    await sql`
      insert into humans (email, name, workspace_id)
      values ('ada@example.com', 'Again', 'ws-martin')
    `;
  } catch (error) {
    emailClash = error;
  }
  assert.equal(emailClash.code, "23505");
  assert.match(emailClash.detail, /ws-martin/);
  assert.equal(emailClash.detail.includes("ws-ada"), false);

  let botClash;
  try {
    await sql`insert into bots (slug, name, color, avatar, description, workspace_id) values ('dexter', 'Again', '#111111', 'square-lime', 'no', 'ws-martin')`;
  } catch (error) {
    botClash = error;
  }
  const { slugTakenMessage, SLUG_TAKEN } = await import("../lib/grant.js");
  assert.equal(slugTakenMessage(botClash), SLUG_TAKEN);
  assert.equal(SLUG_TAKEN.includes("ws-ada"), false);
  assert.equal(SLUG_TAKEN.toLowerCase().includes("workspace"), false);
  assert.match(botClash.detail, /ws-martin/);
  assert.equal(botClash.detail.includes("ws-ada"), false);
  const { POST_ID_TAKEN } = await import("../lib/posts.js");
  await assert.rejects(
    () => insertPost({
      id: "hello-note",
      type: "message",
      from: "human",
      text: "again",
      createdAt: "2026-11-09T00:03:00Z",
      workspaceId: "ws-martin"
    }),
    (error) => {
      assert.equal(error.message, POST_ID_TAKEN);
      assert.equal(error.status, 409);
      assert.equal(error.message.includes("ws-ada"), false);
      assert.equal(error.message.toLowerCase().includes("workspace"), false);
      return true;
    }
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
