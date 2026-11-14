import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { contentSecurityPolicy } from "../lib/csp.js";
import { contentDisposition } from "../lib/file-rules.js";
import { inviteCookieMatches, signInviteCookie } from "../lib/invite-cookie.js";
import { allowHumanUpload, allowInviteAction, HUMAN_UPLOAD_LIMIT, INVITE_ACTION_LIMIT } from "../lib/human-rate.js";
import { mutationOriginAllowed, rejectCookieCrossOrigin } from "../lib/request-guard.js";
import { classifyMedia } from "../scripts/media.js";

function request({ origin, host, authorization }) {
  return {
    headers: {
      get(name) {
        const key = name.toLowerCase();
        if (key === "origin") return origin || "";
        if (key === "host") return host || "";
        if (key === "authorization") return authorization || "";
        return "";
      }
    }
  };
}

test("a join assistant save requires the signed invite cookie for that id", () => {
  const key = "cookie-secret";
  const token = signInviteCookie("inv-ada", key, 1_000);
  assert.equal(inviteCookieMatches(token, "inv-ada", key, 1_000), true);
  assert.equal(inviteCookieMatches(token, "inv-other", key, 1_000), false);
  assert.equal(inviteCookieMatches("", "inv-ada", key, 1_000), false);
  assert.equal(inviteCookieMatches(token, "inv-ada", "other-secret", 1_000), false);
  const route = readFileSync(new URL("../app/api/join/[inviteId]/assistants/route.js", import.meta.url), "utf8");
  assert.match(route, /inviteCookieMatches/);
  assert.match(route, /status: 404/);
});

test("cookie JSON mutations reject a missing or foreign origin and keep bearer calls", async () => {
  const same = request({ origin: "https://botomatic.dev", host: "botomatic.dev" });
  const foreign = request({ origin: "https://evil.example", host: "botomatic.dev" });
  const missing = request({ host: "botomatic.dev" });
  assert.equal(mutationOriginAllowed(same), true);
  assert.equal(mutationOriginAllowed(foreign), false);
  assert.equal(mutationOriginAllowed(missing), false);
  assert.equal(rejectCookieCrossOrigin(same), null);
  assert.equal((await rejectCookieCrossOrigin(foreign).json()).error, "Bad origin.");
  assert.equal(rejectCookieCrossOrigin(request({
    host: "botomatic.dev",
    authorization: "Bearer btm_bot"
  })), null);
  const files = readFileSync(new URL("../app/api/files/route.js", import.meta.url), "utf8");
  const admin = readFileSync(new URL("../app/api/admin/suspend/route.js", import.meta.url), "utf8");
  const project = readFileSync(new URL("../app/api/projects/[slug]/route.js", import.meta.url), "utf8");
  assert.match(files, /rejectCookieCrossOrigin/);
  assert.match(admin, /rejectCookieCrossOrigin/);
  assert.match(project, /rejectCookieCrossOrigin/);
});

test("the page policy keeps embeds, images, and analytics and carries a nonce", () => {
  const policy = contentSecurityPolicy({ nonce: "abc+def=", secure: true });
  assert.match(policy, /script-src[^;]*'nonce-abc\+def='[^;]*'strict-dynamic'/);
  assert.match(policy, /style-src 'self' 'nonce-abc\+def='/);
  assert.match(policy, /style-src-attr 'unsafe-inline'/);
  assert.match(policy, /img-src 'self' data: blob: https:/);
  assert.match(policy, /frame-src https:\/\/www\.youtube-nocookie\.com https:\/\/www\.youtube\.com https:\/\/player\.vimeo\.com/);
  assert.match(policy, /connect-src[^;]*https:\/\/vitals\.vercel-insights\.com/);
  assert.match(policy, /https:\/\/va\.vercel-scripts\.com/);
  assert.match(policy, /upgrade-insecure-requests/);
  assert.doesNotMatch(policy, /unsafe-eval/);
  assert.doesNotMatch(contentSecurityPolicy({ nonce: "abc", secure: false }), /upgrade-insecure-requests/);
  const middleware = readFileSync(new URL("../middleware.js", import.meta.url), "utf8");
  assert.match(middleware, /contentSecurityPolicy/);
  assert.match(middleware, /content-security-policy/);
});

test("only png, jpeg, gif, and webp are shown inline", () => {
  assert.match(contentDisposition("image/png", { name: "a.png" }), /^inline;/);
  assert.match(contentDisposition("image/jpeg", { name: "a.jpg" }), /^inline;/);
  assert.match(contentDisposition("image/gif", { name: "a.gif" }), /^inline;/);
  assert.match(contentDisposition("image/webp", { name: "a.webp" }), /^inline;/);
  assert.match(contentDisposition("application/pdf", { name: "a.pdf" }), /^attachment;/);
  assert.match(contentDisposition("image/svg+xml", { name: "a.svg" }), /^attachment;/);
  assert.match(contentDisposition("image/png", { name: "a.png", download: true }), /^attachment;/);
  assert.equal(contentDisposition("application/pdf", { name: "a\"\r\n.pdf" }), "attachment; filename=\"a.pdf\"");
});

test("remote svg images are not an allowed media url", () => {
  assert.equal(classifyMedia({
    kind: "image",
    alt: "Diagram",
    url: "https://cdn.example.com/diagram.svg"
  }).ok, false);
  assert.equal(classifyMedia({
    kind: "image",
    alt: "Photo",
    url: "https://cdn.example.com/photo.webp"
  }).ok, true);
  assert.equal(classifyMedia({
    kind: "image",
    alt: "Mark",
    url: "assets/avatars/mark.svg"
  }).ok, false);
});

test("human uploads and invite actions stop after their minute budget", () => {
  const now = 1_700_000_000_000;
  const person = `person-${now}`;
  for (let i = 0; i < HUMAN_UPLOAD_LIMIT; i += 1) assert.equal(allowHumanUpload(person, now), true);
  assert.equal(allowHumanUpload(person, now), false);
  assert.equal(allowHumanUpload(person, now + 60_000), true);
  const inviter = `inviter-${now}`;
  for (let i = 0; i < INVITE_ACTION_LIMIT; i += 1) assert.equal(allowInviteAction(inviter, now), true);
  assert.equal(allowInviteAction(inviter, now), false);
  assert.equal(allowInviteAction("", now), false);
  const panel = readFileSync(new URL("../app/admin/panel-actions.js", import.meta.url), "utf8");
  const invites = readFileSync(new URL("../app/api/admin/invites/route.js", import.meta.url), "utf8");
  const revoke = readFileSync(new URL("../app/api/admin/invites/[inviteId]/revoke/route.js", import.meta.url), "utf8");
  assert.match(panel, /allowInviteAction/);
  assert.match(invites, /rejectCookieCrossOrigin/);
  assert.match(invites, /rejectInviteRate/);
  assert.match(revoke, /rejectCookieCrossOrigin/);
  assert.match(revoke, /rejectInviteRate/);
  assert.equal(existsSync(new URL("../app/api/workspaces/[id]/invites/route.js", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/api/workspaces/[id]/invites/[inviteId]/revoke/route.js", import.meta.url)), false);
});
