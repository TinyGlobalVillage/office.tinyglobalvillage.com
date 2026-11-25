// src/lib/agent/server.ts — Teglov's pillbar on Office. Office only serves the session route
// (who may use Teglov, which power tier is on); the worker and the tools live on TGV, which shares
// this database. No worker key here, so every worker op answers 404.
import "server-only";
import type { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { createAgentEngine, createAgentRouteHandlers, type TimStore } from "@tgv/module-agent/server";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db-drizzle";
import { emailForOfficeUser } from "@/lib/im/server";

const engine = createAgentEngine({ db: db as never, tim: {} as TimStore, jobSecret: "", tools: [], ovh: null });

const handlers = createAgentRouteHandlers({
  engine,
  workerKey: "",
  async resolveMember(req) {
    const token = await requireAuth(req as NextRequest);
    const email = emailForOfficeUser(token?.username ?? token?.sub);
    if (!email) return null;
    // Primary address first; a secondary address counts only once verified (an unverified one proves nothing).
    const r = (await db.execute(sql`SELECT m.id, 0 AS rank FROM public.members m WHERE m.deleted_at IS NULL AND lower(m.email) = ${email}
      UNION ALL
      SELECT m.id, 1 FROM public.member_emails e JOIN public.members m ON m.id = e.member_id
      WHERE m.deleted_at IS NULL AND lower(e.email) = ${email} AND e.verified_at IS NOT NULL
      ORDER BY rank LIMIT 1`)) as unknown as { rows?: Array<{ id: string }> };
    return r.rows?.[0]?.id ?? null;
  },
});

export const agentGET = (req: Request) => handlers.GET(req);
export const agentPOST = (req: Request) => handlers.POST(req);
