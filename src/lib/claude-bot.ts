import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { markTyping, clearTyping } from "@/lib/typing-store";

export const BOT_USERNAME = "claude";

const CHAT_FILE = path.join(process.cwd(), "data", "chat-messages.json");
const GROUP_FILE = path.join(process.cwd(), "data", "group-chats.json");
const DM_FILE = path.join(process.cwd(), "data", "direct-messages.json");

const TRIGGER_RE = /(^|\s)(@claude\b|hey[,!\s]+claude\b)/i;

const SYSTEM_PROMPT =
  "You are Claude, a member of a group chat inside a small team's office app (TGV). " +
  "Reply naturally and briefly — like a chat message, not an essay. Keep responses under 3–4 short sentences unless the user explicitly asks for more detail. " +
  "Never prefix your messages with your name; the UI already attributes them. " +
  "Stay helpful, warm, and direct.";

const HISTORY_LIMIT = 20;

export function messageTriggersClaude(content: string): boolean {
  return TRIGGER_RE.test(content ?? "");
}

type ConvMsg = { role: "user" | "assistant"; content: string };

function buildConversation(history: { from: string; content: string }[]): ConvMsg[] {
  const tail = history.slice(-HISTORY_LIMIT);
  const conv: ConvMsg[] = [];
  for (const m of tail) {
    if (!m.content?.trim()) continue;
    if (m.from === BOT_USERNAME) {
      conv.push({ role: "assistant", content: m.content });
    } else {
      conv.push({ role: "user", content: `${m.from}: ${m.content}` });
    }
  }
  // Anthropic requires the last message to be a user turn.
  while (conv.length > 0 && conv[conv.length - 1].role !== "user") conv.pop();
  if (conv.length === 0) conv.push({ role: "user", content: "hey" });
  return conv;
}

async function callClaude(conversation: ConvMsg[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: conversation,
  });
  const blocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );
  return blocks.map((b) => b.text).join("\n\n").trim() || "(no reply)";
}

function safeRead<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function safeWrite(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

async function replyGeneric(
  kind: "tgv" | "group" | "dm",
  typingContext: string,
  conversation: ConvMsg[],
  appendBotMessage: (text: string) => void,
) {
  markTyping(BOT_USERNAME, typingContext);
  const pulse = setInterval(() => markTyping(BOT_USERNAME, typingContext), 2000);
  try {
    const reply = await callClaude(conversation);
    appendBotMessage(reply);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    appendBotMessage(`_(Claude bot failed: ${message})_`);
    // eslint-disable-next-line no-console
    console.error(`[claude-bot][${kind}]`, err);
  } finally {
    clearInterval(pulse);
    clearTyping(BOT_USERNAME, typingContext);
  }
}

type ChatDB = {
  messages: {
    id: string;
    from: string;
    content: string;
    createdAt: string;
    readBy?: string[];
  }[];
  storageBytes: number;
};

export function triggerClaudeForTgv(): void {
  const db = safeRead<ChatDB>(CHAT_FILE, { messages: [], storageBytes: 0 });
  const history = db.messages.map((m) => ({ from: m.from, content: m.content }));
  const conv = buildConversation(history);
  void replyGeneric("tgv", "chat", conv, (text) => {
    const current = safeRead<ChatDB>(CHAT_FILE, { messages: [], storageBytes: 0 });
    current.messages.push({
      id: newId("c"),
      from: BOT_USERNAME,
      content: text,
      createdAt: new Date().toISOString(),
      readBy: [],
    });
    safeWrite(CHAT_FILE, current);
  });
}

type GroupMessageLite = {
  id: string;
  groupId: string;
  from: string;
  content: string;
  createdAt: string;
  readBy?: string[];
};

type GroupDb = {
  groups: Record<string, { id: string; memberIds: string[] }>;
  messages: Record<string, GroupMessageLite[]>;
};

export function triggerClaudeForGroup(groupId: string): void {
  const db = safeRead<GroupDb>(GROUP_FILE, { groups: {}, messages: {} });
  const group = db.groups[groupId];
  if (!group || !group.memberIds.includes(BOT_USERNAME)) return;
  const history = (db.messages[groupId] ?? []).map((m) => ({ from: m.from, content: m.content }));
  const conv = buildConversation(history);
  void replyGeneric("group", `group:${groupId}`, conv, (text) => {
    const current = safeRead<GroupDb>(GROUP_FILE, { groups: {}, messages: {} });
    if (!current.messages[groupId]) current.messages[groupId] = [];
    current.messages[groupId].push({
      id: newId("gm"),
      groupId,
      from: BOT_USERNAME,
      content: text,
      createdAt: new Date().toISOString(),
      readBy: [],
    });
    current.messages[groupId] = current.messages[groupId].slice(-500);
    safeWrite(GROUP_FILE, current);
  });
}

type DmMessageLite = {
  id: string;
  from: string;
  to: string;
  content: string;
  createdAt: string;
  readBy?: string[];
};

type DmDb = { threads: Record<string, DmMessageLite[]> };

function threadKey(a: string, b: string) { return [a, b].sort().join("_"); }

export function triggerClaudeForDm(otherUser: string): void {
  const db = safeRead<DmDb>(DM_FILE, { threads: {} });
  const key = threadKey(otherUser, BOT_USERNAME);
  const history = (db.threads[key] ?? []).map((m) => ({ from: m.from, content: m.content }));
  const conv = buildConversation(history);
  const dmCtx = `dm:${[otherUser, BOT_USERNAME].sort().join("_")}`;
  void replyGeneric("dm", dmCtx, conv, (text) => {
    const current = safeRead<DmDb>(DM_FILE, { threads: {} });
    if (!current.threads[key]) current.threads[key] = [];
    current.threads[key].push({
      id: newId("dm"),
      from: BOT_USERNAME,
      to: otherUser,
      content: text,
      createdAt: new Date().toISOString(),
      readBy: [],
    });
    current.threads[key] = current.threads[key].slice(-500);
    safeWrite(DM_FILE, current);
  });
}
