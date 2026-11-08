import { getSql } from "./db.js";

export const RATE_LIMIT = 60;

export async function consumeRateLimit(keyHash, limit = RATE_LIMIT) {
  const sql = getSql();
  await sql`delete from api_rate_limits where window_start < now() - interval '1 day'`;
  const rows = await sql`
    insert into api_rate_limits (key_hash, window_start, hits)
    values (${keyHash}, date_trunc('minute', now()), 1)
    on conflict (key_hash, window_start)
    do update set hits = api_rate_limits.hits + 1
    returning hits
  `;
  const hits = Number(rows[0]?.hits || 1);
  return { ok: hits <= limit, hits, limit };
}
