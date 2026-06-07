/**
 * TGV Office — admin dashboard scaffold.
 *
 * Auth is gated by the proxy middleware (src/proxy.ts) on the member session.
 * Identity + role are resolved from /api/users/me (requireAuth -> member
 * session), the same pattern the rest of the app uses — NOT useSession(), which
 * is dead under member-auth (no NextAuth JWT is issued post-2026-06-05 retire).
 */
"use client";

import { useEffect, useState } from "react";
import AdminDashboardClient from "./AdminDashboardClient";

type Me = { username?: string; role?: string };

export default function AdminDashboardPage() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/users/me");
        const data = res.ok ? ((await res.json()) as Me) : null;
        if (!cancelled) setMe(data);
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const wrap = (body: React.ReactNode) => (
    <div style={{
      minHeight: "100vh",
      padding: 48,
      fontFamily: "var(--font-geist-sans)",
      color: "var(--t-textMuted)",
      background: "var(--t-bg)",
    }}>{body}</div>
  );

  if (me === undefined) return wrap("Loading…");
  if (!me) return wrap(<>Not signed in. <a href="/login">Sign in</a>.</>);
  if (me.role !== "admin") return wrap("Admin-only page. Contact Gio if you need access.");

  return <AdminDashboardClient adminUsername={me.username ?? "admin"} />;
}
