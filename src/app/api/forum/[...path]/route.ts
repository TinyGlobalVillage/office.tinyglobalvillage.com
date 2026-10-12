// Every /api/forum/* path — the shared forum's own router decides what each one does.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { forum } from "@/lib/forum/server";
export const { GET, POST, PUT, DELETE } = forum.router;
