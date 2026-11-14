export const COACH_SESSION_KEY = "botomatic-coach-session";

export function coachStorageKey(workspaceId) {
  return `botomatic-start-here:${String(workspaceId || "")}`;
}

export function coachShouldShow({ botCount, workspaceId, stored = "", sessionId = "" } = {}) {
  if (!workspaceId || botCount !== 0) return false;
  if (sessionId && stored === sessionId) return false;
  return true;
}
