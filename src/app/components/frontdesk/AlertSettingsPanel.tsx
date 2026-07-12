"use client";

/**
 * AlertSettingsPanel — the reusable "alert preferences" content group.
 *
 * One self-contained panel (loads + saves the current user's
 * user_alert_settings via /api/utils/personal-alerts/settings) reused in TWO
 * places: the Front Desk gear modal (AlertSettingsModal) and the Profile
 * ("Alert preferences" section). Email preferences are front-and-centre.
 *
 * Gold labels + white inputs + neon DDMs, matching the alerts calendar.
 */

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import NeonSelect, { inkWhite } from "./NeonSelect";
import {
  ALL_CHANNELS,
  ALL_RECURRENCES,
  type AlertChannel,
  type AlertRecurrence,
  type AlertVisibility,
  type EmailFromMode,
} from "@tgv/module-calendar/alerts/types";
import { getSettings, updateSettings } from "@tgv/module-calendar/alerts/client";

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;
const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;
const Label = styled.div`
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${colors.gold};
`;
const Hint = styled.div`
  font-size: 0.7rem;
  color: var(--t-textGhost);
`;
const ChanRow = styled.div`display: flex; gap: 1rem; flex-wrap: wrap;`;
const Chk = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  ${inkWhite}
  cursor: pointer;
  input { accent-color: ${colors.gold}; width: 15px; height: 15px; }
`;
const Master = styled(Chk)`font-weight: 700;`;
const EmailBox = styled.div`
  padding: 0.85rem 0.9rem;
  border-radius: 0.7rem;
  border: 1px solid rgba(${rgb.gold}, 0.3);
  background: rgba(${rgb.gold}, 0.05);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`;
const Foot = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.25rem;
`;
const SaveBtn = styled.button`
  padding: 0.5rem 1.1rem;
  border-radius: 0.5rem;
  border: none;
  background: ${colors.gold};
  color: #0b0b0b;
  font-size: 0.8125rem;
  font-weight: 800;
  cursor: pointer;
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;
const Saved = styled.span`font-size: 0.75rem; color: #00dc64; font-weight: 700;`;
const TextInput = styled.input`
  padding: 0.5rem 0.7rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(${rgb.gold}, 0.35);
  background: rgba(0, 0, 0, 0.25);
  ${inkWhite}
  font-size: 0.85rem;
  outline: none;
  &:focus { border-color: rgba(${rgb.gold}, 0.7); box-shadow: 0 0 0 2px rgba(${rgb.gold}, 0.15); }
  &::placeholder { color: var(--t-textGhost); }
  [data-theme="light"] & { background: rgba(0, 0, 0, 0.04); }
`;
const ResetLink = styled.button`
  align-self: flex-start;
  background: none;
  border: none;
  padding: 0;
  color: ${colors.gold};
  font-size: 0.68rem;
  font-weight: 700;
  cursor: pointer;
  text-decoration: underline;
`;

const TZ_OPTIONS = [
  "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
  "Europe/London", "Europe/Lisbon", "Europe/Paris", "Asia/Tokyo", "Australia/Sydney", "UTC",
];
const EMAIL_FROM_OPTIONS: { value: EmailFromMode; label: string }[] = [
  { value: "own_fastmail", label: "Your Fastmail" },
  { value: "system", label: "TGV system (no-reply@tinyglobalvillage.com)" },
  { value: "pick_at_compose", label: "Ask me each time" },
];

function detectTz(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
}

type Props = { onSaved?: () => void };

export default function AlertSettingsPanel({ onSaved }: Props) {
  const [enabled, setEnabled] = useState(true);
  const [channels, setChannels] = useState<AlertChannel[]>(["dashboard"]);
  const [emailFromMode, setEmailFromMode] = useState<EmailFromMode>("own_fastmail");
  const [alertEmail, setAlertEmail] = useState<string>("");
  const [defaultEmail, setDefaultEmail] = useState<string>("");
  const [timezone, setTimezone] = useState<string>(detectTz());
  const [recurrence, setRecurrence] = useState<AlertRecurrence>("none");
  const [visibility, setVisibility] = useState<AlertVisibility>("personal");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const s = await getSettings().catch(() => null);
    if (s) {
      setEnabled(s.enabled);
      setChannels(s.default_channels as AlertChannel[]);
      setEmailFromMode(s.default_email_from_mode as EmailFromMode);
      setAlertEmail((s as { alert_email?: string | null }).alert_email ?? "");
      setTimezone(s.timezone || detectTz());
      setRecurrence(s.default_recurrence as AlertRecurrence);
      setVisibility(s.default_visibility as AlertVisibility);
    } else {
      setTimezone(detectTz());
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Default the recipient field to the signed-in user's canonical staff email.
  useEffect(() => {
    fetch("/api/frontdesk/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => { if (me?.email) setDefaultEmail(me.email); })
      .catch(() => {});
  }, []);

  const toggleChan = (c: AlertChannel) =>
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  async function save() {
    if (channels.length === 0) return;
    setBusy(true);
    setSaved(false);
    try {
      await updateSettings({
        default_channels: channels,
        default_recurrence: recurrence,
        default_visibility: visibility,
        default_email_from_mode: emailFromMode,
        alert_email: alertEmail.trim() || null,
        timezone,
        enabled,
      });
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setBusy(false);
    }
  }

  const tzOptions = [...new Set([...TZ_OPTIONS, detectTz()])].map((t) => ({ value: t, label: t }));
  const emailOn = channels.includes("email");

  return (
    <Wrap>
      <Field>
        <Master>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Alerts are ON for me
        </Master>
        <Hint>Master switch — turn every one of your alerts off without deleting them.</Hint>
      </Field>

      <Field>
        <Label>Default channels for new alerts</Label>
        <ChanRow>
          {ALL_CHANNELS.map((c) => (
            <Chk key={c}>
              <input type="checkbox" checked={channels.includes(c)} onChange={() => toggleChan(c)} />
              {c}
            </Chk>
          ))}
        </ChanRow>
      </Field>

      <EmailBox>
        <Label>Email preferences</Label>
        <Hint>
          {emailOn
            ? "New alerts include email by default. Emails send from the address below."
            : "Add “email” to your default channels above to get alerts by email. This sets the sender."}
        </Hint>
        <Field>
          <Label>Email sends from</Label>
          <NeonSelect
            value={emailFromMode}
            options={EMAIL_FROM_OPTIONS}
            maxWidth="24rem"
            onChange={(v) => setEmailFromMode(v as EmailFromMode)}
          />
        </Field>
        <Field>
          <Label>Send my alerts to</Label>
          <TextInput
            type="email"
            value={alertEmail}
            placeholder={defaultEmail || "you@tinyglobalvillage.com"}
            onChange={(e) => setAlertEmail(e.target.value)}
          />
          <Hint>
            {alertEmail.trim()
              ? "Alerts assigned to you are delivered to this address."
              : `Defaults to your staff email${defaultEmail ? ` (${defaultEmail})` : ""}.`}
          </Hint>
          {alertEmail.trim() && defaultEmail && (
            <ResetLink type="button" onClick={() => setAlertEmail("")}>
              Use my staff email ({defaultEmail})
            </ResetLink>
          )}
        </Field>
      </EmailBox>

      <Field>
        <Label>Timezone</Label>
        <NeonSelect value={timezone} options={tzOptions} maxWidth="18rem" onChange={setTimezone} />
      </Field>

      <Field>
        <Label>Default repeat</Label>
        <NeonSelect
          value={recurrence}
          options={ALL_RECURRENCES.map((r) => ({ value: r, label: r }))}
          maxWidth="12rem"
          onChange={(v) => setRecurrence(v as AlertRecurrence)}
        />
      </Field>

      <Field>
        <Label>Default visibility</Label>
        <NeonSelect
          value={visibility}
          options={[
            { value: "personal", label: "Personal (only me)" },
            { value: "team", label: "Team (shared calendar)" },
          ]}
          maxWidth="16rem"
          onChange={(v) => setVisibility(v as AlertVisibility)}
        />
      </Field>

      <Foot>
        <SaveBtn onClick={save} disabled={busy || channels.length === 0}>
          {busy ? "Saving…" : "Save preferences"}
        </SaveBtn>
        {saved && <Saved>✓ Saved</Saved>}
      </Foot>
    </Wrap>
  );
}
