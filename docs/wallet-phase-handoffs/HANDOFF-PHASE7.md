# HANDOFF — Phase 7: Office Wallet Control Modal (member withdrawals)

> **You are in the OFFICE repo worktree.** Branch `feature/wallet-control-modal` off `main` @ `5fbd5c1`
> (the "Invitations hardening tile + control modal" commit — your closest reference impl).
> Worktree: `/home/admin/.claude/worktrees/office.tinyglobalvillage.com/wallet-control-modal`.
> This is the FINAL phase of the 3-bucket wallet feature. Phases 0–6 are DONE in the **tgv.com** lane
> (a separate repo/worktree: `feature/wallet-3bucket-retainer`, see its `HANDOFF.md`). This file is
> self-contained — the tgv.com contracts you need are embedded below because they aren't merged to
> tgv.com `main` yet.
>
> **Mode call:** routine-build → **sonnet @ medium–high** (an HCM/console over existing shells +
> tgv_db reads + an internal-API proxy). Bump to opus only if the cross-app mutation wiring (§3) gets
> gnarly or you touch money code (the gear "retainer move", §6).
>
> **Scaffolding:** this `HANDOFF-PHASE7.md` is untracked — read it, don't commit it into the PR.

---

## Goal
Build a **`WalletControlModal`** — the operator console for member cash-out (withdrawals) — as a
System-Hardening tile in TGV Office (Utils → System Hardening). Per CLAUDE.md §Hardening UTILS
Surfaces + [[project_dashboard_modal_admin_gear]]: "never invisible to admin, always visually
editable." It surfaces + drives the **Phase 5 withdrawal backend that lives on tgv.com**. Withdrawals
ship **gated OFF** until identity (KYC) + clawback land, so the operator's first real job here is the
**killswitch + limits config** and **watching the audit timeline** — the live queue is empty until the
launch flag flips in a sandbox.

---

## 1. The Phase 5 backend you're a client over (embedded contracts — on tgv.com)
These endpoints exist on **tinyglobalvillage.com** (tgv.com), gated by a tgv.com 2FA member session
whose email is on `TGV_SUPER_USER_EMAILS`. They are NOT on Office and NOT yet on tgv.com `main`
(they're on the `feature/wallet-3bucket-retainer` branch). Canonical source for the full picture:
the tgv.com worktree `HANDOFF.md` §Phase 5 + §Phase 6, and these files in that worktree:
`src/app/api/wallet/withdrawal/{config,advance}/route.ts`, `src/lib/wallet/{withdrawal,withdrawal-config}.ts`,
`src/db/schemas/withdrawals.ts`.

**A) `GET/PUT /api/wallet/withdrawal/config`** — the runtime controls (a JSON file on tgv.com's disk,
read fresh, no redeploy). **NOT** launch-gated (must stay editable to flip the killswitch before launch).
- `GET` → `{ config: WithdrawalConfig, defaults: WithdrawalConfig, gate: { launchEnabled, killswitchEnabled, live } }`
- `PUT` (partial `WithdrawalConfig`) → `{ ok:true, config, gate }`. Merges onto current, normalizes, audits before/after.
- `WithdrawalConfig` fields (each gets a **QMBM** in the modal):
  | field | meaning |
  |---|---|
  | `enabled` (bool) | operator **killswitch** (runtime pause; key #2 of the live gate) |
  | `rail` (`operator_advance`\|`stripe_payout`) | payout executor seam. `stripe_payout` is a STUB (throws) until payments-platform Phase 3 |
  | `maxPerPeriodTokens` (int, 0=∞) + `periodDays` | rolling per-period cap (fraud blast-radius lever; seeded unlimited) |
  | `perRequestMaxTokens` (int, 0=∞) | per-withdrawal ceiling |
  | `minTokens` (int, 0=none) | floor per withdrawal |
  | `cooldownHours` (int) | throttle between a member's requests |
  | `holdHours` (int) | fraud-review window after `requested` before `paid` is allowed |
  | `offerInstant` (bool) + `instantFeeBps` (int) | instant-payout tier — **inert** until `stripe_payout` |
  | `requireVerifiedIdentity` (bool) | KYC hard-gate (stub returns false → blocks all withdrawals while true) |
- **Two-key live gate** (surface BOTH, distinctly): withdrawals are live only when env
  `WITHDRAWALS_ENABLED==='1'` (the **launch** flag — redeploy-bound, NOT editable from the modal) AND
  `config.enabled===true` (the **killswitch** — editable here). The `gate` object tells you all three.

**B) `GET /api/wallet/withdrawal/advance`** (operator queue) — **launch-gated** (403 `withdrawals_not_available`
while the env flag is off). `?op=list[&statuses=requested,approved|all][&limit=N]` →
`{ env, count, withdrawals: WithdrawalRow[] }`.

**C) `POST /api/wallet/withdrawal/advance`** (operator transitions) — launch-gated, audited per transition:
`{ op:'approve'|'markPaid'|'markFailed'|'cancel', withdrawalId, externalRef?, note? }`.
- `approve`: requested→approved. `markPaid`: approved→paid (**requires `externalRef`**; runs the rail
  seam — `stripe_payout` throws `rail_not_implemented` **501**, only `operator_advance` works today).
  `markFailed`/`cancel`: → failed/cancelled and **reverse the cash debit** (money logic — must run
  tgv.com's engine, do NOT re-implement).

**`WithdrawalRow`** (tgv_db `withdrawals` table): `id`(uuid), `memberUserId`, `env`, `amountTokens`,
`amountCents`, `status`(requested\|approved\|paid\|failed\|cancelled), `rail`, `externalRef`, `note`,
`requestedAt`, `updatedAt`. 1 token = $0.25.

**Audit actions** in `admin_audit_log` (your Activity Timeline source): `wallet.withdrawal_approve`,
`wallet.withdrawal_paid`, `wallet.withdrawal_failed`, `wallet.withdrawal_cancel`,
`wallet.withdrawal_config_update`.

---

## 2. Office architecture (from recon — exact paths in THIS worktree)
- **Direct shared-DB access:** Office connects straight to **tgv_db** (`src/lib/pg-pool.ts` via
  `DATABASE_URL`; Drizzle in `src/lib/db-drizzle.ts` using the `@tgv/module-registry/db` schema). Office
  can READ `withdrawals` + `admin_audit_log` directly — exactly how the Invitations modal reads
  `invite_codes`/`invite_redemptions`.
- **Office→tgv.com server-to-server:** the established pattern is an internal-secret call —
  `fetch(\`${TGV_BASE_URL}/api/internal/...\`, { headers: { 'x-internal-secret': INTERNAL_API_SECRET }})`.
  `INTERNAL_API_SECRET` is in Office `.env.local` (set 2026-06-12); `TGV_BASE_URL` defaults to
  `https://tinyglobalvillage.com`. Ref: `src/app/api/admin/invitations/route.ts` (calls tgv.com for the
  branded invite email).
- **Admin gate:** `requireAdmin()` in `src/lib/api-admin.ts` (→ `requireAuth()` + Office staff roster
  `data/office-staff.json` role==='admin'). **Office does NOT use `TGV_SUPER_USER_EMAILS`** — gate your
  new `/api/admin/wallet/*` routes with `requireAdmin()`.
- **Session SSO:** Office shares the `tgv_member_session` cookie (domain `.tinyglobalvillage.com`) with
  tgv.com (`src/lib/member-auth/config.ts`), validated against `member_sessions` in tgv_db.

---

## 3. ⚠️ THE ONE OPEN DECISION — the cross-app data path (confirm with Gio)
tgv.com's wallet endpoints (§1) are gated by a tgv.com **browser super-user session**, not by the
internal secret. The withdrawal **engine** (the ledger refunds on fail/cancel, the config-file write)
lives in tgv.com's `src/lib/wallet/*` — **not a shared `@tgv` package**, so Office CANNOT import it.
Re-implementing those mutations in Office would duplicate money/ledger logic — forbidden.

**Recommended architecture (Option A — proxy, lowest duplication):**
- **Reads** (queue list + audit timeline): Office `/api/admin/wallet/*` routes read **tgv_db directly**
  (`withdrawals` for the queue, `admin_audit_log` for the timeline) — mirrors Invitations, resilient if
  tgv.com is down, no new tgv.com code needed.
- **Mutations + config write** (`approve`/`markPaid`/`markFailed`/`cancel`, `PUT config`): Office routes
  **proxy to tgv.com** with `INTERNAL_API_SECRET` so the canonical engine runs.
- **CROSS-REPO PREREQUISITE (flag for Gio + do in the tgv.com wallet branch, not here):** the 3 tgv.com
  wallet routes currently accept ONLY a super-user session. To call them server-to-server from Office,
  add an `x-internal-secret` auth branch to `/api/wallet/withdrawal/{config,advance}/route.ts`
  (mirroring `/api/internal/send-invite`) **OR** add thin `/api/internal/wallet/*` wrappers around the
  lib fns. Small, well-scoped; it belongs on the `feature/wallet-3bucket-retainer` branch so the whole
  feature merges coherently. **Until it exists, Phase 7 can ship the READ-only slice** (config GET via a
  shared-file read or a temporary direct read, queue + timeline from tgv_db) and wire mutations once the
  internal-auth lands.
- *Option B (rejected):* Office writes `withdrawals`/`admin_audit_log` directly for transitions — NO, the
  fail/cancel refund is ledger money logic that must run tgv.com's engine.

**Phased MVP (recommended first cut):** (1) config read + **killswitch/limits editor** via tgv.com
(the most valuable control today) + (2) the **Activity Timeline** from tgv_db `admin_audit_log` + (3)
the queue list from tgv_db (empty until launch). Defer live approve/pay wiring until withdrawals near
launch — there are zero rows to act on while gated off.

---

## 4. HCM shape (CLAUDE.md §Hardening UTILS Surfaces — follow exactly) + reuse targets
All present in this worktree (cut from main) — READ them, clone the Invitations modal:
1. **Activity Timeline at the TOP** — `AuditLogTimeline` (`src/app/components/hardening/_shared/AuditLogTimeline.tsx`),
   props `{ endpoint, kindLabels? }`, expects the endpoint to return `{ rows: TimelineRow[] }`. Point it
   at a new `/api/admin/wallet/audit-feed` that merges `withdrawals` state-changes ∪ `admin_audit_log`
   withdrawal actions, filterable by kind.
2. **HCM shell** — `HardeningControlModal` (`src/app/components/hardening/HardeningControlModal.tsx`):
   props `{ title, subtitle?, qmbm?, sections: HCMSection[], globalSystemViews, auditLogView, onClose }`.
   **QMBM is built into the shell** — pass a `qmbm` string on the modal and on each `HCMSection`
   (`{ id, title, qmbm?, body }`). **Do NOT create a new QMBM/InfoBubble component** (CLAUDE.md §Before
   creating components) — the shell already renders the "?" bubble.
3. **Wallet-specific sections** — config editor (one input per `WithdrawalConfig` field, each with its
   `qmbm`), the withdrawal queue table (status pills + approve/pay/fail/cancel actions), the two-key
   gate posture banner.
4. **RCS-wide global views at the BOTTOM, ALWAYS** — `Fail2banGlobalView` + `UfwGlobalView`
   (`src/app/components/hardening/_shared/`), passed as `globalSystemViews`. Don't tunnel-vision on the
   wallet slice.
5. **Reference impl to clone:** `src/app/components/hardening/invitations/InvitationsControlModal.tsx`
   (editable table + form + status pills + `AuditLogTimeline` + global views; its API routes
   `src/app/api/admin/invitations/{route,audit-feed/route}.ts` are the template for your
   `/api/admin/wallet/*` routes — `requireAdmin()` + tgv_db reads + best-effort internal call).
6. **Gear menu** ([[project_dashboard_modal_admin_gear]]): pattern in `src/app/dashboard/utils/page.tsx`
   (`GearBtn`, `showGear = isAdmin && …`). Put the locked **"move Retainer → Available/Cash"** admin
   action behind a section gear. ⚠️ That move is **net-new money code that doesn't exist yet** — it
   needs a small super-user/internal tgv.com endpoint (a single-tx `token_ledger` relocate, audited) on
   the tgv.com branch + a reviewer pass. Flag it; don't fake it client-side.

**Register the tile** in `src/app/dashboard/utils/page.tsx` under the **System Hardening** group
(admin-only). Recipe (line numbers approx — confirm against the file): add `"wallet-control"` to the
`HardeningKind` union + the `TileSpec` union + the hardening `SECTIONS` tiles array; add a
`HardeningTile` render branch (after invitations); add the `{openHardening === "wallet-control" && <WalletControlModal …/>}`
instance; import the modal at the top. New modal lives at
`src/app/components/hardening/wallet-control/WalletControlModal.tsx`.

---

## 5. Build / verify plumbing
- **PM2:** `office.tinyglobalvillage.com`. Live build: `npm run build && pm2 reload office.tinyglobalvillage.com --update-env`.
- **No `trailingSlash`** in Office (unlike tgv.com) → your Office API URLs have **NO** trailing slash.
- **DON'T `next build` in this worktree** (RAM-tight box; one build at a time; and worktree builds
  fail module resolution — see below).
- **tsc recipe (CONFIRMED for the sibling tgv.com lane — same applies here):** deps are pnpm-hoisted to
  `/srv/refusion-core/node_modules`; this worktree lives at `/home/admin/.claude/worktrees/…` whose
  ancestors never include the workspace root, so tsc-in-worktree fails with bogus `Cannot find module
  'react'`. Run it INSIDE `/srv/refusion-core/clients/`:
  ```
  rsync -a --exclude node_modules --exclude .next --exclude .git --exclude .turbo \
    /home/admin/.claude/worktrees/office.tinyglobalvillage.com/wallet-control-modal/ \
    /srv/refusion-core/clients/_tmp-wallet-office/
  ln -s /srv/refusion-core/clients/office.tinyglobalvillage.com/node_modules /srv/refusion-core/clients/_tmp-wallet-office/node_modules
  cd /srv/refusion-core/clients/_tmp-wallet-office && \
    NODE_OPTIONS=--max-old-space-size=4096 /srv/refusion-core/node_modules/.bin/tsc -p tsconfig.json --noEmit
  rm -rf /srv/refusion-core/clients/_tmp-wallet-office
  ```
  (Establish the Office baseline error count on your first run, then ensure your change adds 0.)
- `node_modules` is already symlinked into this worktree (→ live office install) for editor convenience.
- Scope commits by explicit path (shared client, never `git add -A`). Reviewer pass before commit;
  treat the retainer-move endpoint (if you build it) as money-code (adversarial review).

---

## 6. When Phase 7 is done
This completes the wallet feature (Phases 0–7). Then:
1. Merge **both** feature branches: tgv.com `feature/wallet-3bucket-retainer` (`/feature done` in that
   worktree) AND office `feature/wallet-control-modal` (`/feature done` here).
2. Run the **manual `stripe listen` + browser test-card pass** flagged across the tgv.com `HANDOFF.md`
   (the only un-headless-verifiable legs: real Checkout → mint, real refund → clawback).
3. Deploy via `gitrefuse`. **DO NOT flip `WITHDRAWALS_ENABLED` live** until identity (KYC) + clawback
   ship — a `paid` withdrawal is irreversible money out.

---

## Related
- **tgv.com worktree** (the backend you wrap): `/home/admin/.claude/worktrees/tinyglobalvillage.com/wallet-3bucket-retainer/`
  — `HANDOFF.md` §Phase 5 (endpoint contracts) + §Phase 6 (the storefront client `WalletPanel.tsx`).
- Memories: [[project_dashboard_modal_admin_gear]], [[project_tgv_token_wallet_two_balances]] (3-bucket
  model), [[project_tgv_money_topology]] (rail = Stripe payout from platform balance),
  [[project_office_tgv_share_membership_db]] (shared tgv_db — your direct-read basis),
  [[tgv-payments-platform]] (Phase 3 = the payout executor the `stripe_payout` rail later calls).
- Checklist: `~/.claude/checklist/wallet-3bucket-withdrawal-phase5.md`.
- CLAUDE.md §Hardening UTILS Surfaces (the HCM contract) + §Before creating components (reuse the shell's QMBM).
