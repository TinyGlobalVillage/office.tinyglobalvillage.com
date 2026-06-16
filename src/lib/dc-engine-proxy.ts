import "server-only";

// Office -> tgv-domain-service engine proxy. The engine is the ONLY home for the
// Cloudflare creds; Office holds none and reaches it over the loopback with the
// shared DC_SERVICE_TOKEN (Bearer — the engine's tokenGate). Admin-gating is the
// CALLER's job (requireAdmin in each route); this just forwards.

const BASE = process.env.DC_SERVICE_URL;
const TOKEN = process.env.DC_SERVICE_TOKEN;

export interface DcEngineResult {
  status: number;
  data: Record<string, unknown>;
}

export async function dcEngine(
  path: string,
  init?: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    search?: Record<string, string | undefined>;
  },
): Promise<DcEngineResult> {
  if (!BASE || !TOKEN) return { status: 503, data: { ok: false, error: "dc_engine_unconfigured" } };
  const url = new URL(path, BASE);
  if (init?.search) {
    for (const [k, v] of Object.entries(init.search)) if (v != null && v !== "") url.searchParams.set(k, v);
  }
  try {
    const res = await fetch(url.toString(), {
      method: init?.method ?? "GET",
      headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
      body: init?.body != null ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, data };
  } catch {
    return { status: 502, data: { ok: false, error: "dc_engine_unreachable" } };
  }
}
