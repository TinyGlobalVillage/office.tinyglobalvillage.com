// Wizards wiring for the Office Modules tile (SYSTEM-scoped, admin-gated).
// Mounts the same @tgv/module-wizards route factory a Villager's own wizards tab will
// use — here with the shared Office pgPool and a system context (tenant_id NULL), so
// TGV's own wizards are canon rows and a tenant's are their own.
// Mirrors src/lib/email-campaigns/deps.ts deliberately: one wiring shape per module.
import { NextResponse, type NextRequest } from "next/server";
import { createWizardsRoutes, type WizardsContext } from "@tgv/module-wizards/server/routes";
import { pgPool } from "@/lib/pg-pool";
import { requireAdmin } from "@/lib/api-admin";

let _routes: ReturnType<typeof createWizardsRoutes> | null = null;
export function wizards() {
  if (!_routes) _routes = createWizardsRoutes({ pool: pgPool });
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
