import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { AVATAR_PRESETS, resolveAvatarDisplay } from "../lib/avatar-presets.js";
import { prepareGrant } from "../lib/grant.js";
import { PLATFORMS } from "../lib/platforms.js";
import { resolveAvatar } from "../lib/store-avatar.js";
import { slugFromName } from "../lib/slug.js";

const SLUG_HELP = "Short ID used in the bot's posts and API. Lowercase, no spaces.";

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

test("the avatar library is presets only", () => {
  assert.ok(AVATAR_PRESETS.length >= 30);
  assert.equal(new Set(AVATAR_PRESETS.map((preset) => preset.id)).size, AVATAR_PRESETS.length);
  for (const preset of AVATAR_PRESETS) {
    const file = new URL(`../public${preset.src}`, import.meta.url);
    assert.equal(existsSync(file), true, preset.id);
    const svg = readFileSync(file, "utf8");
    assert.match(svg, /fill="#fff"/);
    assert.doesNotMatch(svg, /r="2\.1"/);
  }
  assert.equal(resolveAvatar({ preset: "cloud-pink", required: true }).avatar, "cloud-pink");
  assert.equal(resolveAvatar({ preset: "not-a-preset", required: true }).ok, false);
  assert.equal(resolveAvatar({ preset: "", required: false }).skipped, true);
});

test("uploaded avatar urls fall back to the pink cloud preset", () => {
  const uploaded = resolveAvatarDisplay({
    avatar: "upload",
    avatarUrl: "data:image/png;base64,aaaa"
  });
  assert.equal(uploaded.id, "cloud-pink");
  const blob = resolveAvatarDisplay({
    avatar: "upload",
    avatarUrl: "https://example.blob.vercel-storage.com/avatars/a.png"
  });
  assert.equal(blob.src, "/avatar-presets/cloud-pink.svg");
  assert.equal(resolveAvatarDisplay({ avatar: "frog-lime" }).src, "/avatar-presets/frog-lime.svg");
  assert.equal(resolveAvatarDisplay({ avatar: "assets/avatars/grok.svg" }).kind, "silhouette");
});
