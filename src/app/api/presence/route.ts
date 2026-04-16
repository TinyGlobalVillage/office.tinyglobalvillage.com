import { exec } from "child_process";
import { promisify } from "util";
import { isWebOnline, lastWebSeen } from "@/lib/presence-store";

const execAsync = promisify(exec);

const USERS = [
  { sysUser: "admin",  displayName: "Gio" },
  { sysUser: "marmar", displayName: "Marthe" },
];

// Check /dev/pts/ ownership — covers TTY sessions AND VS Code @notty SSH connections
async function getActiveUsers(): Promise<Set<string>> {
  try {
    // stat -c '%U' prints the owning username for each pts device
    const { stdout } = await execAsync(
      "stat -c '%U' /dev/pts/* 2>/dev/null || true"
    );
    const active = new Set<string>();
    for (const name of stdout.split("\n").map((l) => l.trim()).filter(Boolean)) {
      active.add(name);
    }
    return active;
  } catch {
    return new Set();
  }
}

// Count active sessions (pts devices) per user
async function getSessionCount(sysUser: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `stat -c '%U' /dev/pts/* 2>/dev/null | grep -c "^${sysUser}$" || echo 0`
    );
    return parseInt(stdout.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

// Last seen from SSH login history via journalctl (more reliable than `last`/wtmp,
// which gets corrupted when sshd is OOM-killed before it can write exit records)
async function getSshLastSeen(sysUser: string): Promise<number | null> {
  try {
    const { stdout } = await execAsync(
      `journalctl -u ssh --since "365 days ago" -r --no-pager -q 2>/dev/null | grep "Accepted publickey for ${sysUser} " | head -1`
    );
    const line = stdout.trim();
    if (!line) return null;
    // "Apr 11 01:43:53 server sshd[...]: Accepted publickey for marmar from ..."
    const match = line.match(/^(\w+ +\d+ \d+:\d+:\d+)/);
    if (!match) return null;
    const parsed = Date.parse(`${match[1]} ${new Date().getFullYear()}`);
    return isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

function formatLastSeen(ms: number): string {
  const diff = Date.now() - ms;
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 2)   return "just now";
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 7)   return `${days}d ago`;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function GET() {
  const active = await getActiveUsers();

  const presence = await Promise.all(
    USERS.map(async ({ sysUser, displayName }) => {
      const sshOnline = active.has(sysUser);
      const webOnline = isWebOnline(sysUser);
      const online = sshOnline || webOnline;
      const sessions = sshOnline ? await getSessionCount(sysUser) : 0;
      const via = sshOnline && webOnline ? "ssh+web" : sshOnline ? "ssh" : webOnline ? "web" : null;

      let lastSeen: string | null = null;
      if (!online) {
        const webMs  = lastWebSeen(sysUser);
        const sshMs  = await getSshLastSeen(sysUser);
        // Use whichever is more recent
        const bestMs = webMs && sshMs ? Math.max(webMs, sshMs) : (webMs ?? sshMs);
        lastSeen = bestMs ? formatLastSeen(bestMs) : null;
      }

      const onlineSinceMs = online ? lastWebSeen(sysUser) : null;
      return { sysUser, displayName, online, sessions, lastSeen, via, onlineSinceMs };
    })
  );

  return Response.json(presence, {
    headers: { "Cache-Control": "no-store" },
  });
}
