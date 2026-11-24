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

test("an existing database applies only the spaces migration", async () => {
  const mainSource = readFileSync(new URL("../scripts/migrate.sql", import.meta.url), "utf8");
  const spacesSource = readFileSync(new URL("../scripts/migrate-spaces.sql", import.meta.url), "utf8");
  const { resetSqlCache, createSql } = await import("../lib/db.js");
  const { applySchemaOnce, schemaVersion } = await import("../scripts/migrate.mjs");
  resetSqlCache();
  const admin = new pg.Pool({ connectionString: ADMIN_URL });
  await admin.query(`
    select pg_terminate_backend(pid) from pg_stat_activity
    where datname = 'botomatic_upgrade' and pid <> pg_backend_pid()
  `);
  await admin.query("drop database if exists botomatic_upgrade");
  await admin.query("create database botomatic_upgrade");
  await admin.end();
  const sql = createSql("postgres://botomatic:botomatic@127.0.0.1:5432/botomatic_upgrade");
  const first = await applySchemaOnce(sql, mainSource);
  assert.equal(first.applied, true);
  await sql`
    insert into workspaces (id, name, slug) values ('ws-keep', 'Keep', 'keep')
  `;
  await sql`
    insert into humans (email, name, workspace_id) values ('guest@example.com', 'Guest', 'ws-keep')
  `;
  await sql`
    insert into workspace_members (workspace_id, email, role)
    values ('ws-martin', 'guest@example.com', 'owner')
  `;
  await sql`
    insert into posts (id, type, from_slug, body, created_at, author_kind, workspace_id)
    values ('post-keep', 'message', 'dexter', 'keep me', now(), 'bot', 'ws-martin')
  `;
  const again = await applySchemaOnce(sql, mainSource);
  assert.equal(again.applied, false);
  assert.equal(again.statements, 0);
  const spaces = await applySchemaOnce(sql, spacesSource);
  assert.equal(spaces.applied, true);
  assert.equal(spaces.version, schemaVersion(spacesSource));
  const replay = await applySchemaOnce(sql, mainSource);
  assert.equal(replay.applied, false);
  const guest = await sql`
    select role from workspace_members
    where workspace_id = 'ws-martin' and lower(email) = 'guest@example.com'
  `;
  assert.equal(guest[0]?.role, "owner");
  const kept = await sql`select id from posts where id = 'post-keep' and workspace_id = 'ws-martin'`;
  assert.equal(kept.length, 1);
  const versions = await sql`select version from schema_migrations order by version`;
  assert.deepEqual(versions.map((row) => row.version).sort(), [schemaVersion(mainSource), schemaVersion(spacesSource)].sort());
  const column = await sql`
    select 1 from information_schema.columns
    where table_name = 'posts' and column_name = 'space_id'
  `;
  assert.equal(column.length, 1);
  await sql`
    insert into spaces (id, slug, name, owner_workspace_id, created_by)
    values ('spc-upgrade', 'upgrade-space', 'Upgrade', 'ws-martin', 'marty.hungerford3181@gmail.com')
  `;
  const indexed = await sql`
    select indexdef from pg_indexes
    where indexname in ('posts_private_created_idx', 'posts_space_id_uidx', 'post_reactions_post_idx')
  `;
  assert.equal(indexed.length, 3);
  await sql.pool.end();
  resetSqlCache();
});
