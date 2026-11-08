import { decideAccess, hasAuthCookie } from "./lib/access.js";

export default function middleware(req) {
  const decision = decideAccess({
    pathname: req.nextUrl.pathname,
    hasSession: hasAuthCookie(req.cookies.getAll().map((cookie) => cookie.name)),
    authorization: req.headers.get("authorization")
  });
  if (decision.ok) return;
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
