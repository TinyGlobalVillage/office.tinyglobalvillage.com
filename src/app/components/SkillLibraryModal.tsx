"use client";

/**
 * Skill Library — lists every TGV skill (from ~/.claude/SKILLS.md / skills repo)
 * as an ADL (Accordion Dropdown with Lightswitch). Clicking the row toggles
 * expansion; the Lightswitch toggles "skill enabled" (purely UI today —
 * skill enablement isn't yet wired to the agent system, so this is a
 * forward-compatible affordance).
 *
 * Click a skill card → fetches its INDEX.md from the skills repo + renders.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import styled from "styled-components";
import { colors, rgb, glowRgba } from "../theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalSubtitle,
  ModalBody,
  CloseBtn,
} from "../styled";
import { renderMarkdown } from "@/lib/markdown";
import AddmToggle from "@tgv/module-component-library/components/ui/AddmToggle";

type SkillEntry = {
  slug: string;
  title: string;
  blurb: string;
  status: "live" | "in progress" | "planned";
};

// Hardcoded for V1 — matches ~/.claude/SKILLS.md. Future: fetch from
// /api/skills/list which would parse SKILLS.md server-side.
const SKILLS: SkillEntry[] = [
  { slug: "whatsapp-handoff", title: "WhatsApp Handoff", status: "live", blurb: "Bidirectional handoff between Claude Code (laptop) and Claude-via-WhatsApp (phone) using ~/.claude/temp-checklist/ as shared state. Two magic verbs: `save` ↔ `#save` / `load last temp session` ↔ `#load`." },
  { slug: "whatsapp", title: "WhatsApp Business Platform", status: "live", blurb: "Cloud API: phone-number registration + 2FA PIN, messages API, templates, 24h session window, webhooks (HMAC-SHA256), test recipients in dev mode, System User access tokens, conversation pricing, error codes, Telnyx-as-WA-number specifics." },
  { slug: "telnyx", title: "Telnyx", status: "live", blurb: "Voice (Call Control, TeXML, conferences), messaging (SMS/MMS, 10DLC), numbers, AI assistants, video+WebRTC, verify (2FA), wireless, fax, networking (SIP trunks), storage, analytics/billing, webhook Ed25519 signing." },
  { slug: "tgv-automations", title: "TGV Automations", status: "live", blurb: "Reusable architecture for milestone triggers, calendar events, scheduled alerts, and staff announcements in TGV Office. Three pieces: trigger script + announcement API + dashboard surface." },
  { slug: "hardening-utils-encapsulation", title: "Hardening Utils Encapsulation", status: "live", blurb: "Pattern for surfacing every RCS-side defensive mechanism as a tile + Hardening Control Modal (HCM) on TGV Office Utils. Reference impl: telephony 2026-05-02." },
  { slug: "stripe-platform", title: "Stripe Platform", status: "live", blurb: "TGV Stripe Platform topology, Connect, direct charges, application fees." },
  { slug: "opensrs", title: "OpenSRS", status: "live", blurb: "Domain registration, registrar API, SSL certificates, reseller flows." },
  { slug: "fastmail", title: "Fastmail", status: "live", blurb: "JMAP API, mailbox provisioning, custom-domain DNS, email routing." },
  { slug: "cloudflare", title: "Cloudflare", status: "live", blurb: "Full API surface: zones, DNS, SSL/TLS, cache + Rulesets, WAF + bots, Email Routing, Workers/Pages/R2/D1/Stream/Images, Tunnels + Access + Gateway, analytics + Logpush + alerts, complete IAM permission catalog." },
  { slug: "easypost", title: "EasyPost", status: "live", blurb: "Multi-carrier shipping aggregator API: addresses/parcels/shipments/rates/labels, trackers + webhooks, carrier accounts (BYO), customs, insurance, reports, fees model, Node.js SDK patterns." },
  { slug: "hostinger", title: "Hostinger", status: "live", blurb: "Domain portfolio, nameserver updates, DNS zone reads, registrar-side migration ops." },
  { slug: "human-design", title: "Human Design", status: "live", blurb: "HD types, authorities, profiles, centers, channels, gates, engine architecture." },
  { slug: "orakle", title: "Orakle", status: "live", blurb: "Multi-system divination engine: astrology, numerology, tarot, tzolkin, cross-domain synthesis." },
];

/* ── ADL primitives (matches ChatSettingsModal pattern) ─────────── */

const ADLWrap = styled.div`
  border: 1px solid var(--t-border);
  border-radius: 0.6rem;
  background: var(--t-inputBg);
  overflow: hidden;
  & + & { margin-top: 0.5rem; }
`;

const ADLHeader = styled.button<{ $open: boolean }>`
  width: 100%;
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  background: ${(p) => (p.$open ? glowRgba("violet", 0.08) : "transparent")};
  border: none;
  border-bottom: 1px solid ${(p) => (p.$open ? "var(--t-border)" : "transparent")};
  cursor: pointer;
  text-align: left;
  color: var(--t-text);
  font-size: 0.875rem;
  font-weight: 600;
  transition: background 0.15s;

  &:hover { background: ${glowRgba("violet", 0.06)}; }
`;

const ADLLabel = styled.span`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
`;

const ADLBlurb = styled.span`
  font-size: 0.7rem;
  color: var(--t-textFaint);
  font-weight: 400;
  line-height: 1.4;
`;

const StatusBadge = styled.span<{ $status: string }>`
  font-size: 0.55rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.15rem 0.4rem;
  border-radius: 0.3rem;
  color: ${(p) =>
    p.$status === "live" ? colors.green
    : p.$status === "in progress" ? colors.gold
    : "var(--t-textFaint)"};
  background: ${(p) =>
    p.$status === "live" ? glowRgba("green", 0.1)
    : p.$status === "in progress" ? glowRgba("gold", 0.1)
    : "var(--t-inputBg)"};
  border: 1px solid ${(p) =>
    p.$status === "live" ? glowRgba("green", 0.3)
    : p.$status === "in progress" ? glowRgba("gold", 0.3)
    : "var(--t-border)"};
`;

const ADLSwitchTrack = styled.span<{ $on: boolean }>`
  position: relative;
  display: inline-block;
  width: 32px;
  height: 18px;
  border-radius: 9px;
  background: ${(p) =>
    p.$on
      ? `linear-gradient(90deg, rgba(${rgb.cyan}, 0.3), rgba(${rgb.cyan}, 0.15))`
      : "rgba(120,120,120,0.25)"};
  flex-shrink: 0;
  transition: background 0.2s;
`;

const ADLSwitchThumb = styled.span<{ $on: boolean }>`
  position: absolute;
  top: 2px;
  left: ${(p) => (p.$on ? "16px" : "2px")};
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: ${(p) => (p.$on ? colors.cyan : "#888")};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  transition: left 0.2s;
`;

const ADLBody = styled.div<{ $open: boolean }>`
  max-height: ${(p) => (p.$open ? "60vh" : "0")};
  overflow-y: auto;
  transition: max-height 0.25s ease;
  padding: ${(p) => (p.$open ? "0.85rem" : "0 0.85rem")};
`;

const Article = styled.article`
  font-size: 0.8rem;
  line-height: 1.55;
  color: var(--t-text);
  h1 { font-size: 1.05rem; margin: 0 0 0.6rem; }
  h2 { font-size: 0.85rem; margin: 1rem 0 0.4rem; color: ${colors.violet}; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
  h3 { font-size: 0.78rem; margin: 0.75rem 0 0.3rem; }
  p { margin: 0 0 0.6rem; }
  ul, ol { margin: 0 0 0.6rem; padding-left: 1.15rem; }
  li { margin-bottom: 0.2rem; }
  code, .md-code { font-family: var(--font-geist-mono), monospace; font-size: 0.78em; background: rgba(${rgb.violet}, 0.08); border: 1px solid rgba(${rgb.violet}, 0.15); border-radius: 0.25rem; padding: 0.05em 0.3em; color: ${colors.violet}; }
  pre { background: rgba(0, 0, 0, 0.35); border: 1px solid var(--t-border); border-radius: 0.4rem; padding: 0.5rem 0.7rem; overflow-x: auto; font-family: var(--font-geist-mono), monospace; font-size: 0.75rem; margin: 0 0 0.6rem; }
  table { width: 100%; border-collapse: collapse; margin: 0.4rem 0 0.7rem; font-size: 0.75rem; }
  th, td { padding: 0.3rem 0.5rem; border: 1px solid var(--t-border); text-align: left; vertical-align: top; }
  th { background: rgba(${rgb.violet}, 0.08); font-weight: 700; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; }
  blockquote { border-left: 3px solid rgba(${rgb.violet}, 0.4); padding: 0.2rem 0.6rem; margin: 0.4rem 0; color: var(--t-textFaint); font-style: italic; }
  hr { border: 0; border-top: 1px solid var(--t-border); margin: 0.8rem 0; }
  strong { color: var(--t-text); }
`;

const LoadingNote = styled.div`
  text-align: center;
  padding: 1rem;
  color: var(--t-textFaint);
  font-size: 0.8rem;
`;

/* ── Component ──────────────────────────────────────────────────── */

type ADLProps = {
  skill: SkillEntry;
  enabled: boolean;
  open: boolean;
  onToggleEnabled: () => void;
  onToggleOpen: () => void;
  children: ReactNode;
};

function ADL({ skill, enabled, open, onToggleEnabled, onToggleOpen, children }: ADLProps) {
  return (
    <ADLWrap>
      <ADLHeader $open={open} onClick={onToggleOpen} aria-expanded={open}>
        <ADLLabel>
          <span>{skill.title}</span>
          <ADLBlurb>{skill.blurb}</ADLBlurb>
        </ADLLabel>
        <StatusBadge $status={skill.status}>{skill.status}</StatusBadge>
        <ADLSwitchTrack
          $on={enabled}
          onClick={(e) => {
            e.stopPropagation();
            onToggleEnabled();
          }}
          role="button"
          aria-pressed={enabled}
          aria-label={`${skill.title} enabled`}
        >
          <ADLSwitchThumb $on={enabled} />
        </ADLSwitchTrack>
        <AddmToggle open={open} />
      </ADLHeader>
      <ADLBody $open={open}>{open && children}</ADLBody>
    </ADLWrap>
  );
}

type Props = { open: boolean; onClose: () => void };

export default function SkillLibraryModal({ open, onClose }: Props) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SKILLS.map((s) => [s.slug, s.status === "live"]))
  );
  const [content, setContent] = useState<Record<string, string | "loading" | "error">>({});

  const ensureLoaded = useCallback(async (slug: string) => {
    if (content[slug] && content[slug] !== "error") return;
    setContent((prev) => ({ ...prev, [slug]: "loading" }));
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(slug)}/index`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as { body: string };
      setContent((prev) => ({ ...prev, [slug]: j.body }));
    } catch {
      setContent((prev) => ({ ...prev, [slug]: "error" }));
    }
  }, [content]);

  useEffect(() => {
    if (openSlug) void ensureLoaded(openSlug);
  }, [openSlug, ensureLoaded]);

  if (!open) return null;

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer
        $accent="violet"
        $maxWidth="50rem"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader>
          <ModalHeaderLeft>
            <ModalTitle $color={colors.violet}>📚 Skill Library</ModalTitle>
            <ModalSubtitle>
              Domain skills the agent can consult. Toggle to enable/disable; click to expand the index.
            </ModalSubtitle>
          </ModalHeaderLeft>
          <CloseBtn onClick={onClose}>×</CloseBtn>
        </ModalHeader>
        <ModalBody>
          {SKILLS.map((skill) => {
            const isOpen = openSlug === skill.slug;
            const body = content[skill.slug];
            return (
              <ADL
                key={skill.slug}
                skill={skill}
                enabled={enabled[skill.slug]}
                open={isOpen}
                onToggleEnabled={() =>
                  setEnabled((p) => ({ ...p, [skill.slug]: !p[skill.slug] }))
                }
                onToggleOpen={() => setOpenSlug(isOpen ? null : skill.slug)}
              >
                {body === "loading" || body === undefined ? (
                  <LoadingNote>Loading…</LoadingNote>
                ) : body === "error" ? (
                  <LoadingNote>Couldn&apos;t load — check `/srv/refusion-core/skills/{skill.slug}/INDEX.md`</LoadingNote>
                ) : (
                  <Article dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
                )}
              </ADL>
            );
          })}
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}
