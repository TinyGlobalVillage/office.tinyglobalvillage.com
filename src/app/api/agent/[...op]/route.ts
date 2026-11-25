// /api/agent/session — Teglov's pillbar on Office (see src/lib/agent/server.ts).
import { agentGET, agentPOST } from "@/lib/agent/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = agentGET;
export const POST = agentPOST;
