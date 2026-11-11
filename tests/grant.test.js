import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AVATAR_COLORS, AVATAR_SHAPES, LEGACY_AVATARS, resolveAvatarChoice } from "../lib/avatar-presets.js";
import { botStartInstructions, prepareBotEdit, prepareGrant } from "../lib/grant.js";
import { PLATFORMS } from "../lib/platforms.js";
import { resolveAvatar } from "../lib/store-avatar.js";
import { slugFromName } from "../lib/slug.js";

const SLUG_HELP = "Short ID used in the bot's posts and API. Lowercase, no spaces.";

test("the getting started note includes this bot's slug and key", () => {
  const note = botStartInstructions({ name: "Dexter", slug: "dexter", token: "btm_once" });
  assert.match(note, /private board/);
  assert.match(note, /https:\/\/botomatic\.dev/);
  assert.match(note, /Authorization: Bearer btm_once/);
  assert.match(note, /Your slug: dexter/);
  assert.match(note, /@dexter/);
  assert.match(note, /cursor=/);
  assert.match(note, /nextCursor/);
  assert.match(note, /POST https:\/\/botomatic\.dev\/api\/posts/);
  assert.match(note, /handoff/);
  assert.match(note, /\/comments/);
  assert.match(note, /\/reactions/);
  assert.match(note, /@everyone/);
  assert.match(note, /Never put secrets/);
  assert.match(note, /Check the board at least every 15 minutes/);
  assert.match(note, /recurring check at least every 15 minutes/);
  assert.doesNotMatch(note, /Anthropic's cloud/);
  assert.equal(note.includes("btm_other"), false);
  const claude = botStartInstructions({
    name: "Claude",
    slug: "crabby",
    token: "btm_once",
    platform: "claude",
    ownerName: "Ada",
    otherBots: "Grok Bot (grok-bot)"
  });
  assert.match(claude, /cloud-based scheduled task/);
  assert.match(claude, /never in the prompt text/);
  assert.match(claude, /environment called "Botomatic"/);
  assert.match(claude, /owned by Ada/);
  assert.match(claude, /Grok Bot \(grok-bot\)/);
  assert.match(claude, /Australian English/);
  assert.match(claude, /Australia\/Sydney/);
  assert.equal(claude.includes("btm_once"), false);
  const unnamed = botStartInstructions({ name: "Claude", slug: "crabby", token: "bmk_live_shouldnotappear", platform: "claude" });
  assert.match(unnamed, /owned by you/);
  assert.equal(unnamed.includes("bmk_live_shouldnotappear"), false);
  assert.equal(unnamed.includes("owned by Claude"), false);
  const codex = botStartInstructions({ name: "Codex", slug: "codex", token: "btm_once", platform: "codex" });
  assert.match(codex, /scheduled task or automation that runs every 15 minutes/);
  assert.doesNotMatch(codex, /Anthropic's cloud/);
  assert.equal(botStartInstructions({ name: "Nova", slug: "nova", token: "btm_nova" }).includes("Your slug: dexter"), false);
  for (const name of ["Nova", "Nova \"QA\"", "Nova \\ QA"]) {
    const note = botStartInstructions({ name, slug: "nova", token: "btm_nova" });
    const hello = note.split("\n").find((line) => line.includes('"type":"message"'));
    assert.equal(JSON.parse(hello).text, `Hello from ${name}.`);
    assert.equal(JSON.parse(hello).id, "nova-hello");
  }
});

test("a name becomes a lowercase slug and stays editable input", () => {
  assert.equal(slugFromName("Codex"), "codex");
  assert.equal(slugFromName("Grok Bot"), "grok-bot");
  assert.equal(slugFromName("  Hello, World! "), "hello-world");
  const grant = prepareGrant({ name: "Codex", slug: "codex-lab", platform: "codex" });
  assert.equal(grant.ok, true);
  assert.equal(grant.slug, "codex-lab");
  assert.equal(prepareGrant({ name: "Codex", slug: "Codex", platform: "codex" }).slug, "codex");
  assert.equal(prepareGrant({ name: "Codex", slug: "bad_slug", platform: "codex" }).ok, false);
  assert.equal(prepareGrant({ name: "", slug: "codex", platform: "codex" }).ok, false);
  assert.match(SLUG_HELP, /Lowercase, no spaces/);
});

test("platforms are Grok, Claude, Codex, Meta, and Other", () => {
  assert.deepEqual(PLATFORMS.map((platform) => platform.id), ["grok", "claude", "codex", "meta", "other"]);
  assert.deepEqual(PLATFORMS.map((platform) => platform.label), ["Grok", "Claude", "Codex", "Meta", "Other"]);
  assert.equal(prepareGrant({ name: "Nova", slug: "nova", platform: "gemini" }).ok, false);
  assert.equal(prepareGrant({ name: "Nova", slug: "nova", platform: "meta" }).platform, "meta");
  assert.equal(prepareGrant({ name: "Nova", slug: "nova", platform: "other" }).platform, "other");
});

test("a bot card edit keeps the slug and checks the fields", () => {
  const edited = prepareBotEdit({
    name: "Crabby",
    platform: "claude",
    description: "Granted access on Claude."
  });
  assert.equal(edited.ok, true);
  assert.equal(edited.platform, "claude");
  assert.equal(prepareBotEdit({ name: "Crabby", platform: "gemini", description: "Hi" }).ok, false);
  assert.equal(prepareBotEdit({ name: "", platform: "claude", description: "Hi" }).ok, false);
  const sql = readFileSync(new URL("../scripts/migrate.sql", import.meta.url), "utf8");
  assert.match(sql, /description = 'Granted access on Grok\.'/);
  assert.match(sql, /description = 'Granted access on Claude\.'/);
  assert.match(sql, /platform = 'claude'/);
  assert.match(sql, /lower\(slug\) = 'crabby'/);
});

test("avatars are one solid shape plus a separate colour", () => {
  assert.equal(AVATAR_SHAPES.length, 17);
  for (const id of ["triangle", "cone", "rugby"]) {
    assert.ok(AVATAR_SHAPES.some((shape) => shape.id === id), id);
  }
  assert.equal(new Set(AVATAR_SHAPES.map((shape) => shape.id)).size, AVATAR_SHAPES.length);
  assert.equal(AVATAR_SHAPES.some((shape) => shape.id === "snail"), false);
  assert.equal(AVATAR_COLORS.find((color) => color.id === "lime").hex, "#a3d32b");
  for (const id of ["pink", "violet", "cyan", "orange", "yellow", "red", "blue", "grey"]) {
    assert.ok(AVATAR_COLORS.some((color) => color.id === id), id);
  }
  for (const shape of AVATAR_SHAPES) {
    assert.ok(shape.paths.length >= 1, shape.id);
    assert.equal(shape.eyes.length, 2, shape.id);
    for (const path of shape.paths) {
      assert.doesNotMatch(path, /stroke|#|fill/i, shape.id);
    }
  }
  const mark = readFileSync(new URL("../components/AvatarMark.js", import.meta.url), "utf8");
  assert.match(mark, /fill="currentColor"/);
  assert.match(mark, /fill="#fff"/);
  assert.match(mark, /stroke="currentColor"/);
  assert.doesNotMatch(mark, /stroke="#|r="2\.1"/);
  const picker = readFileSync(new URL("../components/GrantAccess.js", import.meta.url), "utf8");
  assert.doesNotMatch(picker, /Find an avatar|preset-label/);
  assert.match(picker, /aria-label=\{item.label\}/);
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /aspect-ratio:\s*1/);
  assert.doesNotMatch(css, /checked \+ span img/);
  const picked = resolveAvatar({ shape: "cloud", color: "pink", required: true });
  assert.equal(picked.avatar, "cloud");
  assert.equal(picked.color, "pink");
  assert.equal(resolveAvatar({ shape: "snail", color: "violet", required: true }).ok, false);
  assert.equal(resolveAvatar({ shape: "", color: "", required: false }).skipped, true);
});

test("older preset ids and uploads still resolve to a shape and colour", () => {
  const sql = readFileSync(new URL("../scripts/migrate.sql", import.meta.url), "utf8");
  for (const [id, [shape, color]] of Object.entries(LEGACY_AVATARS)) {
    const choice = resolveAvatarChoice({ avatar: id });
    assert.equal(choice.shape, shape, id);
    assert.equal(choice.color, color, id);
    assert.match(sql, new RegExp(`'${id}'`));
  }
  assert.equal(resolveAvatarChoice({ avatar: "snail-violet" }).shape, "circle");
  assert.equal(resolveAvatarChoice({ avatar: "frog-lime" }).color, "lime");
  assert.deepEqual(
    resolveAvatarChoice({ avatar: "upload", avatarUrl: "data:image/png;base64,aaaa" }),
    resolveAvatarChoice({ avatar: "cloud", avatarColor: "pink" })
  );
  assert.equal(
    resolveAvatarChoice({ avatarUrl: "https://example.blob.vercel-storage.com/avatars/a.png" }).shape,
    "cloud"
  );
  assert.equal(
    resolveAvatarChoice({ avatar: "cloud-pink", avatarShape: "star", avatarColor: "orange" }).shape,
    "star"
  );
  assert.equal(resolveAvatarChoice({ avatar: "assets/avatars/grok.svg" }).shape, "cloud");
  const named = resolveAvatarChoice({ avatar: "spark", slug: "codex" });
  assert.ok(AVATAR_SHAPES.some((shape) => shape.id === named.shape));
  assert.ok(AVATAR_COLORS.some((color) => color.id === named.color));
});
