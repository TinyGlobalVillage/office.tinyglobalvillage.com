"use client";

// OnboardVillagerModal — operator-driven villager onboarding (P7 "Add-villager
// onboarding" + the giocoelho "Office managed onboarding" decision; NEVLO is
// run #1). The operator enters the person + site + template + comp levers and
// tgv.com's internal orchestrator does the rest: members row, Keycloak user,
// invite marker, member_billing waiver, curated template pick, provisionSite
// (page_models + defaultFeatures), starter content, passkey-enrollment email.
//
// Fees waived = member_billing.waiver_until (intent only — no Stripe objects;
// the billing engine reads it as comp). The person claims their login via the
// Keycloak execute-actions email (passkey + recovery codes).

import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { colors, rgb } from "@/app/theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalBody,
} from "@/app/styled";
import NeonX from "../NeonX";

type Template = {
  id: string;
  templateId: string;
  label: string;
  description: string | null;
  category: string | null;
  tags: string[];
  thumbnail: string | null;
};

type WaivePreset = "none" | "3mo" | "6mo" | "1yr" | "forever" | "custom";

type Result = {
  ok?: boolean;
  error?: string;
  memberId?: string;
  siteId?: string;
  subdomain?: string;
  url?: string;
  templatePicked?: string | null;
  enrollmentSent?: boolean;
};

const WAIVE_LABELS: Record<WaivePreset, string> = {
  none: "No waiver",
  "3mo": "3 months",
  "6mo": "6 months",
  "1yr": "1 year",
  forever: "Indefinite",
  custom: "Custom date",
};

function waiverIso(preset: WaivePreset, customDate: string): string | null {
  if (preset === "none") return null;
  if (preset === "forever") return "2099-12-31T00:00:00Z";
  if (preset === "custom") return customDate ? new Date(customDate).toISOString() : null;
  const d = new Date();
  if (preset === "3mo") d.setMonth(d.getMonth() + 3);
  if (preset === "6mo") d.setMonth(d.getMonth() + 6);
  if (preset === "1yr") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}

const subFromName = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export default function OnboardVillagerModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [subTouched, setSubTouched] = useState(false);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [sharedId, setSharedId] = useState<string | null>(null);

  const [waive, setWaive] = useState<WaivePreset>("1yr");
  const [customDate, setCustomDate] = useState("");
  const [notifyToPay, setNotifyToPay] = useState(false);
  const [sendEnrollment, setSendEnrollment] = useState(true);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    fetch("/api/admin/villagers/onboard-templates")
      .then((r) => r.json())
      .then((d) => setTemplates(Array.isArray(d?.templates) ? d.templates : []))
      .catch(() => setTemplates([]));
  }, []);

  // Landing (home) templates lead the rail — they're the onboarding designs.
  const rail = useMemo(
    () => [...templates.filter((t) => t.category === "home"), ...templates.filter((t) => t.category !== "home")],
    [templates],
  );

  const canSubmit =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    clientName.trim().length > 0 &&
    subdomain.trim().length > 0 &&
    (waive !== "custom" || !!customDate) &&
    !busy;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/villagers/onboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          clientName: clientName.trim(),
          subdomain: subdomain.trim(),
          sharedId,
          waiverUntil: waiverIso(waive, customDate),
          notifyToPay,
          sendEnrollmentEmail: sendEnrollment,
        }),
      });
      const d = (await res.json().catch(() => ({}))) as Result;
      if (!res.ok || !d.ok) {
        setErr(d.error ? `Onboarding failed: ${d.error}` : `Onboarding failed (HTTP ${res.status}).`);
        return;
      }
      setResult(d);
    } catch {
      setErr("Onboarding failed — couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="cyan" $maxWidth="46rem" onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <div>
              <ModalTitle>Onboard Villager</ModalTitle>
              <Sub>Create a member + their first site on their behalf — comp the fees, pick their landing, send the passkey invite</Sub>
            </div>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          {result ? (
            <Stack>
              <OkCard>
                <OkTitle>✓ {clientName || result.subdomain} is live</OkTitle>
                <Note>
                  Site: <A href={result.url} target="_blank" rel="noopener">{result.url}</A>
                  {" · "}
                  Dashboard: <A href={`https://tinyglobalvillage.com/en/dashboard`} target="_blank" rel="noopener">member dashboard</A> (after they log in)
                </Note>
                <Note>
                  {result.templatePicked
                    ? `Landing template "${result.templatePicked}" published as their home page. `
                    : "No template picked — they start on the default page. "}
                  {result.enrollmentSent
                    ? `Passkey-enrollment email sent to ${email.trim()} — they set up their login from that link.`
                    : "No enrollment email sent — resend later from the Keycloak tile (Members → resend enrollment)."}
                </Note>
                <Note>
                  Billing: {waive === "none" ? "no waiver — normal billing applies." : `fees waived (${WAIVE_LABELS[waive]}). Adjust anytime in Member Lookup → billing.`}
                </Note>
              </OkCard>
              <Actions>
                <SecondaryBtn type="button" onClick={onClose}>Done</SecondaryBtn>
              </Actions>
            </Stack>
          ) : (
            <Stack>
              <div>
                <Label>Who</Label>
                <FieldRow>
                  <Field>
                    <FLabel>Email (their login + invite)</FLabel>
                    <TextInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@nevloproject.org" autoFocus />
                  </Field>
                  <Field>
                    <FLabel>Name (optional)</FLabel>
                    <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="NEVLO Project" />
                  </Field>
                </FieldRow>
              </div>

              <div>
                <Label>Their site</Label>
                <FieldRow>
                  <Field>
                    <FLabel>Client / project name</FLabel>
                    <TextInput
                      value={clientName}
                      onChange={(e) => {
                        setClientName(e.target.value);
                        if (!subTouched) setSubdomain(subFromName(e.target.value));
                      }}
                      placeholder="NEVLO Project"
                    />
                  </Field>
                  <Field>
                    <FLabel>Subdomain</FLabel>
                    <SubRow>
                      <TextInput
                        value={subdomain}
                        onChange={(e) => { setSubTouched(true); setSubdomain(subFromName(e.target.value)); }}
                        placeholder="nevlo"
                      />
                      <Dim>.tinyglobalvillage.com</Dim>
                    </SubRow>
                  </Field>
                </FieldRow>
              </div>

              <div>
                <Label>Landing template</Label>
                <Rail>
                  <TemplateCard type="button" $selected={sharedId === null} onClick={() => setSharedId(null)}>
                    <NoThumb>No template</NoThumb>
                    <TplLabel>Blank start</TplLabel>
                  </TemplateCard>
                  {rail.map((t) => (
                    <TemplateCard
                      key={t.id}
                      type="button"
                      $selected={sharedId === t.id}
                      onClick={() => setSharedId(t.id)}
                      title={t.description ?? t.label}
                    >
                      {t.thumbnail ? <Thumb src={t.thumbnail} alt="" /> : <NoThumb>{t.label}</NoThumb>}
                      <TplLabel>{t.label}</TplLabel>
                    </TemplateCard>
                  ))}
                </Rail>
              </div>

              <div>
                <Label>Billing — comp levers (intent only, no money moves)</Label>
                <Pills>
                  {(Object.keys(WAIVE_LABELS) as WaivePreset[]).map((p) => (
                    <Pill key={p} type="button" $on={waive === p} onClick={() => setWaive(p)}>
                      {WAIVE_LABELS[p]}
                    </Pill>
                  ))}
                </Pills>
                {waive === "custom" && (
                  <FieldRow>
                    <Field $narrow>
                      <FLabel>Waive fees through</FLabel>
                      <TextInput type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
                    </Field>
                  </FieldRow>
                )}
                <CheckRow>
                  <label>
                    <input type="checkbox" checked={notifyToPay} onChange={(e) => setNotifyToPay(e.target.checked)} />
                    <span>Notify-to-pay before renewal</span>
                  </label>
                  <label>
                    <input type="checkbox" checked={sendEnrollment} onChange={(e) => setSendEnrollment(e.target.checked)} />
                    <span>Send passkey-enrollment email now</span>
                  </label>
                </CheckRow>
              </div>

              {err && <ErrText>{err}</ErrText>}

              <Actions>
                <PrimaryBtn type="button" disabled={!canSubmit} onClick={submit}>
                  {busy ? "Provisioning…" : "Onboard villager"}
                </PrimaryBtn>
              </Actions>
            </Stack>
          )}
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}

/* ── styles (Villagers modal idiom — see ManagedOnboardingModal) ─────────── */
const Sub = styled.div`font-size: 0.75rem; color: var(--t-textFaint); letter-spacing: 0.04em; margin-top: 0.125rem;`;
const Stack = styled.div`display: flex; flex-direction: column; gap: 1rem;`;
const Label = styled.div`font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: ${colors.cyan}; margin-bottom: 0.35rem;`;
const Dim = styled.span`color: var(--t-textFaint); font-size: 0.72rem; white-space: nowrap;`;
const Note = styled.div`font-size: 0.72rem; line-height: 1.45; color: var(--t-textFaint);`;
const FieldRow = styled.div`display: flex; gap: 0.5rem; flex-wrap: wrap;`;
const Field = styled.div<{ $narrow?: boolean }>`display: flex; flex-direction: column; gap: 0.2rem; flex: ${(p) => (p.$narrow ? "0 0 11rem" : "1 1 12rem")};`;
const FLabel = styled.div`font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--t-textFaint);`;
const TextInput = styled.input`width: 100%; padding: 0.4rem 0.55rem; background: rgba(0,0,0,0.3); border: 1px solid var(--t-border); border-radius: 0.375rem; color: var(--t-text); font-size: 0.8rem; &:focus { outline: none; border-color: rgba(${rgb.cyan}, 0.6); }`;
const SubRow = styled.div`display: flex; align-items: center; gap: 0.4rem;`;
const Rail = styled.div`display: flex; gap: 0.6rem; overflow-x: auto; padding-bottom: 0.35rem;`;
const TemplateCard = styled.button<{ $selected?: boolean }>`
  flex: 0 0 9.5rem; display: flex; flex-direction: column; gap: 0.3rem; padding: 0.35rem;
  background: ${(p) => (p.$selected ? `rgba(${rgb.cyan}, 0.12)` : "rgba(0,0,0,0.25)")};
  border: 1px solid ${(p) => (p.$selected ? `rgba(${rgb.cyan}, 0.65)` : "var(--t-border)")};
  border-radius: 0.5rem; cursor: pointer; text-align: left;
  &:hover { border-color: rgba(${rgb.cyan}, 0.45); }
`;
const Thumb = styled.img`width: 100%; aspect-ratio: 3 / 2; object-fit: cover; object-position: top; border-radius: 0.3rem; display: block;`;
const NoThumb = styled.div`width: 100%; aspect-ratio: 3 / 2; border-radius: 0.3rem; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.04); color: var(--t-textFaint); font-size: 0.7rem; text-align: center; padding: 0.4rem;`;
const TplLabel = styled.div`font-size: 0.7rem; font-weight: 600; color: var(--t-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;
const Pills = styled.div`display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.5rem;`;
const Pill = styled.button<{ $on?: boolean }>`
  padding: 0.28rem 0.7rem; font-size: 0.72rem; font-weight: 600; border-radius: 999px; cursor: pointer;
  background: ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.14)` : "transparent")};
  border: 1px solid ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.6)` : "var(--t-border)")};
  color: ${(p) => (p.$on ? colors.cyan : "var(--t-text)")};
  &:hover { border-color: rgba(${rgb.cyan}, 0.45); }
`;
const CheckRow = styled.div`
  display: flex; gap: 1.25rem; flex-wrap: wrap;
  label { display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: var(--t-text); cursor: pointer; }
  input { accent-color: ${colors.cyan}; }
`;
const Actions = styled.div`display: flex; gap: 0.5rem; flex-wrap: wrap;`;
const PrimaryBtn = styled.button`padding: 0.45rem 1rem; font-size: 0.8rem; border-radius: 0.4rem; cursor: pointer; background: rgba(${rgb.cyan}, 0.14); border: 1px solid rgba(${rgb.cyan}, 0.55); color: ${colors.cyan}; &:hover:not(:disabled) { background: rgba(${rgb.cyan}, 0.24); } &:disabled { opacity: 0.5; cursor: not-allowed; }`;
const SecondaryBtn = styled.button`padding: 0.4rem 0.85rem; font-size: 0.78rem; border-radius: 0.4rem; cursor: pointer; background: transparent; border: 1px solid var(--t-border); color: var(--t-text); &:hover:not(:disabled) { border-color: rgba(${rgb.cyan}, 0.5); }`;
const ErrText = styled.div`font-size: 0.75rem; color: ${colors.pink};`;
const OkCard = styled.div`display: flex; flex-direction: column; gap: 0.55rem; padding: 0.85rem 1rem; border: 1px solid rgba(74,222,128,0.4); border-radius: 0.625rem; background: rgba(74,222,128,0.06);`;
const OkTitle = styled.div`font-size: 0.9rem; font-weight: 700; color: #4ade80;`;
const A = styled.a`color: ${colors.cyan}; text-decoration: none; &:hover { text-decoration: underline; }`;
