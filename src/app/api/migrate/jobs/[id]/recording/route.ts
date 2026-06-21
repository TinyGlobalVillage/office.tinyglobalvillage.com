// /api/migrate/jobs/[id]/recording — stream the headless walkthrough .webm a job
// produced (when run with recording on). 404 until the recorder finishes. Admin-gated;
// the id is validated as a uuid to keep it off the filesystem path beyond the recordings dir.

import { NextResponse, type NextRequest } from "next/server";
import { createReadStream, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import { requireAdmin } from "@/lib/api-admin";

export const runtime = "nodejs";

const RCS_ROOT = "/srv/refusion-core";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return new NextResponse("bad id", { status: 400 });

  const path = `${RCS_ROOT}/data/migrate/recordings/${id}.webm`;
  if (!existsSync(path)) return new NextResponse("no recording", { status: 404 });

  const stat = statSync(path);
  const stream = Readable.toWeb(createReadStream(path)) as unknown as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "content-type": "video/webm",
      "content-length": String(stat.size),
      "cache-control": "private, max-age=60",
    },
  });
}
