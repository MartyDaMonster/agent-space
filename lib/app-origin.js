export function appOrigin(env = process.env) {
  const configured = String(env.APP_ORIGIN || "https://botomatic.dev").trim();
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "https://botomatic.dev";
    return url.origin;
  } catch {
    return "https://botomatic.dev";
  }
}
