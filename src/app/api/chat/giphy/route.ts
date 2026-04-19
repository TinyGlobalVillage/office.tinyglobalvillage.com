import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

const GIPHY_BASE = "https://api.giphy.com/v1";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.GIPHY_API_KEY;
  if (!key) return NextResponse.json({ error: "GIPHY_API_KEY not configured" }, { status: 500 });

  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") === "stickers" ? "stickers" : "gifs";
  const q = sp.get("q") ?? "";
  const offset = Math.max(0, Number(sp.get("offset") ?? 0) | 0);
  const limit = Math.min(50, Math.max(1, Number(sp.get("limit") ?? 24) | 0));

  const endpoint = q ? "search" : "trending";
  const url = new URL(`${GIPHY_BASE}/${kind}/${endpoint}`);
  url.searchParams.set("api_key", key);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("rating", "pg-13");
  if (q) url.searchParams.set("q", q);

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: `Giphy ${res.status}` }, { status: 502 });
    const data = await res.json();
    type GiphyItem = {
      id: string;
      title?: string;
      images?: {
        fixed_height_small?: { url?: string; width?: string; height?: string };
        fixed_height?: { url?: string; width?: string; height?: string };
        original?: { url?: string };
      };
    };
    const items = (data.data as GiphyItem[] | undefined ?? []).map((g) => ({
      id: g.id,
      title: g.title ?? "",
      preview: g.images?.fixed_height_small?.url ?? g.images?.fixed_height?.url ?? "",
      full: g.images?.original?.url ?? "",
      width: Number(g.images?.fixed_height_small?.width ?? g.images?.fixed_height?.width ?? 200),
      height: Number(g.images?.fixed_height_small?.height ?? g.images?.fixed_height?.height ?? 100),
    })).filter((g) => g.preview && g.full);

    const totalCount: number = data.pagination?.total_count ?? items.length + offset + 1;
    return NextResponse.json({ items, nextOffset: offset + items.length, hasMore: offset + items.length < totalCount });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
