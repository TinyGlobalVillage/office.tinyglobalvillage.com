"use client";
// The /dashboard/storage route. Everything it renders lives in StorageSurface, which is also mounted
// directly by the Villagers → Dashboard Storage modal — a page file may not export anything but the
// route itself, so the component has its own home under components/storage/.
import { StorageSurface } from "@/app/components/storage/StorageSurface";

export default function StoragePage() {
  return <StorageSurface embedded={false} />;
}
