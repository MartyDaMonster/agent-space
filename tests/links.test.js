import assert from "node:assert/strict";
import test from "node:test";
import { collectLinkInputs, displayLinks, extractUrls, parseGithubLink, splitText, urlHasCredential } from "../lib/links.js";

const BLOB = "https://github.com/acme/private-notes/blob/main/docs/brief.md";
const TREE = "https://github.com/acme/private-notes/tree/main/docs";
const RAW = "https://github.com/acme/private-notes/raw/main/docs/brief.md";
const PULL = "https://github.com/acme/private-notes/pull/12";
const ISSUE = "https://github.com/acme/private-notes/issues/4";

test("github file, tree, raw, pull, and issue addresses become cards", () => {
  assert.equal(parseGithubLink(BLOB).fileName, "brief.md");
  assert.equal(parseGithubLink(BLOB).path, "docs/brief.md");
  assert.equal(parseGithubLink(BLOB).repo, "acme/private-notes");
  assert.equal(parseGithubLink(BLOB).githubType, "blob");
  assert.equal(parseGithubLink(TREE).githubType, "tree");
  assert.equal(parseGithubLink(TREE).fileName, "docs");
  assert.equal(parseGithubLink(RAW).githubType, "raw");
  assert.equal(parseGithubLink(PULL).fileName, "Pull request #12");
  assert.equal(parseGithubLink(ISSUE).githubType, "issue");
  assert.equal(parseGithubLink("https://www.github.com/acme/private-notes/pull/3/files").githubType, "pull");
  assert.equal(parseGithubLink("https://example.com/readme.md"), null);
});

test("token URLs are rejected and public links still work", () => {
  assert.equal(urlHasCredential("https://example.com/file?token=abc"), true);
  assert.equal(urlHasCredential("https://example.com/file?access_token=abc"), true);
  assert.equal(urlHasCredential("https://example.com/file?access-token=abc"), true);
  assert.equal(urlHasCredential("https://user:secret@example.com/file"), true);
  assert.equal(urlHasCredential(BLOB), false);
  assert.equal(urlHasCredential("https://github.com/acme/repo/blob/main/token.md"), false);
  const rejected = collectLinkInputs({ extras: [{ url: "https://files.example.com/a?token=1" }] });
  assert.equal(rejected.ok, false);
  const kept = collectLinkInputs({
    text: `See ${BLOB} and https://botomatic.dev/privacy.`,
    extras: [{ url: "https://botomatic.dev/privacy", title: "Privacy" }]
  });
  assert.equal(kept.ok, true);
  assert.equal(kept.links.length, 2);
  assert.equal(kept.links[0].title, "Privacy");
  assert.equal(kept.links[1].kind, "github");
  assert.equal(kept.links[1].fileName, "brief.md");
  const shown = displayLinks({ text: `Hello ${BLOB}`, legacy: "https://botomatic.dev" });
  assert.equal(shown.length, 2);
  assert.equal(extractUrls(`(${BLOB}).`).length, 1);
  assert.equal(splitText(`Read ${BLOB} today.`)[1].href, BLOB);
});
