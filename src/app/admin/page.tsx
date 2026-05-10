/**
 * TGV Office — admin dashboard scaffold.
 *
 * Auth is gated by the proxy middleware (src/proxy.ts) — if the request
 * reaches this component, the user has a valid JWT. We DO NOT redirect on
 * useSession showing "loading" or a brief "unauthenticated" blip, since that
 * would race with SessionProvider's first /api/auth/session fetch.
 *
 * Admin-role check is done by probing /api/dev/demo-users (which the dev
 * routes already gate server-side). If the probe fails, we just show a
 * "not authorized" message rather than redirecting.
 */
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import AdminDashboardClient from "./AdminDashboardClient";

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const [adminConfirmed, setAdminConfirmed] = useState<boolean | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dev/demo-users");
        if (!cancelled) setAdminConfirmed(res.ok);
      } catch {
        if (!cancelled) setAdminConfirmed(false);
      }
    })();
    return () => { cancelled = true; };
  }, [status]);

  const wrap = (body: React.ReactNode) => (
    <div style={{
      minHeight: "100vh",
      padding: 48,
      fontFamily: "var(--font-geist-sans)",
      color: "var(--t-textMuted)",
      background: "var(--t-bg)",
    }}>{body}</div>
  );

  if (status === "loading") return wrap("Loading session…");
  if (status !== "authenticated") return wrap(<>Not signed in. <a href="/login">Sign in</a>.</>);
  if (adminConfirmed === null) return wrap("Verifying admin access…");
  if (!adminConfirmed) return wrap("Admin-only page. Contact Gio if you need access.");

  const username =
    (session?.user as { username?: string } | null)?.username ?? "admin";
  return <AdminDashboardClient adminUsername={username} />;
}
