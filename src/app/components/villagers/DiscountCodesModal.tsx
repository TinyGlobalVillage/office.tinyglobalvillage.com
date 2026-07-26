"use client";
// DiscountCodesModal — operator management of the TGV-wide (platform) discount codes the signup
// wizard reads. Wraps the SHARED @tgv/module-component-library PlatformDiscountCodesPanel (the same
// UI the HQ dashboard mounts) with an Office adapter that proxies to HQ over the internal-secret
// seam (Office holds no Stripe keys — see promo-proxy.ts). Same codes, either place.
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
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

export default function DiscountCodesModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });
  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <ModalTitle>Discount Codes — Wizard</ModalTitle>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          <PlatformDiscountCodesPanel adapter={officeAdapter} />
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}
