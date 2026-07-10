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
import TPG from "@tgv/module-component-library/components/ui/TPG";

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

type ReservedSite = { subdomain: string; url: string; templatePicked: string | null; migrationStarted: boolean };

type Result = {
  ok?: boolean;
  error?: string;
  memberId?: string;
  siteId?: string;
  subdomain?: string;
  url?: string;
  templatePicked?: string | null;
  migrationStarted?: boolean;
  reservedSites?: ReservedSite[];
  reservedUntilHours?: number;
  enrollmentSent?: boolean;
};

type MemberLookup = { exists: boolean; name?: string | null; siteCount?: number; reservationGated?: boolean };

/** One site's design fields — shared by the first site and each reserved
 *  additional-site tile. subTouched tracks whether the operator hand-edited the
 *  subdomain (so the name→subdomain auto-fill stops). */
type SiteForm = {
  clientName: string;
  subdomain: string;
  subTouched: boolean;
  sharedId: string | null;
  migrateUrl: string;
  rights: boolean;
};

const emptySite = (): SiteForm => ({
  clientName: "",
  subdomain: "",
  subTouched: false,
  sharedId: null,
  migrateUrl: "",
  rights: false,
});

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

/** The name / subdomain / landing-template / migrate fields for ONE site.
 *  Shared by the first site and every additional-site tile. */
function SiteFields({
  value,
  onPatch,
  rail,
  namePlaceholder,
  subPlaceholder,
}: {
  value: SiteForm;
  onPatch: (patch: Partial<SiteForm>) => void;
  rail: Template[];
  namePlaceholder: string;
  subPlaceholder: string;
}) {
  // Template gallery = a grid of tiles paginated by TPG (page-size DDM:
  // 5/10/25/50/Custom, Gio 2026-07-10). "Blank start" leads as item 0.
  const items = useMemo<(Template | null)[]>(() => [null, ...rail], [rail]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = items.slice((safePage - 1) * pageSize, safePage * pageSize);

  const renderTile = (t: Template | null) =>
    t === null ? (
      <TemplateCard key="__blank__" type="button" $selected={value.sharedId === null} onClick={() => onPatch({ sharedId: null })}>
        <NoThumb>No template</NoThumb>
        <TplLabel>Blank start</TplLabel>
      </TemplateCard>
    ) : (
      <TemplateCard
        key={t.id}
        type="button"
        $selected={value.sharedId === t.id}
        onClick={() => onPatch({ sharedId: t.id })}
        title={t.description ?? t.label}
      >
        {t.thumbnail ? <Thumb src={t.thumbnail} alt="" /> : <NoThumb>{t.label}</NoThumb>}
        <TplLabel>{t.label}</TplLabel>
      </TemplateCard>
    );

  return (
    <>
      <FieldRow>
        <Field>
          <FLabel>Client / project name</FLabel>
          <TextInput
            value={value.clientName}
            onChange={(e) =>
              onPatch({
                clientName: e.target.value,
                ...(value.subTouched ? {} : { subdomain: subFromName(e.target.value) }),
              })
            }
            placeholder={namePlaceholder}
          />
        </Field>
        <Field>
          <FLabel>Subdomain</FLabel>
          <SubRow>
            <TextInput
              value={value.subdomain}
              onChange={(e) => onPatch({ subTouched: true, subdomain: subFromName(e.target.value) })}
              placeholder={subPlaceholder}
            />
            <Dim>.tinyglobalvillage.com</Dim>
          </SubRow>
        </Field>
      </FieldRow>

      <FLabel style={{ marginTop: "0.3rem" }}>Landing template</FLabel>
      <TemplateGrid>{paged.map(renderTile)}</TemplateGrid>
      <TPG
        total={total}
        page={safePage}
        pageSize={pageSize}
        pageSizeOptions={[5, 10, 25, 50]}
        itemNoun="template"
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
      />
      <MigrateBox>
        <FLabel>…or migrate their existing site (URL — crawled &amp; rebuilt by the designer)</FLabel>
        <TextInput
          value={value.migrateUrl}
          onChange={(e) => onPatch({ migrateUrl: e.target.value })}
          placeholder="https://their-current-site.com"
        />
        {value.migrateUrl.trim() && (
          <>
            <CheckRow>
              <label>
                <input type="checkbox" checked={value.rights} onChange={(e) => onPatch({ rights: e.target.checked })} />
                <span>The client owns this content and has asked us to migrate it</span>
              </label>
            </CheckRow>
            <Note>
              The site provisions immediately{value.sharedId ? " with the picked template" : ""};
              the rebuilt landing replaces it automatically when the migration finishes (~a few minutes).
            </Note>
          </>
        )}
      </MigrateBox>
    </>
  );
}

export default function OnboardVillagerModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const [templates, setTemplates] = useState<Template[]>([]);

  // The FIRST site (always provisioned, never reserved) + N additional sites
  // (24h reservations — see below). Both use the shared SiteFields component.
  const [firstSite, setFirstSite] = useState<SiteForm>(emptySite());
  const [additionalSites, setAdditionalSites] = useState<SiteForm[]>([]);

  // 24h multi-subdomain reservations (Gio 2026-07-10): the operator may add
  // extra sites ONLY when the customer agrees to pay within 24h. Extras
  // provision live but expire in 24h unless the member checks out (or is
  // comped); a prior lapse gates the member from multi-reserving again.
  const [payWithin24h, setPayWithin24h] = useState(false);

  const clientName = firstSite.clientName;

  // Existing-member awareness: onboarding an email that already belongs to a
  // member ADDS A SITE to their dashboard (find-or-create), never duplicates.
  const [memberInfo, setMemberInfo] = useState<MemberLookup | null>(null);

  // Plan/addons/promo INTENT (no money moves — the member completes checkout
  // from their own dashboard; recorded to member_billing.onboard_intent).
  const [plans, setPlans] = useState<Plan[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);
  const [planInterval, setPlanInterval] = useState<"monthly" | "yearly">("monthly");
  const [addonPicks, setAddonPicks] = useState<Set<string>>(new Set());
  const [promo, setPromo] = useState("");

  const [addonInfo, setAddonInfo] = useState<string | null>(null);

  const patchFirst = (patch: Partial<SiteForm>) => setFirstSite((s) => ({ ...s, ...patch }));
  const patchAdditional = (i: number, patch: Partial<SiteForm>) =>
    setAdditionalSites((arr) => arr.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const addAdditional = () => setAdditionalSites((arr) => [...arr, emptySite()]);
  const removeAdditional = (i: number) => setAdditionalSites((arr) => arr.filter((_, idx) => idx !== i));

  // The +Add button is gated: the customer must agree to pay within 24h, and
  // the member must not already be reservation-gated (a prior lapse). Non-home
  // addons other than additional-hosting stay as manual checkboxes; the
  // "TGV Additional Site" addon is DERIVED from the reserved-site count.
  const reservationGated = memberInfo?.reservationGated === true;
  const canReserve = payWithin24h && !reservationGated;
  const additionalHosting = useMemo(() => addons.find((a) => a.key === "additional-hosting"), [addons]);
  const otherAddons = useMemo(() => addons.filter((a) => a.key !== "additional-hosting"), [addons]);

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

  const siteValid = (s: SiteForm) =>
    s.subdomain.trim().length > 0 && (!s.migrateUrl.trim() || s.rights);

  const canSubmit =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    firstSite.clientName.trim().length > 0 &&
    siteValid(firstSite) &&
    additionalSites.every(siteValid) &&
    (waive !== "custom" || !!customDate) &&
    !busy;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      // "TGV Additional Site" addon qty is DERIVED from the reserved-site count
      // (the +Add button replaced its checkbox); merge with any manually-picked
      // other addons for the intent record.
      const intentAddons = [...addonPicks].map((id) => ({ addonId: id, qty: 1, mode: "recurring" }));
      if (additionalSites.length > 0 && additionalHosting) {
        intentAddons.push({ addonId: additionalHosting.id, qty: additionalSites.length, mode: "recurring" });
      }
      const res = await fetch("/api/admin/villagers/onboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          clientName: firstSite.clientName.trim(),
          subdomain: firstSite.subdomain.trim(),
          sharedId: firstSite.sharedId,
          migrateUrl: firstSite.migrateUrl.trim() || undefined,
          rightsConfirmed: firstSite.migrateUrl.trim() ? firstSite.rights : undefined,
          payWithin24h: additionalSites.length > 0 ? payWithin24h : undefined,
          additionalSites: additionalSites.length > 0
            ? additionalSites.map((s) => ({
                clientName: s.clientName.trim(),
                subdomain: s.subdomain.trim(),
                sharedId: s.sharedId,
                migrateUrl: s.migrateUrl.trim() || undefined,
                rightsConfirmed: s.migrateUrl.trim() ? s.rights : undefined,
              }))
            : undefined,
          waiverUntil: waiverIso(waive, customDate),
          planInterval: planId ? planInterval : undefined,
          onboardIntent: planId || intentAddons.length || promo.trim()
            ? {
                planProductId: planId ?? undefined,
                planInterval: planId ? planInterval : undefined,
                addons: intentAddons,
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
                {result.reservedSites && result.reservedSites.length > 0 && (
                  <Note>
                    ⏳ {result.reservedSites.length} additional site{result.reservedSites.length === 1 ? "" : "s"}{" "}
                    reserved for {result.reservedUntilHours ?? 24}h ({result.reservedSites.map((r) => r.subdomain).join(", ")}).
                    They appear in the site switcher now but expire unless the member checks out (or you comp them)
                    within the window — after which all but their first site are removed.
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
                <SiteFields
                  value={firstSite}
                  onPatch={patchFirst}
                  rail={rail}
                  namePlaceholder="NEVLO Project"
                  subPlaceholder="nevlo"
                />
              </div>

              {/* Additional sites — 24h reservations (Gio 2026-07-10). Above Plan
                  intent; the +Add button is gated behind the pay-within-24h
                  agreement and a not-already-gated member. */}
              <div>
                <Label>
                  Additional sites {additionalHosting ? "($11/mo each)" : ""}
                  <QmbmBubble
                    type="button"
                    style={{ marginLeft: "0.4rem" }}
                    onClick={() => setAddonInfo(addonInfo === "__addl__" ? null : "__addl__")}
                    aria-label="Explain additional sites"
                    title="Explain additional sites"
                  >
                    ?
                  </QmbmBubble>
                </Label>
                {addonInfo === "__addl__" && (
                  <QmbmCard>
                    {(additionalHosting?.description ?? "An extra published TGV site — editor, hosting, SSL & subdomain.")}{" "}
                    Reserving more than one site requires the customer to agree to pay within 24 hours.
                    Reserved sites appear in their site switcher immediately but expire (all but their first)
                    unless they check out — or you comp them — within 24 hours. If that window lapses, the
                    member can no longer multi-reserve and must purchase each additional site one at a time.
                  </QmbmCard>
                )}

                {reservationGated ? (
                  <ReserveGateNote>
                    ⚠ This member previously let a reservation lapse — they can&apos;t multi-reserve.
                    Add additional sites only after they&apos;ve purchased, one at a time.
                  </ReserveGateNote>
                ) : (
                  <CheckRow>
                    <label>
                      <input
                        type="checkbox"
                        checked={payWithin24h}
                        onChange={(e) => {
                          setPayWithin24h(e.target.checked);
                          if (!e.target.checked) setAdditionalSites([]);
                        }}
                      />
                      <span>Customer agrees to pay within 24 hours (unlocks reserving extra sites)</span>
                    </label>
                  </CheckRow>
                )}

                {additionalSites.map((s, i) => (
                  <ReserveTile key={i}>
                    <ReserveTileHead>
                      <ReserveTileTitle>Additional site {i + 1}</ReserveTileTitle>
                      <RemoveBtn type="button" onClick={() => removeAdditional(i)} aria-label="Remove this site">
                        Remove
                      </RemoveBtn>
                    </ReserveTileHead>
                    <SiteFields
                      value={s}
                      onPatch={(patch) => patchAdditional(i, patch)}
                      rail={rail}
                      namePlaceholder="Second project"
                      subPlaceholder="second-site"
                    />
                  </ReserveTile>
                ))}

                <AddSiteBtn type="button" disabled={!canReserve} onClick={addAdditional}>
                  + Add Additional Site
                </AddSiteBtn>
                {additionalSites.length > 0 && (
                  <Note style={{ marginTop: "0.4rem" }}>
                    {additionalSites.length} extra site{additionalSites.length === 1 ? "" : "s"} —
                    reserved for 24h; permanent once they check out (or you comp them).
                  </Note>
                )}
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
                    {/* Interval + promo on ONE row (Gio 2026-07-10) — only after a
                        plan is chosen. */}
                    <IntervalPromoRow>
                      <Pills style={{ marginBottom: 0 }}>
                        <Pill type="button" $on={planInterval === "monthly"} onClick={() => setPlanInterval("monthly")}>Monthly</Pill>
                        <Pill type="button" $on={planInterval === "yearly"} onClick={() => setPlanInterval("yearly")}>Yearly</Pill>
                      </Pills>
                      <PromoField>
                        <FLabel>Promo code (optional)</FLabel>
                        <TextInput value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="FOUNDER100" />
                      </PromoField>
                    </IntervalPromoRow>
                    {otherAddons.length > 0 && (
                      <>
                        <CheckRow>
                          {otherAddons.map((a) => (
                            <AddonItem key={a.id}>
                              <label>
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
                              <QmbmBubble
                                type="button"
                                onClick={() => setAddonInfo(addonInfo === a.id ? null : a.id)}
                                aria-label={`Explain ${a.name}`}
                                title={`Explain ${a.name}`}
                              >
                                ?
                              </QmbmBubble>
                            </AddonItem>
                          ))}
                        </CheckRow>
                        {addonInfo && otherAddons.some((a) => a.id === addonInfo) && (() => {
                          const a = otherAddons.find((x) => x.id === addonInfo);
                          return a ? <QmbmCard>{a.description ?? a.name}</QmbmCard> : null;
                        })()}
                      </>
                    )}
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
const AddonItem = styled.span`display: inline-flex; align-items: center; gap: 0.35rem;`;
const QmbmBubble = styled.button`
  display: inline-flex; align-items: center; justify-content: center;
  width: 1.125rem; height: 1.125rem; border-radius: 50%;
  border: 1px solid rgba(${rgb.cyan}, 0.4); background: transparent;
  color: ${colors.cyan}; font-size: 0.625rem; font-weight: 700; cursor: pointer;
  &:hover { background: rgba(${rgb.cyan}, 0.1); }
`;
const QmbmCard = styled.div`
  margin-top: 0.5rem; padding: 0.625rem 0.75rem;
  border: 1px solid rgba(${rgb.cyan}, 0.25); border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.3); font-size: 0.75rem; line-height: 1.5;
  color: var(--t-text); white-space: pre-wrap;
`;
const MigrateBox = styled.div`display: flex; flex-direction: column; gap: 0.45rem; margin-top: 0.6rem; padding: 0.7rem 0.85rem; border: 1px dashed rgba(${rgb.cyan}, 0.3); border-radius: 0.55rem;`;
const ExistingNote = styled.div`font-size: 0.72rem; line-height: 1.45; color: #4ade80;`;
const ReserveGateNote = styled.div`font-size: 0.72rem; line-height: 1.45; color: #f59e0b; padding: 0.5rem 0; `;
const ReserveTile = styled.div`
  display: flex; flex-direction: column; gap: 0.5rem;
  margin-top: 0.6rem; padding: 0.75rem 0.85rem;
  border: 1px solid rgba(${rgb.cyan}, 0.22); border-radius: 0.625rem;
  background: rgba(${rgb.cyan}, 0.03);
`;
const ReserveTileHead = styled.div`display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;`;
const ReserveTileTitle = styled.div`font-size: 0.72rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: ${colors.cyan};`;
const RemoveBtn = styled.button`
  padding: 0.2rem 0.6rem; font-size: 0.68rem; border-radius: 999px; cursor: pointer;
  background: transparent; border: 1px solid rgba(255,110,110,0.4); color: ${colors.pink};
  &:hover { background: rgba(255,110,110,0.1); }
`;
const AddSiteBtn = styled.button`
  margin-top: 0.6rem; padding: 0.5rem 1rem; font-size: 0.78rem; font-weight: 600;
  border-radius: 0.5rem; cursor: pointer; width: 100%;
  background: rgba(${rgb.cyan}, 0.08); border: 1px dashed rgba(${rgb.cyan}, 0.5); color: ${colors.cyan};
  &:hover:not(:disabled) { background: rgba(${rgb.cyan}, 0.16); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;
const IntervalPromoRow = styled.div`display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.5rem;`;
const PromoField = styled.div`display: flex; flex-direction: column; gap: 0.2rem; flex: 0 0 12rem;`;
const TemplateGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: 0.6rem;
`;
const TemplateCard = styled.button<{ $selected?: boolean }>`
  width: 100%; display: flex; flex-direction: column; gap: 0.3rem; padding: 0.35rem;
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
