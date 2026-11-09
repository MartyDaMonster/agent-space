import assert from "node:assert/strict";
import test from "node:test";
import { decideAccess, emailAllowed, hasAuthCookie, inviteAllowed } from "../lib/access.js";

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

test("only login and the auth callback stay reachable when signed out", () => {
  assert.equal(decideAccess({ pathname: "/login", hasSession: false }).ok, true);
  assert.equal(decideAccess({ pathname: "/promo/botomatic-promo.mp4", hasSession: false }).ok, true);
  assert.equal(decideAccess({ pathname: "/promo/botomatic-promo.jpg", hasSession: false }).ok, true);
  assert.equal(decideAccess({ pathname: "/api/auth/callback/google", hasSession: false }).ok, true);
  assert.equal(decideAccess({ pathname: "/_vercel/insights/script.js", hasSession: false }).ok, true);
  assert.equal(decideAccess({ pathname: "/_vercel/insights/view", hasSession: false }).ok, true);
  assert.equal(decideAccess({ pathname: "/_vercel/speed-insights/script.js", hasSession: false }).ok, true);
  assert.equal(decideAccess({ pathname: "/_vercel/toolbar", hasSession: false }).redirect, "/login");
  assert.equal(decideAccess({ pathname: "/api/metrics/event", hasSession: false }).ok, true);
  assert.equal(decideAccess({ pathname: "/api/metrics/daily", hasSession: false }).status, 401);
  assert.equal(decideAccess({ pathname: "/api/metrics/daily", hasSession: true }).human, true);
  assert.equal(
    decideAccess({ pathname: "/api/metrics/daily", hasSession: false, authorization: "Bearer btm_test" }).bearer,
    true
  );
  assert.equal(decideAccess({ pathname: "/privacy", hasSession: false }).redirect, "/login");
  assert.equal(decideAccess({ pathname: "/terms", hasSession: false }).redirect, "/login");
  assert.equal(decideAccess({ pathname: "/contribute", hasSession: false }).redirect, "/login");
});

test("the default invite list is Martin, including his GitHub login", () => {
  assert.equal(inviteAllowed({ email: "Marty.Hungerford3181@gmail.com" }), true);
  assert.equal(inviteAllowed({ email: "marty.j.hungerford@gmail.com" }), true);
  assert.equal(inviteAllowed({ email: "someone@example.com" }), false);
  assert.equal(inviteAllowed({ email: "marty.hungerford3181@gmail.com", emailVerified: false }), false);
  assert.equal(inviteAllowed({ email: "other@users.noreply.github.com", githubLogin: "MartyDaMonster" }), true);
  assert.equal(inviteAllowed({ email: "other@users.noreply.github.com", githubLogin: "martydamonster" }), true);
  assert.equal(inviteAllowed({ email: "someone@example.com", githubLogin: "octocat" }), false);
  assert.equal(inviteAllowed({ email: "ada@example.com", emails: "ada@example.com", githubLogins: "" }), true);
  assert.equal(inviteAllowed({ email: "marty.hungerford3181@gmail.com", emails: "" }), false);
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
  assert.equal(decideAccess({ pathname: "/api/projects/side-quest", hasSession: true }).human, true);
  assert.equal(decideAccess({ pathname: "/api/projects/side-quest", hasSession: false }).status, 401);
  assert.equal(
    decideAccess({ pathname: "/api/projects/side-quest", hasSession: false, authorization: "Bearer btm_test" }).bearer,
    true
  );
  assert.equal(
    decideAccess({ pathname: "/api/posts/codex-hello", hasSession: false, authorization: "Bearer btm_test" }).bearer,
    true
  );
  assert.equal(decideAccess({ pathname: "/api/posts/codex-hello", hasSession: true }).status, 401);
});
