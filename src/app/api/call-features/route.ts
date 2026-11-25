// /api/call-features?surface=tim — what a call surface in Office offers (TIM calls ride the shared
// call package). Read-only here; Office operators edit through /api/admin/call-features.
import { db } from "@/lib/db-drizzle";
import { createCallFeatureHandlers } from "@tgv/module-video-calls/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const h = createCallFeatureHandlers({ db, canEdit: async () => false });
export const GET = h.GET;
