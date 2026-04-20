# components/call — Outline

Pointer index for [README.md](README.md). Load this first, jump to a section by anchor.

Shared LiveKit call stack used by **both** SessionsDrawer (as a full room surface) and ChatDrawer (as an inline call strip on DMs/groups). The two drawers are two UI skins on top of a single call engine — never fork this logic per-drawer.

---

## 1. Files

- 1.1 [CallSurface.tsx](README.md#file-callsurface) — `LiveKitRoom` provider + `VideoConference` + local wrappers
- 1.2 [CallButton.tsx](README.md#file-callbutton) — accent-tinted icon button used in chat headers + room headers
- 1.3 [IncomingCallToast.tsx](README.md#file-incoming-toast) — global ringing toast
- 1.4 [useCallToken.ts](README.md#hook-usecalltoken) — fetches LiveKit token for a room, handles refresh + error
- 1.5 [useIncomingCall.ts](README.md#hook-useincoming) — polls `/api/chat/ring`, exposes current ringing channel

## 2. Contracts

- 2.1 [CallSurface props + modes](README.md#contract-callsurface)
- 2.2 [CallButton props + variants](README.md#contract-callbutton)
- 2.3 [IncomingCallToast actions (reject / accept-switch / accept-notify)](README.md#contract-toast)
- 2.4 [Channel key convention](README.md#contract-channel)

## 3. Consumers

- 3.1 [SessionsDrawer — full room surface](README.md#consumer-sessions)
- 3.2 [ChatDrawer — inline DM/group call strip](README.md#consumer-chat)
- 3.3 [ClientShell — global IncomingCallToast mount](README.md#consumer-shell)

## 4. Backend dependencies

- 4.1 [`/api/livekit/token` — per-room ACL](README.md#be-token)
- 4.2 [`/api/chat/ring` — ring signalling](README.md#be-ring)
- 4.3 [`/api/sessions` — session registry](README.md#be-sessions)
