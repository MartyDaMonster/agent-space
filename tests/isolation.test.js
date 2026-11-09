import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  acceptInvite,
  attemptWorkspaceAction,
  authorizeInviteCreate,
  createInviteRecord,
  identityWorkspace,
  MARTIN_WORKSPACE_ID,
  revokeInvite
} from "../lib/workspace.js";

const MARTIN = MARTIN_WORKSPACE_ID;
const OTHER = "ws-other";

const objects = {
  "note-1": { id: "note-1", workspaceId: MARTIN, kind: "post" },
  "cmt-1": { id: "cmt-1", workspaceId: MARTIN, kind: "comment" },
  "side-quest": { id: "side-quest", workspaceId: MARTIN, kind: "project" },
  "key-1": { id: "key-1", workspaceId: MARTIN, kind: "key" }
};

test("Martin's sign-in still resolves to the original workspace", () => {
  assert.equal(identityWorkspace({ email: "Marty.Hungerford3181@gmail.com" }), MARTIN);
  assert.equal(identityWorkspace({ email: "marty.j.hungerford@gmail.com" }), MARTIN);
  assert.equal(identityWorkspace({ githubLogin: "MartyDaMonster" }), MARTIN);
  assert.equal(identityWorkspace({ email: "ada@example.com" }), null);
});

test("another workspace cannot read, edit, rename, comment, or notify by known id", () => {
  for (const id of Object.keys(objects)) {
    for (const action of ["read", "edit", "rename", "comment", "notify"]) {
      const result = attemptWorkspaceAction({
        actorWorkspace: OTHER,
        record: objects[id],
        action
      });
      assert.equal(result.ok, false, `${action} ${id}`);
      assert.equal(result.status, 404);
    }
    assert.equal(attemptWorkspaceAction({
      actorWorkspace: MARTIN,
      record: objects[id],
      action: "read"
    }).ok, true);
  }
});

test("only a workspace owner can create or revoke an invite", () => {
  assert.equal(authorizeInviteCreate({
    actorWorkspace: MARTIN,
    actorRole: "owner",
    workspaceId: MARTIN
  }).ok, true);
  assert.equal(authorizeInviteCreate({
    actorWorkspace: OTHER,
    actorRole: "owner",
    workspaceId: MARTIN
  }).status, 403);
  assert.equal(authorizeInviteCreate({
    actorWorkspace: MARTIN,
    actorRole: "member",
    workspaceId: MARTIN
  }).status, 403);
  const created = createInviteRecord({
    id: "inv-1",
    workspaceId: MARTIN,
    githubLogin: "octocat",
    createdBy: "marty.hungerford3181@gmail.com"
  });
  assert.equal(created.ok, true);
  assert.equal(revokeInvite(created.invite, OTHER).status, 404);
  assert.equal(revokeInvite(created.invite, MARTIN).invite.status, "revoked");
  const accepted = acceptInvite(created.invite, { githubLogin: "octocat" });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.membership.workspaceId, MARTIN);
  assert.equal(acceptInvite(created.invite, { githubLogin: "someone" }).status, 403);
  const acceptedAda = {
    id: "inv-ada",
    workspaceId: "ws-ada",
    email: "ada@example.com",
    githubLogin: "ada",
    status: "accepted",
    createdBy: "marty.hungerford3181@gmail.com"
  };
  const leaked = acceptInvite(acceptedAda, { email: "eve@example.com", githubLogin: "eve" });
  assert.equal(leaked.ok, false);
  assert.equal(leaked.status, 403);
  assert.equal(leaked.invite, undefined);
  assert.equal(JSON.stringify(leaked).includes("ada@example.com"), false);
  const replay = acceptInvite(acceptedAda, { email: "ada@example.com" });
  assert.equal(replay.ok, true);
  assert.equal(replay.invite.email, "ada@example.com");
});

test("queries that touch tenant data are limited to one workspace", () => {
  const posts = readFileSync(new URL("../lib/posts.js", import.meta.url), "utf8");
  const projects = readFileSync(new URL("../lib/projects.js", import.meta.url), "utf8");
  const mentions = readFileSync(new URL("../lib/mention-store.js", import.meta.url), "utf8");
  const bots = readFileSync(new URL("../lib/bot-auth.js", import.meta.url), "utf8");
  const metrics = readFileSync(new URL("../lib/metrics.js", import.meta.url), "utf8");
  assert.match(posts, /posts\.workspace_id = \$\{workspaceId\}/);
  assert.match(posts, /workspace_id = \$\{workspaceId \|\| ""\}/);
  assert.match(projects, /workspace_id = \$\{workspaceId\}/);
  assert.match(mentions, /posts\.workspace_id = \$\{workspaceId\}/);
  assert.match(bots, /bots\.workspace_id = api_keys\.workspace_id/);
  assert.match(metrics, /workspace_id = \$\{workspaceId\}/);
  const migration = readFileSync(new URL("../scripts/migrate.sql", import.meta.url), "utf8");
  assert.match(migration, /insert into workspaces \(id, name, slug\)/);
  assert.match(migration, /where workspace_id is null/);
  assert.match(migration, /ws-martin/);
});
