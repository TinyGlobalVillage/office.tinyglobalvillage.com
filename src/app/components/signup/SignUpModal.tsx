"use client";

// SignUpModal — the navbar "Sign Up" hot button (Gio 2026-11-22).
//
// A member of staff signs a person up with just a name and an email. The person gets
// an email with two ways in ("Sign up in your browser" / "Download the app"); the claim
// link takes them through the wizard, which offers payment or the demo. The full,
// site-and-plan version of onboarding stays in Villagers → Onboard Villager.
// API: /api/staff/signup. Each sign-up is an invite code, so it is also listed (and
// revocable) under Utils → Hardening → Invitations.

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { colors, rgb } from "../../theme";
import { useModalLifecycle } from "../../lib/drawerKnobs";
import {
  ModalBackdrop, ModalContainer, ModalHeader, ModalHeaderLeft, ModalTitle, ModalSubtitle, ModalBody,
  GlowButton, SubtleButton, Input, TextArea, AccentLabel,
} from "../../styled";
import NeonX from "../NeonX";
import Tooltip from "../ui/Tooltip";

type Signup = { id: string; email: string | null; name: string | null; link: string; createdAt: string; status: "sent" | "joined" | "expired" | "revoked" };

const Form = styled.form`display: flex; flex-direction: column; gap: 0.9rem;`;
const Field = styled.label`display: flex; flex-direction: column; gap: 0.35rem;`;
const Row = styled.div`display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;`;
const Msg = styled.div<{ $tone: "ok" | "error" | "info" }>`
  padding: 0.7rem 0.9rem; border-radius: 0.75rem; font-size: 0.82rem; line-height: 1.45; color: var(--t-text);
  background: rgba(${(p) => rgb[p.$tone === "ok" ? "green" : p.$tone === "error" ? "red" : "cyan"]}, 0.08);
  border: 1px solid rgba(${(p) => rgb[p.$tone === "ok" ? "green" : p.$tone === "error" ? "red" : "cyan"]}, 0.3);
`;
const Steps = styled.ol`
  margin: 0; padding: 0 0 0 1.1rem; font-size: 0.8rem; line-height: 1.6; color: var(--t-textMuted);
`;
const List = styled.div`display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.4rem;`;
const Item = styled.div`
  display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.7rem; border-radius: 0.6rem; min-width: 0;
  background: var(--t-inputBg); border: 1px solid var(--t-border); font-size: 0.8rem;
  .who { flex: 1; min-width: 0; }
  .n { font-weight: 700; color: var(--t-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .e { color: var(--t-textFaint); font-size: 0.74rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;
const Pill = styled.span<{ $s: Signup["status"] }>`
  flex: none; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.2rem 0.5rem; border-radius: 999px;
  color: ${(p) => colors[p.$s === "joined" ? "green" : p.$s === "sent" ? "cyan" : "orange"]};
  background: rgba(${(p) => rgb[p.$s === "joined" ? "green" : p.$s === "sent" ? "cyan" : "orange"]}, 0.12);
`;
const LinkBtn = styled.button`
  all: unset; cursor: pointer; flex: none; font-size: 0.74rem; font-weight: 600; color: ${colors.cyan}; padding: 0.15rem 0.3rem; border-radius: 0.3rem;
  &:hover { text-decoration: underline; }
  &:focus-visible { outline: 2px solid rgba(${rgb.cyan}, 0.7); }
  &:disabled { opacity: 0.4; cursor: default; text-decoration: none; }
`;

const ERRORS: Record<string, string> = {
  missing_name: "Add their name.",
  invalid_email: "That email address doesn't look right.",
  already_member: "This person already has an account — nothing to sign up.",
  already_invited: "This address already has an open invite. Use Resend below, or revoke it in Invitations first.",
  rate_limited: "That's a lot of sign-ups in one hour. Try again a little later.",
  could_not_create: "Couldn't create the sign-up. Try again.",
  Unauthorized: "Your session has ended. Sign in again.",
  no_staff_record: "Your Office login isn't linked to a staff member record, so sign-ups can't be attributed. Ask an admin.",
};
const STATUS_LABEL: Record<Signup["status"], string> = { sent: "Sent", joined: "Joined", expired: "Expired", revoked: "Revoked" };

export default function SignUpModal({ onClose }: { onClose: () => void }) {
  useModalLifecycle();
  useEscapeToClose({ open: true, onClose });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error" | "info"; text: string; link?: string } | null>(null);
  const [recent, setRecent] = useState<Signup[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/staff/signup", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.signups) setRecent(d.signups as Signup[]); })
      .catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const copy = (link: string, key: string) => {
    navigator.clipboard?.writeText(link).then(() => { setCopied(key); setTimeout(() => setCopied(null), 1600); }).catch(() => {});
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/staff/signup", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, note }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ tone: "error", text: ERRORS[d?.error as string] ?? "Couldn't sign them up. Try again." }); return; }
      setMsg(d.emailed
        ? { tone: "ok", text: `${name.trim()} is signed up. The email is on its way to ${email.trim().toLowerCase()}.`, link: d.link }
        : { tone: "info", text: `${name.trim()} is signed up, but the email didn't send. Copy the link and send it to them yourself.`, link: d.link });
      setName(""); setEmail(""); setNote("");
      load();
    } catch {
      setMsg({ tone: "error", text: "Couldn't reach the server. Try again." });
    } finally { setBusy(false); }
  };

  const resend = async (s: Signup) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/staff/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "resend", id: s.id }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setMsg({ tone: "error", text: "Couldn't resend that one." });
      else setMsg(d.emailed ? { tone: "ok", text: `Sent again to ${s.email}.`, link: d.link } : { tone: "info", text: "The email didn't send. Copy the link instead.", link: d.link });
    } catch { setMsg({ tone: "error", text: "Couldn't reach the server. Try again." }); }
    finally { setBusy(false); }
  };

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="cyan" $maxWidth="34rem" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Sign up a new member">
        <ModalHeader>
          <ModalHeaderLeft>
            <div>
              <ModalTitle $color={colors.cyan}>Sign Up</ModalTitle>
              <ModalSubtitle>Sign someone up by name and email</ModalSubtitle>
            </div>
          </ModalHeaderLeft>
          <NeonX accent="cyan" onClick={onClose} title="Close (Esc)" />
        </ModalHeader>
        <ModalBody>
          <Form onSubmit={submit}>
            <Field>
              <AccentLabel $accent="cyan">Name</AccentLabel>
              <Input $accent="cyan" autoFocus value={name} maxLength={120} placeholder="Their full name" autoComplete="off" onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field>
              <AccentLabel $accent="cyan">Email</AccentLabel>
              <Input $accent="cyan" type="email" value={email} maxLength={254} placeholder="name@example.com" autoComplete="off" onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field>
              <AccentLabel $accent="cyan">Note for staff (optional)</AccentLabel>
              <TextArea $accent="cyan" rows={2} value={note} maxLength={300} placeholder="Where they came from, what they want…" onChange={(e) => setNote(e.target.value)} />
            </Field>
            <Steps>
              <li>They get an email with two buttons: sign up in the browser, or download the app.</li>
              <li>The wizard walks them through, then offers payment or the free demo.</li>
              <li>The invite works once, for that email, for 30 days.</li>
            </Steps>
            {msg && (
              <Msg $tone={msg.tone} role="status">
                {msg.text}
                {msg.link && <> <LinkBtn type="button" onClick={() => copy(msg.link as string, "msg")}>{copied === "msg" ? "Copied" : "Copy link"}</LinkBtn></>}
              </Msg>
            )}
            <Row>
              <GlowButton $color="cyan" type="submit" disabled={busy || !name.trim() || !email.trim()}>{busy ? "Sending…" : "Sign up and send email"}</GlowButton>
              <SubtleButton type="button" onClick={onClose}>Close</SubtleButton>
            </Row>
          </Form>

          {recent.length > 0 && (
            <div style={{ marginTop: "1.4rem" }}>
              <AccentLabel $accent="cyan">Your recent sign-ups</AccentLabel>
              <List>
                {recent.map((s) => (
                  <Item key={s.id}>
                    <div className="who">
                      <div className="n">{s.name ?? s.email}</div>
                      <div className="e">{s.email} · {new Date(s.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}</div>
                    </div>
                    <Pill $s={s.status}>{STATUS_LABEL[s.status]}</Pill>
                    {s.status === "sent" && (
                      <>
                        <Tooltip label="Send the email again"><LinkBtn type="button" disabled={busy} onClick={() => void resend(s)}>Resend</LinkBtn></Tooltip>
                        <Tooltip label="Copy their link"><LinkBtn type="button" onClick={() => copy(s.link, s.id)}>{copied === s.id ? "Copied" : "Copy"}</LinkBtn></Tooltip>
                      </>
                    )}
                  </Item>
                ))}
              </List>
            </div>
          )}
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}
