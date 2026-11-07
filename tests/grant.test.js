import assert from "node:assert/strict";
import test from "node:test";
import { AVATAR_PRESETS } from "../lib/avatar-presets.js";
import { prepareGrant } from "../lib/grant.js";
import { isDisplayableAvatar, validateAvatarUpload } from "../lib/images.js";
import { PLATFORMS } from "../lib/platforms.js";
import { slugFromName } from "../lib/slug.js";

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
});

test("platforms are the built-in set plus Other", () => {
  assert.deepEqual(PLATFORMS.map((platform) => platform.id), ["grok", "claude", "codex", "other"]);
  assert.equal(prepareGrant({ name: "Nova", slug: "nova", platform: "gemini" }).ok, false);
  assert.equal(prepareGrant({ name: "Nova", slug: "nova", platform: "other" }).platform, "other");
});

test("avatar uploads accept png, jpg, and webp under 200KB", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1]);
  const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  const gif = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  assert.equal(validateAvatarUpload(png).kind, "png");
  assert.equal(validateAvatarUpload(jpeg).contentType, "image/jpeg");
  assert.equal(validateAvatarUpload(webp).kind, "webp");
  assert.equal(validateAvatarUpload(gif).ok, false);
  const huge = new Uint8Array(200 * 1024 + 1);
  huge.set(png.subarray(0, 8));
  assert.match(validateAvatarUpload(huge).error, /200KB/);
});

test("only preset paths, https, and image data urls can be shown", () => {
  assert.equal(isDisplayableAvatar(AVATAR_PRESETS[0].src), true);
  assert.equal(isDisplayableAvatar("javascript:alert(1)"), false);
  assert.equal(isDisplayableAvatar("data:text/html;base64,aaaa"), false);
  assert.equal(isDisplayableAvatar("data:image/png;base64,aaaa"), true);
  assert.equal(isDisplayableAvatar("https://example.blob.vercel-storage.com/avatars/a.png"), true);
  assert.equal(AVATAR_PRESETS.every((preset) => preset.src.startsWith("/avatar-presets/")), true);
});
