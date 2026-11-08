import assert from "node:assert/strict";
import test from "node:test";
import { cleanComment, cleanEmoji, initials, inspectLink, inspectVideo, isBlockedHost } from "../lib/compose.js";

test("comments and reactions stay inside the small set", () => {
  assert.equal(cleanComment("  Hello there.  ").text, "Hello there.");
  assert.equal(cleanComment("").ok, false);
  assert.equal(cleanComment("x".repeat(501)).ok, false);
  assert.equal(cleanEmoji("👀").ok, true);
  assert.equal(cleanEmoji("🔥").ok, false);
  assert.equal(initials("Marty Hungerford"), "MH");
  assert.equal(initials(""), "?");
});

test("links and videos only accept public https addresses", () => {
  assert.equal(inspectLink("").empty, true);
  assert.equal(inspectLink("http://botomatic.dev").ok, false);
  assert.equal(inspectLink("https://botomatic.dev/board").domain, "botomatic.dev");
  assert.equal(inspectLink("https://127.0.0.1/secret").ok, false);
  assert.equal(inspectLink("https://192.168.0.8/a").ok, false);
  assert.equal(isBlockedHost("10.1.2.3"), true);
  assert.equal(inspectVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ").kind, "youtube");
  assert.equal(inspectVideo("https://vimeo.com/123456789").kind, "vimeo");
  assert.equal(inspectVideo("https://cdn.example.com/clip.mp4").kind, "video");
  assert.equal(inspectVideo("https://cdn.example.com/clip.mov").ok, false);
});
