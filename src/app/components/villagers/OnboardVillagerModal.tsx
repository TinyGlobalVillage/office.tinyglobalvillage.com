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
  migrationStarted?: boolean;
  enrollmentSent?: boolean;
};

type MemberLookup = { exists: boolean; name?: string | null; siteCount?: number };

type Plan = {
  id: string;
  name: string;
  description: string | null;
  unit_amount: number | null;
  unit_amount_yearly: number | null;
};

type Addon = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  monthly_amount_cents: number | null;
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

  // Existing-member awareness: onboarding an email that already belongs to a
  // member ADDS A SITE to their dashboard (find-or-create), never duplicates.
  const [memberInfo, setMemberInfo] = useState<MemberLookup | null>(null);

  // Migrate their pre-existing site ("provision now, publish later"): the site
  // goes live immediately; the rebuilt landing replaces it when the crawl +
  // AI rebuild finish (~a few minutes).
  const [migrateUrl, setMigrateUrl] = useState("");
  const [rights, setRights] = useState(false);

  // Plan/addons/promo INTENT (no money moves — the member completes checkout
  // from their own dashboard; recorded to member_billing.onboard_intent).
  const [plans, setPlans] = useState<Plan[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);
  const [planInterval, setPlanInterval] = useState<"monthly" | "yearly">("monthly");
  const [addonPicks, setAddonPicks] = useState<Set<string>>(new Set());
  const [promo, setPromo] = useState("");

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
    fetch("/api/admin/villagers/onboard-plans")
      .then((r) => r.json())
      .then((d) => {
        setPlans(Array.isArray(d?.plans) ? d.plans : []);
        setAddons(Array.isArray(d?.addons) ? d.addons : []);
      })
      .catch(() => {});
  }, []);

  const lookupMember = async () => {
    const em = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setMemberInfo(null); return; }
    try {
      const res = await fetch("/api/admin/villagers/onboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "lookup-member", email: em }),
      });
      const d = (await res.json().catch(() => null)) as MemberLookup | null;
      setMemberInfo(d && typeof d.exists === "boolean" ? d : null);
    } catch {
      setMemberInfo(null);
    }
  };

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
    (!migrateUrl.trim() || rights) &&
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
          migrateUrl: migrateUrl.trim() || undefined,
          rightsConfirmed: migrateUrl.trim() ? rights : undefined,
          waiverUntil: waiverIso(waive, customDate),
          planInterval: planId ? planInterval : undefined,
          onboardIntent: planId || addonPicks.size || promo.trim()
            ? {
                planProductId: planId ?? undefined,
                planInterval: planId ? planInterval : undefined,
                addons: [...addonPicks].map((id) => ({ addonId: id, qty: 1, mode: "recurring" })),
                promoCode: promo.trim() || undefined,
              }
            : undefined,
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
                {result.migrationStarted && (
                  <Note>
                    ⏳ Migration running — their current site is being crawled and rebuilt;
                    the new landing publishes automatically in a few minutes.
                  </Note>
                )}
                <Note>
                  Own domain? They (or you) can bring it in from their dashboard:
                  Site Settings → Domain Console → <strong>Transfer a Domain In</strong> (needs the
                  EPP/auth code from the current registrar; the transfer adds a year of renewal).
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
                    <TextInput
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setMemberInfo(null); }}
                      onBlur={lookupMember}
                      placeholder="hello@nevloproject.org"
                      autoFocus
                    />
                    {memberInfo?.exists ? (
                      <ExistingNote>
                        ✓ Existing member{memberInfo.name ? ` — ${memberInfo.name}` : ""}
                        {typeof memberInfo.siteCount === "number" ? ` (${memberInfo.siteCount} site${memberInfo.siteCount === 1 ? "" : "s"})` : ""}.
                        This adds a new site to their dashboard — no duplicate account.
                      </ExistingNote>
                    ) : memberInfo && !memberInfo.exists ? (
                      <Dim>New member — account + passkey invite will be created.</Dim>
                    ) : null}
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
                <MigrateBox>
                  <FLabel>…or migrate their existing site (URL — crawled &amp; rebuilt by the designer)</FLabel>
                  <TextInput
                    value={migrateUrl}
                    onChange={(e) => setMigrateUrl(e.target.value)}
                    placeholder="https://their-current-site.com"
                  />
                  {migrateUrl.trim() && (
                    <>
                      <CheckRow>
                        <label>
                          <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} />
                          <span>The client owns this content and has asked us to migrate it</span>
                        </label>
                      </CheckRow>
                      <Dim>
                        The site provisions immediately{sharedId ? " with the picked template" : ""};
                        the rebuilt landing replaces it automatically when the migration finishes (~a few minutes).
                      </Dim>
                    </>
                  )}
                </MigrateBox>
              </div>

              <div>
                <Label>Plan intent (optional — member completes checkout from their dashboard)</Label>
                <Pills>
                  <Pill type="button" $on={planId === null} onClick={() => setPlanId(null)}>No plan yet</Pill>
                  {plans.map((p) => (
                    <Pill key={p.id} type="button" $on={planId === p.id} onClick={() => setPlanId(p.id)} title={p.description ?? undefined}>
                      {p.name}
                    </Pill>
                  ))}
                </Pills>
                {planId && (
                  <>
                    <Pills>
                      <Pill type="button" $on={planInterval === "monthly"} onClick={() => setPlanInterval("monthly")}>Monthly</Pill>
                      <Pill type="button" $on={planInterval === "yearly"} onClick={() => setPlanInterval("yearly")}>Yearly</Pill>
                    </Pills>
                    {addons.length > 0 && (
                      <CheckRow>
                        {addons.map((a) => (
                          <label key={a.id} title={a.description ?? undefined}>
                            <input
                              type="checkbox"
                              checked={addonPicks.has(a.id)}
                              onChange={(e) => {
                                const next = new Set(addonPicks);
                                if (e.target.checked) next.add(a.id); else next.delete(a.id);
                                setAddonPicks(next);
                              }}
                            />
                            <span>{a.name}</span>
                          </label>
                        ))}
                      </CheckRow>
                    )}
                    <FieldRow>
                      <Field $narrow>
                        <FLabel>Promo code (optional)</FLabel>
                        <TextInput value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="FOUNDER100" />
                      </Field>
                    </FieldRow>
                  </>
                )}
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
const MigrateBox = styled.div`display: flex; flex-direction: column; gap: 0.45rem; margin-top: 0.6rem; padding: 0.7rem 0.85rem; border: 1px dashed rgba(${rgb.cyan}, 0.3); border-radius: 0.55rem;`;
const ExistingNote = styled.div`font-size: 0.72rem; line-height: 1.45; color: #4ade80;`;
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
