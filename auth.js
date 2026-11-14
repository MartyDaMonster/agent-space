import { cookies, headers } from "next/headers";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { inviteAllowed } from "./lib/access.js";
import { INVITE_COOKIE, inviteCookieOptions } from "./lib/invite-cookie.js";
import { authorizeGithubSignIn } from "./lib/invite-claim.js";
import { MEMBER_ABSOLUTE_SECONDS, adminWindowState, memberSessionState, sessionClock } from "./lib/session-policy.js";
import { currentVersion, issueSession, sessionLive, subjectFromToken } from "./lib/session-store.js";

async function requestPath() {
  try {
    const headerList = await headers();
    return headerList.get("x-botomatic-path") || "";
  } catch {
    return "";
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: MEMBER_ABSOLUTE_SECONDS,
    updateAge: 24 * 60 * 60
  },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production"
      }
    }
  },
  pages: {
    signIn: "/login",
    error: "/login"
  },
  providers: [
    GitHub({
      authorization: { params: { scope: "read:user user:email" } }
    }),
    Google
  ],
  callbacks: {
    async signIn({ user, profile, account }) {
      const provider = account?.provider || "";
      const email = user?.email || profile?.email || "";
      const githubLogin = provider === "github" ? profile?.login || "" : "";
      const githubId = provider === "github" ? String(profile?.id || "") : "";
      const emailVerified = provider === "google" ? profile?.email_verified !== false : profile?.email_verified;
      const allowed = inviteAllowed({
        email,
        emailVerified,
        githubId,
        emails: process.env.ALLOWED_EMAILS,
        githubIds: process.env.ALLOWED_GITHUB_IDS
      });
      const jar = await cookies();
      const returnPath = jar.get("__Secure-authjs.callback-url")?.value
        || jar.get("authjs.callback-url")?.value
        || "";
      const decision = provider === "github" || allowed
        ? await authorizeGithubSignIn({
          email,
          githubLogin,
          githubId,
          cookieValue: jar.get(INVITE_COOKIE)?.value || "",
          returnPath,
          allowed
        })
        : { ok: false };
      if (!decision.ok) return false;
      user.email = email;
      user.emailSource = provider === "github" || provider === "google" ? provider : "";
      user.inviteEmail = decision.inviteEmail || "";
      user.githubId = githubId;
      user.githubLogin = githubLogin;
      if (decision.created) jar.set(INVITE_COOKIE, "", { ...inviteCookieOptions(), maxAge: 0 });
      const { identityWorkspace } = await import("./lib/workspace.js");
      const { recordEvent } = await import("./lib/account-events.js");
      await recordEvent({
        workspaceId: identityWorkspace({ email, githubId }) || decision.workspaceId || "",
        email,
        kind: "sign-in"
      });
      return true;
    },
    async jwt({ token, user, profile }) {
      if (user?.email) token.email = user.email;
      if (user?.emailSource) token.emailSource = user.emailSource;
      if (user?.inviteEmail) token.inviteEmail = user.inviteEmail;
      if (user?.name) token.name = user.name;
      if (user?.githubId) token.githubId = user.githubId;
      if (profile?.id) token.githubId = String(profile.id);
      if (user?.githubLogin) token.githubLogin = user.githubLogin;
      if (profile?.login) token.githubLogin = profile.login;
      const image = user?.image || profile?.picture || profile?.avatar_url || "";
      if (image) token.picture = image;
      const now = sessionClock();
      try {
        if (user) {
          const subject = subjectFromToken(token);
          const issued = subject ? await issueSession(subject) : null;
          if (!issued) return null;
          token.sid = issued.id;
          token.sv = issued.version;
          token.start = now;
          token.seen = now;
          token.authAt = now;
          token.adminSeen = now;
          token.adminBlock = "";
          return token;
        }
        if (!token.sid) {
          const subject = subjectFromToken(token);
          const issued = subject ? await issueSession(subject) : null;
          if (!issued) return null;
          token.sid = issued.id;
          token.sv = issued.version;
          token.start = now;
          token.seen = now;
          token.authAt = now;
          token.adminSeen = now;
        }
        const member = memberSessionState({ now, start: token.start, seen: token.seen });
        if (member !== "ok") return null;
        const version = await currentVersion(subjectFromToken(token));
        if (!version || Number(token.sv) !== version) return null;
        const live = await sessionLive(token.sid, token.sv);
        if (!live) return null;
        const path = await requestPath();
        const admin = path === "/admin" || path.startsWith("/admin/");
        if (admin) {
          const window = adminWindowState({ now, start: token.start, adminSeen: token.adminSeen });
          token.adminBlock = window === "ok" ? "" : window;
          if (window === "ok") token.adminSeen = now;
        }
        token.seen = now;
        return token;
      } catch (error) {
        console.error(error instanceof Error ? error.message : "session check failed");
        return null;
      }
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.name = token.name || session.user.name;
        session.user.email = token.email || session.user.email;
        session.user.image = token.picture || null;
        session.user.githubLogin = token.githubLogin || "";
        session.user.githubId = token.githubId || "";
        session.user.inviteEmail = token.inviteEmail || "";
        session.user.emailSource = token.emailSource || "";
        session.user.authAt = token.authAt || 0;
        session.user.sessionStart = token.start || 0;
        session.user.sessionSeen = token.seen || 0;
        session.user.adminSeen = token.adminSeen || 0;
        session.user.adminBlock = token.adminBlock || "";
      }
      return session;
    }
  }
});
