/**
 * Minimal Telnyx REST wrapper. Reads credentials lazily from env so the module
 * can ship and be exercised in-app without a configured Telnyx account. Every
 * network call routes through `callTelnyx`, which throws `TelnyxNotConfigured`
 * when the API key is missing — callers catch that and return a clean 503.
 */

export class TelnyxNotConfigured extends Error {
  constructor() {
    super("Telnyx is not configured — set TELNYX_API_KEY and related env vars.");
    this.name = "TelnyxNotConfigured";
  }
}

export class TelnyxError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "TelnyxError";
    this.status = status;
    this.body = body;
  }
}

export type TelnyxEnv = {
  apiKey: string;
  messagingProfileId: string | null;
  connectionId: string | null;
  sipUsername: string | null;
  sipPassword: string | null;
  publicKey: string | null;
  frontdeskDid: string | null;
  baseUrl: string;
};

export function readTelnyxEnv(): TelnyxEnv | null {
  const apiKey = process.env.TELNYX_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    messagingProfileId: process.env.TELNYX_MESSAGING_PROFILE_ID?.trim() || null,
    connectionId: process.env.TELNYX_CONNECTION_ID?.trim() || null,
    sipUsername: process.env.TELNYX_SIP_USERNAME?.trim() || null,
    sipPassword: process.env.TELNYX_SIP_PASSWORD?.trim() || null,
    publicKey: process.env.TELNYX_PUBLIC_KEY?.trim() || null,
    frontdeskDid: process.env.TELNYX_FRONTDESK_DID?.trim() || null,
    baseUrl: (process.env.TELNYX_BASE_URL?.trim() || "https://api.telnyx.com/v2").replace(/\/$/, ""),
  };
}

export function isTelnyxConfigured(): boolean {
  return readTelnyxEnv() !== null;
}

async function callTelnyx<T>(method: string, pathname: string, body?: unknown): Promise<T> {
  const env = readTelnyxEnv();
  if (!env) throw new TelnyxNotConfigured();
  const res = await fetch(`${env.baseUrl}${pathname}`, {
    method,
    headers: {
      "Authorization": `Bearer ${env.apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!res.ok) {
    throw new TelnyxError(res.status, parsed, `Telnyx ${method} ${pathname} ${res.status}`);
  }
  return parsed as T;
}

// ── DIDs / numbers ───────────────────────────────────────────────────────────

export type TelnyxPhoneNumberSearchResult = {
  phone_number: string;
  region_information?: Array<{ region_name: string }>;
  cost_information?: { monthly_cost: string; upfront_cost: string; currency: string };
};

export async function searchAvailableNumbers(params: {
  countryCode?: string;
  areaCode?: string;
  limit?: number;
}): Promise<TelnyxPhoneNumberSearchResult[]> {
  const qs = new URLSearchParams();
  qs.set("filter[country_code]", params.countryCode ?? "US");
  if (params.areaCode) qs.set("filter[national_destination_code]", params.areaCode);
  qs.set("filter[limit]", String(params.limit ?? 20));
  const res = await callTelnyx<{ data: TelnyxPhoneNumberSearchResult[] }>(
    "GET",
    `/available_phone_numbers?${qs.toString()}`,
  );
  return res.data ?? [];
}

export type TelnyxOrderedNumber = {
  id: string;
  phone_number: string;
  status: string;
};

export async function orderNumber(phoneNumber: string): Promise<TelnyxOrderedNumber> {
  const env = readTelnyxEnv();
  if (!env) throw new TelnyxNotConfigured();
  const body: Record<string, unknown> = {
    phone_numbers: [{ phone_number: phoneNumber }],
  };
  if (env.connectionId) body.connection_id = env.connectionId;
  if (env.messagingProfileId) body.messaging_profile_id = env.messagingProfileId;
  const res = await callTelnyx<{ data: { id: string; phone_numbers: TelnyxOrderedNumber[] } }>(
    "POST",
    "/number_orders",
    body,
  );
  const ordered = res.data.phone_numbers?.[0];
  if (!ordered) throw new TelnyxError(500, res, "Telnyx number_orders returned no phone_numbers");
  return ordered;
}

export async function releaseNumber(telnyxId: string): Promise<void> {
  await callTelnyx<unknown>("DELETE", `/phone_numbers/${encodeURIComponent(telnyxId)}`);
}

// ── SMS ──────────────────────────────────────────────────────────────────────

export type TelnyxMessageResponse = { data: { id: string; to: Array<{ phone_number: string }> } };

export async function sendSms(params: { fromE164: string; toE164: string; body: string }): Promise<TelnyxMessageResponse> {
  const env = readTelnyxEnv();
  if (!env) throw new TelnyxNotConfigured();
  const payload: Record<string, unknown> = {
    from: params.fromE164,
    to: params.toE164,
    text: params.body,
  };
  if (env.messagingProfileId) payload.messaging_profile_id = env.messagingProfileId;
  return callTelnyx<TelnyxMessageResponse>("POST", "/messages", payload);
}

// ── Call Control (outbound) ──────────────────────────────────────────────────

export async function dialOutbound(params: {
  fromE164: string;
  toE164: string;
  webhookUrl: string;
}): Promise<{ call_control_id: string }> {
  const env = readTelnyxEnv();
  if (!env) throw new TelnyxNotConfigured();
  if (!env.connectionId) throw new TelnyxError(400, null, "TELNYX_CONNECTION_ID not set");
  const res = await callTelnyx<{ data: { call_control_id: string } }>(
    "POST",
    "/calls",
    {
      connection_id: env.connectionId,
      from: params.fromE164,
      to: params.toE164,
      webhook_url: params.webhookUrl,
    },
  );
  return { call_control_id: res.data.call_control_id };
}

export async function answerCall(callControlId: string): Promise<void> {
  await callTelnyx<unknown>("POST", `/calls/${encodeURIComponent(callControlId)}/actions/answer`, {});
}

export async function hangupCall(callControlId: string): Promise<void> {
  await callTelnyx<unknown>("POST", `/calls/${encodeURIComponent(callControlId)}/actions/hangup`, {});
}

// ── Webhook signature verification ───────────────────────────────────────────

/**
 * Verify a Telnyx webhook signature. Uses `TELNYX_PUBLIC_KEY` (Ed25519 key from
 * the Telnyx portal) and the `telnyx-signature-ed25519` + `telnyx-timestamp`
 * headers. Returns true only when both headers are present, timestamp is
 * within `toleranceSec`, and the signature verifies against the public key.
 *
 * Implementation note: Node's built-in `crypto.verify` handles Ed25519 given
 * a proper PEM-wrapped key. We accept either PEM or raw base64 in the env.
 */
export async function verifyWebhookSignature(params: {
  rawBody: string;
  signatureHeader: string | null;
  timestampHeader: string | null;
  toleranceSec?: number;
}): Promise<boolean> {
  const env = readTelnyxEnv();
  if (!env || !env.publicKey) return false;
  if (!params.signatureHeader || !params.timestampHeader) return false;
  const tolerance = params.toleranceSec ?? 300;
  const ts = Number(params.timestampHeader);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > tolerance) return false;

  const { createPublicKey, verify } = await import("node:crypto");
  const keyMaterial = env.publicKey.includes("BEGIN PUBLIC KEY")
    ? env.publicKey
    : `-----BEGIN PUBLIC KEY-----\n${env.publicKey.replace(/(.{64})/g, "$1\n")}\n-----END PUBLIC KEY-----`;
  let pubKey;
  try { pubKey = createPublicKey(keyMaterial); }
  catch { return false; }
  const signedMessage = Buffer.from(`${params.timestampHeader}|${params.rawBody}`);
  const sig = Buffer.from(params.signatureHeader, "base64");
  try {
    return verify(null, signedMessage, pubKey, sig);
  } catch {
    return false;
  }
}
