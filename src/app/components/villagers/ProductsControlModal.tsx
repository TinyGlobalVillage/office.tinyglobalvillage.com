"use client";
// ProductsControlModal — operator management of the signup wizard's PRICING: its subscription PLANS
// (platform_products) and ADD-ONS (platform_addons). Wraps the SHARED
// @tgv/module-component-library PlatformProductsPanel (the same UI the HQ dashboard's folded
// Products tile mounts) with an Office adapter that proxies to HQ over the internal-secret seam
// (Office holds no Stripe keys — see products-proxy.ts). HQ is money-first: it mints the Stripe
// Product+Price before any DB write and compensates on failure. Same rows, either place.
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import {
  PlatformProductsPanel,
  type PlatformProductsAdapter,
} from "@tgv/module-component-library/components/products/PlatformProductsPanel";
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

const officeAdapter: PlatformProductsAdapter = {
  listPlans: async () =>
    (
      await jsonOrThrow(
        await fetch("/api/admin/villagers/platform-products", { cache: "no-store" }),
        "Failed to load plans",
      )
    ).platformProducts ?? [],
  createPlan: async (input) => {
    await jsonOrThrow(
      await fetch("/api/admin/villagers/platform-products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
      "Create failed",
    );
  },
  updatePlan: async (id, input) => {
    await jsonOrThrow(
      await fetch(`/api/admin/villagers/platform-products/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
      "Update failed",
    );
  },
  deletePlan: async (id) => {
    await jsonOrThrow(
      await fetch(`/api/admin/villagers/platform-products/${id}`, { method: "DELETE" }),
      "Delete failed",
    );
  },
  listAddons: async () =>
    (
      await jsonOrThrow(
        await fetch("/api/admin/villagers/platform-addons", { cache: "no-store" }),
        "Failed to load add-ons",
      )
    ).platformAddons ?? [],
  createAddon: async (input) => {
    await jsonOrThrow(
      await fetch("/api/admin/villagers/platform-addons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
      "Create failed",
    );
  },
  updateAddon: async (id, input) => {
    await jsonOrThrow(
      await fetch(`/api/admin/villagers/platform-addons/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
      "Update failed",
    );
  },
  deleteAddon: async (id) => {
    await jsonOrThrow(
      await fetch(`/api/admin/villagers/platform-addons/${id}`, { method: "DELETE" }),
      "Delete failed",
    );
  },
};

export default function ProductsControlModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });
  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <ModalTitle>Wizard Pricing — Plans &amp; Add-ons</ModalTitle>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          <PlatformProductsPanel adapter={officeAdapter} />
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}
