/**
 * Fastmail JMAP client library.
 * Caches sessions per token to avoid redundant GET /jmap/session calls.
 * All mail method calls are batched in a single HTTP POST.
 */


const SESSION_URL = "https://api.fastmail.com/jmap/session";

export type JmapSession = {
  apiUrl: string;
  downloadUrl: string;
  uploadUrl: string;
  accountId: string;      // primary mail account ID
  username: string;
};

type MethodCall = [string, Record<string, unknown>, string];
type MethodResponse = [string, Record<string, unknown>, string];

// In-process cache: token → { session, fetchedAt }
const sessionCache = new Map<string, { session: JmapSession; fetchedAt: number }>();
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 min

export async function getSession(token: string): Promise<JmapSession> {
  const cached = sessionCache.get(token);
  if (cached && Date.now() - cached.fetchedAt < SESSION_TTL_MS) {
    return cached.session;
  }

  const res = await fetch(SESSION_URL, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`JMAP session fetch failed: ${res.status}`);

  const data = await res.json();
  const primaryId =
    data.primaryAccounts?.["urn:ietf:params:jmap:mail"] ??
    Object.keys(data.accounts ?? {})[0];

  const session: JmapSession = {
    apiUrl: data.apiUrl,
    downloadUrl: data.downloadUrl,
    uploadUrl: data.uploadUrl,
    accountId: primaryId,
    username: data.username,
  };
  sessionCache.set(token, { session, fetchedAt: Date.now() });
  return session;
}

export async function jmapRequest(
  token: string,
  methodCalls: MethodCall[]
): Promise<MethodResponse[]> {
  const session = await getSession(token);

  const using = [
    "urn:ietf:params:jmap:core",
    "urn:ietf:params:jmap:mail",
    "urn:ietf:params:jmap:submission",
  ];

  const res = await fetch(session.apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ using, methodCalls }),
    cache: "no-store",
  });

  if (res.status === 401) {
    // Evict and retry once
    sessionCache.delete(token);
    return jmapRequest(token, methodCalls);
  }
  if (!res.ok) throw new Error(`JMAP request failed: ${res.status}`);

  const data = await res.json();
  return data.methodResponses as MethodResponse[];
}

// ── Account config ────────────────────────────────────────────────────────────

export type AccountKey = "admin" | "connect" | "support" | "gio" | "marmar";

export type AccountConfig = {
  key: AccountKey;
  email: string;
  label: string;
  token: string;
  personal: boolean;    // true = requires PIN gate
  ownerUsername: string | null; // office username who owns this personal account
};

export function getAccounts(): AccountConfig[] {
  return [
    {
      key: "admin",
      email: "admin@tinyglobalvillage.com",
      label: "Admin",
      token: process.env.FASTMAIL_TOKEN_ADMIN ?? "",
      personal: false,
      ownerUsername: null,
    },
    {
      key: "connect",
      email: "connect@tinyglobalvillage.com",
      label: "Connect",
      token: process.env.FASTMAIL_TOKEN_CONNECT ?? "",
      personal: false,
      ownerUsername: null,
    },
    {
      key: "support",
      email: "support@tinyglobalvillage.com",
      label: "Support",
      token: process.env.FASTMAIL_TOKEN_SUPPORT ?? "",
      personal: false,
      ownerUsername: null,
    },
    {
      key: "gio",
      email: "gio@tinyglobalvillage.com",
      label: "Gio",
      token: process.env.FASTMAIL_TOKEN_GIO ?? "",
      personal: true,
      ownerUsername: "admin",
    },
    {
      key: "marmar",
      email: "marthe@tinyglobalvillage.com",
      label: "Marthe",
      token: process.env.FASTMAIL_TOKEN_MARMAR ?? "",
      personal: true,
      ownerUsername: "marmar",
    },
  ];
}

export function getAccount(key: AccountKey): AccountConfig {
  const acc = getAccounts().find((a) => a.key === key);
  if (!acc) throw new Error(`Unknown account key: ${key}`);
  return acc;
}

// ── Mail helpers ──────────────────────────────────────────────────────────────

export type Mailbox = {
  id: string;
  name: string;
  role: string | null;
  totalEmails: number;
  unreadEmails: number;
  parentId: string | null;
  sortOrder: number;
};

export async function listMailboxes(token: string): Promise<Mailbox[]> {
  const session = await getSession(token);
  const accountId = session.accountId;

  const [[, resp]] = await jmapRequest(token, [
    [
      "Mailbox/get",
      {
        accountId,
        ids: null,
        properties: ["id", "name", "role", "totalEmails", "unreadEmails", "parentId", "sortOrder"],
      },
      "mb",
    ],
  ]);

  return ((resp as { list: Mailbox[] }).list ?? []).sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
}

export type EmailSummary = {
  id: string;
  subject: string | null;
  from: { name?: string; email: string }[];
  to: { name?: string; email: string }[];
  receivedAt: string;
  preview: string;
  unread: boolean;
  flagged: boolean;
  hasAttachment: boolean;
  size: number;
  threadId: string;
};

export type ListMessagesOpts = {
  mailboxId: string;
  limit?: number;
  position?: number;
  sort?: "asc" | "desc";
};

export async function listMessages(
  token: string,
  opts: ListMessagesOpts
): Promise<{ emails: EmailSummary[]; total: number }> {
  const session = await getSession(token);
  const accountId = session.accountId;
  const limit = opts.limit ?? 30;

  const responses = await jmapRequest(token, [
    [
      "Email/query",
      {
        accountId,
        filter: { inMailbox: opts.mailboxId },
        sort: [{ property: "receivedAt", isAscending: opts.sort === "asc" }],
        limit,
        position: opts.position ?? 0,
      },
      "q",
    ],
    [
      "Email/get",
      {
        accountId,
        "#ids": { resultOf: "q", name: "Email/query", path: "/ids" },
        properties: [
          "id", "subject", "from", "to", "receivedAt", "preview",
          "keywords", "hasAttachment", "size", "threadId",
        ],
      },
      "emails",
    ],
  ]);

  const queryResp = responses.find(([name, , id]) => name === "Email/query" && id === "q");
  const emailsResp = responses.find(([name, , id]) => name === "Email/get" && id === "emails");

  const total = (queryResp?.[1] as { total?: number })?.total ?? 0;
  const list = (emailsResp?.[1] as { list?: Record<string, unknown>[] })?.list ?? [];

  const emails: EmailSummary[] = list.map((e) => {
    const kw = ((e.keywords ?? {}) as Record<string, boolean>);
    return {
      id: String(e.id ?? ""),
      subject: (e.subject as string | null) ?? null,
      from: (e.from as { name?: string; email: string }[] | null) ?? [],
      to: (e.to as { name?: string; email: string }[] | null) ?? [],
      receivedAt: (e.receivedAt as string | null) ?? "",
      preview: (e.preview as string | null) ?? "",
      unread: !kw["$seen"],
      flagged: !!kw["$flagged"],
      hasAttachment: !!e.hasAttachment,
      size: (e.size as number | null) ?? 0,
      threadId: String(e.threadId ?? ""),
    };
  });

  return { emails, total };
}

export type EmailDetail = EmailSummary & {
  htmlBody: string | null;
  textBody: string | null;
  attachments: { name: string; type: string; size: number; blobId: string }[];
  cc: { name?: string; email: string }[];
  replyTo: { name?: string; email: string }[];
  inReplyTo: string | null;
  messageId: string[];
};

export async function getMessage(token: string, emailId: string): Promise<EmailDetail> {
  const session = await getSession(token);
  const accountId = session.accountId;

  const [[, resp]] = await jmapRequest(token, [
    [
      "Email/get",
      {
        accountId,
        ids: [emailId],
        properties: [
          "id", "subject", "from", "to", "cc", "replyTo",
          "receivedAt", "preview", "keywords", "hasAttachment", "size", "threadId",
          "htmlBody", "textBody", "bodyValues", "attachments", "inReplyTo", "messageId",
        ],
        bodyProperties: ["partId", "blobId", "size", "name", "type", "disposition"],
        fetchHTMLBodyValues: true,
        fetchTextBodyValues: true,
        maxBodyValueBytes: 512000,
      },
      "msg",
    ],
  ]);

  const list = (resp as { list: Record<string, unknown>[] }).list;
  const e = list[0];
  if (!e) throw new Error("Email not found");

  const kw = (e.keywords ?? {}) as Record<string, boolean>;
  const bodyValues = (e.bodyValues ?? {}) as Record<string, { value: string }>;

  // Extract HTML/text from body parts
  const htmlPart = (e.htmlBody as { partId: string }[])?.[0];
  const textPart = (e.textBody as { partId: string }[])?.[0];

  return {
    id: e.id as string,
    subject: e.subject as string | null,
    from: (e.from as { name?: string; email: string }[]) ?? [],
    to: (e.to as { name?: string; email: string }[]) ?? [],
    cc: (e.cc as { name?: string; email: string }[]) ?? [],
    replyTo: (e.replyTo as { name?: string; email: string }[]) ?? [],
    receivedAt: e.receivedAt as string,
    preview: e.preview as string ?? "",
    unread: !kw["$seen"],
    flagged: !!kw["$flagged"],
    hasAttachment: !!(e.hasAttachment),
    size: e.size as number ?? 0,
    threadId: e.threadId as string,
    htmlBody: htmlPart ? (bodyValues[htmlPart.partId]?.value ?? null) : null,
    textBody: textPart ? (bodyValues[textPart.partId]?.value ?? null) : null,
    attachments: (e.attachments as { name: string; type: string; size: number; blobId: string }[]) ?? [],
    inReplyTo: e.inReplyTo as string | null,
    messageId: (e.messageId as string[]) ?? [],
  };
}

export async function markRead(token: string, emailId: string, seen: boolean): Promise<void> {
  const session = await getSession(token);
  await jmapRequest(token, [
    [
      "Email/set",
      {
        accountId: session.accountId,
        update: { [emailId]: { "keywords/$seen": seen } },
      },
      "mark",
    ],
  ]);
}

export async function markFlagged(token: string, emailId: string, flagged: boolean): Promise<void> {
  const session = await getSession(token);
  await jmapRequest(token, [
    [
      "Email/set",
      {
        accountId: session.accountId,
        update: { [emailId]: { "keywords/$flagged": flagged } },
      },
      "flag",
    ],
  ]);
}

export async function moveToMailbox(token: string, emailId: string, mailboxId: string): Promise<void> {
  const session = await getSession(token);
  await jmapRequest(token, [
    [
      "Email/set",
      {
        accountId: session.accountId,
        update: { [emailId]: { mailboxIds: { [mailboxId]: true } } },
      },
      "move",
    ],
  ]);
}

export async function trashEmail(
  token: string,
  emailId: string,
  trashMailboxId: string
): Promise<void> {
  await moveToMailbox(token, emailId, trashMailboxId);
}

export type SendEmailOpts = {
  from: { name?: string; email: string };
  to: { name?: string; email: string }[];
  cc?: { name?: string; email: string }[];
  bcc?: { name?: string; email: string }[];
  subject: string;
  textBody?: string;
  htmlBody?: string;
  inReplyTo?: string;
  references?: string[];
};

export async function sendEmail(token: string, opts: SendEmailOpts): Promise<void> {
  const session = await getSession(token);
  const accountId = session.accountId;

  // Get Sent mailbox ID and sending identities in one batch
  const initResponses = await jmapRequest(token, [
    ["Mailbox/get", { accountId, ids: null, properties: ["id", "role"] }, "mb"],
    ["Identity/get", { accountId, ids: null }, "id"],
  ]);
  const mbResp = initResponses.find(([name, , id]) => name === "Mailbox/get" && id === "mb")?.[1];
  const idResp = initResponses.find(([name, , id]) => name === "Identity/get" && id === "id")?.[1];
  const mailboxes = (mbResp as { list: { id: string; role: string | null }[] })?.list ?? [];
  const identities = (idResp as { list: { id: string; email: string }[] })?.list ?? [];
  const sentId = mailboxes.find((m) => m.role === "sent")?.id;
  // Find the identity matching the from address; fall back to first available
  const identityId =
    identities.find((i) => i.email === opts.from.email)?.id ??
    identities[0]?.id;

  // Build body — always include at least a text/plain part
  const bodyValues: Record<string, { value: string }> = {};
  const bodyParts: { partId: string; type: string }[] = [];

  if (opts.htmlBody) {
    bodyParts.push({ partId: "html", type: "text/html" });
    bodyValues.html = { value: opts.htmlBody };
  }
  if (opts.textBody) {
    bodyParts.push({ partId: "text", type: "text/plain" });
    bodyValues.text = { value: opts.textBody };
  }
  // Fallback: empty plain-text body so bodyStructure is never undefined
  if (bodyParts.length === 0) {
    bodyParts.push({ partId: "text", type: "text/plain" });
    bodyValues.text = { value: "" };
  }

  const bodyStructure =
    bodyParts.length === 1
      ? bodyParts[0]
      : { type: "multipart/alternative", subParts: bodyParts };

  const email: Record<string, unknown> = {
    from: [opts.from],
    to: opts.to,
    cc: opts.cc ?? [],
    bcc: opts.bcc ?? [],
    subject: opts.subject,
    bodyStructure,
    bodyValues,
    mailboxIds: sentId ? { [sentId]: true } : {},
  };
  if (opts.inReplyTo) email.inReplyTo = [opts.inReplyTo];
  if (opts.references) email.references = opts.references;

  // Step 1: create the draft email
  const createResponses = await jmapRequest(token, [
    ["Email/set", { accountId, create: { draft: email } }, "create"],
  ]);

  const createResp = createResponses.find(([name, , id]) => name === "Email/set" && id === "create");
  const createResult = createResp?.[1] as { created?: { draft?: { id: string } }; notCreated?: Record<string, unknown> } | undefined;

  if (createResult?.notCreated?.draft) {
    throw new Error(`Email/set failed: ${JSON.stringify(createResult.notCreated.draft)}`);
  }

  const emailId = createResult?.created?.draft?.id;
  if (!emailId) {
    throw new Error(`Email/set did not return a created email ID. Response: ${JSON.stringify(createResult)}`);
  }

  // Step 2: submit the created email
  const submitResponses = await jmapRequest(token, [
    [
      "EmailSubmission/set",
      {
        accountId,
        create: {
          send: {
            emailId,
            identityId,
            envelope: {
              mailFrom: { email: opts.from.email },
              rcptTo: [
                ...opts.to.map((a) => ({ email: a.email })),
                ...(opts.cc ?? []).map((a) => ({ email: a.email })),
                ...(opts.bcc ?? []).map((a) => ({ email: a.email })),
              ],
            },
          },
        },
      },
      "submit",
    ],
  ]);

  const submitResp = submitResponses.find(([name, , id]) => name === "EmailSubmission/set" && id === "submit");
  const submitResult = submitResp?.[1] as { created?: Record<string, unknown>; notCreated?: Record<string, unknown> } | undefined;

  if (submitResult?.notCreated?.send) {
    throw new Error(`EmailSubmission/set failed: ${JSON.stringify(submitResult.notCreated.send)}`);
  }

  if (!submitResult?.created?.send) {
    throw new Error(`EmailSubmission/set did not confirm delivery. Response: ${JSON.stringify(submitResult)}`);
  }
}
