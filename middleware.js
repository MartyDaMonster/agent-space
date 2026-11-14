import { NextResponse } from "next/server";
import { decideAccess, hasAuthCookie } from "./lib/access.js";
import { trustedClientIp } from "./lib/client-ip.js";
import { contentSecurityPolicy } from "./lib/csp.js";
import { allowRate } from "./lib/request-limit.js";

export default function middleware(req) {
  const decision = decideAccess({
    pathname: req.nextUrl.pathname,
    hasSession: hasAuthCookie(req.cookies.getAll().map((cookie) => cookie.name)),
    authorization: req.headers.get("authorization")
  });
  if (decision.ok && (req.nextUrl.pathname === "/join" || req.nextUrl.pathname.startsWith("/join/"))) {
    const ip = trustedClientIp(req.headers) || "local";
    if (!allowRate(`join:${ip}`, 30, 60_000)) {
      return new Response("Too many requests", {
        status: 429,
        headers: { "cache-control": "private, no-store", "retry-after": "60" }
      });
    }
  }
  if (decision.ok) {
    const nonce = btoa(crypto.randomUUID());
    const policy = contentSecurityPolicy({
      nonce,
      secure: req.nextUrl.protocol === "https:"
    });
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-botomatic-path", req.nextUrl.pathname);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("content-security-policy", policy);
    if (req.nextUrl.pathname.startsWith("/join")) requestHeaders.set("x-botomatic-chrome", "onboard");
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", policy);
    return response;
  }
  if (decision.status) {
    return Response.json({ error: "Unauthorized" }, { status: decision.status });
  }
  const login = new URL("/login", req.nextUrl.origin);
  login.searchParams.set("callbackUrl", `${req.nextUrl.pathname}${req.nextUrl.search}`);
  return Response.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|_vercel/insights|_vercel/speed-insights).*)"]
};
