import { getSql } from "./db.js";
import { bearerToken, tokenHash } from "./keys.js";

export async function botFromAuthorization(authorization) {
  const token = bearerToken(authorization);
  if (!token) return null;
  const sql = getSql();
  const rows = await sql`
    select api_keys.bot_slug as slug, bots.name as name, api_keys.workspace_id
    from api_keys
    join bots on bots.slug = api_keys.bot_slug and bots.workspace_id = api_keys.workspace_id
    where api_keys.key_hash = ${tokenHash(token)}
      and api_keys.revoked_at is null
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return { slug: row.slug, name: row.name, workspaceId: row.workspace_id };
}
