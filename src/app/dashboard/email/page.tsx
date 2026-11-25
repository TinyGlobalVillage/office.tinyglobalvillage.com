"use client";

/**
 * /dashboard/email — popout target from OfficeDrawer.
 * Renders the full mail client in a bare window (also the composer / conversation popouts).
 */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import styled from "styled-components";

const MailApp = dynamic(
  () => import("@tgv/module-inbox/components/mail/MailApp"),
  { ssr: false }
);

/* ── Styled ────────────────────────────────────────────────── */

const Shell = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--t-bg);

  [data-theme="light"] & {
    background: var(--t-bg);
  }
`;

/* ── Component ─────────────────────────────────────────────── */

export default function EmailPage() {
  // ?compose=1 opens a new message, ?draft=<id> reopens a draft, ?thread=<id> one conversation,
  // ?view=<path> any place in the client (the same path the drawer writes).
  const [params, setParams] = useState<URLSearchParams | null>(null);
  useEffect(() => { setParams(new URLSearchParams(window.location.search)); }, []);
  if (!params) return <Shell />;
  const thread = params.get("thread");
  const view = params.get("view") ?? (thread ? `mail/t/${encodeURIComponent(thread)}` : null);
  return (
    <Shell>
      <MailApp
        zoom={1.0}
        view={view}
        composeOnMount={params.get("compose") === "1"}
        draftId={params.get("draft")}
        onViewChange={(v) => {
          const u = new URL(window.location.href);
          u.searchParams.set("view", v);
          u.searchParams.delete("thread");
          window.history.replaceState(window.history.state, "", u);
        }}
      />
    </Shell>
  );
}
