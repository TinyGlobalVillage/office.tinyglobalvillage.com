"use client";

// MemberLookupModal — operator look-up of a single member (villager). Search by
// email/name → see their profile (Member since, role, their sites) and set their
// onboarding/billing INTENT (plan, charge-start date, custom amount, waiver,
// notify-to-pay). Per-site Yellow Pages founding toggle folds in here too.
//
// Reads /api/admin/villagers/member-profile; writes billing via
// /api/admin/villagers/member-billing and founding via /api/admin/members/founding.
// The Editor layers gate (page-editor design mode) reads + writes
// /api/admin/villagers/layer-grant. Billing here records operator decisions
// ONLY — no money moves; the membership billing engine (tgv.com lane) reads
// member_billing. requireAdmin guards every route.

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import Lightswitch from "@tgv/module-component-library/components/ui/Lightswitch";
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
import { StarIcon } from "../icons";
import ChargeCardModal from "./ChargeCardModal";

type Member = { id: string; email: string; name: string | null; role: string | null };
type MemberFull = Member & {
  username: string | null;
  created_at: string;
  last_login_at: string | null;
};
type Site = {
  id: string;
  client_name: string | null;
  domain: string | null;
  tier: string | null;
  deploy_status: string | null;
  junction_role: string | null;
  junction_status: string | null;
  founding_active: boolean;
};
type Billing = {
  plan_interval: string | null;
  charge_start_at: string | null;
  custom_amount_cents: number | null;
  waiver_until: string | null;
  notify_to_pay: boolean;
  updated_at: string | null;
  updated_by: string | null;
};
type Profile = { member: MemberFull; sites: Site[]; billing: Billing | null };
type SavedCard = {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  cardholderName: string | null;
  isDefault: boolean;
  // ISO timestamp the member authorized off-session charges, or null ("needs authorization" —
  // the card cannot be charged). Gates the per-card "Charge" button.
  chargeAuthorizedAt: string | null;
};
type ArchiveTicket = {
  id: string;
  status: string;
  subject: string | null;
  openedAt: string | null;
  closedAt: string | null;
  messageCount: number;
  closedByName: string | null;
};
type ArchiveMessage = {
  id: string;
  authorKind: string;
  authorName: string | null;
  body: string;
  createdAt: string;
};
type ArchiveDetail = {
  ticket: { id: string; status: string; requesterName: string | null; requesterEmail: string; assignedName: string | null; openedAt: string | null; closedAt: string | null };
  messages: ArchiveMessage[];
};

const fmtDate = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
const toDateInput = (v: string | null | undefined) =>
  v ? new Date(v).toISOString().slice(0, 10) : "";

export default function MemberLookupModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [foundingBusy, setFoundingBusy] = useState<string | null>(null);
  // Editor layers gate — null = still loading the grant list for this member.
  const [layerGrant, setLayerGrant] = useState<boolean | null>(null);
  const [layerBusy, setLayerBusy] = useState(false);
  const [cards, setCards] = useState<SavedCard[] | null>(null);
  // The card the operator is charging (opens ChargeCardModal); null = closed.
  const [chargeTarget, setChargeTarget] = useState<SavedCard | null>(null);
  // Support Tickets archive (read-only, per villager).
  const [tickets, setTickets] = useState<ArchiveTicket[] | null>(null);
  const [openTicket, setOpenTicket] = useState<ArchiveDetail | null>(null);
  const [loadingTicket, setLoadingTicket] = useState<string | null>(null);

  // Billing form (initialised from the loaded profile).
  const [planInterval, setPlanInterval] = useState("");
  const [chargeStartAt, setChargeStartAt] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [waiverUntil, setWaiverUntil] = useState("");
  const [notifyToPay, setNotifyToPay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Debounced member search (same pattern as MemberWalletModal).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/villagers/members?q=${encodeURIComponent(q)}`, {
          cache: "no-store",
          signal: ctrl.signal,
        });
        const d = await res.json().catch(() => ({}));
        if (res.ok) setResults(Array.isArray(d.members) ? d.members : []);
      } catch {
        /* aborted / network — ignore */
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const loadProfile = useCallback(async (memberId: string) => {
    setProfile(null);
    setCards(null);
    setTickets(null);
    setOpenTicket(null);
    setLayerGrant(null);
    setMsg(null);
    const res = await fetch(
      `/api/admin/villagers/member-profile?memberId=${memberId}`,
      { cache: "no-store" },
    );
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.ok) {
      const p = d as Profile & { ok: true };
      setProfile({ member: p.member, sites: p.sites ?? [], billing: p.billing ?? null });
      const b = p.billing;
      setPlanInterval(b?.plan_interval ?? "");
      setChargeStartAt(toDateInput(b?.charge_start_at));
      setCustomAmount(
        b?.custom_amount_cents != null ? (b.custom_amount_cents / 100).toFixed(2) : "",
      );
      setWaiverUntil(toDateInput(b?.waiver_until));
      setNotifyToPay(b?.notify_to_pay ?? false);
      // Saved cards — display-only (brand + last4). Best-effort; never blocks the profile.
      try {
        const cardsRes = await fetch(
          `/api/admin/villagers/payment-methods?memberId=${memberId}`,
          { cache: "no-store" },
        );
        const cd = await cardsRes.json().catch(() => ({}));
        setCards(cardsRes.ok && cd.ok && Array.isArray(cd.cards) ? cd.cards : []);
      } catch {
        setCards([]);
      }
      // Support tickets archive — best-effort; never blocks the profile.
      try {
        const tRes = await fetch(
          `/api/admin/villagers/support-tickets?memberId=${memberId}`,
          { cache: "no-store" },
        );
        const td = await tRes.json().catch(() => ({}));
        setTickets(tRes.ok && td.ok && Array.isArray(td.tickets) ? td.tickets : []);
      } catch {
        setTickets([]);
      }
      // Editor layers gate — best-effort; never blocks the profile.
      try {
        const gRes = await fetch("/api/admin/villagers/layer-grant", {
          cache: "no-store",
        });
        const gd = await gRes.json().catch(() => ({}));
        setLayerGrant(
          gRes.ok && gd.ok && Array.isArray(gd.memberIds)
            ? gd.memberIds.includes(memberId)
            : false,
        );
      } catch {
        setLayerGrant(false);
      }
    } else {
      setMsg({ kind: "err", text: d.error ?? `Couldn't load member (HTTP ${res.status}).` });
    }
  }, []);

  const openArchiveTicket = useCallback(async (id: string) => {
    setLoadingTicket(id);
    try {
      const res = await fetch(`/api/admin/villagers/support-ticket/${id}`, { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) setOpenTicket({ ticket: d.ticket, messages: d.messages ?? [] });
    } finally {
      setLoadingTicket(null);
    }
  }, []);

  const selectMember = (m: Member) => {
    setSelected(m);
    setResults([]);
    setQuery("");
    void loadProfile(m.id);
  };

  const saveBilling = async () => {
    if (!selected) return;
    setSaving(true);
    setMsg(null);
    const cents = customAmount.trim()
      ? Math.round(Number(customAmount) * 100)
      : null;
    if (cents != null && (!Number.isFinite(cents) || cents < 0)) {
      setMsg({ kind: "err", text: "Custom amount must be a non-negative number." });
      setSaving(false);
      return;
    }
    try {
      const res = await fetch("/api/admin/villagers/member-billing", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          memberId: selected.id,
          planInterval: planInterval || null,
          chargeStartAt: chargeStartAt || null,
          customAmountCents: cents,
          waiverUntil: waiverUntil || null,
          notifyToPay,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.ok === false) {
        setMsg({ kind: "err", text: d.error ?? `Save failed (HTTP ${res.status}).` });
      } else {
        setMsg({ kind: "ok", text: "Billing intent saved." });
        await loadProfile(selected.id);
      }
    } catch {
      setMsg({ kind: "err", text: "Save failed — couldn't reach the server." });
    } finally {
      setSaving(false);
    }
  };

  const toggleFounding = async (site: Site) => {
    setFoundingBusy(site.id);
    try {
      const res = await fetch("/api/admin/members/founding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteId: site.id, on: !site.founding_active }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        setProfile((p) =>
          p
            ? {
                ...p,
                sites: p.sites.map((s) =>
                  s.id === site.id ? { ...s, founding_active: Boolean(d.active) } : s,
                ),
              }
            : p,
        );
      } else {
        setMsg({
          kind: "err",
          text:
            d.reason === "not_founding"
              ? "Member is not currently a founding member."
              : d.error ?? `Founding toggle failed (HTTP ${res.status}).`,
        });
      }
    } catch {
      setMsg({ kind: "err", text: "Founding toggle failed — couldn't reach the server." });
    } finally {
      setFoundingBusy(null);
    }
  };

  // Editor layers gate — optimistic flip, revert on error (founding-toggle pattern).
  const toggleLayerGrant = async () => {
    if (!selected || layerGrant === null || layerBusy) return;
    const next = !layerGrant;
    setLayerGrant(next);
    setLayerBusy(true);
    try {
      const res = await fetch("/api/admin/villagers/layer-grant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: selected.id, granted: next }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.ok !== true) {
        setLayerGrant(!next);
        setMsg({
          kind: "err",
          text: d.error ?? `Editor layers toggle failed (HTTP ${res.status}).`,
        });
      }
    } catch {
      setLayerGrant(!next);
      setMsg({ kind: "err", text: "Editor layers toggle failed — couldn't reach the server." });
    } finally {
      setLayerBusy(false);
    }
  };

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="gold" $maxWidth="46rem" onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <div>
              <ModalTitle>Member Lookup</ModalTitle>
              <Sub>Search a member · view their profile & sites · set billing on their behalf</Sub>
            </div>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          <Stack>
            <div>
              <Label>Find a member</Label>
              <SearchInput
                placeholder="Search by email or name…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              {searching && <Dim>Searching…</Dim>}
              {results.length > 0 && (
                <Results>
                  {results.map((m) => (
                    <ResultRow key={m.id} type="button" onClick={() => selectMember(m)}>
                      <strong>{m.email}</strong>
                      <Dim>
                        {m.name ?? "—"}
                        {m.role ? ` · ${m.role}` : ""}
                      </Dim>
                    </ResultRow>
                  ))}
                </Results>
              )}
            </div>

            {selected && !profile && <Dim>Loading member…</Dim>}

            {profile && (
              <>
                {/* Profile header */}
                <Card>
                  <MemberHead>
                    <div>
                      <strong>{profile.member.email}</strong>{" "}
                      <Dim>{profile.member.name ?? ""}</Dim>
                    </div>
                    <Mono>{profile.member.id.slice(0, 8)}</Mono>
                  </MemberHead>
                  <MetaGrid>
                    <Meta>
                      <MLabel>Member since</MLabel>
                      <MVal>{fmtDate(profile.member.created_at)}</MVal>
                    </Meta>
                    <Meta>
                      <MLabel>Role</MLabel>
                      <MVal>{profile.member.role ?? "member"}</MVal>
                    </Meta>
                    <Meta>
                      <MLabel>Username</MLabel>
                      <MVal>{profile.member.username ?? "—"}</MVal>
                    </Meta>
                    <Meta>
                      <MLabel>Last login</MLabel>
                      <MVal>{fmtDate(profile.member.last_login_at)}</MVal>
                    </Meta>
                  </MetaGrid>
                </Card>

                {/* Sites + founding */}
                <Card>
                  <SectionTitle>Sites</SectionTitle>
                  {profile.sites.length === 0 ? (
                    <Dim>No sites linked to this member.</Dim>
                  ) : (
                    <SiteList>
                      {profile.sites.map((s) => (
                        <SiteRow key={s.id}>
                          <SiteLeft>
                            <SiteName>{s.client_name ?? s.domain ?? s.id.slice(0, 8)}</SiteName>
                            <SiteMeta>
                              {s.domain ?? "—"} · {s.tier ?? "—"} · {s.deploy_status ?? "—"}
                              {s.junction_role ? ` · ${s.junction_role}` : ""}
                              {s.junction_status ? ` (${s.junction_status})` : ""}
                            </SiteMeta>
                          </SiteLeft>
                          <FoundingBtn
                            type="button"
                            $on={s.founding_active}
                            disabled={foundingBusy === s.id}
                            onClick={() => void toggleFounding(s)}
                            title="Yellow Pages founding member — unlimited free listings"
                          >
                            {foundingBusy === s.id ? (
                              "…"
                            ) : (
                              <>
                                <StarIcon size={12} />
                                {s.founding_active ? "Founding" : "Make founding"}
                              </>
                            )}
                          </FoundingBtn>
                        </SiteRow>
                      ))}
                    </SiteList>
                  )}
                </Card>

                {/* Editor layers gate — page-editor design mode */}
                <Card>
                  <SectionTitle>Page Editor</SectionTitle>
                  <SiteRow>
                    <SiteLeft>
                      <SiteName>Editor layers (design mode)</SiteName>
                      <SiteMeta>
                        {profile.member.role === "superadmin"
                          ? "superadmins always have design mode"
                          : layerGrant === null
                            ? "Loading grant…"
                            : layerGrant
                              ? "Granted — full layer manipulation in the page editor"
                              : "Off — the member edits content only"}
                      </SiteMeta>
                    </SiteLeft>
                    <Lightswitch
                      on={
                        profile.member.role === "superadmin" || layerGrant === true
                      }
                      disabled={
                        profile.member.role === "superadmin" ||
                        layerGrant === null ||
                        layerBusy
                      }
                      title={
                        profile.member.role === "superadmin"
                          ? "superadmins always have design mode"
                          : layerGrant
                            ? "Design mode granted — click to revoke"
                            : "Content-only — click to grant design mode"
                      }
                      onChange={() => void toggleLayerGrant()}
                    />
                  </SiteRow>
                  <HelpNote>
                    Members get the Regular (content) editor by default. Granting design mode
                    unlocks full layer manipulation in the TGV page editor. Grants are audited;
                    revoking returns the member to content-only.
                  </HelpNote>
                </Card>

                {/* Card on file — display + ad-hoc charge (consent-gated) */}
                <Card>
                  <SectionTitle>Card on file</SectionTitle>
                  {cards === null ? (
                    <Dim>Loading cards…</Dim>
                  ) : cards.length === 0 ? (
                    <Dim>No card on file.</Dim>
                  ) : (
                    <SiteList>
                      {cards.map((c) => {
                        const authorized = !!c.chargeAuthorizedAt;
                        return (
                          <CardRowEl key={c.id} $isDefault={c.isDefault}>
                            <CardFace>
                              {c.brand ?? "Card"} ···· {c.last4 ?? "****"}
                              {c.expMonth && c.expYear ? (
                                <CardExp>
                                  exp {String(c.expMonth).padStart(2, "0")}/
                                  {String(c.expYear).slice(-2)}
                                </CardExp>
                              ) : null}
                            </CardFace>
                            <CardRowActions>
                              {c.isDefault && <CardDefault>DEFAULT</CardDefault>}
                              <AuthChip
                                $on={authorized}
                                title={
                                  authorized
                                    ? "Member authorized off-session charges on this card"
                                    : "Member hasn't authorized charges on this card"
                                }
                              >
                                {authorized ? "Authorized" : "Needs auth"}
                              </AuthChip>
                              <ChargeRowBtn
                                type="button"
                                disabled={!authorized}
                                title={
                                  authorized
                                    ? "Charge this card"
                                    : "Card needs member authorization before it can be charged"
                                }
                                onClick={() => setChargeTarget(c)}
                              >
                                Charge
                              </ChargeRowBtn>
                            </CardRowActions>
                          </CardRowEl>
                        );
                      })}
                    </SiteList>
                  )}
                  <HelpNote>
                    Only the card brand + last 4 are shown (the full number is never stored). A card
                    can be charged ad-hoc only after the member authorized it in their wallet — the
                    stored consent mandate. Charges fire immediately and are audit-logged.
                  </HelpNote>
                </Card>

                {chargeTarget && selected && (
                  <ChargeCardModal
                    memberId={selected.id}
                    memberName={selected.name ?? selected.email}
                    card={chargeTarget}
                    onClose={() => setChargeTarget(null)}
                    onCharged={() => {
                      setChargeTarget(null);
                      void loadProfile(selected.id);
                    }}
                  />
                )}

                {/* Support Tickets archive (read-only) */}
                <Card>
                  <SectionTitle>Support Tickets</SectionTitle>
                  {openTicket ? (
                    <>
                      <ArchBar>
                        <ArchBack type="button" onClick={() => setOpenTicket(null)}>
                          ← All tickets
                        </ArchBack>
                        <ArchBarSub>
                          {openTicket.ticket.status}
                          {openTicket.ticket.assignedName ? ` · ${openTicket.ticket.assignedName}` : ""}
                        </ArchBarSub>
                      </ArchBar>
                      <ArchScroll>
                        {openTicket.messages.map((m) => {
                          const staff = m.authorKind === "staff";
                          return (
                            <ArchMsg key={m.id} $staff={staff}>
                              <ArchWho>
                                {m.authorKind === "villager"
                                  ? openTicket.ticket.requesterName || "Villager"
                                  : staff
                                    ? m.authorName || "Staff"
                                    : "Auto"}
                              </ArchWho>
                              <ArchBubble $staff={staff}>{m.body}</ArchBubble>
                            </ArchMsg>
                          );
                        })}
                      </ArchScroll>
                    </>
                  ) : tickets === null ? (
                    <Dim>Loading tickets…</Dim>
                  ) : tickets.length === 0 ? (
                    <Dim>No support conversations.</Dim>
                  ) : (
                    <SiteList>
                      {tickets.map((t) => (
                        <TicketRow
                          key={t.id}
                          type="button"
                          disabled={loadingTicket === t.id}
                          onClick={() => void openArchiveTicket(t.id)}
                        >
                          <TicketTop>
                            <TicketSubj>{t.subject || "Support conversation"}</TicketSubj>
                            <TStatus $complete={t.status === "complete"}>{t.status}</TStatus>
                          </TicketTop>
                          <TicketMeta>
                            {fmtDate(t.openedAt)} · {t.messageCount} message
                            {t.messageCount === 1 ? "" : "s"}
                            {t.closedByName ? ` · closed by ${t.closedByName}` : ""}
                          </TicketMeta>
                        </TicketRow>
                      ))}
                    </SiteList>
                  )}
                  <HelpNote>
                    Read-only archive of every support conversation this villager had with staff —
                    including which staff member replied (quality/training record).
                  </HelpNote>
                </Card>

                {/* Billing intent */}
                <Card>
                  <SectionTitle>Billing</SectionTitle>
                  <HelpNote>
                    Operator onboarding decisions only — this moves no money. The membership
                    billing engine reads these to charge the member ($33/mo normal rate).
                  </HelpNote>
                  <FormGrid>
                    <Field>
                      <FLabel>Plan</FLabel>
                      <Select
                        value={planInterval}
                        onChange={(e) => setPlanInterval(e.target.value)}
                      >
                        <option value="">— not set —</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </Select>
                    </Field>
                    <Field>
                      <FLabel>Begin charging on</FLabel>
                      <TextInput
                        type="date"
                        value={chargeStartAt}
                        onChange={(e) => setChargeStartAt(e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FLabel>Custom amount (USD/mo)</FLabel>
                      <TextInput
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="blank = normal $33"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FLabel>Waive (comp) until</FLabel>
                      <TextInput
                        type="date"
                        value={waiverUntil}
                        onChange={(e) => setWaiverUntil(e.target.value)}
                      />
                    </Field>
                  </FormGrid>
                  <CheckRow>
                    <input
                      id="notify-to-pay"
                      type="checkbox"
                      checked={notifyToPay}
                      onChange={(e) => setNotifyToPay(e.target.checked)}
                    />
                    <label htmlFor="notify-to-pay">
                      Notify this member to pay by their renewal date
                    </label>
                  </CheckRow>
                  <SaveRow>
                    <SaveBtn type="button" disabled={saving} onClick={() => void saveBilling()}>
                      {saving ? "Saving…" : "Save billing intent"}
                    </SaveBtn>
                    {profile.billing?.updated_by && (
                      <Dim>last set by {profile.billing.updated_by}</Dim>
                    )}
                  </SaveRow>
                  {msg &&
                    (msg.kind === "ok" ? <OkText>{msg.text}</OkText> : <ErrText>{msg.text}</ErrText>)}
                </Card>

                <Note style={{ opacity: 0.75 }}>
                  Token wallet (Cash / Available / Retainer) is managed in the{" "}
                  <strong>Member Wallet</strong> tile.
                </Note>
              </>
            )}
          </Stack>
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}

/* ── styles ─────────────────────────────────────────────────────────────── */
const Sub = styled.div`
  font-size: 0.75rem;
  color: var(--t-textFaint);
  letter-spacing: 0.04em;
  margin-top: 0.125rem;
`;
const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;
const Label = styled.div`
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${colors.gold};
  margin-bottom: 0.35rem;
`;
const SearchInput = styled.input`
  width: 100%;
  padding: 0.5rem 0.65rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--t-border);
  border-radius: 0.45rem;
  color: var(--t-text);
  font-size: 0.85rem;
  &:focus {
    outline: none;
    border-color: rgba(${rgb.cyan}, 0.6);
  }
`;
const Results = styled.div`
  margin-top: 0.4rem;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--t-border);
  border-radius: 0.45rem;
  overflow: hidden;
  max-height: 14rem;
  overflow-y: auto;
`;
const ResultRow = styled.button`
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  text-align: left;
  padding: 0.5rem 0.65rem;
  background: transparent;
  border: 0;
  border-bottom: 1px solid rgba(${rgb.gold}, 0.08);
  cursor: pointer;
  color: var(--t-text);
  font-size: 0.8rem;
  &:hover {
    background: rgba(${rgb.cyan}, 0.08);
  }
  &:last-child {
    border-bottom: 0;
  }
`;
const Dim = styled.span`
  color: var(--t-textFaint);
  font-size: 0.72rem;
`;
const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(${rgb.gold}, 0.18);
  border-radius: 0.625rem;
  background: rgba(${rgb.gold}, 0.04);
`;
const CardRowEl = styled.div<{ $isDefault: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.65rem;
  border: 1px solid ${(p) => (p.$isDefault ? "rgba(52,211,153,0.35)" : "var(--t-border)")};
  border-radius: 0.45rem;
  background: ${(p) => (p.$isDefault ? "rgba(16,185,129,0.08)" : "rgba(0,0,0,0.2)")};
`;
const CardFace = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--t-text);
`;
const CardExp = styled.span`
  font-size: 0.68rem;
  font-weight: 400;
  color: var(--t-textFaint);
`;
const CardDefault = styled.span`
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
`;
const CardRowActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;
const AuthChip = styled.span<{ $on: boolean }>`
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: ${(p) => (p.$on ? "rgba(16,185,129,0.18)" : `rgba(${rgb.gold}, 0.16)`)};
  color: ${(p) => (p.$on ? "#34d399" : colors.gold)};
`;
const ChargeRowBtn = styled.button`
  appearance: none;
  cursor: pointer;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  padding: 0.25rem 0.6rem;
  border-radius: 0.4rem;
  border: 1px solid rgba(${rgb.gold}, 0.45);
  background: rgba(${rgb.gold}, 0.12);
  color: ${colors.gold};
  transition: background 0.15s ease;
  &:hover:not(:disabled) {
    background: rgba(${rgb.gold}, 0.22);
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;
// ── Support Tickets archive ──────────────────────────────────────────────────
const TicketRow = styled.button`
  appearance: none;
  cursor: pointer;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.55rem 0.7rem;
  border-radius: 0.45rem;
  background: rgba(${rgb.cyan}, 0.04);
  border: 1px solid rgba(${rgb.cyan}, 0.18);
  &:hover:not(:disabled) {
    background: rgba(${rgb.cyan}, 0.1);
  }
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;
const TicketTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
`;
const TicketSubj = styled.span`
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--t-text);
`;
const TStatus = styled.span<{ $complete: boolean }>`
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  color: ${(p) => (p.$complete ? "var(--t-textGhost)" : "#34d399")};
  background: ${(p) => (p.$complete ? "rgba(255,255,255,0.06)" : "rgba(16,185,129,0.14)")};
  border: 1px solid ${(p) => (p.$complete ? "var(--t-border)" : "rgba(16,185,129,0.4)")};
`;
const TicketMeta = styled.span`
  font-size: 0.7rem;
  color: var(--t-textGhost);
`;
const ArchBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
`;
const ArchBack = styled.button`
  appearance: none;
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 700;
  color: ${colors.cyan};
  background: transparent;
  border: none;
`;
const ArchBarSub = styled.span`
  font-size: 0.7rem;
  color: var(--t-textGhost);
`;
const ArchScroll = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  max-height: 40vh;
  overflow-y: auto;
  padding: 0.4rem 0.1rem;
`;
const ArchMsg = styled.div<{ $staff: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: ${(p) => (p.$staff ? "flex-end" : "flex-start")};
  gap: 0.12rem;
`;
const ArchWho = styled.span`
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--t-textGhost);
`;
const ArchBubble = styled.div<{ $staff: boolean }>`
  max-width: 85%;
  padding: 0.4rem 0.6rem;
  border-radius: 0.65rem;
  font-size: 0.8rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
  color: ${(p) => (p.$staff ? "#04161a" : "var(--t-text)")};
  background: ${(p) => (p.$staff ? `rgba(${rgb.cyan}, 0.9)` : "var(--t-inputBg)")};
  border: 1px solid ${(p) => (p.$staff ? "transparent" : "var(--t-border)")};
`;

const MemberHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.85rem;
`;
const Mono = styled.span`
  font-family: var(--font-geist-mono), monospace;
  color: ${colors.cyan};
  font-size: 0.72rem;
`;
const MetaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
  gap: 0.5rem;
`;
const Meta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
`;
const MLabel = styled.div`
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--t-textFaint);
`;
const MVal = styled.div`
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--t-text);
`;
const SectionTitle = styled.div`
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${colors.gold};
`;
const SiteList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;
const SiteRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--t-border);
  border-radius: 0.45rem;
  background: rgba(0, 0, 0, 0.2);
`;
const SiteLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  min-width: 0;
`;
const SiteName = styled.div`
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--t-text);
`;
const SiteMeta = styled.div`
  font-size: 0.68rem;
  color: var(--t-textFaint);
`;
const FoundingBtn = styled.button<{ $on: boolean }>`
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.7rem;
  font-size: 0.72rem;
  font-weight: 700;
  border-radius: 999px;
  cursor: pointer;
  background: ${(p) => (p.$on ? `rgba(${rgb.gold}, 0.16)` : "transparent")};
  color: ${(p) => (p.$on ? colors.gold : "var(--t-textFaint)")};
  border: 1px solid ${(p) => (p.$on ? `rgba(${rgb.gold}, 0.55)` : "var(--t-border)")};
  &:hover:not(:disabled) {
    border-color: rgba(${rgb.gold}, 0.55);
    color: ${colors.gold};
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
const HelpNote = styled.div`
  font-size: 0.7rem;
  line-height: 1.4;
  color: var(--t-textFaint);
`;
const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: 0.6rem;
`;
const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;
const FLabel = styled.label`
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--t-textFaint);
`;
const TextInput = styled.input`
  padding: 0.4rem 0.55rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--t-border);
  border-radius: 0.375rem;
  color: var(--t-text);
  font-size: 0.8rem;
  &:focus {
    outline: none;
    border-color: rgba(${rgb.cyan}, 0.6);
  }
`;
const Select = styled.select`
  padding: 0.4rem 0.55rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--t-border);
  border-radius: 0.375rem;
  color: var(--t-text);
  font-size: 0.8rem;
  &:focus {
    outline: none;
    border-color: rgba(${rgb.cyan}, 0.6);
  }
`;
const CheckRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.78rem;
  color: var(--t-text);
`;
const SaveRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;
const SaveBtn = styled.button`
  padding: 0.45rem 1rem;
  font-size: 0.8rem;
  border-radius: 0.4rem;
  cursor: pointer;
  background: rgba(${rgb.cyan}, 0.14);
  border: 1px solid rgba(${rgb.cyan}, 0.55);
  color: ${colors.cyan};
  &:hover:not(:disabled) {
    background: rgba(${rgb.cyan}, 0.24);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
const Note = styled.div`
  font-size: 0.72rem;
  line-height: 1.45;
  color: var(--t-textFaint);
`;
const ErrText = styled.div`
  font-size: 0.75rem;
  color: ${colors.pink};
`;
const OkText = styled.div`
  font-size: 0.75rem;
  color: #4ade80;
`;
