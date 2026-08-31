// GET = the AUTHED private read (admin-gated house scope). Private bytes are reachable ONLY through
// this route; public files use the tokenized tgv.com share URL instead (they never route through here).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { storage, storageError } from "@/lib/storage/deps";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  try {
    return await storage.read(req, id);
  } catch (e) {
    return storageError(e);
  }
}
