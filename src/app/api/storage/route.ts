// GET = list the company gallery (?folder=&limit=&offset=) + quota snapshot; POST = upload.
// Thin wrapper over @tgv/module-storage/server — admin-gated, pinned HOUSE scope (see lib/storage/deps).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { storage, storageError } from "@/lib/storage/deps";

export async function GET(req: Request) {
  try {
    return await storage.list(req);
  } catch (e) {
    return storageError(e);
  }
}

export async function POST(req: Request) {
  try {
    return await storage.upload(req);
  } catch (e) {
    return storageError(e);
  }
}
