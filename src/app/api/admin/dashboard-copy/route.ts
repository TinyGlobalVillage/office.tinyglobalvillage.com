// /api/admin/dashboard-copy — the words on every tenant's dashboard modals, authored here.
//
// Gio 2026-09-05: "i want an interface to be able to edit the text on any modal of the dashboard",
// "platform wide", "yes one office editable canon". Office WRITES; tgv.com reads the same tables
// server-side (src/lib/dashboard/copyCanon.ts) and hands them to DashboardCopyProvider — the same
// cross-app shape as dashboard_runtime_settings and dashboard_layout_canon.
//
//   GET  ?lang=xx   → { languages[], fields: { modalKey: { fieldKey: { value, source } } } }
//   PUT  { lang, modalKey, fieldKey, value }
//                   → upsert one field as source 'human'; an EMPTY value DELETES the row, which
//                     is how "revert to the shipped English" is spelled. Audited.
//   POST { lang, label }
//                   → add a language and auto-seed it (see below). Audited.
//
// WHAT IS VALIDATED, AND WHY IT IS THE REGISTRY. `modalKey`/`fieldKey` are checked against
// DASHBOARD_COPY_REGISTRY rather than a hand-kept allowlist, because the registry is already the
// list of what a dashboard will actually read — an accepted key that no modal reads would be a
// row an operator can type into and never see, which is worse than a 400.
//
// Raw SQL via db.execute(): these tables aren't in the drizzle schema (same reasoning as
// dashboard-settings). Audit rows go through schema.adminAuditLog.
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/api-admin";
import { db, schema } from "@/lib/db-drizzle";
import { resolveAdminActorId } from "@/lib/admin-actor";
import {
  DASHBOARD_COPY_REGISTRY,
  COPY_SPEC_BY_KEY,
} from "@tgv/module-component-library/helpers/dashboardCopy/registry";

export const runtime = "nodejs";
// The seed translates the whole registry in one call. Well inside the default, but stated so a
// growing registry fails loudly at the edge rather than silently truncating.
export const maxDuration = 120;

type CopyRow = { modal_key: string; field_key: string; value: string; source: string };
type LangRow = {
  lang: string;
  label: string;
  seed_status: string;
  seed_error: string | null;
  seeded_at: string | Date | null;
};

function rowsOf<T>(r: unknown): T[] {
  return ((r as { rows?: T[] })?.rows ?? (Array.isArray(r) ? (r as T[]) : [])) as T[];
}

/** BCP-47-ish, lowercased, primary subtag only — the same normalisation tgv.com reads with. */
function normLang(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase();
  if (!/^[a-z]{2,8}(-[a-z0-9]{2,8})*$/.test(s)) return "";
  return s.split("-")[0];
}

function knownField(modalKey: string, fieldKey: string): boolean {
  return !!COPY_SPEC_BY_KEY[modalKey]?.fields.some((f) => f.key === fieldKey);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const lang = normLang(req.nextUrl.searchParams.get("lang")) || "en";

  const langs = rowsOf<LangRow>(
    await db.execute(sql`
      SELECT lang, label, seed_status, seed_error, seeded_at
      FROM public.dashboard_copy_languages
      ORDER BY (lang = 'en') DESC, label ASC`),
  );

  const rows = rowsOf<CopyRow>(
    await db.execute(sql`
      SELECT modal_key, field_key, value, source
      FROM public.dashboard_copy_canon
      WHERE lang = ${lang}`),
  );

  const fields: Record<string, Record<string, { value: string; source: string }>> = {};
  for (const r of rows) {
    (fields[r.modal_key] ??= {})[r.field_key] = { value: r.value, source: r.source };
  }

  return NextResponse.json({ ok: true, lang, languages: langs, fields });
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// PUT — one field
// ─────────────────────────────────────────────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const actorUserId = await resolveAdminActorId(gate.username);
  if (!actorUserId) {
    return NextResponse.json(
      { ok: false, error: "Admin actor not registered in users table" },
      { status: 403 },
    );
  }

  let body: { lang?: string; modalKey?: string; fieldKey?: string; value?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const lang = normLang(body.lang);
  const modalKey = String(body.modalKey ?? "").trim();
  const fieldKey = String(body.fieldKey ?? "").trim();
  const value = typeof body.value === "string" ? body.value : "";

  if (!lang) return NextResponse.json({ ok: false, error: "Bad lang" }, { status: 400 });
  if (!knownField(modalKey, fieldKey)) {
    return NextResponse.json(
      { ok: false, error: `Unknown copy field ${modalKey}.${fieldKey}` },
      { status: 400 },
    );
  }
  if (value.length > 4000) {
    return NextResponse.json({ ok: false, error: "Value too long (4000 max)" }, { status: 400 });
  }

  const result = await db.transaction(async (tx) => {
    const prev =
      rowsOf<{ value: string }>(
        await tx.execute(sql`
          SELECT value FROM public.dashboard_copy_canon
          WHERE lang = ${lang} AND modal_key = ${modalKey} AND field_key = ${fieldKey}`),
      )[0]?.value ?? null;

    if (!value.trim()) {
      // REVERT. Deleting rather than storing "" is what makes the shipped English the single
      // source of the default — an empty string in the table would render an empty dashboard.
      await tx.execute(sql`
        DELETE FROM public.dashboard_copy_canon
        WHERE lang = ${lang} AND modal_key = ${modalKey} AND field_key = ${fieldKey}`);
    } else {
      await tx.execute(sql`
        INSERT INTO public.dashboard_copy_canon
          (lang, modal_key, field_key, value, source, updated_at, updated_by)
        VALUES (${lang}, ${modalKey}, ${fieldKey}, ${value}, 'human', now(), ${gate.username})
        ON CONFLICT (lang, modal_key, field_key) DO UPDATE SET
          value = EXCLUDED.value,
          source = 'human',
          updated_at = now(),
          updated_by = EXCLUDED.updated_by`);
    }

    await tx.insert(schema.adminAuditLog).values({
      actorUserId,
      action: value.trim() ? "platform.dashboard_copy_set" : "platform.dashboard_copy_reset",
      targetType: "dashboard_copy",
      targetId: `${lang}:${modalKey}.${fieldKey}`,
      before: { value: prev },
      after: { value: value.trim() ? value : null },
      note: `Dashboard copy ${lang} ${modalKey}.${fieldKey} by ${gate.username}`,
    });

    return { ok: true as const, lang, modalKey, fieldKey, value: value.trim() ? value : null };
  });

  return NextResponse.json(result);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// POST — add a language, and auto-seed it with Claude
// ─────────────────────────────────────────────────────────────────────────────────────────────
//
// Gio 2026-09-05: "when a language is first selected in the dropdown menu, it auto-fires an engine
// we're going to create that translates it using claude ai to auto-seed every field that was in
// english in the now selected language, and then that way, if anything doesn't sound correct in
// that language, we can have a native speaker tweak it."
//
// So a machine seed is a STARTING POINT, never an authority. Two consequences are built in:
//   • every seeded row is written `source = 'machine'`, and
//   • a re-seed skips rows already marked 'human' — a native speaker's correction survives the
//     next time somebody presses the button, which is the whole reason the column exists.
export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const actorUserId = await resolveAdminActorId(gate.username);
  if (!actorUserId) {
    return NextResponse.json(
      { ok: false, error: "Admin actor not registered in users table" },
      { status: 403 },
    );
  }

  let body: { lang?: string; label?: string; reseed?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const lang = normLang(body.lang);
  const label = String(body.label ?? "").trim().slice(0, 60);
  if (!lang) return NextResponse.json({ ok: false, error: "Bad lang" }, { status: 400 });
  if (lang === "en") {
    return NextResponse.json(
      { ok: false, error: "English is the source canon — it is not translated." },
      { status: 400 },
    );
  }
  if (!label) return NextResponse.json({ ok: false, error: "Missing label" }, { status: 400 });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    // The language still gets created — an operator can hand-write it. Only the seed is lost.
    await db.execute(sql`
      INSERT INTO public.dashboard_copy_languages (lang, label, seed_status, seed_error, created_by)
      VALUES (${lang}, ${label}, 'failed', 'ANTHROPIC_API_KEY not configured', ${gate.username})
      ON CONFLICT (lang) DO NOTHING`);
    return NextResponse.json(
      { ok: false, error: "ANTHROPIC_API_KEY not configured — language added, seed skipped" },
      { status: 500 },
    );
  }

  await db.execute(sql`
    INSERT INTO public.dashboard_copy_languages (lang, label, seed_status, created_by)
    VALUES (${lang}, ${label}, 'seeding', ${gate.username})
    ON CONFLICT (lang) DO UPDATE SET
      label = EXCLUDED.label,
      seed_status = 'seeding',
      seed_error = NULL`);

  // What already exists in this language, so a re-seed leaves human corrections alone.
  const existing = new Set(
    rowsOf<CopyRow>(
      await db.execute(sql`
        SELECT modal_key, field_key, value, source
        FROM public.dashboard_copy_canon WHERE lang = ${lang}`),
    )
      .filter((r) => r.source === "human")
      .map((r) => `${r.modal_key}.${r.field_key}`),
  );

  // The payload: every registered English string not already fixed by a human. Flat id → text,
  // because a flat map is the one shape a model returns reliably and a nested one is not.
  const payload: Record<string, string> = {};
  const context: Record<string, string> = {};
  for (const m of DASHBOARD_COPY_REGISTRY) {
    for (const f of m.fields) {
      const id = `${m.key}.${f.key}`;
      if (existing.has(id)) continue;
      payload[id] = f.default;
      context[id] = `${m.label} (${m.tab}) — ${f.label} [${f.kind}]${f.note ? ` — ${f.note}` : ""}`;
    }
  }

  if (!Object.keys(payload).length) {
    await db.execute(sql`
      UPDATE public.dashboard_copy_languages
      SET seed_status = 'ready', seeded_at = now(), seed_error = NULL WHERE lang = ${lang}`);
    return NextResponse.json({ ok: true, lang, seeded: 0, note: "Nothing left to translate" });
  }

  let translated: Record<string, string> = {};
  try {
    const anthropic = new Anthropic({ apiKey: key });
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      system:
        "You translate UI copy for a web dashboard. You will receive a JSON object of id → English " +
        "string, and a JSON object of id → context describing where each string appears and what " +
        "kind of element it is. Translate every value into the requested language, keeping the " +
        "tone of product UI: plain, warm, second person, no marketing language. Preserve typographic " +
        "punctuation (’ — …) exactly as in the source. Keep button and label strings short enough to " +
        "fit the same control. Do NOT translate product or brand names. Reply with ONLY a JSON " +
        "object of the same ids mapped to the translated strings — no prose, no code fence.",
      messages: [
        {
          role: "user",
          content:
            `Target language: ${label} (${lang}).\n\n` +
            `CONTEXT:\n${JSON.stringify(context, null, 2)}\n\n` +
            `STRINGS:\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
    });
    const text = msg.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("");
    // A model that ignores "no code fence" is a formatting slip, not a failure — strip it.
    const json = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    translated = JSON.parse(json) as Record<string, string>;
  } catch (e) {
    const message = String((e as Error)?.message ?? e).slice(0, 500);
    await db.execute(sql`
      UPDATE public.dashboard_copy_languages
      SET seed_status = 'failed', seed_error = ${message} WHERE lang = ${lang}`);
    return NextResponse.json({ ok: false, error: `Translation failed: ${message}` }, { status: 502 });
  }

  let seeded = 0;
  for (const [id, value] of Object.entries(translated)) {
    if (typeof value !== "string" || !value.trim()) continue;
    const dot = id.indexOf(".");
    if (dot < 1) continue;
    const modalKey = id.slice(0, dot);
    const fieldKey = id.slice(dot + 1);
    // The model's own output is untrusted input: only registered ids are written, so a
    // hallucinated key cannot create a row.
    if (!knownField(modalKey, fieldKey)) continue;
    await db.execute(sql`
      INSERT INTO public.dashboard_copy_canon
        (lang, modal_key, field_key, value, source, updated_at, updated_by)
      VALUES (${lang}, ${modalKey}, ${fieldKey}, ${value.slice(0, 4000)}, 'machine', now(), ${gate.username})
      ON CONFLICT (lang, modal_key, field_key) DO UPDATE SET
        value = EXCLUDED.value,
        source = 'machine',
        updated_at = now(),
        updated_by = EXCLUDED.updated_by
      WHERE public.dashboard_copy_canon.source <> 'human'`);
    seeded += 1;
  }

  await db.execute(sql`
    UPDATE public.dashboard_copy_languages
    SET seed_status = 'ready', seeded_at = now(), seed_error = NULL WHERE lang = ${lang}`);

  await db.insert(schema.adminAuditLog).values({
    actorUserId,
    action: "platform.dashboard_copy_seed",
    targetType: "dashboard_copy_language",
    targetId: lang,
    before: null,
    after: { lang, label, seeded },
    note: `Auto-seeded ${seeded} dashboard copy strings into ${label} (${lang}) by ${gate.username}`,
  });

  return NextResponse.json({ ok: true, lang, label, seeded });
}
