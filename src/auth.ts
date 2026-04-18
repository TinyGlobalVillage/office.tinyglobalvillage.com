import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

const USERS = [
  {
    id: "1",
    name: "Gio",
    username: "admin",
    passwordHashEnv: "ADMIN_PASSWORD_HASH",
  },
  {
    id: "2",
    name: "Marthe",
    username: "marmar",
    passwordHashEnv: "MARMAR_PASSWORD_HASH",
  },
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    // Dev-only: skip password when DEV_AUTO_LOGIN=<username> is set
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
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const username = credentials?.username as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!username || !password) return null;

        const user = USERS.find((u) => u.username === username);
        if (!user) return null;

        const hash = process.env[user.passwordHashEnv];
        if (!hash) return null;

        const valid = await bcrypt.compare(password, hash);
        if (!valid) return null;

        return { id: user.id, name: user.name, username: user.username } as { id: string; name: string; username: string };
      },
    }),
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
        // Store the login username in the JWT so proxy can read it without filesystem access
        token.username = (user as { username?: string }).username ?? null;
      }
      // Backfill username for existing sessions that predate this field
      if (!token.username) {
        const byName = token.name ? USERS.find((u) => u.name === token.name) : null;
        const bySub  = token.sub  ? USERS.find((u) => u.id   === token.sub)  : null;
        const match  = byName ?? bySub;
        if (match) token.username = match.username;
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
