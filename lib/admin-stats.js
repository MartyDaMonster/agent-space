import { getSql } from "./db.js";
import { guardMartin } from "./admin-store.js";
import { reportWindow, summarizeDaily } from "./metrics.js";
import { formatStorage } from "./admin-panel.js";

function sumWindow(days, count) {
  return days.slice(-count).reduce((total, day) => ({
    views: total.views + day.views,
    visitors: total.visitors + day.uniqueVisitors,
    plays: total.plays + day.videoPlays
  }), { views: 0, visitors: 0, plays: 0 });
}

export async function adminOverview(session) {
  const gate = guardMartin(session);
  if (!gate.ok) return gate;
  const sql = getSql();
  const window = reportWindow(30);
  const allEvents = await sql`
    select event_type, created_at, visitor_hash, referrer
    from page_metrics
    where created_at >= ${window.start.toISOString()}::timestamptz
      and created_at < ${window.end.toISOString()}::timestamptz
    order by created_at asc
  `;
  const daily = summarizeDaily(allEvents.map((row) => ({
    type: row.event_type,
    createdAt: row.created_at,
    visitorHash: row.visitor_hash,
    referrer: row.referrer || null
  })), { days: 30 });
  const today = sumWindow(daily.days, 1);
  const week = sumWindow(daily.days, 7);
  const month = sumWindow(daily.days, 30);
  const [users, active, invites, workspaces, bots, posts, comments, storage] = await Promise.all([
    sql`select count(distinct lower(email))::int as n from workspace_members`,
    sql`select count(distinct lower(email))::int as n from account_events where email is not null and created_at > now() - interval '7 days'`,
    sql`
      select
        count(*)::int as sent,
        count(*) filter (where status = 'accepted')::int as accepted,
        count(*) filter (where status = 'pending' and expires_at > now())::int as pending,
        count(*) filter (where status = 'pending' and (expires_at is null or expires_at <= now()))::int as expired
      from workspace_invites
      where status is distinct from 'preview'
    `,
    sql`select count(*)::int as n from workspaces`,
    sql`
      select count(*)::int as n from bots
      where exists (
        select 1 from api_keys
        where api_keys.bot_slug = bots.slug
          and api_keys.workspace_id = bots.workspace_id
          and api_keys.revoked_at is null
          and api_keys.last_seen_at is not null
      )
    `,
    sql`select count(*)::int as n from posts where deleted_at is null and created_at > now() - interval '7 days'`,
    sql`select count(*)::int as n from comments where deleted_at is null and created_at > now() - interval '7 days'`,
    sql`select coalesce(sum(byte_size), 0)::bigint as n from board_files where deleted_at is null`
  ]);
  const invite = invites[0] || { sent: 0, accepted: 0, pending: 0, expired: 0 };
  return {
    ok: true,
    traffic: { today, week, month, bars: daily.days.map((day) => day.views) },
    users: users[0]?.n || 0,
    active: active[0]?.n || 0,
    invites: {
      ...invite,
      rate: invite.sent ? Math.round((invite.accepted / invite.sent) * 100) : 0
    },
    workspaces: workspaces[0]?.n || 0,
    bots: bots[0]?.n || 0,
    posts: posts[0]?.n || 0,
    comments: comments[0]?.n || 0,
    storage: formatStorage(storage[0]?.n || 0)
  };
}
