# FrontDeskDrawer — Reference

The Front Desk module: a gold accent drawer housing four tabs — Phone, SMS,
Contacts, Alerts — plus a global incoming-call overlay. Replaces the legacy
`AlertsDrawer`; announcements now live inside the Alerts tab.

Source: [FrontDeskDrawer.tsx](FrontDeskDrawer.tsx). Tab components are under
[frontdesk/](frontdesk/). API routes live at `src/app/api/frontdesk/`. Storage
libs + types at `src/lib/frontdesk/`. FreeSWITCH config templates at
`telephony/`.

---

## 1. Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                         Browser (Next.js)                          │
│                                                                    │
│   FrontDeskDrawer   ─ PhoneTab  ─ DTMF keypad + admin bar           │
│                     ─ SmsTab                                        │
│                     ─ ContactsTab                                   │
│                     ─ AlertsTab ─ AnnouncementsPanel                │
│                                                                    │
│   IncomingCallOverlay  (mounted in ClientShell, polls every 2.5s)  │
└────────────────────────────────────────────────────────────────────┘
                 │                                         ▲
      fetch /api/frontdesk/*                               │
                 ▼                                         │
┌────────────────────────────────────────────────────────────────────┐
│                         Next.js API routes                         │
│                                                                    │
│   dids/      shift/    contacts/   calls/   sms/   alerts/         │
│                                                                    │
│   persist:  data/frontdesk/*.json                                  │
│   telnyx:   src/lib/frontdesk/telnyx.ts (REST + Ed25519 webhook)   │
│   esl:      src/lib/frontdesk/esl.ts    (localhost:8021)           │
└────────────────────────────────────────────────────────────────────┘
          │                                         ▲
  REST + webhooks                              ESL cmd/events
          ▼                                         │
┌──────────────────┐                  ┌──────────────────────────────┐
│      Telnyx      │  SIP trunk       │  FreeSWITCH (systemd)        │
│  DIDs / SMS API  │ ◄──────────────► │  external/telnyx + internal  │
│  Call Control    │                  │  /webrtc profiles + dialplan │
└──────────────────┘                  └──────────────────────────────┘
```

## 2. Tabs

### Phone
DID line card, DTMF keypad, recent-calls log, admin bar. Admin bar shows
current shift-worker; exec users (`admin`, `marmar`) get buttons to open the
`ShiftWorkerModal` and `DidManagerModal`.

Listens for: `frontdesk-dial-prefill` → prefills the dial input.

### SMS
Thread list → conversation view. "Call this number" dispatches
`frontdesk-dial-prefill`. Polls every ~10s.

### Contacts
Scope chips (All / Clients / Employees) + search + hover row actions:
Call, SMS, Edit, Delete. The contact card modal handles CRUD.

### Alerts
Primary: inbound form-email inquiries (web forms POST to
`/api/frontdesk/alerts/intake` with `x-frontdesk-intake-token`). Secondary:
`AnnouncementsPanel`.

## 3. Ring flow

1. Telnyx `call.initiated` webhook → `/api/frontdesk/calls/webhook` creates
   a `CallRecord` with `ringTarget`:
   - DID assignment = user       → `ringTarget = <username>`
   - DID assignment = frontdesk  → `ringTarget = shift.username ?? "*"`
   - DID unassigned              → `ringTarget = "*"` (voicemail-only in dialplan)
2. `IncomingCallOverlay` polls `/api/frontdesk/calls/incoming`. If the call
   targets me or has `ringTarget === "*"`, the gold overlay appears.
3. Server-side `setTimeout` (30s) promotes a direct ring to `"*"` if not
   answered.
4. `Accept` → POST `/api/frontdesk/calls/answer` → Telnyx `actions/answer`.
5. `Decline` or `Voicemail` → POST `/api/frontdesk/calls/reject` → Telnyx
   `actions/hangup`; the FreeSWITCH dialplan owns the voicemail prompt.
6. `Team` → promotes the ring to `"*"` without hanging up (joins ring-all).

## 4. Storage layout

JSON-backed fs storage under `data/frontdesk/`:
- `dids.json`     — registered DIDs + assignment
- `shift.json`    — today's shift-worker
- `contacts.json` — clients + employees
- `calls.json`    — last 2000 call records (ring target, recording paths, etc.)
- `sms.json`      — message log
- `alerts.json`   — inbound form inquiries

## 5. FreeSWITCH

Templates in [telephony/](../../../telephony/). Install with:

```bash
sudo /srv/refusion-core/utils/scripts/telephony/install-freeswitch.sh
sudo /srv/refusion-core/utils/scripts/telephony/render-freeswitch-config.sh
```

ESL bridge in [src/lib/frontdesk/esl.ts](../../lib/frontdesk/esl.ts). Used by
future dialplan socket() handoffs to steer calls to the ring-target user's
WebRTC endpoint.

## 6. Environment

See [.env.example](../../../.env.example). Until Telnyx is provisioned the
module stays online — API routes return 503 for actions that need Telnyx, and
the incoming-call overlay remains idle.

## 7. Exec gating

Hardcoded `EXEC_USERNAMES = new Set(["admin", "marmar"])` in `PhoneTab.tsx` +
server-side `isExec` check in `/api/frontdesk/dids` (POST/DELETE) and
`/api/frontdesk/shift` (PUT). Non-exec users can dial, read calls, send SMS,
edit contacts — they just can't provision DIDs or change the shift-worker.

## 8. Popout

`/dashboard/frontdesk?popout=1&tab=<name>` — chromeless window. The tab pill
menu's popout button dispatches this.
