/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@vercel/blob", "pg", "@napi-rs/canvas", "wawoff2"],
  outputFileTracingIncludes: {
    "/api/invite/[inviteId]/countdown.png": ["./assets/fonts/fraunces-black-soft.woff2"],
    "/api/invite/[inviteId]/countdown.gif": ["./assets/fonts/fraunces-black-soft.woff2"],
    "/dev/invite-countdown.gif": ["./assets/fonts/fraunces-black-soft.woff2"]
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" }
        ]
      }
    ];
  }
};

export default nextConfig;
