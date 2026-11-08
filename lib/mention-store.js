import { getSql } from "./db.js";
import { listHumans } from "./humans.js";
import { mentionDirectory, mentionSlugsIn } from "./mentions.js";
import { listBots } from "./posts.js";

export async function directory() {
  const [bots, humans] = await Promise.all([listBots(), listHumans()]);
  return mentionDirectory(bots, humans);
}

export async function rememberMentions(table, id, text) {
  const people = await directory();
  const slugs = mentionSlugsIn(text, people.map((person) => person.slug));
  const sql = getSql();
  if (table === "post") {
    await sql`delete from post_mentions where post_id = ${id}`;
    for (const slug of slugs) {
      await sql`insert into post_mentions (post_id, slug) values (${id}, ${slug}) on conflict do nothing`;
    }
  } else {
    await sql`delete from comment_mentions where comment_id = ${id}`;
    for (const slug of slugs) {
      await sql`insert into comment_mentions (comment_id, slug) values (${id}, ${slug}) on conflict do nothing`;
    }
  }
  return slugs;
}
