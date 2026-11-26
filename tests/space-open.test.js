import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import pg from "pg";
import { createSql, getSql, resetSqlCache } from "../lib/db.js";
import { newBotToken, newKeyId, tokenHash } from "../lib/keys.js";
import { spaceAccess } from "../lib/space-access.js";
import { createSpace, setSpaceBots, spaceDocumentTitle } from "../lib/spaces.js";
import { bundledStatements } from "../scripts/migrate.mjs";

register(new URL("./alias-hook.mjs", import.meta.url));

const ADMIN_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic";
const DATABASE_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic_space_open";
process.env.SQL_DRIVER = "pg";
process.env.DATABASE_URL = DATABASE_URL;

const statements = bundledStatements();

async function resetDatabase() {
  resetSqlCache();
  const admin = new pg.Pool({ connectionString: ADMIN_URL });
  await admin.query(`
    select pg_terminate_backend(pid) from pg_stat_activity
    where datname = 'botomatic_space_open' and pid <> pg_backend_pid()
  `);
  await admin.query("drop database if exists botomatic_space_open");
  await admin.query("create database botomatic_space_open");
  await admin.end();
  const sql = createSql(DATABASE_URL);
  for (const statement of statements) await sql.query(statement);
  await sql.pool.end();
  resetSqlCache();
}

test("the owner who signs in with GitHub can open the space they just created", async () => {
  await resetDatabase();
  const sql = getSql();
  await sql`
    insert into workspaces (id, name, slug) values ('ws-martin', 'Martin', 'martin')
    on conflict (id) do nothing
  `;
  await sql`
    insert into workspace_members (workspace_id, email, github_login, role)
    values ('ws-martin', 'marty.hungerford3181@gmail.com', 'MartyDaMonster', 'owner')
    on conflict (workspace_id, email) do update
      set github_user_id = null, github_login = 'MartyDaMonster', role = 'owner'
  `;
  await sql`
    insert into bots (slug, name, color, avatar, description, workspace_id)
    values ('dexter', 'Dexter', '#fff', 'circle', 'Bot', 'ws-martin')
    on conflict (workspace_id, slug) do nothing
  `;
  const token = newBotToken();
  await sql`
    insert into api_keys (id, bot_slug, key_hash, label, workspace_id)
    values (${newKeyId()}::uuid, 'dexter', ${tokenHash(token)}, 'test', 'ws-martin')
  `;
  const martin = {
    kind: "human",
    workspaceId: "ws-martin",
    email: "marty.hungerford3181@gmail.com",
    githubId: "150204025",
    role: "owner"
  };
  const created = await createSpace({
    workspaceId: "ws-martin",
    email: martin.email,
    role: "owner",
    name: "Testing"
  });
  assert.equal(created.ok, true, created.error);
  assert.equal(created.space.slug, "testing");
  const access = await spaceAccess(martin, created.space.slug);
  assert.equal(access.ok, true, "owner should open /s/testing");
  assert.equal(access.canModerate, true);
  assert.equal(await spaceDocumentTitle(martin, "testing"), "Testing");
  const membership = await sql`
    select role from space_workspaces
    where space_id = ${created.space.id} and workspace_id = 'ws-martin'
  `;
  assert.equal(membership[0].role, "owner");

  await setSpaceBots({
    access,
    email: martin.email,
    slugs: ["dexter"]
  });
  const { GET } = await import("../app/api/posts/route.js");
  const response = await GET(new Request("http://local/api/posts?space=testing", {
    headers: { authorization: `Bearer ${token}` }
  }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.space, "testing");
  assert.deepEqual(body.posts, []);

  await sql`
    insert into workspaces (id, name, slug) values ('ws-other', 'Other', 'other')
  `;
  await sql`
    insert into workspace_members (workspace_id, email, github_user_id, role)
    values ('ws-other', 'ada@example.com', '999', 'owner')
  `;
  await sql`
    insert into space_workspaces (space_id, workspace_id, role)
    values (${created.space.id}, 'ws-other', 'member')
  `;
  const mismatched = await spaceAccess({
    kind: "human",
    workspaceId: "ws-other",
    email: "ada@example.com",
    githubId: "111",
    role: "owner"
  }, "testing");
  assert.equal(mismatched.status, 404);
});
