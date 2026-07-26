// PATCH (toggle active) + DELETE one platform promo code — proxied to HQ over the internal-secret seam.
import type { NextRequest } from "next/server";
import { proxyPromo } from "@/lib/promo-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyPromo(req, { path: `/api/user/admin/promo-codes/${encodeURIComponent(id)}`, method: "PATCH" });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyPromo(req, { path: `/api/user/admin/promo-codes/${encodeURIComponent(id)}`, method: "DELETE" });
}
