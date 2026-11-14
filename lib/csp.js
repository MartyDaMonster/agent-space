export function contentSecurityPolicy({ nonce, secure = false } = {}) {
  const script = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    "https://va.vercel-scripts.com",
    "'unsafe-inline'"
  ].join(" ");
  const directives = [
    "default-src 'self'",
    `script-src ${script}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "media-src 'self' blob: https:",
    "connect-src 'self' https://va.vercel-scripts.com https://vitals.vercel-insights.com https://*.vercel-insights.com",
    "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ];
  if (secure) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
