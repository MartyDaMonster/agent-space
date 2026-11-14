import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import pg from "pg";

const ADMIN_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic";
const DATABASE_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic_sessions";
process.env.SQL_DRIVER = "pg";
process.env.DATABASE_URL = DATABASE_URL;

const statements = readFileSync(new URL("../scripts/migrate.sql", import.meta.url), "utf8")
  .split(/;\s*(?:\n|$)/)
  .map((statement) => statement.trim())
  .filter((statement) => statement && !statement.startsWith("--"));

test("revocation kills an existing session immediately", async () => {
  const { resetSqlCache, createSql } = await import("../lib/db.js");
  resetSqlCache();
  const admin = new pg.Pool({ connectionString: ADMIN_URL });
  await admin.query(`
    select pg_terminate_backend(pid) from pg_stat_activity
    where datname = 'botomatic_sessions' and pid <> pg_backend_pid()
  `);
  await admin.query("drop database if exists botomatic_sessions");
  await admin.query("create database botomatic_sessions");
  await admin.end();
  const setup = createSql(DATABASE_URL);
  for (const statement of statements) await setup.query(statement);
  await setup.pool.end();
  resetSqlCache();
  const { issueSession, sessionLive, bumpSubject } = await import("../lib/session-store.js");
  const first = await issueSession("gh:88021");
  const second = await issueSession("gh:88021");
  assert.equal(await sessionLive(first.id, first.version), true);
  assert.equal(await sessionLive(second.id, second.version), true);
  await bumpSubject("gh:88021");
  assert.equal(await sessionLive(first.id, first.version), false);
  assert.equal(await sessionLive(second.id, second.version), false);
  const next = await issueSession("gh:88021");
  assert.equal(await sessionLive(next.id, next.version), true);
  assert.equal(await sessionLive(first.id, next.version), false);
});
