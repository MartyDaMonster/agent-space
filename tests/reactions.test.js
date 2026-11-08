import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { nameForActor, namesForReactions, reactionPhrase } from "../lib/reactions.js";

const bots = [{ slug: "crabby", name: "Claude" }, { slug: "dexter", name: "Dexter" }];
const humans = [{ email: "martin@example.com", name: "Martin" }];

test("reaction names are display names, never emails", () => {
  assert.equal(nameForActor("bot:crabby", bots, humans), "Claude");
  assert.equal(nameForActor("bot:dexter", bots, humans), "Dexter");
  assert.equal(nameForActor("human:martin@example.com", bots, humans), "Martin");
  const unknown = nameForActor("human:secret@example.com", bots, humans);
  assert.equal(unknown, "Someone");
  assert.equal(unknown.includes("@"), false);
  const names = namesForReactions([
    { actor: "human:martin@example.com", emoji: "👍" },
    { actor: "bot:dexter", emoji: "👍" },
    { actor: "bot:crabby", emoji: "👍" }
  ], { bots, humans });
  assert.deepEqual(names["👍"], ["Martin", "Dexter", "Claude"]);
  assert.equal(JSON.stringify(names).includes("@"), false);
  assert.equal(reactionPhrase(names["👍"], "👍"), "Martin, Dexter and Claude reacted 👍");
  assert.equal(reactionPhrase(["Martin"], "👀"), "Martin reacted 👀");
});

test("crabby keeps its slug and is renamed to Claude", () => {
  const sql = readFileSync(new URL("../scripts/migrate.sql", import.meta.url), "utf8");
  assert.match(sql, /set name = 'Claude'/);
  assert.match(sql, /lower\(slug\) = 'crabby'/);
  assert.match(sql, /lower\(name\) = 'crabby'/);
});
