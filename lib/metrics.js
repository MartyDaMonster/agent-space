import { createHash } from "node:crypto";
import { getSql } from "./db.js";
import { bearerToken } from "./keys.js";
import { METRIC_TYPES } from "./metric-events.js";

export { METRIC_TYPES };
export const SYDNEY = "Australia/Sydney";
export const DEFAULT_DAYS = 14;
export const MAX_DAYS = 90;
export const METRIC_RATE_LIMIT = 20;
export const TOP_REFERRERS = 5;

const BOT_UA = /bot|spider|crawler|crawl|slurp|wget|curl|python-requests|python-urllib|go-http-client|headless|lighthouse|pagespeed|pingdom|uptimerobot|facebookexternalhit|embedly|slackbot|discordbot|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|bingpreview|baiduspider|yandex|duckduckbot|ahrefs|semrush|mj12bot|dotbot|petalbot|bytespider|gptbot|claudebot|amazonbot|scrapy|httpclient|ia_archiver|archive\.org_bot/i;

export function metricsSalt() {
  return process.env.METRICS_SALT || process.env.AUTH_SECRET || "botomatic-metrics";
}

export function clientIp(headers) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  return real ? real.trim() : "";
}

export function isObviousBot(userAgent) {
  const ua = String(userAgent || "").trim();
  if (ua.length < 8) return true;
  return BOT_UA.test(ua);
}

export function sydneyDate(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SYDNEY,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function addCalendarDays(dateStr, days) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

function zoneOffsetMs(timeZone, instant) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(instant).map((part) => [part.type, part.value]));
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, Number(parts.minute), Number(parts.second));
  return asUtc - instant.getTime();
}

export function zonedMidnight(dateStr, timeZone = SYDNEY) {
  const guess = Date.parse(`${dateStr}T00:00:00Z`);
  const first = guess - zoneOffsetMs(timeZone, new Date(guess));
  const second = guess - zoneOffsetMs(timeZone, new Date(first));
  return new Date(second);
}

export function reportWindow(days, now = new Date()) {
  const today = sydneyDate(now);
  const startDate = addCalendarDays(today, -(days - 1));
  const endDate = addCalendarDays(today, 1);
  return {
    startDate,
    endDate,
    start: zonedMidnight(startDate),
    end: zonedMidnight(endDate),
    dates: Array.from({ length: days }, (_, index) => addCalendarDays(startDate, index))
  };
}

export function visitorHash({ ip, userAgent, day, salt }) {
  return createHash("sha256").update(`${salt}\n${day}\n${ip}\n${userAgent}`, "utf8").digest("hex");
}

export function ipRateKey(ip, salt) {
  return `metrics:${createHash("sha256").update(`${salt}\nip\n${ip}`, "utf8").digest("hex")}`;
}

export function referrerDomain(value, { selfHosts = [] } = {}) {
  if (typeof value !== "string" || !value.trim()) return null;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  let host = url.hostname.toLowerCase();
  if (host.startsWith("www.")) host = host.slice(4);
  if (!host || host === "localhost" || host.endsWith(".localhost")) return null;
  const selves = new Set(
    selfHosts
      .map((item) => String(item || "").toLowerCase().replace(/:\d+$/, "").replace(/^www\./, ""))
      .filter(Boolean)
  );
  if (selves.has(host)) return null;
  return host;
}

export function parseDays(value) {
  if (value == null || value === "") return DEFAULT_DAYS;
  if (!/^\d+$/.test(String(value))) return null;
  const days = Number(value);
  if (days < 1 || days > MAX_DAYS) return null;
  return days;
}

export function sameSiteOrigin(origin, host) {
  if (!origin) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function prepareMetric({ type, referrer, ip, userAgent, now = new Date(), salt, selfHosts }) {
  if (!METRIC_TYPES.includes(type)) return { error: "bad_type" };
  if (isObviousBot(userAgent)) return { ignore: true };
  const day = sydneyDate(now);
  return {
    event: {
      type,
      createdAt: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
      visitorHash: visitorHash({ ip: String(ip || ""), userAgent: String(userAgent || ""), day, salt }),
      referrer: type === "login_view" ? referrerDomain(referrer, { selfHosts }) : null
    }
  };
}

export function summarizeDaily(events, { days, now = new Date() } = {}) {
  const window = reportWindow(days, now);
  const buckets = new Map(window.dates.map((date) => [date, {
    views: 0,
    visitors: new Set(),
    videoPlays: 0,
    videoCompletes: 0,
    referrers: new Map()
  }]));
  for (const event of events) {
    const created = event.createdAt instanceof Date ? event.createdAt : new Date(event.createdAt);
    if (Number.isNaN(created.getTime()) || created < window.start || created >= window.end) continue;
    const bucket = buckets.get(sydneyDate(created));
    if (!bucket) continue;
    if (event.type === "login_view") {
      bucket.views += 1;
      if (event.visitorHash) bucket.visitors.add(event.visitorHash);
      if (event.referrer) bucket.referrers.set(event.referrer, (bucket.referrers.get(event.referrer) || 0) + 1);
    } else if (event.type === "video_play") {
      bucket.videoPlays += 1;
    } else if (event.type === "video_complete") {
      bucket.videoCompletes += 1;
    }
  }
  return {
    timezone: SYDNEY,
    days: window.dates.map((date) => {
      const bucket = buckets.get(date);
      const referrers = [...bucket.referrers.entries()]
        .map(([domain, views]) => ({ domain, views }))
        .sort((left, right) => right.views - left.views || left.domain.localeCompare(right.domain))
        .slice(0, TOP_REFERRERS);
      return {
        date,
        views: bucket.views,
        uniqueVisitors: bucket.visitors.size,
        videoPlays: bucket.videoPlays,
        videoCompletes: bucket.videoCompletes,
        referrers
      };
    })
  };
}

export function dailyAccess({ authorization, bearerValid, invited }) {
  if (bearerToken(authorization)) return bearerValid ? { ok: true } : { ok: false, status: 401 };
  if (!invited) return { ok: false, status: 401 };
  return { ok: true };
}

export async function insertMetric(event) {
  const sql = getSql();
  await sql`
    insert into page_metrics (event_type, created_at, visitor_hash, referrer)
    values (${event.type}, ${event.createdAt}::timestamptz, ${event.visitorHash}, ${event.referrer})
  `;
}

export async function listMetrics(start, end) {
  const sql = getSql();
  const rows = await sql`
    select event_type, created_at, visitor_hash, referrer
    from page_metrics
    where created_at >= ${start.toISOString()}::timestamptz
      and created_at < ${end.toISOString()}::timestamptz
    order by created_at asc
  `;
  return rows.map((row) => ({
    type: row.event_type,
    createdAt: row.created_at,
    visitorHash: row.visitor_hash,
    referrer: row.referrer || null
  }));
}
