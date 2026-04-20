# components/call — Reference

Shared LiveKit call stack. Outline: [OUTLINE.md](OUTLINE.md).

**Core principle:** one call engine, many UI surfaces. SessionsDrawer shows it as a full room (video tiles fill the pane). ChatDrawer shows it as an inline strip above the message list. Both surfaces call into the same primitives in this directory.

Never fork call logic per-drawer. If you find yourself writing a second LiveKit connection flow elsewhere, stop and lift it in here instead.

---

<a id="file-callsurface"></a>
## 1.1 CallSurface.tsx

The LiveKit-provider-plus-video-ui block. Internally:

```tsx
<LiveKitRoom token={token} serverUrl={LIVEKIT_URL} connect audio video={!observer}>
  <VideoConference />  {/* from @livekit/components-react */}
  <CallSurfaceSlot>{children}</CallSurfaceSlot> {/* optional children overlay */}
</LiveKitRoom>
```

Dynamic-imported client-side only (`ssr: false`) because `@livekit/components-react` touches `window`.

<a id="file-callbutton"></a>
## 1.2 CallButton.tsx

Accent-tinted icon button. Variants:

- `call` — green phone glyph, starts/joins a call
- `video` — green video glyph, starts/joins with camera
- `mute-mic` / `mute-cam` — red "off" or neutral "on" depending on state
- `leave` — red NeonX-style phone-hangup glyph (distinct from drawer-close NeonX)

Uses existing icons from [../icons/index.ts](../icons/index.ts): `PhoneIcon`, `VideoIcon`, `MicIcon`, `StopIcon`.

<a id="file-incoming-toast"></a>
## 1.3 IncomingCallToast.tsx

Mounted globally in `ClientShell` (see §3.3). Listens to `useIncomingCall()` and renders a themed toast when a ring lands. Toast shows caller avatar + name + channel context + three action buttons.

<a id="hook-usecalltoken"></a>
## 1.4 useCallToken.ts

```ts
function useCallToken(roomName: string | null): {
  token: string | null;
  error: Error | null;
  refresh: () => void;
}
```

POSTs to `/api/livekit/token` with `{ room: roomName }`. Null `roomName` → no fetch (hook is inert). Handles 403 (banned / not a member / pair-cap) by surfacing a typed error so the caller can show an inline message.

<a id="hook-useincoming"></a>
## 1.5 useIncomingCall.ts

Polls `/api/chat/ring?for=me` every 2s (same cadence as typing indicator). Returns:

```ts
{
  ring: {
    from: { id, name, avatar };
    channel: { type: "dm" | "group" | "session"; id: string; name: string };
    startedAt: string;
  } | null;
  reject: () => void;
  acceptSwitch: () => void;     // leaves current, joins new
  acceptNotify: () => void;     // joins new in observer mode, posts "be right there"
}
```

The "accept-notify" path is the newer expanded UX (see SessionsDrawer §4.3) — not a naive auto-decline.

---

<a id="contract-callsurface"></a>
## 2.1 CallSurface props + modes

```ts
type CallSurfaceProps = {
  room: string;                   // channel key, see §2.4
  mode?: "active" | "observer";   // observer = mic+cam forced off on join
  layout?: "full" | "strip";      // "full" = video-conference grid (Sessions); "strip" = slim audio-first row (Chat)
  onLeave?: () => void;
  children?: React.ReactNode;     // overlay slot
};
```

`layout="strip"` renders a compact bar (participant chips + mute toggles + leave) instead of the full `VideoConference` grid. Same underlying `LiveKitRoom` connection either way — the swap is purely UI.

<a id="contract-callbutton"></a>
## 2.2 CallButton props

```ts
type CallButtonProps = {
  variant: "call" | "video" | "mute-mic" | "mute-cam" | "leave";
  accent?: "green" | "pink" | "cyan" | "red";   // default "green"
  size?: "sm" | "md";
  active?: boolean;                             // for mute toggles, inverted state
  onClick: () => void;
  title?: string;                               // tooltip text
};
```

<a id="contract-toast"></a>
## 2.3 IncomingCallToast actions

Three buttons, always in this order:

1. **Reject** — red, fires `reject()`; caller sees "declined".
2. **Accept & Switch** — neutral, fires `acceptSwitch()`; leaves any current call.
3. **Accept & Notify** — neutral, fires `acceptNotify()`; joins new call in observer mode + auto-posts "be right there" in the new channel.

Buttons are icon-first on narrow screens, icon-plus-label on wide.

<a id="contract-channel"></a>
## 2.4 Channel key convention

Used everywhere a room is referenced (`/api/livekit/token`, `/api/chat/ring`, `CallSurface.room`, `useCallToken`):

- `dm:<sortedPairAZ>` — 1:1 DM call (pair of user IDs, sorted lexicographically)
- `group:<groupId>` — group chat call
- `session:lounge` — the Lounge
- `session:study-<n>` / `session:pair-<n>` — seeded Study / Pair rooms
- `session:user-<uuid>` — user-created custom session

Token endpoint (§4.1) uses the prefix to decide ACL: `session:*` rooms consult the sessions registry; `dm:*` and `group:*` consult chat-pins / group membership.

---

<a id="consumer-sessions"></a>
## 3.1 SessionsDrawer

Uses `<CallSurface room={...} layout="full" mode={observer ? "observer" : "active"} />` inside the session-room column. The `onLeave` prop unwires `setSelection({ type: "none" })`.

<a id="consumer-chat"></a>
## 3.2 ChatDrawer

For DMs and groups, the chat header exposes two `CallButton`s (voice + video). Click rings the peer/group via `/api/chat/ring` and mounts an inline `<CallSurface room={...} layout="strip" />` above the message list. The chat UI (composer + messages) remains fully usable during the call.

<a id="consumer-shell"></a>
## 3.3 ClientShell

`ClientShell` mounts `<IncomingCallToast />` once at the app root so rings reach the user no matter which drawer they're looking at. The toast has its own z-index above all drawers.

---

<a id="be-token"></a>
## 4.1 `/api/livekit/token`

Hardened in Phase 2.3. Per-room ACL described in [../SessionsDrawer.README.md#data-token](../SessionsDrawer.README.md#data-token).

<a id="be-ring"></a>
## 4.2 `/api/chat/ring`

JSON-backed, 2s-polled. Described in [../SessionsDrawer.README.md#data-ring](../SessionsDrawer.README.md#data-ring).

<a id="be-sessions"></a>
## 4.3 `/api/sessions`

Registry + presence. Described in [../SessionsDrawer.README.md#data-sessions](../SessionsDrawer.README.md#data-sessions).
