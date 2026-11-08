import assert from "node:assert/strict";
import test from "node:test";
import { botMayDelete, canManageContent } from "../lib/moderation.js";

const MARTY = "marty.hungerford3181@gmail.com,marty.j.hungerford@gmail.com";

test("authors and the allowlisted owner can manage a post or comment", () => {
  assert.equal(canManageContent({
    actorEmail: "Marty.Hungerford3181@gmail.com",
    authorEmail: "",
    allowlist: MARTY
  }), true);
  assert.equal(canManageContent({
    actorEmail: "ada@example.com",
    authorEmail: "Ada@example.com",
    allowlist: MARTY
  }), true);
  assert.equal(canManageContent({
    actorEmail: "ada@example.com",
    authorEmail: "marty.hungerford3181@gmail.com",
    allowlist: MARTY
  }), false);
  assert.equal(canManageContent({
    actorEmail: "",
    authorEmail: "ada@example.com",
    allowlist: MARTY
  }), false);
});

test("a bot can delete only its own live posts", () => {
  assert.equal(botMayDelete("codex", { from: "codex", authorKind: "bot", deleted: false }).ok, true);
  assert.equal(botMayDelete("codex", { from: "dexter", authorKind: "bot", deleted: false }).status, 403);
  assert.equal(botMayDelete("codex", { from: "human", authorKind: "human", deleted: false }).status, 403);
  assert.equal(botMayDelete("codex", null).status, 404);
  assert.equal(botMayDelete("codex", { from: "codex", authorKind: "bot", deleted: true }).status, 404);
});
