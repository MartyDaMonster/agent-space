import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { activityPage, decodeCursor, encodeCursor } from "../lib/activity.js";
import { parseFeedQuery } from "../lib/feed-query.js";

const cursor = "2026-11-07T00:00:00Z";

function post(id, createdAt, extra = {}) {
  return { id, createdAt, editedAt: "", text: id, comments: [], ...extra };
}

test("a mention comment on an older post is returned after the cursor", () => {
  const older = post("old-thread", "2026-11-01T00:00:00Z", { text: "An older post." });
  assert.equal(activityPage([older], { cursor }).posts.length, 0);
  older.comments.push({
    id: "c-mention",
    createdAt: "2026-11-08T12:00:00Z",
    editedAt: "",
    text: "@dexter this thread moved"
  });
  const page = activityPage([older, post("quiet", "2026-10-01T00:00:00Z")], { cursor });
  assert.equal(page.posts.length, 1);
  assert.equal(page.posts[0].id, "old-thread");
  assert.match(page.posts[0].comments[0].text, /@dexter/);
  assert.equal(page.nextCursor, null);
  assert.equal(decodeCursor(page.cursor).id, "old-thread");
});

test("edits are activity and pages walk past the newest posts", () => {
  const posts = [
    post("created-after", "2026-11-08T01:00:00Z"),
    post("edited-after", "2026-10-02T00:00:00Z", { editedAt: "2026-11-08T02:00:00Z" }),
    post("comment-edited", "2026-10-03T00:00:00Z", {
      comments: [{ id: "c1", createdAt: "2026-10-04T00:00:00Z", editedAt: "2026-11-08T03:00:00Z", text: "updated" }]
    }),
    post("deleted-comment", "2026-10-05T00:00:00Z", {
      comments: [{ id: "c2", createdAt: "2026-11-08T04:00:00Z", deletedAt: "2026-11-08T04:01:00Z", text: "gone" }]
    }),
    post("removed", "2026-11-08T05:00:00Z", { deletedAt: "2026-11-08T05:01:00Z" })
  ];
  let position = cursor;
  const seen = [];
  for (let step = 0; step < 5; step += 1) {
    const page = activityPage(posts, { cursor: position, limit: 1 });
    seen.push(...page.posts.map((item) => item.id));
    if (!page.nextCursor) break;
    position = page.nextCursor;
  }
  assert.deepEqual(seen, ["created-after", "edited-after", "comment-edited"]);
});

test("a cursor round-trips and rejects a mix with since", () => {
  const encoded = encodeCursor("2026-11-08T12:00:00.123Z", "old-thread");
  assert.equal(decodeCursor(encoded).id, "old-thread");
  assert.equal(parseFeedQuery(new URLSearchParams("cursor=")).cursor, "");
  assert.equal(parseFeedQuery(new URLSearchParams(`cursor=${encoded}`)).ok, true);
  assert.equal(parseFeedQuery(new URLSearchParams("cursor=yesterday")).ok, false);
  assert.equal(parseFeedQuery(new URLSearchParams(`since=${cursor}&cursor=${cursor}`)).ok, false);
  assert.equal(parseFeedQuery(new URLSearchParams(`since=${cursor}`)).since, cursor);
  assert.equal(parseFeedQuery(new URLSearchParams(`since=${cursor}`)).cursor, null);
});

test("the activity query includes comment and edit times", () => {
  const source = readFileSync(new URL("../lib/posts.js", import.meta.url), "utf8");
  assert.match(source, /posts\.created_at > \$\{since\}/);
  assert.match(source, /posts\.edited_at/);
  assert.match(source, /c\.created_at/);
  assert.match(source, /c\.edited_at/);
  assert.match(source, /c\.deleted_at is null/);
  assert.match(source, /order by feed\.activity_at asc, feed\.id asc/);
});
