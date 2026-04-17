import { type NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/api-auth";
import { getAccount, sendEmail } from "@/lib/fastmail";

export const runtime = "nodejs";

type Message = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `You are the TGV Office SuggestionBox AI — a product architect inside TinyGlobalVillage's admin platform.

When a user submits a feature suggestion you will:
1. Acknowledge the idea with genuine enthusiasm (one sentence).
2. Produce a structured implementation plan in markdown:
   - **Summary** — what the feature does in 2-3 sentences.
   - **Stack** — which parts of the TGV canonical stack are involved (Next.js 15, React 19, Tailwind v4, Drizzle ORM, PostgreSQL, Stripe, LiveKit, etc.).
   - **Files to create / modify** — bullet list with paths.
   - **Steps** — numbered implementation steps (concise, actionable).
   - **Estimated effort** — T-shirt size (XS / S / M / L / XL) with a one-line justification.
   - **Risks / open questions** — anything the team should decide before starting.
3. If the user asks follow-up questions, continue the conversation naturally — refine the plan, answer technical questions, suggest alternatives.

Keep responses practical and direct. Use markdown formatting. The audience is the TGV admin team (technical).`;

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const action = body.action as string;

  // --- Action: chat (Claude conversation) ---
  if (action === "chat") {
    const featureName = body.featureName as string;
    const messages: Message[] = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0)
      return NextResponse.json({ error: "messages required" }, { status: 400 });

    const client = new Anthropic({ apiKey });
    const enrichedMessages = messages.map((m, i) => ({
      role: m.role,
      content:
        i === 0 && featureName
          ? `Feature: "${featureName}"\n\n${m.content}`
          : m.content,
    }));

    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: enrichedMessages,
      });

      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text"
      );
      const replyText = textBlocks.map((b) => b.text).join("\n\n");

      return NextResponse.json({
        reply: replyText,
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      return NextResponse.json({ error: `Claude API error: ${message}` }, { status: 502 });
    }
  }

  // --- Action: send (email to admin team) ---
  if (action === "send") {
    const featureName = body.featureName as string;
    const description = body.description as string;
    const conversation: Message[] = Array.isArray(body.conversation) ? body.conversation : [];
    const submittedBy = token.name || token.username || "Unknown";

    if (!featureName || !description)
      return NextResponse.json({ error: "featureName and description required" }, { status: 400 });

    const adminAcc = getAccount("admin");
    if (!adminAcc.token)
      return NextResponse.json({ error: "Admin email not configured" }, { status: 503 });

    const conversationHtml = conversation
      .map((m) => {
        const isUser = m.role === "user";
        const label = isUser ? submittedBy : "Claude AI";
        const bg = isUser ? "#1a1a2e" : "#0d1117";
        const border = isUser ? "#ff4ecb" : "#00bfff";
        const content = m.content
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br>");
        return `<div style="margin-bottom:16px;padding:16px;border-radius:12px;background:${bg};border-left:3px solid ${border}">
          <div style="font-size:11px;font-weight:700;color:${border};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">${label}</div>
          <div style="font-size:14px;color:#e0e0e0;line-height:1.6">${content}</div>
        </div>`;
      })
      .reverse()
      .join("");

    const implementUrl = `${process.env.NEXTAUTH_URL || process.env.AUTH_URL || "https://office.tinyglobalvillage.com"}/api/suggestion?action=implement&feature=${encodeURIComponent(featureName)}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0814;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:640px;margin:0 auto;padding:32px 24px">
    <div style="text-align:center;margin-bottom:32px">
      <h1 style="font-size:28px;font-weight:800;color:#ff4ecb;margin:0;text-shadow:0 0 12px rgba(255,78,203,0.4)">
        New Feature Suggestion
      </h1>
      <p style="color:rgba(255,255,255,0.4);font-size:13px;margin-top:8px">Submitted by ${submittedBy} via TGV Office SuggestionBox</p>
    </div>

    <div style="background:rgba(255,78,203,0.06);border:1px solid rgba(255,78,203,0.2);border-radius:16px;padding:24px;margin-bottom:24px">
      <h2 style="font-size:20px;color:#ff4ecb;margin:0 0 8px">${featureName.replace(/</g, "&lt;")}</h2>
      <p style="font-size:14px;color:#e0e0e0;line-height:1.6;margin:0">${description.replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>
    </div>

    ${conversation.length > 0 ? `
    <div style="margin-bottom:24px">
      <h3 style="font-size:14px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:2px;margin-bottom:16px">
        Conversation (most recent first)
      </h3>
      ${conversationHtml}
    </div>
    ` : ""}

    <div style="text-align:center;margin-top:32px">
      <a href="${implementUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#ff4ecb,#a855f7);color:#fff;font-weight:700;font-size:14px;text-decoration:none;border-radius:12px;letter-spacing:0.5px;box-shadow:0 4px 24px rgba(255,78,203,0.3)">
        Implement Immediately
      </a>
      <p style="color:rgba(255,255,255,0.25);font-size:11px;margin-top:12px">
        Routes to Sandbox staging for review before deployment
      </p>
    </div>

    <div style="text-align:center;margin-top:48px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.06)">
      <p style="color:rgba(255,255,255,0.2);font-size:11px">TGV Office · SuggestionBox · tinyglobalvillage.com</p>
    </div>
  </div>
</body>
</html>`;

    try {
      const adminEmail = process.env.ADMIN_EMAIL || "admin@tinyglobalvillage.com";
      await sendEmail(adminAcc.token, {
        from: { name: "TGV SuggestionBox", email: adminAcc.email },
        to: [{ email: adminEmail }],
        subject: `[SuggestionBox] ${featureName}`,
        htmlBody,
        textBody: `New Feature Suggestion: ${featureName}\n\nBy: ${submittedBy}\n\n${description}\n\n${conversation.map((m) => `${m.role === "user" ? submittedBy : "Claude"}: ${m.content}`).join("\n\n")}`,
      });

      return NextResponse.json({ ok: true, sentTo: adminEmail });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      return NextResponse.json({ error: `Email send failed: ${message}` }, { status: 502 });
    }
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
