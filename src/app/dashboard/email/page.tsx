"use client";

/**
 * /dashboard/email — popout target from OfficeDrawer.
 * Renders the full email client in a bare window.
 */
import dynamic from "next/dynamic";

const EmailClient = dynamic(
  () => import("../../components/email/EmailClient"),
  { ssr: false }
);

export default function EmailPage() {
  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: "rgba(7,9,13,1)" }}>
      <EmailClient zoom={1.0} />
    </div>
  );
}
