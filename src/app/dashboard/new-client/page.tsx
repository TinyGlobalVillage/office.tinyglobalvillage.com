// /dashboard/new-client — RETIRED (Gio 2026-08-31, checklist #7): the stepped
// wizard's fields (custom domain, vertical, tier, modules, storage, custom/RFP,
// branding, contact phone) folded into OnboardVillagerModal on the villagers
// page — one onboarding surface, not two. This route survives only as a
// redirect so old bookmarks and links keep working.
import { redirect } from "next/navigation";

export default function NewClientPage() {
  redirect("/dashboard/villagers");
}
