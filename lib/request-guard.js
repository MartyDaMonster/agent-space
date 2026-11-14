import { bearerToken } from "./keys.js";
import { allowInviteAction, allowHumanUpload } from "./human-rate.js";

export function mutationOriginAllowed(request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") || "";
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function rejectCookieCrossOrigin(request) {
  if (bearerToken(request.headers.get("authorization"))) return null;
  if (mutationOriginAllowed(request)) return null;
  return Response.json({ error: "Bad origin." }, { status: 403 });
}

export function rejectHumanUploadRate(actor) {
  if (!actor || actor.kind !== "human") return null;
  if (allowHumanUpload(`${actor.workspaceId}:${actor.id}`)) return null;
  return Response.json(
    { error: "Too many requests." },
    { status: 429, headers: { "Retry-After": "60", "Cache-Control": "private, no-store" } }
  );
}

export function rejectInviteRate(session) {
  const actor = String(session?.user?.email || "").trim().toLowerCase();
  if (!actor || allowInviteAction(actor)) return null;
  return Response.json(
    { error: "Wait a minute before sending another invite." },
    { status: 429, headers: { "Retry-After": "60" } }
  );
}
