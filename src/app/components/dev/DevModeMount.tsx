/**
 * Mounts the DEV MODE drawer globally when all conditions hold:
 *   - NEXT_PUBLIC_DEV_SWITCHER is "true" (or NODE_ENV === "development")
 *   - current session is authenticated
 *   - server confirms the real user is role=admin (via /api/dev/demo-users)
 *   - localStorage "dev-drawer-on" !== "false" (default on for admins)
 *
 * Listens for the custom "dev-drawer-change" event (fired by the Settings
 * modal lightswitch) so toggling reflects immediately without a reload.
 */
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import DevUserSwitcher from "./DevUserSwitcher";

const DRAWER_KEY = "dev-drawer-on";

// Routes where the DEV drawer must NOT render. Auth pages are excluded so the
// mount never fires /api/dev/demo-users while a user is mid-login, and admin-
// only UI never appears before the session is established.
const EXCLUDED_PREFIXES = [
  "/login",
  "/verify-2fa",
  "/setup-2fa",
  "/setup-passkey",
  "/api",
];

function readDrawerOn(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DRAWER_KEY) !== "false";
}

export default function DevModeMount() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [drawerOn, setDrawerOn] = useState<boolean>(false);

  const pathExcluded = EXCLUDED_PREFIXES.some((p) => pathname?.startsWith(p));

  const envEnabled =
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_DEV_SWITCHER === "true";

  useEffect(() => {
    setDrawerOn(readDrawerOn());
    function onChange() { setDrawerOn(readDrawerOn()); }
    window.addEventListener("dev-drawer-change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("dev-drawer-change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  useEffect(() => {
    if (!envEnabled || status !== "authenticated" || pathExcluded) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dev/demo-users");
        if (!cancelled) setIsAdmin(res.ok);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => { cancelled = true; };
  }, [envEnabled, status, pathExcluded]);

  if (pathExcluded || !envEnabled || status !== "authenticated" || !isAdmin || !drawerOn) return null;

  const realUsername =
    (session?.user as { username?: string } | null)?.username ?? "admin";
  return <DevUserSwitcher adminUsername={realUsername} />;
}
