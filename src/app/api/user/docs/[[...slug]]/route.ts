export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Doc Editor API (module-docs) — Office's mount of the same route factory TGV mounts, so the
// Modules → Doc Editor view and TGV's Editor → Doc Editor are one library behind one interface
// (Gio 2026-10-22). OPTIONAL catch-all: the list endpoint is the base path itself.
import type { NextRequest } from "next/server";
import { createDocsRouteHandlers } from "@tgv/module-docs/api/docs";
import { createPm2LanguageTool } from "@tgv/module-docs/server/languageTool";
import { db } from "@/lib/db-drizzle";
import { requireAuth } from "@/lib/api-auth";
import { getOfficeRole, memberIdForUsername } from "@/lib/member-auth/bridge";
import { resolvePlatformSiteId } from "@/lib/docs/platformSite";
import { sql } from "drizzle-orm";

const firstRow = <T,>(r: unknown): T | undefined =>
  ((r as { rows?: T[] }).rows ?? (r as T[]))[0];

/** Share links open on the public site, never on Office — a recipient has no Office login. */
const PUBLIC_ORIGIN = process.env.TGV_PUBLIC_ORIGIN || "https://tinyglobalvillage.com";

const usernameOf = async (req: NextRequest) => {
  const token = await requireAuth(req);
  return token?.username ?? token?.sub ?? null;
};

const handlers = createDocsRouteHandlers({
  getDb: () => db,
  // Office user → their members row (via the staff roster), documents filed under HQ. Fails
  // closed: not on the roster, no members row, or no platform site → null → 401.
  getCtx: async (req) => {
    const userId = await memberIdForUsername((await usernameOf(req)) ?? undefined);
    if (!userId) return null;
    const siteId = await resolvePlatformSiteId();
    if (!siteId) return null;
    // The email lets a document shared with this ADDRESS open here too.
    const me = firstRow<{ email: string | null }>(
      await db.execute(sql`SELECT email FROM public.members WHERE id = ${userId} LIMIT 1`),
    );
    return { siteId, userId, email: me?.email || undefined };
  },
  memberByEmail: async (email) => {
    const row = firstRow<{ id: string }>(
      await db.execute(sql`
        SELECT id FROM public.members WHERE lower(email) = ${email.toLowerCase()} AND deleted_at IS NULL LIMIT 1`),
    );
    return row ? { memberId: row.id } : null;
  },
  shareUrl: (token) => `${PUBLIC_ORIGIN}/d/${token}/`,
  // The gear's fleet-engine switch: Office admins only, same wall as the Modules route.
  canManageProofing: async (req) => {
    const username = await usernameOf(req);
    return !!username && getOfficeRole(username) === "admin";
  },
  languageTool: createPm2LanguageTool(),
});

export const { GET, POST, PATCH, DELETE } = handlers;
