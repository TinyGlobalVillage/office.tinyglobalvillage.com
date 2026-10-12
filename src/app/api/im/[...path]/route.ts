// Every /api/im/* path — the shared messenger's own router decides what each one does.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { im } from "@/lib/im/server";
export const { GET, POST, PATCH, DELETE } = im.router;
