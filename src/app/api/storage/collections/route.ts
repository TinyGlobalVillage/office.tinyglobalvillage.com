// GET = the company gallery's collections (with file counts + covers); POST = create one.
// Thin wrapper over @tgv/module-storage/server — identical to the tenant mount, house scope.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { storage, storageError } from "@/lib/storage/deps";

export async function GET(req: Request) {
  try {
    return await storage.collectionsList(req);
  } catch (e) {
    return storageError(e);
  }
}

export async function POST(req: Request) {
  try {
    return await storage.collectionCreate(req);
  } catch (e) {
    return storageError(e);
  }
}
