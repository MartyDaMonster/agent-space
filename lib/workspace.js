export const MARTIN_WORKSPACE_ID = "ws-martin";
export const MARTIN_EMAILS = [
  "marty.hungerford3181@gmail.com",
  "marty.j.hungerford@gmail.com"
];
export const MARTIN_GITHUB = "martydamonster";

export function identityWorkspace({ email = "", githubLogin = "" } = {}) {
  const normalized = String(email || "").trim().toLowerCase();
  const login = String(githubLogin || "").trim().toLowerCase();
  if (MARTIN_EMAILS.includes(normalized) || login === MARTIN_GITHUB) return MARTIN_WORKSPACE_ID;
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

export function acceptInvite(invite, { email = "", githubLogin = "" } = {}) {
  if (!invite || invite.status === "revoked") return { ok: false, status: 404, error: "That invite is not open." };
  if (invite.status === "accepted") {
    return { ok: true, invite, membership: { workspaceId: invite.workspaceId, email: invite.email, role: "member" } };
  }
  const cleanEmail = String(email || "").trim().toLowerCase();
  const login = String(githubLogin || "").trim().toLowerCase();
  const emailOk = Boolean(invite.email) && cleanEmail === invite.email;
  const loginOk = Boolean(invite.githubLogin) && login === invite.githubLogin.toLowerCase();
  if (!emailOk && !loginOk) return { ok: false, status: 403, error: "This invite is for someone else." };
  return {
    ok: true,
    invite: { ...invite, status: "accepted" },
    membership: {
      workspaceId: invite.workspaceId,
      email: cleanEmail || invite.email,
      githubLogin: invite.githubLogin,
      role: "member"
    }
  };
}

const ISOLATION_ACTIONS = ["read", "edit", "rename", "comment", "notify"];

export function attemptWorkspaceAction({ actorWorkspace, record, action }) {
  if (!ISOLATION_ACTIONS.includes(action)) return { ok: false, status: 400 };
  return crossWorkspaceResult(actorWorkspace, record);
}
