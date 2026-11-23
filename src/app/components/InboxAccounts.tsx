"use client";

// InboxAccounts — "Mail accounts" inside the Inbox drawer: a staff member connects their
// own mailboxes (Fastmail · another provider · an existing TGV Mailbox) or disconnects
// one. The list + wizard are @tgv/module-inbox's EmailManage / EmailSetupWizard — the same
// ones the tinyglobalvillage.com dashboard uses — against Office's /api/email routes.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import EmailManage from "@tgv/module-inbox/components/EmailManage";
import { createEmailDockClient } from "@tgv/module-inbox/dock/client";
import type { EmailDockBoot } from "@tgv/module-inbox/dock/types";
import { colors, rgb } from "../theme";

const Wrap = styled.div`flex: 1; min-height: 0; height: 100%; display: flex; flex-direction: column; color: var(--t-text);`;
const Bar = styled.div`
  flex: none; display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.9rem; border-bottom: 1px solid var(--t-border);
  h2 { margin: 0; font-size: 0.95rem; font-weight: 700; }
`;
const Back = styled.button`
  all: unset; cursor: pointer; padding: 0.35rem 0.8rem; border-radius: 999px; font-size: 0.78rem; font-weight: 700;
  color: ${colors.cyan}; border: 1px solid rgba(${rgb.cyan}, 0.45); background: rgba(${rgb.cyan}, 0.08);
  &:hover { background: rgba(${rgb.cyan}, 0.18); }
  &:focus-visible { outline: 2px solid ${colors.cyan}; outline-offset: 2px; }
`;
const Body = styled.div`flex: 1; min-height: 0; overflow-y: auto; padding: 1rem; max-width: 46rem; width: 100%; margin: 0 auto;`;
const Note = styled.div`padding: 0.8rem 1rem; border-radius: 0.75rem; font-size: 0.84rem; color: var(--t-textMuted); background: var(--t-inputBg); border: 1px solid var(--t-border);`;

const OUTCOME: Record<string, string> = {
  connected: "Mailbox connected.",
  declined: "Sign-in was cancelled, so nothing was connected.",
  failed: "The sign-in did not finish. Try again.",
  mismatch: "That sign-in link had expired. Start again.",
  "no-refresh": "The provider did not grant ongoing access. Try again and allow it.",
  "no-address": "The provider did not say which address that was.",
  "signed-out": "Sign in to Office first.",
  off: "Connecting your own mailbox is not switched on in Office yet.",
};

export default function InboxAccounts({ onDone, title = "Mail accounts", backLabel = "‹ Back to mail", intro }: {
  onDone: (changed: boolean) => void;
  /** Another host of the same pane (Villagers → Onboard Villager → Mailbox) names it and its way back. */
  title?: string;
  backLabel?: string;
  /** A line above the list saying what connecting here does. */
  intro?: React.ReactNode;
}) {
  const api = useMemo(() => createEmailDockClient("/api/email"), []);
  const [boot, setBoot] = useState<EmailDockBoot | null>(null);
  const [failed, setFailed] = useState(false);
  const [changed, setChanged] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/email/dock", { cache: "no-store" })
      .then(async (r) => { if (!r.ok) throw new Error(String(r.status)); setBoot((await r.json()) as EmailDockBoot); setFailed(false); })
      .catch(() => setFailed(true));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Returning from "Sign in with …": ?email=<outcome> — say it once, then drop it from the address.
  useEffect(() => {
    const u = new URL(window.location.href);
    const o = u.searchParams.get("email");
    if (!o) return;
    setOutcome(OUTCOME[o] ?? null);
    if (o === "connected") setChanged(true);
    u.searchParams.delete("email");
    window.history.replaceState(window.history.state, "", u);
  }, []);

  return (
    <Wrap>
      <Bar>
        <Back type="button" onClick={() => onDone(changed)}>{backLabel}</Back>
        <h2>{title}</h2>
      </Bar>
      <Body>
        {intro && <Note style={{ marginBottom: "0.9rem" }}>{intro}</Note>}
        {outcome && <Note role="status" style={{ marginBottom: "0.9rem" }}>{outcome}</Note>}
        {failed ? <Note>Could not load your mail accounts. You may need to sign in again.</Note>
          : !boot ? <Note>Loading…</Note>
          : <EmailManage api={api} boot={boot} onChanged={() => { setChanged(true); load(); }} onConnected={() => { setChanged(true); load(); }} />}
      </Body>
    </Wrap>
  );
}
