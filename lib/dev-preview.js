export function devPreviewBlocked(env = process.env) {
  return env.VERCEL_ENV === "production" || env.NODE_ENV === "production";
}
