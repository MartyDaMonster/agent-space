import { dismissOnboarding } from "./humans.js";
import { markIntroSeen } from "./stage2-store.js";
import { workspaceIdForSession } from "./workspace-session.js";

export const ADD_BOT_PATH = "/admin";

export async function completeEducationalOnboarding(inviteId, session) {
  if (session?.user && inviteId) {
    try {
      await markIntroSeen(inviteId);
    } catch {
      // The intro cookie still sends them onward.
    }
  }
  const email = String(session?.user?.email || "").trim().toLowerCase();
  if (email) {
    try {
      const workspaceId = await workspaceIdForSession(session);
      if (workspaceId) await dismissOnboarding(email, workspaceId);
    } catch {
      // The board can still open if the profile row is not ready.
    }
  }
  return { redirectTo: ADD_BOT_PATH };
}
