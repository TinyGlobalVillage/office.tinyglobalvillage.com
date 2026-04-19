import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

type OgMeta = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
};

const CACHE = new Map<string, { ts: number; meta: OgMeta }>();
const TTL_MS = 1000 * 60 * 60; // 1h

function pickMeta(html: string, name: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return m[1];
  }
  return undefined;
}

function pickTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim();
}

function decodeEntities(s?: string): string | undefined {
  if (!s) return s;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/");
}

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "Invalid protocol" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const cached = CACHE.get(parsed.href);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return NextResponse.json(cached.meta);
  }

  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    const res = await fetch(parsed.href, {
      redirect: "follow",
      signal: ctl.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; TGV-OfficeBot/1.0; +https://office.tinyglobalvillage.com)",
        accept: "text/html,*/*;q=0.8",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html")) return NextResponse.json({ error: "Not HTML" }, { status: 415 });
    const body = (await res.text()).slice(0, 200_000);

    const meta: OgMeta = {
      url: parsed.href,
      title: decodeEntities(pickMeta(body, "og:title") ?? pickTitle(body)),
      description: decodeEntities(pickMeta(body, "og:description") ?? pickMeta(body, "description")),
      image: pickMeta(body, "og:image"),
      siteName: decodeEntities(pickMeta(body, "og:site_name") ?? parsed.hostname),
    };

    if (meta.image && !/^https?:\/\//i.test(meta.image)) {
      try { meta.image = new URL(meta.image, parsed.origin).href; } catch { meta.image = undefined; }
    }

    CACHE.set(parsed.href, { ts: Date.now(), meta });
    return NextResponse.json(meta);
  } catch {
    return NextResponse.json({ error: "Fetch error" }, { status: 502 });
  }
}
