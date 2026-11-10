import { cookies } from "next/headers";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { inviteAllowed } from "./lib/access.js";
import { INVITE_COOKIE } from "./lib/invite-cookie.js";
import { authorizeGithubSignIn } from "./lib/invite-claim.js";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
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
        githubLogin,
        emails: process.env.ALLOWED_EMAILS,
        githubLogins: process.env.ALLOWED_GITHUB_LOGINS
      });
      const jar = await cookies();
      const decision = provider === "github" || allowed
        ? await authorizeGithubSignIn({
          email,
          githubLogin,
          githubId,
          cookieValue: jar.get(INVITE_COOKIE)?.value || "",
          allowed
        })
        : { ok: false };
      if (!decision.ok) return false;
      if (decision.email) user.email = decision.email;
      user.botomaticEmail = decision.email || email;
      user.githubId = githubId;
      user.githubLogin = githubLogin;
      const { identityWorkspace } = await import("./lib/workspace.js");
      const { recordEvent } = await import("./lib/account-events.js");
      await recordEvent({
        workspaceId: identityWorkspace({ email: user.email, githubLogin }) || decision.workspaceId || "",
        email: user.email,
        kind: "sign-in"
      });
      return true;
    },
    async jwt({ token, user, profile }) {
      if (user?.botomaticEmail) token.email = user.botomaticEmail;
      else if (user?.email) token.email = user.email;
      if (user?.name) token.name = user.name;
      if (user?.githubId) token.githubId = user.githubId;
      if (profile?.id) token.githubId = String(profile.id);
      if (user?.githubLogin) token.githubLogin = user.githubLogin;
      if (profile?.login) token.githubLogin = profile.login;
      const image = user?.image || profile?.picture || profile?.avatar_url || "";
      if (image) token.picture = image;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.name = token.name || session.user.name;
        session.user.email = token.email || session.user.email;
        session.user.image = token.picture || null;
        session.user.githubLogin = token.githubLogin || "";
        session.user.githubId = token.githubId || "";
      }
      return session;
    }
  }
});
