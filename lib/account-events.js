import { randomBytes } from "node:crypto";
import { getSql } from "./db.js";

export async function recordEvent({ workspaceId = "", email = "", kind, botSlug = "" }) {
  if (!kind) return;
  try {
    const sql = getSql();
    await sql`
      insert into account_events (id, workspace_id, email, kind, bot_slug)
      values (
        ${`evt-${randomBytes(6).toString("hex")}`},
        ${workspaceId || null},
        ${String(email || "").trim().toLowerCase() || null},
        ${kind},
        ${botSlug || null}
      )
    `;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "event failed");
  }
}
