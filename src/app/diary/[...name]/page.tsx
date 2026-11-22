// /diary/<link name> (or /diary/<date>/<slug>) — open an RCS Diary entry straight from a link.
// Resolves the name (renamed links redirect) and lands on the dashboard with the diary open on it.
import { notFound, redirect } from "next/navigation";
import { resolveLink } from "@/lib/diary-links";

export const dynamic = "force-dynamic";

export default async function DiaryLink({ params }: { params: Promise<{ name: string[] }> }) {
  const { name } = await params;
  const key = await resolveLink((name ?? []).map((s) => decodeURIComponent(s)));
  if (!key) notFound();
  redirect(`/dashboard?tile=Diary&view=${encodeURIComponent(key)}`);
}
