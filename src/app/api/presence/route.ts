import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const USERS = [
  { sysUser: "admin",  displayName: "Gio" },
  { sysUser: "marmar", displayName: "Marthe" },
];

async function getActiveUsers(): Promise<Set<string>> {
  try {
    const { stdout } = await execAsync("who");
    const active = new Set<string>();
    for (const line of stdout.split("\n")) {
      const username = line.trim().split(/\s+/)[0];
      if (username) active.add(username);
    }
    return active;
  } catch {
    return new Set();
  }
}

// Parse `last -n 1 <user>` output to get last login time
async function getLastSeen(sysUser: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`last -n 1 ${sysUser}`);
    const lines = stdout.split("\n").filter((l) => l.startsWith(sysUser));
    if (!lines[0]) return null;

    // Format: "marmar   pts/10   75.111.7.250   Sun Jan 25 17:10 - 17:12  (00:02)"
    // Extract the date portion — it's after the IP/hostname column
    const match = lines[0].match(
      /\w+\s+\w+\/?\w*\s+[\d.]+\s+([\w]+ [\w]+ \d+ \d+:\d+)/
    );
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const [active] = await Promise.all([getActiveUsers()]);

  const presence = await Promise.all(
    USERS.map(async ({ sysUser, displayName }) => {
      const online = active.has(sysUser);
      const lastSeen = online ? null : await getLastSeen(sysUser);
      return { sysUser, displayName, online, lastSeen };
    })
  );

  return Response.json(presence, {
    headers: { "Cache-Control": "no-store" },
  });
}
