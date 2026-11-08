export const METRIC_TYPES = ["login_view", "video_play", "video_complete"];

export function videoRatio(current, duration) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  if (!Number.isFinite(current) || current < 0) return 0;
  return current / duration;
}

export function takeOnce(seen, type) {
  if (!METRIC_TYPES.includes(type) || seen[type]) return false;
  seen[type] = true;
  return true;
}
