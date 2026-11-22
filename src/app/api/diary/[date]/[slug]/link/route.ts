// GET /api/diary/<date>/<slug>/link — this entry's link name + the old names that still redirect to it
// PUT /api/diary/<date>/<slug>/link {name} — rename the link; the old name becomes a redirect
import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { isDate, isSlug } from "../../../_lib";
import { linkNames, redirectsTo, renameLink, LinkError } from "@/lib/diary-links";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ date: string; slug: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!(await requireAuth(req))?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { date, slug } = await ctx.params;
  if (!isDate(date) || !isSlug(slug)) return NextResponse.json({ error: "invalid date or slug" }, { status: 400 });
  const key = `${date}/${slug}`;
  const name = (await linkNames())[key];
  if (!name) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ name, redirects: await redirectsTo(key) });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  if (!(await requireAuth(req))?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { date, slug } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  try {
    const name = await renameLink(`${date}/${slug}`, typeof body.name === "string" ? body.name : "");
    return NextResponse.json({ name, redirects: await redirectsTo(`${date}/${slug}`) });
  } catch (e) {
    const status = e instanceof LinkError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
