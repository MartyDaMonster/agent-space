import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import pg from "pg";

const ADMIN_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic";
const DATABASE_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic_writes";
process.env.SQL_DRIVER = "pg";
process.env.DATABASE_URL = DATABASE_URL;

const statements = readFileSync(new URL("../scripts/migrate.sql", import.meta.url), "utf8")
  .split(/;\s*(?:\n|$)/)
  .map((statement) => statement.trim())
  .filter((statement) => statement && !statement.startsWith("--"));

test("a comment and a reaction with no files can be saved", async () => {
  const { resetSqlCache, createSql, getSql } = await import("../lib/db.js");
  resetSqlCache();
  const admin = new pg.Pool({ connectionString: ADMIN_URL });
  await admin.query(`
    select pg_terminate_backend(pid) from pg_stat_activity
    where datname = 'botomatic_writes' and pid <> pg_backend_pid()
  `);
  await admin.query("drop database if exists botomatic_writes");
  await admin.query("create database botomatic_writes");
  await admin.end();
  const setup = createSql(DATABASE_URL);
  for (const statement of statements) await setup.query(statement);
  await setup.query("alter table comments alter column workspace_id set not null");
  await setup.query("alter table post_reactions alter column workspace_id set not null");
  await setup.query("alter table post_mentions alter column workspace_id set not null");
  await setup.pool.end();
  resetSqlCache();

  const sql = getSql();
  await sql`
    insert into posts (id, type, from_slug, body, created_at, workspace_id)
    values ('note-1', 'message', 'dexter', 'hello', now(), 'ws-martin')
  `;
  const { insertComment, toggleReaction, publicId } = await import("../lib/posts.js");
  const { attachFiles } = await import("../lib/files.js");
  const { utcStamp } = await import("../scripts/schema.js");
  const comment = await insertComment({
    id: publicId("cmt"),
    postId: "note-1",
    authorKind: "bot",
    authorSlug: "dexter",
    authorName: "Dexter",
    text: "On it.",
    createdAt: utcStamp(),
    workspaceId: "ws-martin"
  });
  const attached = await attachFiles({
    ids: [],
    workspaceId: "ws-martin",
    uploaderKind: "bot",
    uploaderId: "dexter",
    commentId: comment.id
  });
  const reaction = await toggleReaction({
    postId: "note-1",
    actor: "bot:dexter",
    emoji: "👀",
    workspaceId: "ws-martin"
  });
  assert.equal(attached.ok, true);
  assert.deepEqual(attached.files, []);
  assert.equal(reaction.on, true);
  const saved = await sql`
    select body, workspace_id from comments where id = ${comment.id}
  `;
  const reacted = await sql`
    select workspace_id from post_reactions
    where post_id = 'note-1' and actor = 'bot:dexter' and emoji = '👀'
  `;
  assert.equal(saved[0].body, "On it.");
  assert.equal(saved[0].workspace_id, "ws-martin");
  assert.equal(reacted[0].workspace_id, "ws-martin");
});
