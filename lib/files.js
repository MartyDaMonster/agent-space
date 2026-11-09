import { randomBytes } from "node:crypto";
import { getSql } from "./db.js";
import {
  fileAccess,
  inspectUpload,
  quotaDecision,
  storageChoice,
  storageReport,
  WORKSPACE_QUOTA_BYTES
} from "./file-rules.js";

function newFileId() {
  return `file_${randomBytes(18).toString("base64url")}`;
}

function hasBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function asBuffer(value) {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value, "base64");
  return Buffer.from(value);
}

export function presentFile(row, viewer = {}) {
  if (!row) return null;
  const expired = Boolean(row.deleted_at);
  return {
    id: row.id,
    name: row.name,
    extension: row.extension,
    contentType: row.content_type,
    bytes: row.byte_size,
    expired,
    canDelete: !expired && viewer.kind === row.uploader_kind && viewer.id === row.uploader_id
  };
}

async function usedBytes(workspaceId) {
  const sql = getSql();
  const rows = await sql`
    select coalesce(sum(byte_size), 0)::bigint as bytes, count(*)::int as files
    from board_files
    where workspace_id = ${workspaceId} and deleted_at is null
  `;
  return { bytes: Number(rows[0]?.bytes || 0), files: Number(rows[0]?.files || 0) };
}

export async function workspaceUsage(workspaceId) {
  const usage = await usedBytes(workspaceId);
  return { ...usage, quota: WORKSPACE_QUOTA_BYTES };
}

export async function storageTotals(workspaceId) {
  const sql = getSql();
  const rows = await sql`
    select
      coalesce(sum(byte_size), 0)::bigint as overall_bytes,
      count(*)::int as overall_files,
      coalesce(sum(byte_size) filter (where workspace_id = ${workspaceId}), 0)::bigint as workspace_bytes,
      count(*) filter (where workspace_id = ${workspaceId})::int as workspace_files
    from board_files
    where deleted_at is null
  `;
  const row = rows[0] || {};
  return storageReport({
    workspaceBytes: row.workspace_bytes,
    workspaceFiles: row.workspace_files,
    overallBytes: row.overall_bytes,
    overallFiles: row.overall_files
  });
}

async function withQuota(workspaceId, size, insert) {
  const sql = getSql();
  if (!sql.pool) {
    const usage = await usedBytes(workspaceId);
    const room = quotaDecision({ usedBytes: usage.bytes, incomingBytes: size });
    if (!room.ok) return room;
    await insert();
    return { ok: true };
  }
  const client = await sql.pool.connect();
  try {
    await client.query("select pg_advisory_lock(hashtext($1)::bigint)", [workspaceId]);
    const usage = await client.query(
      "select coalesce(sum(byte_size), 0)::bigint as bytes from board_files where workspace_id = $1 and deleted_at is null",
      [workspaceId]
    );
    const room = quotaDecision({ usedBytes: usage.rows[0]?.bytes, incomingBytes: size });
    if (!room.ok) return room;
    await insert();
    return { ok: true };
  } finally {
    await client.query("select pg_advisory_unlock(hashtext($1)::bigint)", [workspaceId]).catch(() => {});
    client.release();
  }
}

async function storeBlob(pathname, bytes, contentType) {
  const { put } = await import("@vercel/blob");
  const saved = await put(pathname, bytes, {
    access: "private",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    contentType,
    addRandomSuffix: false
  });
  return saved.pathname;
}

async function readBlob(pathname) {
  const { get } = await import("@vercel/blob");
  const saved = await get(pathname, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
  if (!saved?.stream) return null;
  return Buffer.from(await new Response(saved.stream).arrayBuffer());
}

async function removeBlob(pathname) {
  if (!pathname || !hasBlob()) return;
  const { del } = await import("@vercel/blob");
  await del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN });
}

export async function createFile({ workspaceId, uploaderKind, uploaderId, name, bytes }) {
  const body = asBuffer(bytes);
  const inspected = inspectUpload({ name, size: body?.length || 0 });
  if (!inspected.ok) return inspected;
  const choice = storageChoice({ size: inspected.size, hasBlob: hasBlob() });
  if (!choice.ok) return choice;
  const id = newFileId();
  let blobPath = null;
  let stored = null;
  const reserved = await withQuota(workspaceId, inspected.size, async () => {
    if (choice.storage === "blob") {
      blobPath = await storeBlob(`workspaces/${workspaceId}/${id}/${inspected.name}`, body, inspected.contentType);
    } else {
      stored = body;
    }
    const sql = getSql();
    await sql`
      insert into board_files (
        id, workspace_id, name, extension, content_type, byte_size, storage, blob_path, body,
        uploader_kind, uploader_id
      ) values (
        ${id},
        ${workspaceId},
        ${inspected.name},
        ${inspected.extension},
        ${inspected.contentType},
        ${inspected.size},
        ${choice.storage},
        ${blobPath},
        ${stored},
        ${uploaderKind},
        ${uploaderId}
      )
    `;
  });
  if (!reserved.ok) return reserved;
  try {
    const next = await usedBytes(workspaceId);
    return {
      ok: true,
      file: presentFile({
        id,
        name: inspected.name,
        extension: inspected.extension,
        content_type: inspected.contentType,
        byte_size: inspected.size,
        uploader_kind: uploaderKind,
        uploader_id: uploaderId,
        deleted_at: null
      }, { kind: uploaderKind, id: uploaderId }),
      usage: { ...next, quota: WORKSPACE_QUOTA_BYTES }
    };
  } catch (error) {
    if (blobPath) await removeBlob(blobPath);
    throw error;
  }
}

async function loadRow(id) {
  const sql = getSql();
  const rows = await sql`
    select id, workspace_id, post_id, comment_id, name, extension, content_type, byte_size,
           storage, blob_path, body, uploader_kind, uploader_id, created_at, deleted_at
    from board_files
    where id = ${id}
    limit 1
  `;
  return rows[0] || null;
}

export async function readFile({ id, workspaceId, anonymous = false }) {
  const row = await loadRow(id);
  const gate = fileAccess({
    anonymous,
    actorWorkspace: workspaceId,
    file: row ? { workspaceId: row.workspace_id } : null
  });
  if (!gate.ok) return gate;
  if (row.deleted_at) return { ok: false, status: 404 };
  const bytes = row.storage === "blob" ? await readBlob(row.blob_path) : asBuffer(row.body);
  if (!bytes) return { ok: false, status: 404 };
  return { ok: true, file: row, bytes };
}

export async function deleteOwnFile({ id, workspaceId, uploaderKind, uploaderId, anonymous = false }) {
  const row = await loadRow(id);
  const gate = fileAccess({
    anonymous,
    actorWorkspace: workspaceId,
    file: row ? { workspaceId: row.workspace_id } : null
  });
  if (!gate.ok) return gate;
  if (row.deleted_at) return { ok: false, status: 404 };
  if (row.uploader_kind !== uploaderKind || row.uploader_id !== uploaderId) {
    return { ok: false, status: 404 };
  }
  await eraseStored(row);
  return { ok: true };
}

async function eraseStored(row) {
  await removeBlob(row.blob_path);
  const sql = getSql();
  await sql`
    update board_files
    set deleted_at = coalesce(deleted_at, now()), body = null, blob_path = null
    where id = ${row.id} and workspace_id = ${row.workspace_id}
  `;
}

export async function attachFiles({ ids = [], workspaceId, uploaderKind, uploaderId, postId = null, commentId = null }) {
  const unique = [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
  if (!unique.length) return { ok: true, files: [] };
  const sql = getSql();
  for (const id of unique) {
    const rows = await sql`
      select id, workspace_id, post_id, comment_id, uploader_kind, uploader_id, deleted_at
      from board_files
      where id = ${id}
      limit 1
    `;
    const row = rows[0];
    if (!row || row.deleted_at || row.workspace_id !== workspaceId) {
      return { ok: false, status: 404, error: "That file is gone." };
    }
    if (row.uploader_kind !== uploaderKind || row.uploader_id !== uploaderId || row.post_id || row.comment_id) {
      return { ok: false, status: 404, error: "That file is gone." };
    }
  }
  await sql`
    update board_files
    set post_id = ${postId}, comment_id = ${commentId}
    where id = any(${unique})
      and workspace_id = ${workspaceId}
      and uploader_kind = ${uploaderKind}
      and uploader_id = ${uploaderId}
      and post_id is null
      and comment_id is null
      and deleted_at is null
  `;
  return { ok: true };
}

export async function filesForPosts(postIds, workspaceId, viewer = {}) {
  const ids = [...new Set((postIds || []).filter(Boolean))];
  const posts = {};
  const comments = {};
  if (!ids.length) return { posts, comments };
  const sql = getSql();
  const rows = await sql`
    select board_files.id, board_files.post_id, board_files.comment_id, board_files.name, board_files.extension, board_files.content_type,
           board_files.byte_size, board_files.uploader_kind, board_files.uploader_id, board_files.deleted_at
    from board_files
    where board_files.workspace_id = ${workspaceId}
      and (
        board_files.post_id = any(${ids})
        or board_files.comment_id in (select comments.id from comments where comments.post_id = any(${ids}))
      )
    order by board_files.created_at asc
  `;
  for (const row of rows) {
    const card = presentFile(row, viewer);
    if (row.comment_id) {
      comments[row.comment_id] = comments[row.comment_id] || [];
      comments[row.comment_id].push(card);
    } else if (row.post_id) {
      posts[row.post_id] = posts[row.post_id] || [];
      posts[row.post_id].push(card);
    }
  }
  return { posts, comments };
}

export async function removeFilesForPost(postId, workspaceId) {
  const sql = getSql();
  const rows = await sql`
    select id, workspace_id, storage, blob_path
    from board_files
    where workspace_id = ${workspaceId}
      and deleted_at is null
      and (
        post_id = ${postId}
        or comment_id in (select id from comments where post_id = ${postId})
      )
  `;
  for (const row of rows) await removeBlob(row.blob_path);
  if (rows.length) {
    await sql`
      delete from board_files
      where workspace_id = ${workspaceId}
        and id = any(${rows.map((row) => row.id)})
    `;
  }
}

export async function expireOldFiles() {
  const sql = getSql();
  const rows = await sql`
    select board_files.id, board_files.workspace_id, board_files.blob_path
    from board_files
    left join posts on posts.id = board_files.post_id
    left join comments on comments.id = board_files.comment_id
    left join posts comment_posts on comment_posts.id = comments.post_id
    where board_files.deleted_at is null
      and board_files.created_at < now() - interval '30 days'
      and posts.pinned_at is null
      and comment_posts.pinned_at is null
  `;
  for (const row of rows) await eraseStored(row);
  return { deleted: rows.length };
}
