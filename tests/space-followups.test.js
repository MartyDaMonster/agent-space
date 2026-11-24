import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import pg from "pg";
import { createFile, readFile } from "../lib/files.js";
import { markPostDeleted } from "../lib/posts.js";
import { rememberSpaceMentions } from "../lib/space-feed.js";
import { addSpaceBotPost } from "../lib/space-feed.js";
import {
  SPACE_JOIN_CAP,
  acceptSpaceInvite,
  createSpace,
  createSpaceInvite,
  hashInviteToken,
  ownedWorkspaces,
  setSpaceBots,
  setSpacePostHidden,
  spaceDocumentTitle,
  spaceParticipants,
  viewerFromSession
} from "../lib/spaces.js";
import { bundledStatements } from "../scripts/migrate.mjs";
import { createSql, getSql, resetSqlCache } from "../lib/db.js";
import { newBotToken, newKeyId, tokenHash } from "../lib/keys.js";

const ADMIN_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic";
const DATABASE_URL = "postgres://botomatic:botomatic@127.0.0.1:5432/botomatic_space_follow";
process.env.SQL_DRIVER = "pg";
process.env.DATABASE_URL = DATABASE_URL;

const statements = bundledStatements();
const ada = { kind: "human", workspaceId: "ws-ada", email: "ada@example.com", role: "owner" };
const bea = { kind: "human", workspaceId: "ws-bea", email: "bea@example.com", role: "owner" };

function freshSession(email) {
  return { user: { email, authAt: Math.floor(Date.now() / 1000) } };
}

async function resetDatabase() {
  resetSqlCache();
  const admin = new pg.Pool({ connectionString: ADMIN_URL });
  await admin.query(`
    select pg_terminate_backend(pid) from pg_stat_activity
    where datname = 'botomatic_space_follow' and pid <> pg_backend_pid()
  `);
  await admin.query("drop database if exists botomatic_space_follow");
  await admin.query("create database botomatic_space_follow");
  await admin.end();
  const sql = createSql(DATABASE_URL);
  for (const statement of statements) await sql.query(statement);
  await sql.pool.end();
  resetSqlCache();
}

test("space invite links are hashed, single-use, and chosen explicitly", async () => {
  await resetDatabase();
  const sql = getSql();
  await sql`
    insert into workspaces (id, name, slug) values
      ('ws-ada', 'Ada', 'ada'),
      ('ws-bea', 'Bea', 'bea'),
      ('ws-bea-2', 'Bea Two', 'bea-two')
  `;
  await sql`
    insert into workspace_members (workspace_id, email, role) values
      ('ws-ada', 'ada@example.com', 'owner'),
      ('ws-bea', 'bea@example.com', 'owner'),
      ('ws-bea-2', 'bea@example.com', 'owner')
  `;
  await sql`
    insert into bots (slug, name, color, avatar, description, workspace_id)
    values ('dexter', 'Dexter', '#fff', 'circle', 'Bot', 'ws-ada')
  `;
  const created = await createSpace({
    workspaceId: "ws-ada",
    email: "ada@example.com",
    role: "owner",
    name: "Design review"
  });
  const invite = await createSpaceInvite({
    access: { ok: true, canModerate: true, space: created.space },
    session: freshSession("ada@example.com"),
    email: "ada@example.com",
    targetSlug: "bea"
  });
  assert.equal(invite.ok, true, invite.error);
  const stored = await sql`select id, token_hash from space_invites`;
  assert.equal(stored[0].id === invite.inviteId, false);
  assert.equal(stored[0].token_hash, hashInviteToken(invite.inviteId));
  assert.equal(await spaceDocumentTitle(ada, created.space.slug), "Design review");
  const owned = await ownedWorkspaces({ user: { email: "bea@example.com" } });
  assert.deepEqual(owned.map((workspace) => workspace.id).sort(), ["ws-bea", "ws-bea-2"]);
  const wrongWorkspace = await acceptSpaceInvite({
    inviteId: invite.inviteId,
    workspaceId: "ws-bea-2",
    email: "bea@example.com",
    role: "owner"
  });
  assert.equal(wrongWorkspace.status, 404);
  const accepted = await acceptSpaceInvite({
    inviteId: invite.inviteId,
    workspaceId: "ws-bea",
    email: "bea@example.com",
    role: "owner"
  });
  assert.equal(accepted.ok, true, accepted.error);
  const reused = await acceptSpaceInvite({
    inviteId: invite.inviteId,
    workspaceId: "ws-bea",
    email: "bea@example.com",
    role: "owner"
  });
  assert.equal(reused.status, 404);

  const page = readFileSync(new URL("../app/join/space/[inviteId]/page.js", import.meta.url), "utf8");
  const scrub = readFileSync(new URL("../components/ScrubInviteToken.js", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../app/layout.js", import.meta.url), "utf8");
  const middleware = readFileSync(new URL("../middleware.js", import.meta.url), "utf8");
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /Which workspace is joining/);
  assert.match(scrub, /history\.replaceState/);
  assert.match(layout, /path\.startsWith\("\/join\/space"\)/);
  assert.match(middleware, /Referrer-Policy", "no-referrer"/);
});

test("space writes and uploads stay inside their caps", async () => {
  await resetDatabase();
  const sql = getSql();
  await sql`insert into workspaces (id, name, slug) values ('ws-ada', 'Ada', 'ada'), ('ws-bea', 'Bea', 'bea')`;
  await sql`
    insert into workspace_members (workspace_id, email, role) values
      ('ws-ada', 'ada@example.com', 'owner'),
      ('ws-bea', 'bea@example.com', 'owner')
  `;
  const token = newBotToken();
  await sql`
    insert into bots (slug, name, color, avatar, description, workspace_id)
    values ('dexter', 'Dexter', '#fff', 'circle', 'Bot', 'ws-ada')
  `;
  await sql`
    insert into api_keys (id, bot_slug, key_hash, label, workspace_id)
    values (${newKeyId()}::uuid, 'dexter', ${tokenHash(token)}, 'test', 'ws-ada')
  `;
  const created = await createSpace({
    workspaceId: "ws-ada",
    email: "ada@example.com",
    role: "owner",
    name: "Design review"
  });
  await setSpaceBots({
    access: { ok: true, viewer: ada, space: { ...created.space, archivedAt: "" } },
    email: "ada@example.com",
    slugs: ["dexter"]
  });
  for (let n = 0; n < 19; n += 1) {
    await sql`
      insert into posts (id, type, from_slug, body, created_at, author_kind, workspace_id, space_id)
      values (${`seed-${n}`}, 'message', 'dexter', 'seed', now(), 'bot', 'ws-ada', ${created.space.id})
    `;
  }
  const bot = { workspaceId: "ws-ada", slug: "dexter", name: "Dexter" };
  const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const postBody = (id) => ({
    id,
    type: "message",
    from: "dexter",
    to: null,
    text: "one more",
    createdAt: stamp,
    status: null,
    media: null,
    reactions: {}
  });
  const [first, second] = await Promise.all([
    addSpaceBotPost({ bot, space: created.space, post: postBody("race-a") }),
    addSpaceBotPost({ bot, space: created.space, post: postBody("race-b") })
  ]);
  const statuses = [first.status || (first.ok ? 201 : 0), second.status || (second.ok ? 201 : 0)].sort();
  assert.deepEqual(statuses, [201, 429]);

  await sql`
    insert into board_files (
      id, workspace_id, space_id, name, extension, content_type, byte_size, storage, uploader_kind, uploader_id
    ) values (
      'file-almost', 'ws-ada', ${created.space.id}, 'full.bin', 'bin', 'application/octet-stream',
      ${100 * 1024 * 1024 - 12}, 'db', 'bot', 'dexter'
    )
  `;
  const uploads = await Promise.all([
    createFile({ workspaceId: "ws-ada", uploaderKind: "bot", uploaderId: "dexter", name: "a.txt", bytes: Buffer.from("hellohello"), spaceId: created.space.id }),
    createFile({ workspaceId: "ws-ada", uploaderKind: "bot", uploaderId: "dexter", name: "b.txt", bytes: Buffer.from("hellohello"), spaceId: created.space.id })
  ]);
  assert.deepEqual(uploads.map((item) => item.status || (item.ok ? 201 : 0)).sort(), [201, 413]);

  for (let n = 0; n < SPACE_JOIN_CAP; n += 1) {
    const id = `spc-join-${n}`;
    await sql`
      insert into spaces (id, slug, name, owner_workspace_id, created_by)
      values (${id}, ${`join-${n}`}, ${`Join ${n}`}, 'ws-ada', 'ada@example.com')
    `;
    await sql`
      insert into space_workspaces (space_id, workspace_id, role)
      values (${id}, 'ws-ada', 'owner'), (${id}, 'ws-bea', 'member')
    `;
  }
  const overflowInvite = await createSpaceInvite({
    access: { ok: true, canModerate: true, space: created.space },
    session: freshSession("ada@example.com"),
    email: "ada@example.com"
  });
  const overflow = await acceptSpaceInvite({
    inviteId: overflowInvite.inviteId,
    workspaceId: "ws-bea",
    email: "bea@example.com",
    role: "owner"
  });
  assert.equal(overflow.ok, false);
  assert.match(overflow.error, /20 spaces/);
});

test("hidden space posts stay out of files, names, and private deletes", async () => {
  await resetDatabase();
  const sql = getSql();
  await sql`insert into workspaces (id, name, slug) values ('ws-ada', 'Ada', 'ada'), ('ws-bea', 'Bea', 'bea')`;
  await sql`
    insert into workspace_members (workspace_id, email, role) values
      ('ws-ada', 'ada@example.com', 'owner'),
      ('ws-bea', 'bea@example.com', 'owner')
  `;
  const created = await createSpace({
    workspaceId: "ws-ada",
    email: "ada@example.com",
    role: "owner",
    name: "Quiet room"
  });
  const invite = await createSpaceInvite({
    access: { ok: true, canModerate: true, space: created.space },
    session: freshSession("ada@example.com"),
    email: "ada@example.com"
  });
  await acceptSpaceInvite({
    inviteId: invite.inviteId,
    workspaceId: "ws-bea",
    email: "bea@example.com",
    role: "owner"
  });
  await sql`
    insert into posts (id, type, from_slug, body, created_at, author_kind, author_name, author_email, workspace_id, space_id)
    values ('hidden-note', 'message', 'human', 'secret', now(), 'human', 'Ada', 'ada@example.com', 'ws-ada', ${created.space.id})
  `;
  await setSpacePostHidden({
    access: { ok: true, canModerate: true, space: created.space },
    email: "ada@example.com",
    postId: "hidden-note",
    hidden: true
  });
  const people = await spaceParticipants(created.space.id);
  assert.equal(people.posters.some((person) => person.name === "Ada"), false);
  const saved = await createFile({
    workspaceId: "ws-ada",
    uploaderKind: "human",
    uploaderId: "ada@example.com",
    name: "note.txt",
    bytes: Buffer.from("hide")
  });
  assert.equal(saved.ok, true, saved.error);
  await sql`
    update board_files
    set space_id = ${created.space.id}, post_id = 'hidden-note'
    where id = ${saved.file.id}
  `;
  const outsider = await readFile({ id: saved.file.id, workspaceId: "ws-bea", viewer: bea });
  assert.equal(outsider.status, 404);
  const owner = await readFile({ id: saved.file.id, workspaceId: "ws-ada", viewer: ada });
  assert.equal(owner.ok, true);
  await markPostDeleted("hidden-note", "ws-ada");
  const still = await sql`select deleted_at from posts where id = 'hidden-note' and workspace_id = 'ws-ada'`;
  assert.equal(still[0].deleted_at, null);
  await sql`
    insert into comments (id, post_id, workspace_id, author_kind, author_name, body, space_id, author_workspace_id)
    values ('cmt-human', 'hidden-note', 'ws-ada', 'human', 'Ada', 'hello @dexter', ${created.space.id}, 'ws-ada')
  `;
  await rememberSpaceMentions("comment", "cmt-human", "ws-ada", ["ada/dexter"]);
  const mentions = await sql`select slug from comment_mentions where comment_id = 'cmt-human'`;
  assert.deepEqual(mentions.map((row) => row.slug), ["ada/dexter"]);
  void viewerFromSession;
});
