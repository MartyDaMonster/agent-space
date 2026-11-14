import { githubIdAllowed } from "./access.js";
import { inviteMatchesIdentity } from "./stage2.js";

export const MARTIN_WORKSPACE_ID = "ws-martin";
export const MARTIN_EMAILS = [
  "marty.hungerford3181@gmail.com",
  "marty.j.hungerford@gmail.com"
];
export const MARTIN_GITHUB_ID = "150204025";

export function identityWorkspace({ email = "", githubId = "" } = {}) {
  const id = String(githubId || "").trim();
  if (id) return githubIdAllowed(id) ? MARTIN_WORKSPACE_ID : null;
  const normalized = String(email || "").trim().toLowerCase();
  if (MARTIN_EMAILS.includes(normalized)) return MARTIN_WORKSPACE_ID;
  return null;
}

export function belongsToWorkspace(record, workspaceId) {
  if (!record || !workspaceId) return false;
  const owner = record.workspaceId || record.workspace_id || "";
  return owner === workspaceId;
}

export function crossWorkspaceResult(actorWorkspace, record) {
  if (!belongsToWorkspace(record, actorWorkspace)) return { ok: false, status: 404 };
  return { ok: true, record };
}

export function authorizeInviteCreate({ actorWorkspace, actorRole, workspaceId }) {
  if (!actorWorkspace || actorWorkspace !== workspaceId || actorRole !== "owner") {
    return { ok: false, status: 403 };
  }
  return { ok: true };
}

export function createInviteRecord({ id, workspaceId, email = "", githubLogin = "", createdBy }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const login = String(githubLogin || "").trim();
  if (!id || !workspaceId || !createdBy) return { ok: false, error: "Missing workspace." };
  if (!cleanEmail && !login) return { ok: false, error: "An invite needs an email or a GitHub login." };
  if (cleanEmail && !cleanEmail.includes("@")) return { ok: false, error: "That email is not usable." };
  return {
    ok: true,
    invite: {
      id,
      workspaceId,
      email: cleanEmail,
      githubLogin: login,
      status: "pending",
      createdBy
    }
  };
}

export function revokeInvite(invite, actorWorkspace) {
  const gate = crossWorkspaceResult(actorWorkspace, invite);
  if (!gate.ok) return gate;
  if (invite.status === "accepted") return { ok: false, status: 409, error: "That invite was already accepted." };
  return { ok: true, invite: { ...invite, status: "revoked" } };
}

function sameGithub(invite, { githubLogin = "", githubId = "" } = {}) {
  const login = String(githubLogin || "").trim().toLowerCase();
  const id = String(githubId || "").trim();
  const claimedLogin = String(invite?.githubLogin || "").trim().toLowerCase();
  const claimedId = String(invite?.githubUserId || "").trim();
  if (claimedId && id && claimedId === id) return true;
  if (claimedLogin && login && claimedLogin === login) return true;
  return false;
}

export function acceptInvite(invite, identity = {}) {
  if (!invite || invite.status === "revoked") return { ok: false, status: 404, error: "That invite is not open." };
  const expiresAt = invite.expiresAt ? new Date(invite.expiresAt).getTime() : null;
  if (expiresAt && expiresAt <= Date.now()) return { ok: false, status: 404, error: "That invite is not open." };
  const login = String(identity.githubLogin || "").trim().toLowerCase();
  if (invite.status === "accepted") {
    if (!sameGithub(invite, identity)) return { ok: false, status: 409, error: "That invite is not open." };
    return {
      ok: true,
      invite,
      membership: {
        workspaceId: invite.workspaceId,
        email: invite.email,
        githubLogin: invite.githubLogin,
        role: "owner"
      }
    };
  }
  if (invite.status !== "pending") return { ok: false, status: 404, error: "That invite is not open." };
  if (!inviteMatchesIdentity(invite, identity)) return { ok: false, status: 404, error: "That invite is not open." };
  return {
    ok: true,
    invite: { ...invite, status: "accepted", githubLogin: login || invite.githubLogin },
    membership: {
      workspaceId: invite.workspaceId,
      email: invite.email,
      githubLogin: login || invite.githubLogin,
      role: "owner"
    }
  };
}

const ISOLATION_ACTIONS = ["read", "edit", "rename", "comment", "notify"];

export function attemptWorkspaceAction({ actorWorkspace, record, action }) {
  if (!ISOLATION_ACTIONS.includes(action)) return { ok: false, status: 400 };
  return crossWorkspaceResult(actorWorkspace, record);
}
