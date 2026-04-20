// Shared in-memory typing state for chat (TGV/DM/group).
// Key format: `${username}|${context}` where context is "chat", "dm:<sortedPair>", or "group:<id>".

const typingState = new Map<string, number>();
const STALE_MS = 4000;

export function normalizeContext(context: string, me: string): string {
  if (context.startsWith("dm:")) {
    const peer = context.slice(3);
    const pair = [me, peer].sort().join("_");
    return `dm:${pair}`;
  }
  return context;
}

export function markTyping(username: string, context: string): void {
  typingState.set(`${username}|${context}`, Date.now());
}

export function clearTyping(username: string, context: string): void {
  typingState.delete(`${username}|${context}`);
}

export function getActiveTypers(context: string, exclude?: string): string[] {
  const now = Date.now();
  const result: string[] = [];
  for (const [key, ts] of typingState.entries()) {
    if (now - ts > STALE_MS) { typingState.delete(key); continue; }
    const sep = key.indexOf("|");
    if (sep < 0) continue;
    const username = key.slice(0, sep);
    const ctx = key.slice(sep + 1);
    if (ctx === context && username !== exclude) result.push(username);
  }
  return result;
}
