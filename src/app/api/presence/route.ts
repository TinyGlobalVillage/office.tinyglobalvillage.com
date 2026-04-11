import { exec } from "child_process";
import { promisify } from "util";

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

// Last seen from `last`
async function getLastSeen(sysUser: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `last -n 1 ${sysUser} 2>/dev/null || true`
    );
    const line = stdout.split("\n").find((l) => l.startsWith(sysUser));
    if (!line) return null;
    // "marmar   pts/10   75.111.7.250   Sun Jan 25 17:10 - 17:12  (00:02)"
    const match = line.match(/\w+\s+\S+\s+\S+\s+([\w]+ [\w]+ +\d+ \d+:\d+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const active = await getActiveUsers();

  const presence = await Promise.all(
    USERS.map(async ({ sysUser, displayName }) => {
      const online = active.has(sysUser);
      const sessions = online ? await getSessionCount(sysUser) : 0;
      const lastSeen = online ? null : await getLastSeen(sysUser);
      return { sysUser, displayName, online, sessions, lastSeen };
    })
  );

  return Response.json(presence, {
    headers: { "Cache-Control": "no-store" },
  });
}
