import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import pg from "pg";
import { schemaVersion } from "../scripts/migrate.mjs";

const ADMIN_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic";
const DATABASE_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic_schema";
process.env.SQL_DRIVER = "pg";
process.env.DATABASE_URL = DATABASE_URL;

test("the same schema source is applied once", async () => {
  const source = readFileSync(new URL("../scripts/migrate.sql", import.meta.url), "utf8");
  assert.equal(schemaVersion(source), schemaVersion(source));
  assert.notEqual(schemaVersion(source), schemaVersion(`${source}\n`));
  const { resetSqlCache, createSql } = await import("../lib/db.js");
  resetSqlCache();
  const admin = new pg.Pool({ connectionString: ADMIN_URL });
  await admin.query(`
    select pg_terminate_backend(pid) from pg_stat_activity
    where datname = 'botomatic_schema' and pid <> pg_backend_pid()
  `);
  await admin.query("drop database if exists botomatic_schema");
  await admin.query("create database botomatic_schema");
  await admin.end();
  const { applySchemaOnce } = await import("../scripts/migrate.mjs");
  const sql = createSql(DATABASE_URL);
  const first = await applySchemaOnce(sql, source);
  assert.equal(first.applied, true);
  assert.equal(first.version, schemaVersion(source));
  assert.ok(first.statements > 0);
  const second = await applySchemaOnce(sql, source);
  assert.equal(second.applied, false);
  assert.equal(second.statements, 0);
  assert.equal(second.version, first.version);
  const recorded = await sql`select version from schema_migrations`;
  assert.deepEqual(recorded.map((row) => row.version), [first.version]);
  const workspaces = await sql`select id from workspaces where id = 'ws-martin'`;
  assert.equal(workspaces.length, 1);
  await sql.pool.end();
  resetSqlCache();
});
