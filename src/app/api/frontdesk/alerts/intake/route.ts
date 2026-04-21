/**
 * Public intake for website form submissions. Authenticated by the
 * `FRONTDESK_INTAKE_TOKEN` env var — the public website includes this token
 * in the `x-frontdesk-intake-token` header when posting form payloads.
 *
 * Leaves the env var unset until the user provisions one; the route then 503s
 * instead of silently accepting unauthenticated inbox spam.
 */
import { type NextRequest, NextResponse } from "next/server";
import { createAlert } from "@/lib/frontdesk/alerts";

export async function POST(req: NextRequest) {
  const configured = process.env.FRONTDESK_INTAKE_TOKEN?.trim();
  if (!configured) {
    return NextResponse.json({ error: "Front Desk intake not configured" }, { status: 503 });
  }
  const presented = req.headers.get("x-frontdesk-intake-token");
  if (presented !== configured) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const subject = typeof body.subject === "string" ? body.subject : "Website inquiry";
  const messageBody = typeof body.body === "string" ? body.body : "";
  const fromName = typeof body.fromName === "string" ? body.fromName : null;
  const fromEmail = typeof body.fromEmail === "string" ? body.fromEmail : null;
  const fromPhone = typeof body.fromPhone === "string" ? body.fromPhone : null;
  const payload = typeof body.payload === "object" && body.payload !== null ? body.payload : {};

  const alert = createAlert({
    source: "website-form",
    subject,
    body: messageBody,
    fromName,
    fromEmail,
    fromPhone,
    payload: payload as Record<string, unknown>,
  });
  return NextResponse.json({ alert });
}
