import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// This config is used by middleware (Edge runtime) — no Prisma imports allowed here.
// The actual authorize logic is in auth.ts which adds the Prisma-dependent parts.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    // Placeholder — the real authorize function is added in auth.ts
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      // Public routes
      if (
        pathname.startsWith("/api/auth") ||
        pathname === "/login" ||
        pathname === "/setup" ||
        pathname === "/api/setup"
      ) {
        return true;
      }

      // Must be logged in for everything else
      if (!isLoggedIn) {
        return false; // Redirects to signIn page
      }

      // Admin-only routes
      if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
        if (auth?.user?.role !== "ADMIN") {
          return Response.redirect(new URL("/chat", nextUrl));
        }
      }

      return true;
    },
  },
};
