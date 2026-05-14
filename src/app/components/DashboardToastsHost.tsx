/**
 * Dashboard-wide toast host. Lives inside the dashboard layout so the
 * transcriber's "✓ ready" toast pops bottom-right wherever the operator
 * is in /dashboard — not just on /dashboard/utils.
 *
 * Why a separate client component instead of inlining the toast in
 * layout.tsx: layout.tsx is a server component and the toast needs the
 * Next.js client `useRouter` to navigate. This host is the smallest
 * possible client island that holds the routing concerns.
 */
"use client";

import { useRouter } from "next/navigation";
import { TranscriberJobsToast } from "@tgv/module-transcriber";

export default function DashboardToastsHost() {
  const router = useRouter();
  return (
    <TranscriberJobsToast
      onOpenEditor={(id) => router.push(`/dashboard/utils/transcripts/${id}`)}
      onOpenList={() => router.push("/dashboard/utils?transcripts=open")}
    />
  );
}
