import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { emailAllowed } from "./lib/access.js";

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
    async signIn({ user, profile }) {
      const email = user?.email || profile?.email || "";
      return emailAllowed(email, process.env.ALLOWED_EMAILS);
    },
    async jwt({ token, user, profile }) {
      if (user?.name) token.name = user.name;
      if (user?.email) token.email = user.email;
      const image = user?.image || profile?.picture || profile?.avatar_url || "";
      if (image) token.picture = image;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.name = token.name || session.user.name;
        session.user.email = token.email || session.user.email;
        session.user.image = token.picture || null;
      }
      return session;
    }
  }
});
