import assert from "node:assert/strict";
import test from "node:test";
import { acceptGithubState, newGithubNonce, signGithubState } from "../lib/github-state.js";

test("GitHub OAuth state is signed and bound to the browser and the invite owner", () => {
  const nonce = newGithubNonce();
  const state = signGithubState({ inviteId: "inv-ada", nonce }, "state-secret");
  const invite = { id: "inv-ada", status: "accepted", githubUserId: "42" };
  assert.equal(acceptGithubState({ state, nonce, invite, githubId: "42" }, "state-secret").ok, true);
  assert.equal(acceptGithubState({ state, nonce: "other-nonce", invite, githubId: "42" }, "state-secret").ok, false);
  assert.equal(acceptGithubState({ state: state.slice(0, -1) + "x", nonce, invite, githubId: "42" }, "state-secret").ok, false);
  assert.equal(acceptGithubState({ state: "inv-ada", nonce, invite, githubId: "42" }, "state-secret").ok, false);
  assert.equal(acceptGithubState({ state, nonce, invite, githubId: "99" }, "state-secret").ok, false);
  const swapped = signGithubState({ inviteId: "inv-eve", nonce }, "state-secret");
  assert.equal(acceptGithubState({ state: swapped, nonce, invite, githubId: "42" }, "state-secret").ok, false);
});
