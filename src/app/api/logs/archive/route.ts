/**
 * POST /api/logs/archive        → compress logs older than 30 days
 * POST /api/logs/archive?decompress=YYYY-MM-DD → decompress one archive to temp
 * DELETE /api/logs/archive?date=YYYY-MM-DD    → delete temp decompressed file
 */
import { NextRequest, NextResponse } from "next/server";
import { execSync, spawnSync } from "child_process";
import { readdirSync, existsSync, unlinkSync, statSync } from "fs";
import path from "path";

const LOG_DIR = "/srv/refusion-core/logs/tgv-office";
const ARCHIVE_DIR = `${LOG_DIR}/archive`;
const TEMP_DIR = `${LOG_DIR}/tmp`;

function laToday(): string {
  const [m, d, y] = new Date()
    .toLocaleDateString("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .split("/");
  return `${y}-${m}-${d}`;
}

function dateDiffDays(dateStr: string): number {
  const today = new Date(laToday());
  const target = new Date(dateStr);
  return Math.floor((today.getTime() - target.getTime()) / 86_400_000);
}

export async function GET(_req: NextRequest) {
  // List archives
  try {
    execSync(`mkdir -p "${ARCHIVE_DIR}" "${TEMP_DIR}"`);
    const archives = readdirSync(ARCHIVE_DIR)
      .filter((f) => f.endsWith(".log.gz"))
      .map((f) => {
        const date = f.replace(".log.gz", "");
        const fp = path.join(ARCHIVE_DIR, f);
        const stat = statSync(fp);
        const tmpPath = path.join(TEMP_DIR, `${date}.log`);
        return {
          date,
          compressedSize: stat.size,
          decompressed: existsSync(tmpPath),
          tmpPath: existsSync(tmpPath) ? tmpPath : null,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
    return NextResponse.json({ archives });
  } catch {
    return NextResponse.json({ archives: [] });
  }
}

export async function POST(req: NextRequest) {
  const decompress = req.nextUrl.searchParams.get("decompress");

  if (decompress) {
    // Decompress a specific archive to temp
    const safe = decompress.replace(/[^0-9-]/g, "");
    const archivePath = path.join(ARCHIVE_DIR, `${safe}.log.gz`);
    const tmpPath = path.join(TEMP_DIR, `${safe}.log`);

    if (!existsSync(archivePath)) {
      return NextResponse.json({ error: "Archive not found" }, { status: 404 });
    }

    execSync(`mkdir -p "${TEMP_DIR}"`);
    spawnSync("gunzip", ["-k", "-f", "-c", archivePath], {
      stdio: ["ignore", require("fs").openSync(tmpPath, "w"), "ignore"],
    });

    // Read first/last line count
    const result = spawnSync("wc", ["-l", tmpPath], { encoding: "utf8" });
    const lineCount = parseInt(result.stdout?.trim().split(" ")[0] ?? "0", 10);

    return NextResponse.json({ ok: true, date: safe, lineCount, tmpPath });
  }

  // Auto-archive logs older than 30 days
  execSync(`mkdir -p "${ARCHIVE_DIR}"`);
  const archived: string[] = [];

  if (!existsSync(LOG_DIR)) return NextResponse.json({ archived: [] });

  const files = readdirSync(LOG_DIR).filter((f) => f.endsWith(".log"));

  for (const file of files) {
    const date = file.replace(".log", "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (dateDiffDays(date) < 30) continue;

    const src = path.join(LOG_DIR, file);
    const dst = path.join(ARCHIVE_DIR, `${date}.log.gz`);

    // Compress then delete original
    const result = spawnSync("gzip", ["-9", "-c", src], { maxBuffer: 50 * 1024 * 1024 });
    if (result.status === 0 && result.stdout) {
      require("fs").writeFileSync(dst, result.stdout);
      unlinkSync(src);
      archived.push(date);
    }
  }

  return NextResponse.json({ archived });
}

export async function DELETE(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "Missing date" }, { status: 400 });

  const safe = date.replace(/[^0-9-]/g, "");
  const tmpPath = path.join(TEMP_DIR, `${safe}.log`);

  if (existsSync(tmpPath)) unlinkSync(tmpPath);
  return NextResponse.json({ ok: true });
}
