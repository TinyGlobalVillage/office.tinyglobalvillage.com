/**
 * SVG Lab saved variants — staff-edited copies of ecosystem icons.
 * GET  → { variants: SvgVariant[] }
 * POST { name, sourceKey, svg } → { variant }
 * Storage + sanitization live in @/lib/svg-lab/store (index+entry layout).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { readVariants, saveVariant } from "@/lib/svg-lab/store";
import { sanitizeSvgMarkup } from "@/app/components/svg-lab/svgModel";

export const runtime = "nodejs";

const MAX_SVG_BYTES = 200 * 1024;

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ variants: await readVariants() });
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { name?: string; sourceKey?: string; svg?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const name = (body.name ?? "").trim().slice(0, 80);
  const sourceKey = (body.sourceKey ?? "").trim().slice(0, 200);
  const svg = sanitizeSvgMarkup((body.svg ?? "").trim());
  if (!name || !svg) return NextResponse.json({ error: "name and svg required" }, { status: 400 });
  if (Buffer.byteLength(svg, "utf8") > MAX_SVG_BYTES)
    return NextResponse.json({ error: "svg too large" }, { status: 413 });
  if (!svg.startsWith("<svg")) return NextResponse.json({ error: "not an svg" }, { status: 400 });

  const variant = await saveVariant({ name, sourceKey, svg, createdBy: token.username ?? token.sub ?? "staff" });
  return NextResponse.json({ variant });
}
