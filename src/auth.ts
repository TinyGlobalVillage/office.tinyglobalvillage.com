import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

// Passkey-only, member-auth-only (2026-06-05 retire of the legacy NextAuth
// login). The standing password login is GONE — no credentials/password
// provider remains. Authentication is solely a WebAuthn passkey (or a recovery
// code) via @tgv/module-auth, which issues the member session cookie
// (tgv_member_session). The break-glass is now the recovery-code login +
// audited admin reset — NOT a password.
//
// This NextAuth instance is kept ONLY as the client session-context shell
// (SessionProvider/useSession) + the sign-out helper that clears any stale
// legacy JWT. It no longer issues sessions in production (no non-dev provider),
// and nothing mints a NextAuth JWT anymore — the proxy + getEffectiveUser read
// the member session exclusively.
const USERS = [
  { id: "1", name: "Gio", username: "admin" },
  { id: "2", name: "Marthe", username: "marmar" },
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    // Dev-only convenience: skip auth when DEV_AUTO_LOGIN=<username> is set on a
    // local dev box. NODE_ENV-gated → never active in production.
    ...(process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN
      ? [Credentials({
          id: "dev",
          credentials: {},
          authorize: () => {
            const u = USERS.find(u => u.username === process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN);
            return u ? { id: u.id, name: u.name, username: u.username } as { id: string; name: string; username: string } : null;
          },
        })]
      : []),
  ],
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.name = user.name;
        token.username = (user as { username?: string }).username ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (token.name) session.user.name = token.name as string;
      if (token.username) (session.user as unknown as Record<string, unknown>).username = token.username;
      return session;
    },
  },
});
