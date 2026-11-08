import { getSql } from "./db.js";
import {
  checkFile,
  contentDisposition,
  newFileId,
  privateBlobEnabled,
  publicFile,
  readFileIds
} from "./file-rules.js";

function ownerKey(owner) {
  return `${owner.kind}:${owner.id}`;
}

async function saveBlob(id, name, bytes, contentType) {
  const { put } = await import("@vercel/blob");
  const saved = await put(`files/${id}/${name}`, bytes, {
    access: "private",
    contentType,
    addRandomSuffix: false,
    cacheControlMaxAge: 0
  });
  if (!saved?.pathname || saved.pathname.includes("://")) {
    throw new Error("Private blob did not return a pathname.");
  }
  return saved.pathname;
}

async function saveBytes(id, name, bytes, contentType, owner) {
  const sql = getSql();
  const hex = Buffer.from(bytes).toString("hex");
  await sql`
    insert into files (id, name, content_type, size_bytes, storage, blob_path, bytes, created_by, created_at)
    values (
      ${id},
      ${name},
      ${contentType},
      ${bytes.byteLength},
      ${"db"},
      ${null},
      decode(${hex}, 'hex'),
      ${ownerKey(owner)},
      now()
    )
  `;
}

export async function storeUpload({ name, bytes, owner }) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const checked = checkFile({ name, bytes: view });
  if (!checked.ok) return checked;
  const id = newFileId();
  const body = Buffer.from(view);
  if (privateBlobEnabled()) {
    let pathname = "";
    try {
      pathname = await saveBlob(id, checked.name, body, checked.contentType);
    } catch {
      console.error("Private blob upload failed.");
      if (checked.size > 4 * 1024 * 1024) {
        return { ok: false, error: "Private file storage could not save that file." };
      }
    }
    if (pathname) {
      const sql = getSql();
      await sql`
        insert into files (id, name, content_type, size_bytes, storage, blob_path, created_by, created_at)
        values (
          ${id}, ${checked.name}, ${checked.contentType}, ${checked.size}, ${"blob"}, ${pathname}, ${ownerKey(owner)}, now()
        )
      `;
      return { ok: true, file: publicFile({ id, name: checked.name, content_type: checked.contentType, size_bytes: checked.size }) };
    }
  }
  await saveBytes(id, checked.name, body, checked.contentType, owner);
  return { ok: true, file: publicFile({ id, name: checked.name, content_type: checked.contentType, size_bytes: checked.size }) };
}

export async function readStoredFile(id) {
  const sql = getSql();
  const rows = await sql`
    select id, name, content_type, size_bytes, storage, blob_path,
           case when storage = 'db' then encode(bytes, 'base64') else null end as data
    from files
    where id = ${id}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  if (row.storage === "blob") {
    if (!row.blob_path || String(row.blob_path).includes("://")) return null;
    const { get } = await import("@vercel/blob");
    const result = await get(row.blob_path, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return { name: row.name, contentType: row.content_type, size: row.size_bytes, stream: result.stream };
  }
  if (!row.data) return null;
  return {
    name: row.name,
    contentType: row.content_type,
    size: row.size_bytes,
    buffer: Buffer.from(row.data, "base64")
  };
}

export function fileResponse(file) {
  const headers = {
    "Content-Type": file.contentType,
    "Content-Disposition": contentDisposition(file.name, file.contentType),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff"
  };
  if (file.size) headers["Content-Length"] = String(file.buffer ? file.buffer.length : file.size);
  return new Response(file.stream || file.buffer, { headers });
}

async function ownedIds(ids, owner) {
  if (!ids.length) return { ok: true, ids };
  const sql = getSql();
  const rows = await sql`
    select id, created_by from files where id = any(${ids})
  `;
  if (rows.length !== ids.length) return { ok: false, error: "That file was not found." };
  const mine = ownerKey(owner);
  if (rows.some((row) => row.created_by !== mine)) return { ok: false, error: "You can only attach files you uploaded." };
  return { ok: true, ids };
}

export async function attachToPost(postId, value, owner) {
  const parsed = readFileIds(value);
  if (!parsed.ok) return parsed;
  const owned = await ownedIds(parsed.ids, owner);
  if (!owned.ok) return owned;
  const sql = getSql();
  const previous = await collectPostFiles(postId);
  await sql`delete from post_files where post_id = ${postId}`;
  for (let index = 0; index < parsed.ids.length; index += 1) {
    await sql`
      insert into post_files (post_id, file_id, position)
      values (${postId}, ${parsed.ids[index]}, ${index})
    `;
  }
  await releaseFiles(previous.filter((row) => !parsed.ids.includes(row.id)));
  return { ok: true };
}

export async function attachToComment(commentId, value, owner) {
  const parsed = readFileIds(value);
  if (!parsed.ok) return parsed;
  if (!parsed.ids.length) return { ok: true };
  const owned = await ownedIds(parsed.ids, owner);
  if (!owned.ok) return owned;
  const sql = getSql();
  for (let index = 0; index < parsed.ids.length; index += 1) {
    await sql`
      insert into comment_files (comment_id, file_id, position)
      values (${commentId}, ${parsed.ids[index]}, ${index})
      on conflict do nothing
    `;
  }
  return { ok: true };
}

export async function fileCards({ postIds = [], commentIds = [] } = {}) {
  const posts = {};
  const comments = {};
  const sql = getSql();
  if (postIds.length) {
    const rows = await sql`
      select post_files.post_id, files.id, files.name, files.content_type, files.size_bytes
      from post_files
      join files on files.id = post_files.file_id
      where post_files.post_id = any(${postIds})
      order by post_files.position asc, files.id asc
    `;
    for (const row of rows) {
      posts[row.post_id] = posts[row.post_id] || [];
      posts[row.post_id].push(publicFile(row));
    }
  }
  if (commentIds.length) {
    const rows = await sql`
      select comment_files.comment_id, files.id, files.name, files.content_type, files.size_bytes
      from comment_files
      join files on files.id = comment_files.file_id
      where comment_files.comment_id = any(${commentIds})
      order by comment_files.position asc, files.id asc
    `;
    for (const row of rows) {
      comments[row.comment_id] = comments[row.comment_id] || [];
      comments[row.comment_id].push(publicFile(row));
    }
  }
  return { posts, comments };
}

export async function collectPostFiles(postId) {
  const sql = getSql();
  return sql`
    select files.id, files.storage, files.blob_path
    from files
    where files.id in (
      select file_id from post_files where post_id = ${postId}
      union
      select comment_files.file_id
      from comment_files
      join comments on comments.id = comment_files.comment_id
      where comments.post_id = ${postId}
    )
  `;
}

export async function collectCommentFiles(commentId) {
  const sql = getSql();
  return sql`
    select files.id, files.storage, files.blob_path
    from files
    join comment_files on comment_files.file_id = files.id
    where comment_files.comment_id = ${commentId}
  `;
}

export async function releaseFiles(rows) {
  const list = rows || [];
  if (!list.length) return;
  const sql = getSql();
  for (const row of list) {
    const still = await sql`
      select 1 as hit from post_files where file_id = ${row.id}
      union all
      select 1 from comment_files where file_id = ${row.id}
      limit 1
    `;
    if (still.length) continue;
    if (row.storage === "blob" && row.blob_path && !String(row.blob_path).includes("://")) {
      try {
        const { del } = await import("@vercel/blob");
        await del(row.blob_path);
      } catch {
        console.error("Private blob delete failed.");
      }
    }
    await sql`delete from files where id = ${row.id}`;
  }
}
