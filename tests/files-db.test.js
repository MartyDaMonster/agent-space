import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { readFileSync } from "node:fs";
import { QUOTA_MESSAGE, WORKSPACE_QUOTA_BYTES } from "../lib/file-rules.js";

const ADMIN_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic";
const DATABASE_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic_files";
process.env.SQL_DRIVER = "pg";
process.env.DATABASE_URL = DATABASE_URL;
delete process.env.BLOB_READ_WRITE_TOKEN;

const statements = readFileSync(new URL("../scripts/migrate.sql", import.meta.url), "utf8")
  .split(/;\s*(?:\n|$)/)
  .map((statement) => statement.trim())
  .filter((statement) => statement && !statement.startsWith("--"));

async function resetDatabase() {
  const { resetSqlCache } = await import("../lib/db.js");
  resetSqlCache();
  const admin = new pg.Pool({ connectionString: ADMIN_URL });
  await admin.query(`
    select pg_terminate_backend(pid) from pg_stat_activity
    where datname = 'botomatic_files' and pid <> pg_backend_pid()
  `);
  await admin.query("drop database if exists botomatic_files");
  await admin.query("create database botomatic_files");
  await admin.end();
  const { createSql, resetSqlCache: resetAgain } = await import("../lib/db.js");
  const sql = createSql(DATABASE_URL);
  for (const statement of statements) await sql.query(statement);
  await sql.pool.end();
  resetAgain();
}

test("files stay inside one workspace and a full workspace refuses the next upload", async () => {
  await resetDatabase();
  const { createFile, readFile, deleteOwnFile, attachFiles, storageTotals, expireOldFiles } = await import("../lib/files.js");
  const { getSql } = await import("../lib/db.js");
  const sql = getSql();
  await sql`insert into workspaces (id, name, slug) values ('ws-ada', 'Ada', 'ada')`;
  await sql`
    insert into posts (id, type, from_slug, body, created_at, reactions, author_kind, workspace_id)
    values
      ('note-martin', 'message', 'human', 'martin', now(), '{}'::jsonb, 'human', 'ws-martin'),
      ('note-ada', 'message', 'human', 'ada', now(), '{}'::jsonb, 'human', 'ws-ada'),
      ('note-pinned', 'message', 'human', 'pinned', now(), '{}'::jsonb, 'human', 'ws-martin')
  `;
  await sql`update posts set pinned_at = now() where id = 'note-pinned'`;
  const ada = await createFile({
    workspaceId: "ws-ada",
    uploaderKind: "human",
    uploaderId: "ada@example.com",
    name: "secret.md",
    bytes: Buffer.from("ada secret")
  });
  assert.equal(ada.ok, true);
  const seen = await readFile({ id: ada.file.id, workspaceId: "ws-martin" });
  assert.equal(seen.status, 404);
  const removed = await deleteOwnFile({
    id: ada.file.id,
    workspaceId: "ws-martin",
    uploaderKind: "human",
    uploaderId: "marty.hungerford3181@gmail.com"
  });
  assert.equal(removed.status, 404);
  const still = await readFile({ id: ada.file.id, workspaceId: "ws-ada" });
  assert.equal(still.ok, true);
  assert.equal(still.bytes.toString(), "ada secret");
  const stolen = await attachFiles({
    ids: [ada.file.id],
    workspaceId: "ws-martin",
    uploaderKind: "human",
    uploaderId: "marty.hungerford3181@gmail.com",
    postId: "note-martin"
  });
  assert.equal(stolen.status, 404);
  const own = await createFile({
    workspaceId: "ws-martin",
    uploaderKind: "human",
    uploaderId: "marty.hungerford3181@gmail.com",
    name: "ours.txt",
    bytes: Buffer.from("ours")
  });
  const attached = await attachFiles({
    ids: [own.file.id],
    workspaceId: "ws-martin",
    uploaderKind: "human",
    uploaderId: "marty.hungerford3181@gmail.com",
    postId: "note-martin"
  });
  assert.equal(attached.ok, true);
  await sql`
    insert into files (
      id, workspace_id, name, extension, content_type, byte_size, storage, uploader_kind, uploader_id, post_id
    ) values (
      'file_full', 'ws-martin', 'full.bin', 'txt', 'text/plain', ${WORKSPACE_QUOTA_BYTES}, 'neon', 'human', 'marty.hungerford3181@gmail.com', 'note-martin'
    )
  `;
  const blocked = await createFile({
    workspaceId: "ws-martin",
    uploaderKind: "human",
    uploaderId: "marty.hungerford3181@gmail.com",
    name: "more.txt",
    bytes: Buffer.from("x")
  });
  assert.equal(blocked.status, 413);
  assert.equal(blocked.error, QUOTA_MESSAGE);
  const adaUsage = await storageTotals("ws-ada");
  assert.equal(adaUsage.files, 1);
  assert.ok(adaUsage.overallFiles > adaUsage.files);
  assert.ok(adaUsage.overallBytes > adaUsage.bytes);
  await sql`
    insert into files (
      id, workspace_id, name, extension, content_type, byte_size, storage, body, uploader_kind, uploader_id, post_id, created_at
    ) values (
      'file_old', 'ws-ada', 'old.txt', 'txt', 'text/plain', 4, 'neon', convert_to('old', 'utf8'), 'human', 'ada@example.com', 'note-ada', now() - interval '31 days'
    )
  `;
  await sql`
    insert into files (
      id, workspace_id, name, extension, content_type, byte_size, storage, uploader_kind, uploader_id, post_id, created_at
    ) values (
      'file_keep', 'ws-martin', 'keep.txt', 'txt', 'text/plain', 4, 'neon', 'human', 'marty.hungerford3181@gmail.com', 'note-pinned', now() - interval '31 days'
    )
  `;
  const expired = await expireOldFiles();
  assert.ok(expired.deleted >= 1);
  const old = await sql`select deleted_at, body from files where id = 'file_old'`;
  const kept = await sql`select deleted_at from files where id = 'file_keep'`;
  assert.ok(old[0].deleted_at);
  assert.equal(old[0].body, null);
  assert.equal(kept[0].deleted_at, null);
});
