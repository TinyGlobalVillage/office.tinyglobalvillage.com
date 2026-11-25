"use client";
// Is the signed-in Office user TGV staff (roster admin or employee)? One fetch of /api/users/me per
// page load, shared by every caller. FAIL-CLOSED: until the answer arrives, and whenever it can't be
// had, the answer is "no" — so a staff-only tile is never flashed at someone who isn't staff.
// The real boundary is still the server (requireStaff on the API, the page's own gate); this only
// decides what the dashboard draws.
import { useEffect, useState } from "react";

let asked: Promise<boolean> | null = null;

function ask(): Promise<boolean> {
  asked ??= fetch("/api/users/me", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((me) => me?.isStaff === true)
    .catch(() => false);
  return asked;
}

export function useIsStaff(): boolean {
  const [isStaff, setIsStaff] = useState(false);
  useEffect(() => {
    let live = true;
    void ask().then((v) => { if (live) setIsStaff(v); });
    return () => { live = false; };
  }, []);
  return isStaff;
}
