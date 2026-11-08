import assert from "node:assert/strict";
import test from "node:test";
import { parseFeedQuery } from "../lib/feed-query.js";
import { readFileSync } from "node:fs";
import {
  commentAuthorFromBot,
  exposeMentions,
  filterMentions,
  mentionAtCaret,
  mentionDirectory,
  mentionNotice,
  mentionSlugsIn,
  splitMentions
} from "../lib/mentions.js";
import { canEditComment } from "../lib/moderation.js";

test("a bot comment still has an author when the key lookup has no name", () => {
  const author = commentAuthorFromBot({ slug: "dexter" });
  assert.equal(author.ok, true);
  assert.equal(author.slug, "dexter");
  assert.equal(author.name, "dexter");
  assert.equal(commentAuthorFromBot({ slug: "dexter", name: "Dexter" }).name, "Dexter");
  assert.equal(commentAuthorFromBot({}).ok, false);
  assert.notEqual(author.name, null);
  assert.notEqual(author.name, undefined);
});

test("mentions match bots and humans and can be filtered", () => {
  const people = mentionDirectory(
    [{ slug: "dexter", name: "Dexter" }],
    [{ email: "ada@example.com", name: "Ada Lovelace" }]
  );
  assert.deepEqual(people.map((person) => person.slug), ["dexter", "ada-lovelace"]);
  assert.deepEqual(mentionSlugsIn("Hello @dexter and @nope", people.map((person) => person.slug)), ["dexter"]);
  assert.equal(mentionAtCaret("ping @de", 8).query, "de");
  assert.equal(filterMentions(people, "ada")[0].name, "Ada Lovelace");
  assert.equal(filterMentions(people, "dex")[0].kind, "bot");
  assert.equal(splitMentions("Hi @dexter", people)[1].slug, "dexter");
  assert.equal(parseFeedQuery(new URLSearchParams("mentions=dexter")).mentions, "dexter");
  assert.equal(parseFeedQuery(new URLSearchParams("mentions=Dexter")).ok, false);
});

test("a note mentions and notifies the same people as a comment", () => {
  const people = mentionDirectory(
    [{ slug: "dexter", name: "Dexter" }],
    [{ email: "ada@example.com", name: "Ada Lovelace" }]
  );
  const note = "Hey @dexter, can you look?\nAlso @Ada-Lovelace and @nope.";
  const comment = "Hey @dexter, can you look? Also @ada-lovelace and @nope.";
  assert.deepEqual(mentionNotice(note, people), ["dexter", "ada-lovelace"]);
  assert.deepEqual(mentionNotice(note, people), mentionNotice(comment, people));
  assert.deepEqual(mentionSlugsIn(note, people.map((person) => person.slug)), mentionNotice(note, people));
  const dexter = splitMentions(note, people).find((part) => part.slug === "dexter");
  assert.equal(dexter.kind, "bot");
  assert.equal(dexter.name, "Dexter");
  const ada = splitMentions(note, people).find((part) => part.slug === "ada-lovelace");
  assert.equal(ada.kind, "human");
  const saved = "Updated note for @dexter only.";
  assert.deepEqual(mentionNotice(saved, people), ["dexter"]);
});

test("the feed exposes note mentions beside comment mentions", () => {
  const posts = exposeMentions([
    {
      id: "note-1",
      text: "Hey @dexter",
      comments: [{ id: "cmt-1", text: "Looping @ada-lovelace" }]
    },
    { id: "note-2", text: "No mentions here." }
  ], {
    postsById: { "note-1": ["dexter"] },
    commentsById: { "cmt-1": ["ada-lovelace"] }
  });
  assert.deepEqual(posts[0].mentions, ["dexter"]);
  assert.deepEqual(posts[0].comments[0].mentions, ["ada-lovelace"]);
  assert.deepEqual(posts[1].mentions, []);
  assert.equal(posts[0].text, "Hey @dexter");
});

test("notes store mentions with the same call comments use", () => {
  const actions = readFileSync(new URL("../app/feed/actions.js", import.meta.url), "utf8");
  const api = readFileSync(new URL("../app/api/posts/route.js", import.meta.url), "utf8");
  const store = readFileSync(new URL("../lib/mention-store.js", import.meta.url), "utf8");
  const posts = readFileSync(new URL("../lib/posts.js", import.meta.url), "utf8");
  assert.match(actions, /rememberMentions\("post", noteId, text\.text\)/);
  assert.match(actions, /rememberMentions\("post", post\.id, text\.text\)/);
  assert.match(actions, /rememberMentions\("comment", commentId, text\.text\)/);
  assert.match(actions, /rememberMentions\("comment", comment\.id, text\.text\)/);
  assert.match(api, /rememberMentions\("post", post\.id, post\.text\)/);
  assert.match(api, /exposeMentions\(/);
  assert.match(store, /from post_mentions/);
  assert.match(store, /from comment_mentions/);
  assert.match(posts, /from post_mentions/);
  assert.match(posts, /from comment_mentions/);
});

test("only the human who wrote a comment can edit it", () => {
  assert.equal(canEditComment({
    actorEmail: "Ada@example.com",
    authorEmail: "ada@example.com",
    authorKind: "human"
  }), true);
  assert.equal(canEditComment({
    actorEmail: "ada@example.com",
    authorEmail: "ada@example.com",
    authorKind: "bot"
  }), false);
  assert.equal(canEditComment({
    actorEmail: "marty@example.com",
    authorEmail: "ada@example.com",
    authorKind: "human"
  }), false);
});
