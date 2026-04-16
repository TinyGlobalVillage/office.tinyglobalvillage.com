/**
 * GET /api/logs                           → list log dates + archive dates (newest first)
 * GET /api/logs?date=YYYY-MM-DD&page=1    → paginated lines for a live log
 * GET /api/logs?date=YYYY-MM-DD&tmp=1     → paginated lines from a decompressed tmp file
 */
import { NextRequest } from "next/server";
import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import path from "path";

const LOG_DIR = "/srv/refusion-core/logs/tgv-office";
const ARCHIVE_DIR = `${LOG_DIR}/archive`;
const TEMP_DIR = `${LOG_DIR}/tmp`;
const DEFAULT_LIMIT = 200;

function listLiveDates(): { date: string; bytes: number; archived: false }[] {
  try {
    return readdirSync(LOG_DIR)
      .filter((f) => f.endsWith(".log"))
      .map((f) => {
        const date = f.replace(".log", "");
        try { return { date, bytes: statSync(path.join(LOG_DIR, f)).size, archived: false as const }; }
        catch { return { date, bytes: 0, archived: false as const }; }
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch { return []; }
}

function listArchiveDates(): { date: string; bytes: number; archived: true; decompressed: boolean }[] {
  try {
    if (!existsSync(ARCHIVE_DIR)) return [];
    return readdirSync(ARCHIVE_DIR)
      .filter((f) => f.endsWith(".log.gz"))
      .map((f) => {
        const date = f.replace(".log.gz", "");
        const bytes = (() => { try { return statSync(path.join(ARCHIVE_DIR, f)).size; } catch { return 0; } })();
        const decompressed = existsSync(path.join(TEMP_DIR, `${date}.log`));
        return { date, bytes, archived: true as const, decompressed };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch { return []; }
}

function paginateFile(filePath: string, page: number, limit: number) {
  const raw = readFileSync(filePath, "utf8");
  const allLines = raw.split("\n").filter(Boolean);
  const total = allLines.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const fromEnd = (page - 1) * limit;
  const start = Math.max(0, total - fromEnd - limit);
  const end = Math.max(0, total - fromEnd);
  return {
    total,
    totalPages,
    lines: allLines.slice(start, end).reverse(),
  };
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  const tmp = req.nextUrl.searchParams.get("tmp") === "1";
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(1000, Math.max(10,
    parseInt(req.nextUrl.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)
  ));

  // List mode
  if (!date) {
    const live = listLiveDates();
    const archived = listArchiveDates();
    return Response.json({ dates: live, archives: archived });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "Invalid date format" }, { status: 400 });
  }

  // Serve from tmp (decompressed archive)
  if (tmp) {
    const tmpPath = path.join(TEMP_DIR, `${date}.log`);
    if (!existsSync(tmpPath)) {
      return Response.json({ error: "Not decompressed yet" }, { status: 404 });
    }
    const { total, totalPages, lines } = paginateFile(tmpPath, page, limit);
    return Response.json({ date, total, page, totalPages, limit, lines, source: "archive" });
  }

  // Serve from live log
  const filePath = path.join(LOG_DIR, `${date}.log`);
  if (!existsSync(filePath)) {
    return Response.json({ error: "Log file not found" }, { status: 404 });
  }
  const { total, totalPages, lines } = paginateFile(filePath, page, limit);
  return Response.json({ date, total, page, totalPages, limit, lines, source: "live" });
}
