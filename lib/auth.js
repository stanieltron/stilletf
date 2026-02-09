// lib/auth.js
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";

export const authOptions = {
  // JWT sessions so we can cache user.id (uid) on the token
  session: { strategy: "jwt" },

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  callbacks: {
    /**
     * jwt: runs whenever the JWT is issued/updated.
     * - Keep your existing provider info on the token
     * - Resolve and cache our DB user id (uid) + nickname onto the token
     */
    async jwt({ token, account, profile }) {
      // --- keep your provider fields ---
      if (account) {
        token.provider = account.provider;
        token.providerAccountId =
          account.providerAccountId ||
          account.userId ||
          account.accountId ||
          account.id;
      }

      // Keep your name derivation from the profile
      if (profile?.name && !token.name) {
        token.name = profile.name;
      }

      // --- NEW: resolve DB user id (uid) & nickname and cache on token ---
      // If we already have uid, keep it. Otherwise try to resolve from our DB by email.
      // (With your current setup you key users by email; if no match, uid stays undefined.)
      if (!token.uid && token.email) {
        try {
          const user = await prisma.user.findUnique({
            where: { email: token.email },
            select: { id: true, nickname: true },
          });
          if (user) {
            token.uid = user.id;                        // <-- DB User.id cached on token
            if (user.nickname && !token.nickname) {
              token.nickname = user.nickname;
            }
          }
        } catch {
          // swallow DB errors to avoid breaking auth
        }
      }

      return token;
    },

    /**
     * session: exposes fields to the client/session API.
     * - Keep your provider fields on session (as before)
     * - Always expose our DB user id on session.user.id
     * - Keep your 'exists' and nickname logic; avoid extra DB hits when possible
     */
    async session({ session, token }) {
      // --- keep your provider fields on the session ---
      if (token?.provider) {
        session.provider = token.provider;
        session.providerAccountId = token.providerAccountId;
      }

      // --- NEW: make the app ID-first ---
      // Put our DB user id on the session (if we have it)
      if (session?.user) {
        if (token?.uid) {
          session.user.id = token.uid;                 // <-- the important bit
        }

        // Prefer nickname cached on token, but keep your original behavior
        if (token?.nickname && !session.user.nickname) {
          session.user.nickname = token.nickname;
        }

        // Maintain your 'exists' and nickname behavior,
        // but avoid a DB call if we already have uid.
        try {
          if (session.user.email) {
            if (token?.uid) {
              // We already resolved a DB user; exists = true
              session.user.exists = true;
              // If we still don't have a nickname, we *optionally* fetch it now.
              if (!session.user.nickname) {
                const u = await prisma.user.findUnique({
                  where: { email: session.user.email },
                  select: { nickname: true },
                });
                if (u?.nickname) {
                  session.user.nickname = u.nickname;
                  if (!session.user.name) session.user.name = u.nickname;
                }
              }
            } else {
              // No uid cached; fall back to your original lookup so 'exists' still works
              const u = await prisma.user.findUnique({
                where: { email: session.user.email },
                select: { id: true, nickname: true },
              });
              session.user.exists = !!u;
              if (u) {
                session.user.id = u.id;                // <-- expose id even on fallback
                if (u.nickname) {
                  session.user.nickname = session.user.nickname || u.nickname;
                  if (!session.user.name) session.user.name = u.nickname;
                }
              }
            }
          }
        } catch {
          // leave session as-is on error
        }
      }

      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};
