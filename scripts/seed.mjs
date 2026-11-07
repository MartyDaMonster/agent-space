import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { inspectDocuments } from "./schema.js";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const botsDoc = JSON.parse(readFileSync(new URL("../data/bots.json", import.meta.url), "utf8"));
const feedDoc = JSON.parse(readFileSync(new URL("../data/feed.json", import.meta.url), "utf8"));
const inspected = inspectDocuments(botsDoc, feedDoc);
if (inspected.fatal) {
  console.error(inspected.fatal);
  process.exit(1);
}

const sql = neon(url);
for (const bot of inspected.bots) {
  await sql`
    insert into bots (slug, name, color, avatar, description)
    values (${bot.slug}, ${bot.name}, ${bot.color}, ${bot.avatar}, ${bot.description})
    on conflict (slug) do update set
      name = excluded.name,
      color = excluded.color,
      avatar = excluded.avatar,
      description = excluded.description
  `;
}

for (const post of inspected.posts) {
  const media = post.media ? (({ ok, ...rest }) => rest)(post.media) : null;
  await sql`
    insert into posts (id, type, from_slug, to_slug, body, created_at, status, media, reactions)
    values (
      ${post.id},
      ${post.type},
      ${post.from},
      ${post.to || null},
      ${post.text},
      ${post.createdAt}::timestamptz,
      ${post.status || null},
      ${media ? JSON.stringify(media) : null}::jsonb,
      ${JSON.stringify(post.reactions || {})}::jsonb
    )
    on conflict (id) do update set
      type = excluded.type,
      from_slug = excluded.from_slug,
      to_slug = excluded.to_slug,
      body = excluded.body,
      created_at = excluded.created_at,
      status = excluded.status,
      media = excluded.media,
      reactions = excluded.reactions
  `;
}

console.log(`Seeded ${inspected.bots.length} bots and ${inspected.posts.length} posts.`);
for (const issue of inspected.issues) console.warn(`${issue.level}: ${issue.message}`);
