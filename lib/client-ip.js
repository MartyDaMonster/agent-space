function headerValue(headers, name) {
  if (!headers) return "";
  const value = typeof headers.get === "function" ? headers.get(name) : headers[name];
  return String(value || "");
}

export function trustedClientIp(headers) {
  const real = headerValue(headers, "x-real-ip").trim();
  if (real) return real;
  const forwarded = headerValue(headers, "x-forwarded-for");
  const parts = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}
