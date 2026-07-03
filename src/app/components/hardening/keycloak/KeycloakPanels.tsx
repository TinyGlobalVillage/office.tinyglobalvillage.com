"use client";

// Panels for the Keycloak hardening surface (E17). Same styled idiom as
// TelephonyPanels — pills, mono inputs, gold save buttons. All mutations go
// through /api/hardening/keycloak/* (audit-logged server-side).

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import { askConfirm } from "../../dialogService";

const Row = styled.div`
  display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;
`;

const Col = styled.div`
  display: flex; flex-direction: column; gap: 0.55rem;
`;

const StatusPill = styled.span<{ $tone: "ok" | "warn" | "muted" }>`
  display: inline-flex; align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border: 1px solid ${p =>
    p.$tone === "ok" ? `rgba(${rgb.cyan}, 0.5)` :
    p.$tone === "warn" ? `rgba(${rgb.pink}, 0.5)` :
    "var(--t-border)"};
  color: ${p =>
    p.$tone === "ok" ? colors.cyan :
    p.$tone === "warn" ? colors.pink :
    "var(--t-textFaint)"};
  background: ${p =>
    p.$tone === "ok" ? `rgba(${rgb.cyan}, 0.08)` :
    p.$tone === "warn" ? `rgba(${rgb.pink}, 0.08)` :
    "transparent"};
`;

const Label = styled.span`
  font-size: 0.75rem;
  color: var(--t-textFaint);
`;

const Mono = styled.span`
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.75rem;
  color: var(--t-text);
`;

const NumberInput = styled.input`
  width: 7rem;
  padding: 0.3rem 0.5rem;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.75rem;
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--t-border);
  border-radius: 0.375rem;
  color: var(--t-text);
  &:focus { outline: none; border-color: rgba(${rgb.gold}, 0.5); }
`;

const TextInput = styled(NumberInput)`
  width: 20rem;
  max-width: 100%;
`;

const SaveBtn = styled.button`
  padding: 0.3rem 0.6rem;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  border-radius: 0.375rem;
  background: rgba(${rgb.gold}, 0.12);
  color: ${colors.gold};
  border: 1px solid rgba(${rgb.gold}, 0.5);
  &:hover:not(:disabled) { background: rgba(${rgb.gold}, 0.22); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const DangerBtn = styled(SaveBtn)`
  background: rgba(${rgb.pink}, 0.1);
  color: ${colors.pink};
  border-color: rgba(${rgb.pink}, 0.5);
  &:hover:not(:disabled) { background: rgba(${rgb.pink}, 0.2); }
`;

const Note = styled.div`
  font-size: 0.6875rem;
  color: var(--t-textFaint);
  line-height: 1.55;
`;

const ErrorText = styled.div`
  font-size: 0.6875rem; color: ${colors.pink};
  font-family: var(--font-geist-mono), monospace;
`;

const OkText = styled.div`
  font-size: 0.6875rem; color: ${colors.cyan};
  font-family: var(--font-geist-mono), monospace;
`;

const ListRow = styled.div`
  display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--t-border);
  border-radius: 0.5rem;
  background: rgba(0,0,0,0.18);
`;

/* ── shared types (mirrors the status route payload) ─────────────────── */

export type KcRealmView = {
  enabled: boolean;
  displayName?: string;
  loginTheme?: string;
  browserFlow?: string;
  ssoSessionIdleTimeout: number;
  ssoSessionMaxLifespan: number;
  accessTokenLifespan: number;
  bruteForceProtected: boolean;
  permanentLockout: boolean;
  failureFactor: number;
  waitIncrementSeconds: number;
  maxFailureWaitSeconds: number;
  maxDeltaTimeSeconds: number;
  minimumQuickLoginWaitSeconds: number;
  smtpConfigured: boolean;
  smtpHost?: string;
  smtpFrom?: string;
};

export type KcClientView = {
  id: string;
  clientId: string;
  description?: string;
  enabled: boolean;
  publicClient: boolean;
  serviceAccountsEnabled: boolean;
  standardFlowEnabled: boolean;
  redirectUris: string[];
  webOrigins: string[];
};

export type OfficeKcConfigView = {
  realmMutationsEnabled: boolean;
  enrollmentEmail: { clientId: string; redirectUri: string; lifespanHours: number };
  lastUpdated: string | null;
};

export type KcStatusView = {
  configured: boolean;
  issuer: string;
  realmName?: string;
  health: { up: boolean; checks: { name: string; status: string }[] };
  realm: KcRealmView | null;
  clients: KcClientView[];
  config: OfficeKcConfigView;
};

/* ── Realm status ──────────────────────────────────────────────────────── */

export function RealmStatusPanel({ status }: { status: KcStatusView | null }) {
  if (!status) return <Note>Loading realm status…</Note>;
  const r = status.realm;
  return (
    <Col>
      <Row>
        <StatusPill $tone={status.health.up ? "ok" : "warn"}>
          {status.health.up ? "container up" : "container DOWN"}
        </StatusPill>
        <StatusPill $tone={status.configured ? "ok" : "warn"}>
          {status.configured ? "admin client configured" : "KC_ADMIN_* missing"}
        </StatusPill>
        {r && (
          <StatusPill $tone={r.enabled ? "ok" : "warn"}>
            realm {status.realmName ?? "tgv"} {r.enabled ? "enabled" : "DISABLED"}
          </StatusPill>
        )}
        {r && (
          <StatusPill $tone={r.smtpConfigured ? "ok" : "warn"}>
            {r.smtpConfigured ? "smtp wired" : "smtp NOT configured"}
          </StatusPill>
        )}
      </Row>
      <Row>
        <Label>Issuer</Label>
        <Mono>{status.issuer}</Mono>
      </Row>
      {r && (
        <>
          <Row>
            <Label>Login flow</Label>
            <Mono>{r.browserFlow ?? "browser"}</Mono>
            <StatusPill $tone={r.browserFlow === "tgv-passkey-browser" ? "ok" : "warn"}>
              {r.browserFlow === "tgv-passkey-browser"
                ? "passkey-only posture"
                : "NON-CANON FLOW"}
            </StatusPill>
          </Row>
          <Row>
            <Label>Theme</Label>
            <Mono>{r.loginTheme ?? "keycloak"}</Mono>
            <Label>SMTP</Label>
            <Mono>{r.smtpConfigured ? `${r.smtpFrom ?? "?"} via ${r.smtpHost ?? "?"}` : "—"}</Mono>
          </Row>
        </>
      )}
    </Col>
  );
}

/* ── Session & token lifetimes ─────────────────────────────────────────── */

export function LifetimesPanel({
  status, onSave,
}: {
  status: KcStatusView | null;
  onSave: () => void;
}) {
  const r = status?.realm ?? null;
  const [idleDays, setIdleDays] = useState("");
  const [maxDays, setMaxDays] = useState("");
  const [accessMin, setAccessMin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!r) return;
    setIdleDays(String(r.ssoSessionIdleTimeout / 86400));
    setMaxDays(String(r.ssoSessionMaxLifespan / 86400));
    setAccessMin(String(r.accessTokenLifespan / 60));
  }, [r]);

  const mutationsOff = status ? !status.config.realmMutationsEnabled : false;

  const save = useCallback(async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/hardening/keycloak/realm-settings", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ssoSessionIdleTimeout: Math.round(Number(idleDays) * 86400),
          ssoSessionMaxLifespan: Math.round(Number(maxDays) * 86400),
          accessTokenLifespan: Math.round(Number(accessMin) * 60),
        }),
      });
      const body = await res.json().catch(() => ({}));
      setMsg(res.ok
        ? { ok: true, text: "Lifetimes saved — applies to NEW sessions/tokens." }
        : { ok: false, text: body.error ?? `HTTP ${res.status}` });
      if (res.ok) onSave();
    } catch {
      setMsg({ ok: false, text: "Network error" });
    } finally {
      setBusy(false);
    }
  }, [idleDays, maxDays, accessMin, onSave]);

  if (!r) return <Note>Realm settings unavailable.</Note>;
  return (
    <Col>
      <Row>
        <Label>SSO idle</Label>
        <NumberInput value={idleDays} onChange={e => setIdleDays(e.target.value)} /> <Label>days</Label>
        <Label>SSO max</Label>
        <NumberInput value={maxDays} onChange={e => setMaxDays(e.target.value)} /> <Label>days</Label>
        <Label>Access token</Label>
        <NumberInput value={accessMin} onChange={e => setAccessMin(e.target.value)} /> <Label>min</Label>
        <SaveBtn onClick={save} disabled={busy || mutationsOff}>
          {busy ? "Saving…" : "Save lifetimes"}
        </SaveBtn>
      </Row>
      <Note>Canon (2026-07-02): idle 14d · max 30d · access 5min. App-local sessions stay 30d.</Note>
      {mutationsOff && <ErrorText>Realm mutations are disabled by the Office kill-switch below.</ErrorText>}
      {msg && (msg.ok ? <OkText>{msg.text}</OkText> : <ErrorText>{msg.text}</ErrorText>)}
    </Col>
  );
}

/* ── Brute-force protection ────────────────────────────────────────────── */

export function BruteForcePanel({
  status, onSave,
}: {
  status: KcStatusView | null;
  onSave: () => void;
}) {
  const r = status?.realm ?? null;
  const [failureFactor, setFailureFactor] = useState("");
  const [waitInc, setWaitInc] = useState("");
  const [maxWait, setMaxWait] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!r) return;
    setFailureFactor(String(r.failureFactor));
    setWaitInc(String(r.waitIncrementSeconds));
    setMaxWait(String(r.maxFailureWaitSeconds));
  }, [r]);

  const mutationsOff = status ? !status.config.realmMutationsEnabled : false;

  const put = useCallback(async (body: Record<string, number | boolean>, okText: string) => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/hardening/keycloak/realm-settings", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const rb = await res.json().catch(() => ({}));
      setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: rb.error ?? `HTTP ${res.status}` });
      if (res.ok) onSave();
    } catch {
      setMsg({ ok: false, text: "Network error" });
    } finally {
      setBusy(false);
    }
  }, [onSave]);

  if (!r) return <Note>Realm settings unavailable.</Note>;
  return (
    <Col>
      <Row>
        <StatusPill $tone={r.bruteForceProtected ? "ok" : "muted"}>
          {r.bruteForceProtected ? "brute-force protection ON" : "brute-force protection OFF"}
        </StatusPill>
        {r.bruteForceProtected ? (
          <DangerBtn
            disabled={busy || mutationsOff}
            onClick={async () => {
              if (await askConfirm({
                title: "Disable brute-force protection?",
                message: "Failed-login lockouts stop realm-wide until re-enabled.",
                confirmLabel: "Disable",
                intent: "danger",
              })) {
                put({ bruteForceProtected: false }, "Brute-force protection disabled.");
              }
            }}
          >
            Disable
          </DangerBtn>
        ) : (
          <SaveBtn
            disabled={busy || mutationsOff}
            onClick={() => put({ bruteForceProtected: true }, "Brute-force protection enabled.")}
          >
            Enable
          </SaveBtn>
        )}
      </Row>
      <Row>
        <Label>Failure threshold</Label>
        <NumberInput value={failureFactor} onChange={e => setFailureFactor(e.target.value)} />
        <Label>Wait increment (s)</Label>
        <NumberInput value={waitInc} onChange={e => setWaitInc(e.target.value)} />
        <Label>Max wait (s)</Label>
        <NumberInput value={maxWait} onChange={e => setMaxWait(e.target.value)} />
        <SaveBtn
          disabled={busy || mutationsOff}
          onClick={() => put({
            failureFactor: Number(failureFactor),
            waitIncrementSeconds: Number(waitInc),
            maxFailureWaitSeconds: Number(maxWait),
          }, "Brute-force thresholds saved.")}
        >
          Save thresholds
        </SaveBtn>
      </Row>
      <Note>
        Members are passkey-only, so lockouts mostly guard the recovery-code path.
        Thresholds apply on the NEXT failed attempt; disabling never unlocks an
        already-locked account.
      </Note>
      {msg && (msg.ok ? <OkText>{msg.text}</OkText> : <ErrorText>{msg.text}</ErrorText>)}
    </Col>
  );
}

/* ── OIDC clients ──────────────────────────────────────────────────────── */

export function ClientsPanel({ status }: { status: KcStatusView | null }) {
  if (!status) return <Note>Loading clients…</Note>;
  const visible = status.clients
    .filter(c => !/^(account|account-console|admin-cli|broker|realm-management|security-admin-console)$/.test(c.clientId))
    .sort((a, b) => a.clientId.localeCompare(b.clientId));
  return (
    <Col>
      {visible.map(c => (
        <ListRow key={c.id}>
          <Mono>{c.clientId}</Mono>
          <StatusPill $tone={c.enabled ? "ok" : "warn"}>{c.enabled ? "enabled" : "disabled"}</StatusPill>
          <StatusPill $tone="muted">
            {c.serviceAccountsEnabled ? "service account" : c.standardFlowEnabled ? "site RP" : "other"}
          </StatusPill>
          {c.redirectUris.length > 0 && (
            <Label title={c.redirectUris.join("\n")}>
              {c.redirectUris.length} redirect URI{c.redirectUris.length === 1 ? "" : "s"}
            </Label>
          )}
        </ListRow>
      ))}
      <Note>
        Built-in Keycloak clients are hidden. To wire a NEW tenant app as a
        relying-party, use Villagers → Wire Client to Keycloak (E18) — it
        creates the client, minting + file-dropping the secret server-side.
      </Note>
    </Col>
  );
}

/* ── Members (realm users) ─────────────────────────────────────────────── */

type KcUserView = {
  id: string;
  username: string;
  email?: string;
  emailVerified?: boolean;
  enabled?: boolean;
  requiredActions?: string[];
  createdTimestamp?: number;
};

type KcCredentialView = { id: string; type: string; userLabel?: string; createdDate?: number };

export function MembersPanel({ onAction }: { onAction: () => void }) {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<KcUserView[]>([]);
  const [total, setTotal] = useState(0);
  const [creds, setCreds] = useState<Record<string, KcCredentialView[]>>({});
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async (q: string) => {
    try {
      const res = await fetch(
        `/api/hardening/keycloak/users?max=50${q ? `&search=${encodeURIComponent(q)}` : ""}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      if (!res.ok) return;
      const body = await res.json();
      setUsers(body.users ?? []);
      setTotal(body.total ?? 0);
    } catch { /* keep prior list */ }
  }, []);

  useEffect(() => { load(""); }, [load]);

  const toggleCreds = useCallback(async (id: string) => {
    if (creds[id]) {
      setCreds(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    try {
      const res = await fetch(`/api/hardening/keycloak/users/${id}/credentials`, {
        credentials: "same-origin", cache: "no-store",
      });
      if (!res.ok) return;
      const body = await res.json();
      setCreds(prev => ({ ...prev, [id]: body.credentials ?? [] }));
    } catch { /* leave collapsed */ }
  }, [creds]);

  const act = useCallback(async (
    user: KcUserView,
    kind: "enrollment-email" | "logout-all",
    confirmText: string,
    okText: string,
  ) => {
    if (!(await askConfirm({
      title: kind === "logout-all" ? "Sign out everywhere?" : "Resend enrollment email?",
      message: confirmText,
      confirmLabel: kind === "logout-all" ? "Sign out" : "Send",
      ...(kind === "logout-all" ? { intent: "danger" as const } : {}),
    }))) return;
    setBusyUser(user.id); setMsg(null);
    try {
      const res = await fetch(`/api/hardening/keycloak/users/${user.id}/${kind}`, {
        method: "POST", credentials: "same-origin",
      });
      const body = await res.json().catch(() => ({}));
      setMsg(res.ok
        ? { ok: true, text: okText.replace("%u", user.username) }
        : { ok: false, text: body.error ?? `HTTP ${res.status}` });
      if (res.ok) onAction();
    } catch {
      setMsg({ ok: false, text: "Network error" });
    } finally {
      setBusyUser(null);
    }
  }, [onAction]);

  return (
    <Col>
      <Row>
        <TextInput
          placeholder="Search username or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") load(search); }}
        />
        <SaveBtn onClick={() => load(search)}>Search</SaveBtn>
        <Label>{total} realm user{total === 1 ? "" : "s"}</Label>
      </Row>
      {users.map(u => (
        <ListRow key={u.id}>
          <Mono>{u.username}</Mono>
          <Label>{u.email ?? "no email"}</Label>
          <StatusPill $tone={u.enabled ? "ok" : "warn"}>{u.enabled ? "enabled" : "disabled"}</StatusPill>
          {!u.emailVerified && <StatusPill $tone="muted">email unverified</StatusPill>}
          {(u.requiredActions?.length ?? 0) > 0 && (
            <StatusPill $tone="warn" title={u.requiredActions!.join(", ")}>
              enrollment pending
            </StatusPill>
          )}
          <SaveBtn onClick={() => toggleCreds(u.id)}>
            {creds[u.id] ? "Hide credentials" : "Credentials"}
          </SaveBtn>
          <SaveBtn
            disabled={busyUser === u.id}
            onClick={() => act(
              u,
              "enrollment-email",
              `Re-send the passkey + recovery-code enrollment email to ${u.email ?? u.username}?`,
              "Enrollment email sent to %u.",
            )}
          >
            Resend enrollment
          </SaveBtn>
          <DangerBtn
            disabled={busyUser === u.id}
            onClick={() => act(
              u,
              "logout-all",
              `Sign ${u.username} out EVERYWHERE (all Keycloak SSO sessions + the shared tgv.com/Office session)?`,
              "%u signed out everywhere.",
            )}
          >
            Sign out everywhere
          </DangerBtn>
          {creds[u.id] && (
            <Col style={{ width: "100%", paddingLeft: "0.5rem" }}>
              {creds[u.id].length === 0 && <Note>No credentials enrolled yet.</Note>}
              {creds[u.id].map(c => (
                <Row key={c.id}>
                  <StatusPill $tone={c.type === "webauthn-passwordless" ? "ok" : "muted"}>
                    {c.type === "webauthn-passwordless" ? "passkey" :
                     c.type === "recovery-authn-codes" ? "recovery codes" : c.type}
                  </StatusPill>
                  {c.userLabel && <Mono>{c.userLabel}</Mono>}
                  {c.createdDate && (
                    <Label>{new Date(c.createdDate).toISOString().slice(0, 10)}</Label>
                  )}
                </Row>
              ))}
            </Col>
          )}
        </ListRow>
      ))}
      {msg && (msg.ok ? <OkText>{msg.text}</OkText> : <ErrorText>{msg.text}</ErrorText>)}
      <Note>
        Passkey add/remove stays member-driven (dashboard Settings) — Office only
        re-sends enrollment links and revokes sessions, both audit-logged.
      </Note>
    </Col>
  );
}

/* ── Office-side config (kill-switch + enrollment return) ──────────────── */

export function OfficeConfigPanel({
  status, onSave,
}: {
  status: KcStatusView | null;
  onSave: () => void;
}) {
  const cfg = status?.config ?? null;
  const [clientId, setClientId] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [lifespanHours, setLifespanHours] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!cfg) return;
    setClientId(cfg.enrollmentEmail.clientId);
    setRedirectUri(cfg.enrollmentEmail.redirectUri);
    setLifespanHours(String(cfg.enrollmentEmail.lifespanHours));
  }, [cfg]);

  const put = useCallback(async (body: Record<string, unknown>, okText: string) => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/hardening/keycloak/config", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const rb = await res.json().catch(() => ({}));
      setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: rb.error ?? `HTTP ${res.status}` });
      if (res.ok) onSave();
    } catch {
      setMsg({ ok: false, text: "Network error" });
    } finally {
      setBusy(false);
    }
  }, [onSave]);

  if (!cfg) return <Note>Loading config…</Note>;
  return (
    <Col>
      <Row>
        <StatusPill $tone={cfg.realmMutationsEnabled ? "ok" : "warn"}>
          {cfg.realmMutationsEnabled ? "realm mutations ALLOWED" : "realm mutations LOCKED"}
        </StatusPill>
        {cfg.realmMutationsEnabled ? (
          <DangerBtn
            disabled={busy}
            onClick={async () => {
              if (await askConfirm({
                title: "Lock realm mutations?",
                message: "The lifetimes + brute-force panels turn read-only until unlocked here.",
                confirmLabel: "Lock",
              })) {
                put({ realmMutationsEnabled: false }, "Realm mutations locked.");
              }
            }}
          >
            Lock
          </DangerBtn>
        ) : (
          <SaveBtn disabled={busy} onClick={() => put({ realmMutationsEnabled: true }, "Realm mutations unlocked.")}>
            Unlock
          </SaveBtn>
        )}
      </Row>
      <Row>
        <Label>Enrollment return client</Label>
        <TextInput value={clientId} onChange={e => setClientId(e.target.value)} style={{ width: "14rem" }} />
        <Label>redirect URI</Label>
        <TextInput value={redirectUri} onChange={e => setRedirectUri(e.target.value)} />
        <Label>link lifespan (h)</Label>
        <NumberInput value={lifespanHours} onChange={e => setLifespanHours(e.target.value)} />
        <SaveBtn
          disabled={busy}
          onClick={() => put({
            enrollmentEmail: {
              clientId: clientId.trim(),
              redirectUri: redirectUri.trim(),
              lifespanHours: Number(lifespanHours),
            },
          }, "Enrollment email settings saved.")}
        >
          Save
        </SaveBtn>
      </Row>
      <Note>
        The redirect URI must be registered on the return client in Keycloak
        (tinyglobalvillage.com has /login registered for this — the D12 convention).
        File-backed at data/keycloak/keycloak-config.json; applies without restart.
      </Note>
      {msg && (msg.ok ? <OkText>{msg.text}</OkText> : <ErrorText>{msg.text}</ErrorText>)}
    </Col>
  );
}
