// /api/hardening/privacy — Utils → System Hardening → Privacy & Data.
//   GET  → { ok, migrated, consents, requests, pending, keys, cron, at }
//   POST → { op: "cancel", memberId }     restore a member inside the soft window (mirrors module cancelErasure)
//        | { op: "erase-now", memberId }  pull erase_after to now() — the nightly erase cron on TGV does the deletion
//                                         (Keycloak / Stripe / blobs live in TGV's lib, not here)
// Raw SQL over the shared tgv_db pool — Office carries no @tgv/module-privacy dependency.
import fs from "node:fs";
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import { pgPool } from "@/lib/pg-pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TGV_DIR = "/srv/refusion-core/clients/tinyglobalvillage.com";
const DEMO_DIR = "/srv/refusion-core/clients/demo-hq";
const CRON_LOG = `${TGV_DIR}/data/privacy/erase-cron.log`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Presence only — the value is never read into a response. */
function keyPresent(dir: string): boolean | null {
  try {
    const env = fs.readFileSync(`${dir}/.env.local`, "utf8");
    return /^PRIVACY_FIELD_KEY=\S+/m.test(env);
  } catch { return null; }
}

function cronStatus(): { logAt: string | null; lastLines: string[] } {
  try {
    const st = fs.statSync(CRON_LOG);
    const raw = fs.readFileSync(CRON_LOG, "utf8").trimEnd();
    return { logAt: st.mtime.toISOString(), lastLines: raw ? raw.split("\n").slice(-6) : [] };
  } catch { return { logAt: null, lastLines: [] }; }
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const base = { at: new Date().toISOString(), keys: { tgv: keyPresent(TGV_DIR), demo: keyPresent(DEMO_DIR) }, cron: cronStatus() };
  try {
    const [consents, reqs, openCounts, pending] = await Promise.all([
      pgPool.query(`SELECT purpose, COUNT(*) FILTER (WHERE withdrawn_at IS NULL AND granted) AS active,
                           COUNT(*) FILTER (WHERE withdrawn_at IS NOT NULL OR NOT granted) AS withdrawn
                    FROM consent_records GROUP BY purpose ORDER BY purpose`),
      pgPool.query(`SELECT r.id, r.member_id, m.email, r.kind, r.status, r.note, r.created_at, r.due_at, r.completed_at
                    FROM privacy_requests r LEFT JOIN members m ON m.id = r.member_id
                    ORDER BY r.created_at DESC LIMIT 50`),
      pgPool.query(`SELECT kind, COUNT(*) AS n FROM privacy_requests WHERE status = 'open' GROUP BY kind`),
      pgPool.query(`SELECT m.id, m.email, m.deleted_at, m.erase_after,
                           (SELECT id FROM privacy_requests r WHERE r.member_id = m.id AND r.kind = 'erase' AND r.status = 'open' ORDER BY created_at DESC LIMIT 1) AS request_id
                    FROM members m WHERE m.deleted_at IS NOT NULL AND m.erase_after IS NOT NULL ORDER BY m.erase_after ASC`),
    ]);
    return NextResponse.json({
      ok: true, migrated: true, ...base,
      consents: consents.rows.map((r) => ({ purpose: r.purpose, active: Number(r.active), withdrawn: Number(r.withdrawn) })),
      openByKind: Object.fromEntries(openCounts.rows.map((r) => [r.kind, Number(r.n)])),
      requests: reqs.rows.map((r) => ({
        id: r.id, memberId: r.member_id, email: r.email ?? null, kind: r.kind, status: r.status, note: r.note ?? null,
        createdAt: iso(r.created_at), dueAt: iso(r.due_at), completedAt: iso(r.completed_at),
      })),
      pending: pending.rows.map((r) => ({
        memberId: r.id, email: r.email ?? null, deletedAt: iso(r.deleted_at), eraseAfter: iso(r.erase_after), requestId: r.request_id ?? null,
      })),
    });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "42P01" || code === "42703") return NextResponse.json({ ok: true, migrated: false, ...base, consents: [], openByKind: {}, requests: [], pending: [] });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e), ...base }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as { op?: string; memberId?: string };
  const memberId = String(body.memberId ?? "");
  if (!UUID.test(memberId)) return NextResponse.json({ error: "memberId must be a uuid" }, { status: 400 });

  if (body.op === "cancel") {
    const client = await pgPool.connect();
    try {
      await client.query("BEGIN");
      const upd = await client.query(
        `UPDATE members SET deleted_at = NULL, erase_after = NULL, updated_at = now()
         WHERE id = $1::uuid AND deleted_at IS NOT NULL AND erase_after IS NOT NULL AND erase_after > now() RETURNING email`,
        [memberId],
      );
      if (!upd.rowCount) { await client.query("ROLLBACK"); return NextResponse.json({ error: "not scheduled, or already past the window" }, { status: 409 }); }
      const r = await client.query(
        `UPDATE privacy_requests SET status = 'cancelled', completed_at = now(), note = COALESCE(note || ' · ', '') || $2
         WHERE member_id = $1::uuid AND kind = 'erase' AND status = 'open' RETURNING result`,
        [memberId, `cancelled by office:${auth.username}`],
      );
      const res = (r.rows[0]?.result ?? {}) as { removedVillager?: string[]; removedClients?: string[] };
      for (const siteId of res.removedVillager ?? []) {
        await client.query(`UPDATE villager SET status = 'active' WHERE member_id = $1::uuid AND site_id = $2::uuid AND status = 'removed'`, [memberId, siteId]).catch(() => {});
      }
      for (const siteId of res.removedClients ?? []) {
        await client.query(`UPDATE villager_clients SET status = 'active' WHERE member_id = $1::uuid AND site_id = $2::uuid AND status = 'removed'`, [memberId, siteId]).catch(() => {});
      }
      await client.query("COMMIT");
      logHardeningAction({ action: "privacy.erase_cancel", target: memberId, user: auth.username, success: true, details: { email: upd.rows[0]?.email ?? null } });
      return NextResponse.json({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      logHardeningAction({ action: "privacy.erase_cancel", target: memberId, user: auth.username, success: false, details: String(e) });
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    } finally { client.release(); }
  }

  if (body.op === "erase-now") {
    const upd = await pgPool.query(
      `UPDATE members SET erase_after = now(), updated_at = now()
       WHERE id = $1::uuid AND deleted_at IS NOT NULL AND erase_after IS NOT NULL AND golden IS NOT TRUE RETURNING email`,
      [memberId],
    );
    const ok = !!upd.rowCount;
    logHardeningAction({ action: "privacy.erase_due_now", target: memberId, user: auth.username, success: ok, details: { email: upd.rows[0]?.email ?? null } });
    if (!ok) return NextResponse.json({ error: "not scheduled (or golden)" }, { status: 409 });
    return NextResponse.json({ ok: true, note: "due now — the 03:30 erase cron on TGV deletes it tonight" });
  }

  return NextResponse.json({ error: "unknown op" }, { status: 400 });
}
