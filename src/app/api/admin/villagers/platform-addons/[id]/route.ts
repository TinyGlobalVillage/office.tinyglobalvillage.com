// PATCH (edit / re-price / toggle) + DELETE one wizard ADD-ON — proxied to HQ over the internal-secret seam.
import type { NextRequest } from "next/server";
import { proxyProducts } from "@/lib/products-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyProducts(req, {
    path: `/api/user/admin/platform-addons/${encodeURIComponent(id)}`,
    method: "PATCH",
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyProducts(req, {
    path: `/api/user/admin/platform-addons/${encodeURIComponent(id)}`,
    method: "DELETE",
  });
}
