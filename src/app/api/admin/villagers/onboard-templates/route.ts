// /api/admin/villagers/onboard-templates — published curated templates for the
// Onboard Villager modal's gallery rail. Reads shared_templates straight from
// the shared tgv_db (Office villagers pattern — raw SQL via db.execute; the
// wizard's own gallery route is member-session-gated so Office can't use it).
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";

export const runtime = "nodejs";

function tgvBase(): string {
  return (process.env.TGV_BASE_URL ?? "https://tinyglobalvillage.com").replace(/\/$/, "");
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const res = await db.execute(sql`
    SELECT id, template_id, label, description, category, tags, thumbnail
      FROM public.shared_templates
     WHERE status = 'published' AND deleted_at IS NULL
     ORDER BY category = 'home' DESC, label ASC`);
  const rows = ((res as unknown as { rows?: Record<string, unknown>[] }).rows ?? []) as Array<{
    id: string;
    template_id: string;
    label: string;
    description: string | null;
    category: string | null;
    tags: string[] | null;
    thumbnail: string | null;
  }>;

  const base = tgvBase();
  return NextResponse.json({
    templates: rows.map((r) => ({
      id: r.id,
      templateId: r.template_id,
      label: r.label,
      description: r.description,
      category: r.category,
      tags: r.tags ?? [],
      // Thumbnails are stored app-relative (/templates/thumbs/<id>.png) — serve
      // them from tgv.com so Office can render them cross-origin.
      thumbnail: r.thumbnail ? `${base}${r.thumbnail.startsWith("/") ? "" : "/"}${r.thumbnail}` : null,
    })),
  });
}
