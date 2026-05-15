import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcrypt";
import { prisma } from "./prisma";
import { authConfig } from "./auth.config";

const allowedDomain = process.env.SSO_ALLOWED_DOMAIN?.trim().toLowerCase() || "";
const googleClientId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
const googleClientSecret =
  process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;

export const ssoEnabled = Boolean(googleClientId && googleClientSecret && allowedDomain);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;

      const email = profile?.email?.toLowerCase();
      const verified = (profile as { email_verified?: boolean } | undefined)?.email_verified;
      const hd = (profile as { hd?: string } | undefined)?.hd?.toLowerCase();
      const emailDomain = email?.split("@")[1];

      if (!email || !verified) return false;
      if (!allowedDomain) return false;
      if (hd !== allowedDomain && emailDomain !== allowedDomain) return false;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (!existing) {
        await prisma.user.create({
          data: {
            email,
            name: profile?.name || email,
            role: "PENDING",
          },
        });
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google" && profile?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: profile.email.toLowerCase() },
          select: { id: true, role: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
        }
        return token;
      }
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = user.id;
      } else if (token.id) {
        // Refresh role from DB so changes take effect without re-login.
        // If the user row is gone (DB reset, account deleted), invalidate the
        // token so we don't pass a dangling userId to downstream queries
        // (which would 500 with a foreign-key error on first write).
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
        } else {
          delete (token as { id?: string }).id;
          delete (token as { role?: string }).role;
        }
      }
      return token;
    },
    session({ session, token }) {
      // Token was invalidated upstream (user row no longer exists). Strip the
      // user field entirely so every `if (!session?.user)` guard in the API
      // tier treats this as logged-out and the user gets bounced to /login.
      if (!token.id) {
        return { ...session, user: undefined as unknown as typeof session.user };
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  providers: [
    ...(googleClientId && googleClientSecret
      ? [
          Google({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            // Restrict the Google account picker to the allowed Workspace domain.
            // `hd` is a hint only — the signIn callback enforces the actual check.
            authorization: allowedDomain
              ? { params: { hd: allowedDomain, prompt: "select_account" } }
              : undefined,
          }),
        ]
      : []),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user?.hashedPassword) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.hashedPassword
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});
