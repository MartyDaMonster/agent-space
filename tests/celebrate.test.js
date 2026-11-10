import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import pg from "pg";

const ADMIN_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic";
const DATABASE_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic_celebrate";
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
    where datname = 'botomatic_celebrate' and pid <> pg_backend_pid()
  `);
  await admin.query("drop database if exists botomatic_celebrate");
  await admin.query("create database botomatic_celebrate");
  await admin.end();
  const sql = createSql(DATABASE_URL);
  for (const statement of statements) await sql.query(statement);
  await sql.pool.end();
  resetSqlCache();
}

test("the first post and the first project each celebrate once", async () => {
  await resetDatabase();
  const { getSql } = await import("../lib/db.js");
  const { claimFirstPost, claimFirstProject } = await import("../lib/celebrate.js");
  const { insertHumanPost } = await import("../lib/posts.js");
  const sql = getSql();
  await sql`
    insert into humans (email, name, workspace_id)
    values ('ada@example.com', 'Ada', 'ws-martin')
  `;
  await insertHumanPost({
    id: "note-first",
    type: "message",
    from: "human",
    text: "hello",
    createdAt: new Date().toISOString(),
    authorName: "Ada",
    authorEmail: "ada@example.com",
    workspaceId: "ws-martin"
  });
  assert.equal(await claimFirstPost("ada@example.com", "ws-martin"), true);
  await insertHumanPost({
    id: "note-second",
    type: "message",
    from: "human",
    text: "again",
    createdAt: new Date().toISOString(),
    authorName: "Ada",
    authorEmail: "ada@example.com",
    workspaceId: "ws-martin"
  });
  assert.equal(await claimFirstPost("ada@example.com", "ws-martin"), false);
  await sql`
    insert into projects (id, name, slug, created_by, workspace_id)
    values ('prj-ada', 'Ada', 'ada-space', 'ada@example.com', 'ws-martin')
  `;
  assert.equal(await claimFirstProject("ada@example.com", "ws-martin"), true);
  assert.equal(await claimFirstProject("ada@example.com", "ws-martin"), false);
});

test("motion stays in CSS and turns off when reduced", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const avatar = readFileSync(new URL("../components/Avatar.js", import.meta.url), "utf8");
  assert.match(css, /\.post-card \.avatar \{ width: 64px; height: 64px; \}/);
  assert.match(css, /@keyframes avatar-bob/);
  assert.match(css, /@keyframes react-pop/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.avatar-live,\s*\.avatar-live \.eyes/);
  assert.match(avatar, /IntersectionObserver/);
  assert.match(avatar, /avatar-live/);
  const burst = readFileSync(new URL("../components/celebrate.js", import.meta.url), "utf8");
  assert.match(burst, /prefers-reduced-motion: reduce/);
  assert.match(burst, /canvas-confetti/);
});
