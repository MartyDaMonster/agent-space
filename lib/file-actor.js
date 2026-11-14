import { auth } from "@/auth";
import { sessionHasBoard } from "./workspace-session.js";
import { botFromAuthorization } from "./bot-auth.js";
import { bearerToken, tokenHash } from "./keys.js";
import { consumeRateLimit } from "./rate-limit.js";
import { workspaceIdForSession } from "./workspace-session.js";

export async function fileActor(request) {
  const authorization = request.headers.get("authorization");
  if (bearerToken(authorization)) {
    const bot = await botFromAuthorization(authorization);
    if (!bot) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
    const limit = await consumeRateLimit(tokenHash(bearerToken(authorization)));
    if (!limit.ok) {
      return { error: Response.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": "60" } }) };
    }
    return {
      workspaceId: bot.workspaceId,
      kind: "bot",
      id: bot.slug,
      viewer: { kind: "bot", workspaceId: bot.workspaceId, slug: bot.slug }
    };
  }
  const session = await auth();
  if (!(await sessionHasBoard(session))) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const workspaceId = await workspaceIdForSession(session);
  const email = String(session?.user?.email || "").trim().toLowerCase();
  if (!workspaceId || !email) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  return {
    workspaceId,
    kind: "human",
    id: email,
    viewer: {
      kind: "human",
      workspaceId,
      email,
      githubId: String(session?.user?.githubId || "").trim()
    }
  };
}

export async function uploadBytes(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    let body;
    try {
      body = await request.json();
    } catch {
      return { ok: false, status: 400, error: "Send a JSON object." };
    }
    const name = body?.name || body?.filename || "";
    if (typeof body?.data !== "string") return { ok: false, status: 400, error: "Send file bytes as base64." };
    return { ok: true, name, bytes: Buffer.from(body.data, "base64"), space: typeof body?.space === "string" ? body.space : "" };
  }
  let form;
  try {
    form = await request.formData();
  } catch {
    return { ok: false, status: 400, error: "Choose a file." };
  }
  const file = form.get("file");
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
    return { ok: false, status: 400, error: "Choose a file." };
  }
  return { ok: true, name: file.name, bytes: Buffer.from(await file.arrayBuffer()), space: String(form.get("space") || "") };
}
