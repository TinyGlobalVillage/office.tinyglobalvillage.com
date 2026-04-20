"use client";

/**
 * /dashboard/email — popout target from OfficeDrawer.
 * Renders the full email client in a bare window.
 */
import dynamic from "next/dynamic";
import styled from "styled-components";

const EmailClient = dynamic(
  () => import("@tgv/module-inbox/components/EmailClient"),
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
  return (
    <Shell>
      <EmailClient zoom={1.0} />
    </Shell>
  );
}
