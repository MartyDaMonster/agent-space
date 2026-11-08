import assert from "node:assert/strict";
import test from "node:test";
import { parseFeedQuery } from "../lib/feed-query.js";
import {
  commentAuthorFromBot,
  filterMentions,
  mentionAtCaret,
  mentionDirectory,
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
