import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { inviteAllowed } from "./lib/access.js";
import { pendingInviteForIdentity } from "./lib/stage2-store.js";

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
      const emailVerified = provider === "google" ? profile?.email_verified !== false : profile?.email_verified;
      const allowed = inviteAllowed({
        email,
        emailVerified,
        githubLogin,
        emails: process.env.ALLOWED_EMAILS,
        githubLogins: process.env.ALLOWED_GITHUB_LOGINS
      });
      const invited = !allowed && provider === "github"
        ? await pendingInviteForIdentity({ email, githubLogin })
        : null;
      if (!allowed && !invited) return false;
      const { identityWorkspace } = await import("./lib/workspace.js");
      const { recordEvent } = await import("./lib/account-events.js");
      await recordEvent({
        workspaceId: identityWorkspace({ email, githubLogin }) || invited?.workspaceId || "",
        email,
        kind: "sign-in"
      });
      return true;
    },
    async jwt({ token, user, profile }) {
      if (user?.name) token.name = user.name;
      if (user?.email) token.email = user.email;
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
      }
      return session;
    }
  }
});
