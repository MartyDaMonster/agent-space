import assert from "node:assert/strict";
import test from "node:test";
import { decideAccess, emailAllowed, hasAuthCookie } from "../lib/access.js";

const MARTY = "marty.hungerford3181@gmail.com,marty.j.hungerford@gmail.com";

test("allowlist accepts only the configured emails", () => {
  assert.equal(emailAllowed("Marty.Hungerford3181@gmail.com", MARTY), true);
  assert.equal(emailAllowed("marty.j.hungerford@gmail.com", MARTY), true);
  assert.equal(emailAllowed("someone@example.com", MARTY), false);
  assert.equal(emailAllowed("", MARTY), false);
  assert.equal(emailAllowed("marty.hungerford3181@gmail.com", ""), false);
  assert.equal(emailAllowed("marty.hungerford3181@gmail.com", undefined), false);
});

test("pages and human APIs require a session", () => {
  assert.deepEqual(decideAccess({ pathname: "/", hasSession: false }), { ok: false, redirect: "/login" });
  assert.deepEqual(decideAccess({ pathname: "/admin", hasSession: false }), { ok: false, redirect: "/login" });
  assert.deepEqual(decideAccess({ pathname: "/api/admin/keys", hasSession: false }), { ok: false, status: 401 });
  assert.equal(decideAccess({ pathname: "/", hasSession: true }).ok, true);
  assert.equal(decideAccess({ pathname: "/admin", hasSession: true }).human, true);
});

test("login, privacy, and the auth callback stay reachable", () => {
  assert.equal(decideAccess({ pathname: "/login", hasSession: false }).ok, true);
  assert.equal(decideAccess({ pathname: "/privacy", hasSession: false }).ok, true);
  assert.equal(decideAccess({ pathname: "/terms", hasSession: false }).ok, true);
  assert.equal(decideAccess({ pathname: "/api/auth/callback/google", hasSession: false }).ok, true);
  assert.equal(decideAccess({ pathname: "/contribute", hasSession: false }).redirect, "/login");
});

test("only an Auth.js session cookie counts as signed in", () => {
  assert.equal(hasAuthCookie(["authjs.session-token"]), true);
  assert.equal(hasAuthCookie(["__Secure-authjs.session-token.0"]), true);
  assert.equal(hasAuthCookie(["other"]), false);
});

test("bot routes require a bearer token and ignore a bare session", () => {
  assert.deepEqual(
    decideAccess({ pathname: "/api/posts", hasSession: true, authorization: "" }),
    { ok: false, status: 401 }
  );
  assert.deepEqual(
    decideAccess({ pathname: "/api/bots", hasSession: false }),
    { ok: false, status: 401 }
  );
  assert.equal(
    decideAccess({ pathname: "/api/posts", hasSession: false, authorization: "Bearer btm_test" }).bearer,
    true
  );
  assert.equal(
    decideAccess({ pathname: "/api/bots", hasSession: false, authorization: "bearer btm_test" }).ok,
    true
  );
  assert.equal(
    decideAccess({ pathname: "/api/projects", hasSession: false, authorization: "Bearer btm_test" }).bearer,
    true
  );
  assert.equal(decideAccess({ pathname: "/api/projects", hasSession: true }).status, 401);
});
