const buckets = new Map();

export function allowRate(key, limit = 30, windowMs = 60_000, now = Date.now()) {
  const recent = (buckets.get(key) || []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.delete(key);
  buckets.set(key, recent);
  while (buckets.size > 5000) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined || oldest === key) break;
    buckets.delete(oldest);
  }
  return true;
}
