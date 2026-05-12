import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

// This config is used by middleware (Edge runtime) — no Prisma imports allowed here.
// The actual authorize / signIn logic is in auth.ts which adds the Prisma-dependent parts.
const googleClientId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
const googleClientSecret =
  process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;

export const authConfig: NextAuthConfig = {
  // Trust the Host header — we're typically behind a reverse proxy (Docker,
  // nginx, etc.) so the Host the user requested is what we should redirect to.
  // Without this, NextAuth v5 refuses to operate in production with a clear
  // "UntrustedHost" error.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(googleClientId && googleClientSecret
      ? [Google({ clientId: googleClientId, clientSecret: googleClientSecret })]
      : []),
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
      const role = auth?.user?.role;

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

      // Admin-only routes (OWNER + ADMIN)
      if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
        if (role !== "ADMIN" && role !== "OWNER") {
          return Response.redirect(new URL("/chat", nextUrl));
        }
      }

      // PENDING users (newly self-provisioned via SSO) can browse /chat but
      // cannot send messages or use integrations. Write APIs gate on the role
      // themselves; here we just make sure they can't reach team/workflow
      // management pages.
      if (role === "PENDING") {
        const pendingBlocked =
          pathname.startsWith("/api/workflows") ||
          pathname.startsWith("/api/automations") ||
          pathname.startsWith("/api/integrations") ||
          pathname.startsWith("/api/projects");
        if (pendingBlocked) {
          return Response.redirect(new URL("/chat", nextUrl));
        }
      }

      return true;
    },
  },
};
