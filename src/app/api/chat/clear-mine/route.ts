import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { setClearCutoff, dmChannelKey, tgvChannelKey, groupChannelKey } from "@/lib/chat-clears";

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const body = await req.json().catch(() => null);
  const scope = typeof body?.scope === "string" ? body.scope : "";

  let channel: string | null = null;
  if (scope === "tgv") {
    channel = tgvChannelKey();
  } else if (scope === "dm") {
    const peer = typeof body?.peer === "string" ? body.peer : "";
    if (!peer) return NextResponse.json({ error: "Missing peer" }, { status: 400 });
    channel = dmChannelKey(username, peer);
  } else if (scope === "group") {
    const groupId = typeof body?.groupId === "string" ? body.groupId : "";
    if (!groupId) return NextResponse.json({ error: "Missing groupId" }, { status: 400 });
    channel = groupChannelKey(groupId);
  } else {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

  const cutoff = new Date().toISOString();
  setClearCutoff(username, channel, cutoff);
  return NextResponse.json({ ok: true, cutoff });
}
