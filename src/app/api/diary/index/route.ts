import { NextResponse } from "next/server";
import { listDates, listEntriesForDate } from "../_lib";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dates = await listDates();
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
          })),
        };
      }),
    );
    return NextResponse.json({ days });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
