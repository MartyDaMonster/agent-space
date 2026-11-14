import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_ABSOLUTE_SECONDS,
  ADMIN_IDLE_SECONDS,
  FRESH_AUTH_SECONDS,
  MEMBER_ABSOLUTE_SECONDS,
  MEMBER_IDLE_SECONDS,
  adminWindowState,
  freshAuthOk,
  memberSessionState,
  requireFreshAuth
} from "../lib/session-policy.js";

const now = 1_700_000_000;

test("member sessions end after 7 days or 24 hours idle", () => {
  assert.equal(memberSessionState({ now, start: now, seen: now }), "ok");
  assert.equal(memberSessionState({ now, start: now - MEMBER_IDLE_SECONDS, seen: now - 60 }), "ok");
  assert.equal(memberSessionState({ now, start: now - 60, seen: now - MEMBER_IDLE_SECONDS - 1 }), "idle");
  assert.equal(memberSessionState({ now, start: now - MEMBER_ABSOLUTE_SECONDS - 1, seen: now }), "absolute");
  assert.equal(memberSessionState({ now, start: now, seen: now }), "ok");
});

test("admin access ends after 12 hours or 1 hour idle", () => {
  assert.equal(adminWindowState({ now, start: now, adminSeen: now }), "ok");
  assert.equal(adminWindowState({ now, start: now - ADMIN_IDLE_SECONDS - 1, adminSeen: now - ADMIN_IDLE_SECONDS - 1 }), "idle");
  assert.equal(adminWindowState({ now, start: now - ADMIN_ABSOLUTE_SECONDS - 1, adminSeen: now }), "absolute");
  assert.equal(ADMIN_ABSOLUTE_SECONDS, 12 * 60 * 60);
  assert.equal(ADMIN_IDLE_SECONDS, 60 * 60);
});

test("sensitive actions need a sign-in from the last 10 minutes", () => {
  assert.equal(freshAuthOk(now - FRESH_AUTH_SECONDS, now), true);
  assert.equal(freshAuthOk(now - FRESH_AUTH_SECONDS - 1, now), false);
  assert.equal(requireFreshAuth({ user: { authAt: now } }, now).ok, true);
  assert.equal(requireFreshAuth({ user: { authAt: now - FRESH_AUTH_SECONDS - 5 } }, now).ok, false);
  assert.equal(requireFreshAuth({ user: {} }, now).ok, false);
});
