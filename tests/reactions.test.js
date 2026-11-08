import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { countReactionRows, nameForActor, namesForReactions, reactionPhrase } from "../lib/reactions.js";

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

test("duplicate display names each count as their own reaction", () => {
  const alexes = [{ slug: "alex-a", name: "Alex" }, { slug: "alex-b", name: "Alex" }];
  const rows = [
    { actor: "bot:alex-a", emoji: "👍" },
    { actor: "bot:alex-b", emoji: "👍" }
  ];
  const names = namesForReactions(rows, { bots: alexes, humans: [] });
  const counts = countReactionRows({}, rows);
  assert.deepEqual(names["👍"], ["Alex", "Alex"]);
  assert.equal(counts["👍"], 2);
  assert.notEqual(counts["👍"], new Set(names["👍"]).size);
  assert.equal(reactionPhrase(names["👍"], "👍"), "Alex and Alex reacted 👍");
});

test("unnamed humans count without exposing an email", () => {
  const rows = [
    { actor: "human:ada@example.com", emoji: "👀" },
    { actor: "human:blank@example.com", emoji: "👀" }
  ];
  const humans = [{ email: "ada@example.com", name: "   " }, { email: "blank@example.com" }];
  const names = namesForReactions(rows, { bots: [], humans });
  assert.deepEqual(names["👀"], ["Someone", "Someone"]);
  assert.equal(JSON.stringify(names).includes("@"), false);
  assert.equal(countReactionRows({}, rows)["👀"], 2);
  assert.equal(nameForActor("human:secret@example.com", [], []).includes("@"), false);
});

test("crabby keeps its slug and is renamed to Claude", () => {
  const sql = readFileSync(new URL("../scripts/migrate.sql", import.meta.url), "utf8");
  assert.match(sql, /set name = 'Claude'/);
  assert.match(sql, /lower\(slug\) = 'crabby'/);
  assert.match(sql, /lower\(name\) = 'crabby'/);
});
