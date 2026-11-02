"use client";
// DiscountCodesModal — Villagers → Codes (Gio 2026-11-01: "Discount Codes on Office>Villagers,
// which should be re-labeled Codes, and a pillbar"). Three pills over TGV's own codes, the same
// rows HQ's Store Front → Codes shows: Discount | Referral | Invite.
//
// Discount: operator management of the TGV-wide (platform) discount codes the signup
// wizard reads. Wraps the SHARED @tgv/module-component-library PlatformDiscountCodesPanel (the same
// UI the HQ dashboard mounts) with an Office adapter that proxies to HQ over the internal-secret
// seam (Office holds no Stripe keys — see promo-proxy.ts). Same codes, either place.
import { useState } from "react";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import PillBar from "@tgv/module-component-library/components/ui/PillBar";
import {
  PlatformReferralCodesPanel,
  type PlatformReferralAdapter,
} from "@tgv/module-component-library/components/discounts/PlatformReferralCodesPanel";
import {
  InviteCodesPanel,
  type InviteCodesAdapter,
  type SiteInvite,
} from "@tgv/module-storefront/components/StorefrontContainer";
import {
  PlatformDiscountCodesPanel,
  type PlatformDiscountAdapter,
} from "@tgv/module-component-library/components/discounts/PlatformDiscountCodesPanel";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalBody,
} from "@/app/styled";
import NeonX from "../NeonX";

async function jsonOrThrow(r: Response, fallback: string) {
  if (!r.ok) {
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(d.error ?? fallback);
  }
  return r.json();
}

const officeAdapter: PlatformDiscountAdapter = {
  listCodes: async () =>
    (
      await jsonOrThrow(
        await fetch("/api/admin/villagers/promo-codes", { cache: "no-store" }),
        "Failed to load codes",
      )
    ).promoCodes ?? [],
  listTargets: async () =>
    (
      await jsonOrThrow(
        await fetch("/api/admin/villagers/promo-codes/targets", { cache: "no-store" }),
        "Failed to load targets",
      )
    ).targets ?? [],
  createCode: async (input) => {
    await jsonOrThrow(
      await fetch("/api/admin/villagers/promo-codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
      "Create failed",
    );
  },
  setActive: async (id, active) => {
    await jsonOrThrow(
      await fetch(`/api/admin/villagers/promo-codes/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active }),
      }),
      "Update failed",
    );
  },
  deleteCode: async (id) => {
    await jsonOrThrow(
      await fetch(`/api/admin/villagers/promo-codes/${id}`, { method: "DELETE" }),
      "Delete failed",
    );
  },
};

type ReferralRow = {
  id: string;
  code: string;
  ownerName?: string | null;
  tokenReward?: number;
  signupBonus?: number;
  maxUses?: number | null;
  usedCount?: number;
  active?: boolean;
  expiresAt?: string | null;
};

const referralAdapter: PlatformReferralAdapter = {
  listCodes: async () => {
    const d = await jsonOrThrow(
      await fetch("/api/admin/villagers/referral-codes", { cache: "no-store" }),
      "Failed to load referral codes",
    );
    return ((d.referralCodes ?? []) as ReferralRow[]).map((r) => ({
      id: r.id,
      code: r.code,
      ownerName: r.ownerName ?? null,
      tokenReward: r.tokenReward ?? 0,
      signupBonus: r.signupBonus ?? 0,
      maxUses: r.maxUses ?? null,
      usedCount: r.usedCount ?? 0,
      active: r.active ?? true,
      expiresAt: r.expiresAt ?? null,
    }));
  },
  createCode: async (input) => {
    await jsonOrThrow(
      await fetch("/api/admin/villagers/referral-codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
      "Create failed",
    );
  },
  setActive: async (id, active) => {
    await jsonOrThrow(
      await fetch(`/api/admin/villagers/referral-codes/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active }),
      }),
      "Update failed",
    );
  },
  deleteCode: async (id) => {
    await jsonOrThrow(
      await fetch(`/api/admin/villagers/referral-codes/${id}`, { method: "DELETE" }),
      "Delete failed",
    );
  },
};

const invitePost = async (body: Record<string, unknown>) =>
  jsonOrThrow(
    await fetch("/api/admin/villagers/invite-codes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    "Request failed",
  );

const inviteAdapter: InviteCodesAdapter = {
  list: async () =>
    ((
      await jsonOrThrow(
        await fetch("/api/admin/villagers/invite-codes", { cache: "no-store" }),
        "Failed to load invite codes",
      )
    ).invites ?? []) as SiteInvite[],
  create: (input, send) => invitePost({ op: "create", input, send }),
  send: async (id) => { await invitePost({ op: "send", id }); },
  setActive: async (id, active) => { await invitePost({ op: "setActive", id, active }); },
};

type View = "discount" | "referral" | "invite";

export default function DiscountCodesModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });
  const [view, setView] = useState<View>("discount");
  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <ModalTitle>Codes</ModalTitle>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          <PillBar
            ariaLabel="Codes"
            active={view}
            onChange={(k) => setView(k as View)}
            segments={[
              { key: "discount", label: "Discount" },
              { key: "referral", label: "Referral" },
              { key: "invite", label: "Invite" },
            ]}
          />
          <div style={{ marginTop: 14 }}>
            {view === "invite" ? (
              <InviteCodesPanel adapter={inviteAdapter} />
            ) : view === "referral" ? (
              <PlatformReferralCodesPanel adapter={referralAdapter} />
            ) : (
              <PlatformDiscountCodesPanel adapter={officeAdapter} />
            )}
          </div>
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}
