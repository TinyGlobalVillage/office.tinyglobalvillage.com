// A staff member's own connected mailboxes — the shared `inbox_accounts` table (tgv_db),
// keyed by the member, the same rows their tinyglobalvillage.com dashboard uses. Mirrors
// clients/tinyglobalvillage.com/src/lib/inbox/store.ts; the credentials column holds
// `{ sealed }` and nothing else (see ./seal).
import "server-only";
import { sql } from "drizzle-orm";
import type { InboxCredentials, InboxProvider } from "@tgv/module-inbox/db/accounts";
import type { ResolvedAccount } from "@tgv/module-inbox/adapters/provider";
import { readSetupProgress, type EmailDockAccount, type EmailSetupProgress } from "@tgv/module-inbox/dock/types";
import { db } from "@/lib/db-drizzle";
import { ensureFreshFastmail } from "@tgv/module-inbox/oauth/fastmail";
import { canSealInbox, openInbox, sealInbox } from "./seal";

type Row = { id?: string; account_key: string; email: string; label: string | null; provider: string; credentials: { sealed?: string } | null };
const rowsOf = (r: unknown): Row[] => ((r as { rows?: Row[] })?.rows ?? []) as Row[];

// 42P01: the table is not there. 42501: it is, but this app was never granted it.
const missingTable = (e: unknown) => {
  const code = (e as { code?: string })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
  return code === "42P01" || code === "42501";
};

export type InboxReadiness = { ready: true } | { ready: false; note: string };
const OFF = "Connecting your own mailbox is not switched on in Office yet.";

export async function inboxReadiness(): Promise<InboxReadiness> {
  if (!canSealInbox()) return { ready: false, note: OFF };
  try {
    await db.execute(sql`SELECT 1 FROM public.inbox_accounts LIMIT 1`);
    return { ready: true };
  } catch (e) {
    if (missingTable(e)) return { ready: false, note: OFF };
    throw e;
  }
}

/** Mailboxes this member has connected that Office can open (rows sealed by another app's key are left out). */
export async function listInboxAccounts(memberId: string): Promise<EmailDockAccount[]> {
  const r = await db.execute(sql`
    SELECT account_key, email, label, provider, credentials FROM public.inbox_accounts
     WHERE member_id = ${memberId}::uuid
     ORDER BY is_default DESC, created_at ASC`);
  return rowsOf(r).filter((x) => openInbox(x.credentials?.sealed) !== null)
    .map((x) => ({ key: x.account_key, email: x.email, label: x.label || x.email, provider: x.provider as InboxProvider }));
}

function resolved(x: Row | undefined): ResolvedAccount | null {
  const plain = openInbox(x?.credentials?.sealed);
  if (!x || !plain) return null;
  try {
    return { accountId: x.account_key, email: x.email, provider: x.provider as InboxProvider, credentials: JSON.parse(plain) as InboxCredentials };
  } catch {
    return null;
  }
}

/**
 * A "Sign in with Fastmail" mailbox holds a one-hour access token and a refresh token that
 * Fastmail ROTATES on every use. Refresh when stale and write the new pair to every row of this
 * member still holding the old refresh token (same rows the dashboard reads), or the next
 * refresh, here or there, would be refused. Mirrors tinyglobalvillage.com src/lib/inbox/store.ts.
 * A failed refresh leaves the stale token: the call fails as "unauthorized" and they reconnect.
 */
async function freshen(memberId: string, a: ResolvedAccount): Promise<ResolvedAccount> {
  const c = a.credentials;
  if (c.provider !== "fastmail" || !c.oauth) return a;
  const old = c.oauth.refreshToken;
  try {
    const next = await ensureFreshFastmail(c, async (n) => {
      const r = await db.execute(sql`
        SELECT id, account_key, email, label, provider, credentials FROM public.inbox_accounts
         WHERE member_id = ${memberId}::uuid AND provider = 'fastmail'`);
      for (const row of rowsOf(r)) {
        const plain = openInbox(row?.credentials?.sealed);
        if (!plain || !row.id) continue;
        let cur: InboxCredentials;
        try { cur = JSON.parse(plain) as InboxCredentials; } catch { continue; }
        if (cur.provider !== "fastmail" || cur.oauth?.refreshToken !== old) continue;
        const sealed = JSON.stringify({ sealed: sealInbox(JSON.stringify({ ...cur, token: n.token, oauth: n.oauth })) });
        await db.execute(sql`UPDATE public.inbox_accounts SET credentials = ${sealed}::jsonb, updated_at = now() WHERE id = ${row.id}::uuid`);
      }
    });
    return next === c ? a : { ...a, credentials: next };
  } catch {
    return a;
  }
}

export async function resolveInboxAccounts(memberId: string): Promise<ResolvedAccount[]> {
  if (!canSealInbox()) return [];
  try {
    const r = await db.execute(sql`
      SELECT account_key, email, label, provider, credentials FROM public.inbox_accounts
       WHERE member_id = ${memberId}::uuid
       ORDER BY is_default DESC, created_at ASC`);
    const list = rowsOf(r).map(resolved).filter((a): a is ResolvedAccount => a !== null);
    return Promise.all(list.map((a) => freshen(memberId, a)));
  } catch (e) {
    if (missingTable(e)) return [];
    throw e;
  }
}

export async function resolveInboxAccount(memberId: string, accountKey: string): Promise<ResolvedAccount | null> {
  if (!canSealInbox()) return null;
  try {
    const r = await db.execute(sql`
      SELECT account_key, email, label, provider, credentials FROM public.inbox_accounts
       WHERE member_id = ${memberId}::uuid AND account_key = ${accountKey} LIMIT 1`);
    const a = resolved(rowsOf(r)[0]);
    return a ? freshen(memberId, a) : null;
  } catch (e) {
    if (missingTable(e)) return null;
    throw e;
  }
}

export type NewInboxAccount = { email: string; label: string; accountKey: string; credentials: InboxCredentials; tgvManaged?: boolean };

/** Connect a mailbox, or refresh the credentials of one already connected. */
export async function saveInboxAccount(memberId: string, a: NewInboxAccount): Promise<void> {
  const creds = JSON.stringify({ sealed: sealInbox(JSON.stringify(a.credentials)) });
  await db.execute(sql`
    DELETE FROM public.inbox_accounts
     WHERE member_id = ${memberId}::uuid AND account_key = ${a.accountKey} AND email <> ${a.email}`);
  await db.execute(sql`
    INSERT INTO public.inbox_accounts
      (member_id, email, label, provider, account_key, credentials, is_default, is_personal, tgv_managed)
    VALUES (
      ${memberId}::uuid, ${a.email}, ${a.label}, ${a.credentials.provider}, ${a.accountKey}, ${creds}::jsonb,
      NOT EXISTS (SELECT 1 FROM public.inbox_accounts WHERE member_id = ${memberId}::uuid),
      true, ${a.tgvManaged === true})
    ON CONFLICT (member_id, email) DO UPDATE
      SET label = EXCLUDED.label, provider = EXCLUDED.provider,
          account_key = CASE WHEN EXCLUDED.provider = 'fastmail' OR inbox_accounts.provider <> EXCLUDED.provider
                             THEN EXCLUDED.account_key ELSE inbox_accounts.account_key END,
          credentials = EXCLUDED.credentials, updated_at = now()`);
}

export async function removeInboxAccount(memberId: string, accountKey: string): Promise<boolean> {
  const r = await db.execute(sql`
    DELETE FROM public.inbox_accounts
     WHERE member_id = ${memberId}::uuid AND account_key = ${accountKey}
     RETURNING account_key`);
  return rowsOf(r).length > 0;
}

export async function readSetup(memberId: string): Promise<EmailSetupProgress> {
  const r = await db.execute(sql`SELECT setup FROM public.inbox_member_state WHERE member_id = ${memberId}::uuid LIMIT 1`);
  return readSetupProgress(((r as { rows?: { setup?: unknown }[] }).rows ?? [])[0]?.setup);
}

export async function writeSetup(memberId: string, setup: EmailSetupProgress): Promise<void> {
  const value = JSON.stringify(readSetupProgress(setup));
  await db.execute(sql`
    INSERT INTO public.inbox_member_state (member_id, setup) VALUES (${memberId}::uuid, ${value}::jsonb)
    ON CONFLICT (member_id) DO UPDATE SET setup = EXCLUDED.setup, updated_at = now()`);
}
