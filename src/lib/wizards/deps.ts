// Wizards wiring for the Office Modules tile (SYSTEM-scoped, admin-gated).
// Mounts the same @tgv/module-wizards route factory a Villager's own wizards tab will
// use — here with the shared Office pgPool and a system context (tenant_id NULL), so
// TGV's own wizards are canon rows and a tenant's are their own.
// Mirrors src/lib/email-campaigns/deps.ts deliberately: one wiring shape per module.
import { NextResponse, type NextRequest } from "next/server";
import { createWizardsRoutes, type WizardsContext } from "@tgv/module-wizards/server/routes";
import { scratchSlugForSlide } from "@tgv/module-wizards/slides";
import { pgPool } from "@/lib/pg-pool";
import { requireAdmin } from "@/lib/api-admin";

/**
 * Delete the workbench pages of steps that no longer exist.
 *
 * Double-clicking a slide on the board opens it in HQ's page editor, and that
 * door writes a throwaway `page_models` row to hold the canvas. Nothing else
 * ever deletes it, so a step that is removed here leaves its workbench behind —
 * a page in an operator's list with nothing left to save it back into. The
 * Template Gallery hit this first and answered it the same way: the workbench
 * dies with the thing it was opened from, whoever opened it.
 *
 * Office reaches into HQ's table on purpose. `page_models` lives in the same
 * `tgv_db` this pool is already connected to, and the delete happens HERE
 * because the board is here — the alternative is an app-to-app HTTP call for
 * housekeeping, which is a failure mode in exchange for nothing. The slug comes
 * from the module so both apps compute it from one definition.
 */
async function deleteSlideWorkbenches(key: string, stepKeys: string[]) {
  const slugs = stepKeys.map((stepKey) => scratchSlugForSlide(key, stepKey));
  await pgPool.query(`DELETE FROM public.page_models WHERE slug = ANY($1::text[])`, [slugs]);
}

let _routes: ReturnType<typeof createWizardsRoutes> | null = null;
export function wizards() {
  if (!_routes)
    _routes = createWizardsRoutes({
      pool: pgPool,
      onSlidesOrphaned: ({ key, stepKeys }) => deleteSlideWorkbenches(key, stepKeys),
    });
  return _routes;
}

/** Operator gate → system-scoped context. Returns the context, or a NextResponse to
 *  return as-is when the caller isn't an admin. */
export async function adminCtx(req: NextRequest): Promise<WizardsContext | NextResponse> {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  return { scope: "system", tenantId: null, username: gate.username };
}

/** Uniform 400 for a route that threw (a Zod parse, or a save against a missing row). */
export function badRequest(e: unknown) {
  return NextResponse.json({ error: e instanceof Error ? e.message : "request_failed" }, { status: 400 });
}
