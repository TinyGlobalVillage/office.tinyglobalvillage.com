import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { ringingForUser } from "@/lib/frontdesk/calls";
import { findContactByPhone } from "@/lib/frontdesk/contacts";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const ringing = ringingForUser(username);
  const call = ringing[0] ?? null;
  const contact = call ? findContactByPhone(call.fromE164) : null;
  return NextResponse.json({ call, contact });
}
