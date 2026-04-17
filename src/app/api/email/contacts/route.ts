import { type NextRequest, NextResponse } from "next/server";
import { requireAuth, requirePersonalAccess } from "@/lib/api-auth";
import { getAccount, getSession, jmapRequest, type AccountKey } from "@/lib/fastmail";

type Address = { name?: string; email: string };

// In-memory contact cache: accountKey → { contacts, fetchedAt }
const contactCache = new Map<string, { contacts: Address[]; fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

async function fetchContacts(token: string): Promise<Address[]> {
  const session = await getSession(token);
  const accountId = session.accountId;

  // Get Sent mailbox ID
  const [[, mbResp]] = await jmapRequest(token, [
    ["Mailbox/get", { accountId, ids: null, properties: ["id", "role"] }, "mb"],
  ]);
  const mailboxes = (mbResp as { list: { id: string; role: string | null }[] }).list;
  const sentId = mailboxes.find((m) => m.role === "sent")?.id;
  if (!sentId) return [];

  // Query last 200 sent emails for to/cc addresses
  const responses = await jmapRequest(token, [
    [
      "Email/query",
      {
        accountId,
        filter: { inMailbox: sentId },
        sort: [{ property: "sentAt", isAscending: false }],
        limit: 200,
        position: 0,
      },
      "q",
    ],
    [
      "Email/get",
      {
        accountId,
        "#ids": { resultOf: "q", name: "Email/query", path: "/ids" },
        properties: ["to", "cc"],
      },
      "emails",
    ],
  ]);

  const emailsResp = responses.find(([name, , id]) => name === "Email/get" && id === "emails");
  const list = (emailsResp?.[1] as { list?: Record<string, unknown>[] })?.list ?? [];

  // Collect unique addresses (deduplicate by email)
  const seen = new Set<string>();
  const contacts: Address[] = [];
  for (const e of list) {
    const addrs = [
      ...((e.to as Address[] | null) ?? []),
      ...((e.cc as Address[] | null) ?? []),
    ];
    for (const addr of addrs) {
      const key = addr.email.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        contacts.push({ email: addr.email, ...(addr.name ? { name: addr.name } : {}) });
      }
    }
  }
  return contacts;
}

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const key = params.get("account") as AccountKey | null;
  if (!key) return NextResponse.json({ error: "Missing account" }, { status: 400 });

  const acc = getAccount(key);
  if (!acc.token) return NextResponse.json({ error: "Account not configured" }, { status: 503 });

  if (acc.personal) {
    const check = requirePersonalAccess(req, acc.ownerUsername!, token.username);
    if (check !== "ok") return NextResponse.json({ error: check }, { status: 403 });
  }

  if (!acc.personal && token.username !== "admin")
    return NextResponse.json({ error: "access_denied" }, { status: 403 });

  const q = (params.get("q") ?? "").toLowerCase().trim();

  try {
    const cached = contactCache.get(key);
    let contacts: Address[];

    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      contacts = cached.contacts;
    } else {
      contacts = await fetchContacts(acc.token);
      contactCache.set(key, { contacts, fetchedAt: Date.now() });
    }

    const results = q
      ? contacts.filter(
          (c) =>
            c.email.toLowerCase().includes(q) ||
            (c.name ?? "").toLowerCase().includes(q)
        ).slice(0, 8)
      : contacts.slice(0, 8);

    return NextResponse.json({ contacts: results });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
