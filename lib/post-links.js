import { getSql } from "./db.js";

function mapLink(row) {
  return {
    url: row.url,
    title: row.title || "",
    domain: row.domain,
    kind: row.kind,
    repo: row.repo || "",
    path: row.path || "",
    fileName: row.file_name || "",
    githubType: row.github_type || ""
  };
}

async function replaceRows(table, id, links) {
  const sql = getSql();
  if (table === "post_links") await sql`delete from post_links where post_id = ${id}`;
  else await sql`delete from comment_links where comment_id = ${id}`;
  for (let position = 0; position < links.length; position += 1) {
    const link = links[position];
    if (table === "post_links") {
      await sql`
        insert into post_links (post_id, url, title, domain, kind, repo, path, file_name, github_type, position)
        values (
          ${id}, ${link.url}, ${link.title || ""}, ${link.domain}, ${link.kind},
          ${link.repo || ""}, ${link.path || ""}, ${link.fileName || ""}, ${link.githubType || ""}, ${position}
        )
      `;
    } else {
      await sql`
        insert into comment_links (comment_id, url, title, domain, kind, repo, path, file_name, github_type, position)
        values (
          ${id}, ${link.url}, ${link.title || ""}, ${link.domain}, ${link.kind},
          ${link.repo || ""}, ${link.path || ""}, ${link.fileName || ""}, ${link.githubType || ""}, ${position}
        )
      `;
    }
  }
}

export function replacePostLinks(postId, links) {
  return replaceRows("post_links", postId, links);
}

export function replaceCommentLinks(commentId, links) {
  return replaceRows("comment_links", commentId, links);
}

export async function linksFor({ postIds = [], commentIds = [] } = {}) {
  const posts = {};
  const comments = {};
  const sql = getSql();
  if (postIds.length) {
    const rows = await sql`
      select post_id, url, title, domain, kind, repo, path, file_name, github_type
      from post_links
      where post_id = any(${postIds})
      order by position asc, url asc
    `;
    for (const row of rows) {
      posts[row.post_id] = posts[row.post_id] || [];
      posts[row.post_id].push(mapLink(row));
    }
  }
  if (commentIds.length) {
    const rows = await sql`
      select comment_id, url, title, domain, kind, repo, path, file_name, github_type
      from comment_links
      where comment_id = any(${commentIds})
      order by position asc, url asc
    `;
    for (const row of rows) {
      comments[row.comment_id] = comments[row.comment_id] || [];
      comments[row.comment_id].push(mapLink(row));
    }
  }
  return { posts, comments };
}
