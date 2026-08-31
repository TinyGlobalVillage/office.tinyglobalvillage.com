// DELETE = remove a file (unlinks + releases quota); PATCH = rename and/or flip visibility.
// Admin-gated, pinned HOUSE scope (see lib/storage/deps).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { storage, storageError } from "@/lib/storage/deps";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  try {
    return await storage.remove(req, id);
  } catch (e) {
    return storageError(e);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  try {
    return await storage.update(req, id);
  } catch (e) {
    return storageError(e);
  }
}
