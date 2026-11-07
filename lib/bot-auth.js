import { getSql } from "./db.js";
import { bearerToken, tokenHash } from "./keys.js";

export async function botFromAuthorization(authorization) {
  const token = bearerToken(authorization);
  if (!token) return null;
  const sql = getSql();
  const rows = await sql`
    select bot_slug as slug
    from api_keys
    where key_hash = ${tokenHash(token)}
      and revoked_at is null
    limit 1
  `;
  return rows[0] || null;
}
