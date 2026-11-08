import { utcStamp } from "../scripts/schema.js";

export function formatUtc(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return utcStamp(date);
}

export function parseFeedQuery(searchParams) {
  const since = searchParams.get("since");
  const to = searchParams.get("to");
  const limitRaw = searchParams.get("limit");
  let limit = 50;
  if (limitRaw != null && limitRaw !== "") {
    if (!/^\d+$/.test(limitRaw) || Number(limitRaw) < 1 || Number(limitRaw) > 100) {
      return { ok: false, error: "limit must be a whole number from 1 to 100." };
    }
    limit = Number(limitRaw);
  }
  if (since != null && since !== "" && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(since)) {
    return { ok: false, error: "since must be UTC, such as 2026-11-07T00:00:00Z." };
  }
  if (to != null && to !== "" && !/^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/.test(to)) {
    return { ok: false, error: "to must be a bot slug." };
  }
  const project = searchParams.get("project");
  if (project != null && project !== "" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project)) {
    return { ok: false, error: "project must be a slug." };
  }
  const mentions = searchParams.get("mentions");
  if (mentions != null && mentions !== "" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(mentions)) {
    return { ok: false, error: "mentions must be a slug." };
  }
  return {
    ok: true,
    since: since || null,
    to: to || null,
    limit,
    project: project || null,
    mentions: mentions || null
  };
}
