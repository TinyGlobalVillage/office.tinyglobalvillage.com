"use client";
// Villagers → "Dashboard Storage config". Thin host over the shared @tgv/module-storage fleet gear:
// FleetStorageSettings renders its own overlay + card and talks to office's superadmin-gated
// /api/admin/storage/fleet route (basePath "/api/admin/storage"). This is the single source of truth the
// storage billing lifecycle reads — tier caps, dormant-hosting pricing ($5 + $1/GB), lapse/purge timings,
// and the Stripe price pointers for the +GB add-on and the dormant subscription (wired in P3/P4).
import { FleetStorageSettings } from "@tgv/module-storage/ui";

export default function DashboardStorageConfigModal({ onClose }: { onClose: () => void }) {
  return <FleetStorageSettings basePath="/api/admin/storage" onClose={onClose} />;
}
