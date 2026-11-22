import { NextResponse } from "next/server";
import { listDates, listEntriesForDate } from "../_lib";
import { linkNames } from "@/lib/diary-links";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [dates, links] = await Promise.all([listDates(), linkNames()]);
    const days = await Promise.all(
      dates.map(async (date) => {
        const items = await listEntriesForDate(date);
        return {
          date,
          count: items.length,
          headlines: items.map((it) => ({
            nn: it.nn,
            slug: it.slug,
            time: it.meta.time ?? "",
            type: it.meta.type ?? "log",
            title: it.meta.title ?? it.slug,
            summary: it.summary,
            featured: it.meta.featured ?? false,
            subtitle: it.meta.subtitle ?? "",
            glow: it.meta.glow ?? "",
            link: links[`${date}/${it.slug}`] ?? it.slug,
          })),
        };
      }),
    );
    return NextResponse.json({ days });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
