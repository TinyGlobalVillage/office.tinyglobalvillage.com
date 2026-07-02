"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import HardeningControlModal, {
  type HCMSection,
} from "../HardeningControlModal";
import AuditLogTimeline from "../_shared/AuditLogTimeline";
import { askConfirm } from "../../dialogService";

type ServiceStatus = "running" | "stopped" | "error" | "unknown";

type EnrolledDevice = {
  id: string;
  hostname: string;
  os: string;
  user: string;
  meshIp: string;
  lastSeen: string | null;
};

type PreAuthKey = {
  id: string;
  user: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  reusable: boolean;
};

type UfwRuleSummary = {
  active: boolean;
  port: string;
  allowedSources: string[];
  exceptions: string[];
};

type MeshVpnStatus = {
  service: { state: ServiceStatus; lastConfigModified: string | null };
  enrolledUsers: string[];
  devices: EnrolledDevice[];
  preAuthKeys: PreAuthKey[];
  ufw: UfwRuleSummary;
  currentRole: "admin" | "operator" | "viewer" | null;
  fail2banJailName: string;
};

const Row = styled.div`
  display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;
`;

const Col = styled.div`
  display: flex; flex-direction: column; gap: 0.5rem;
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

const Note = styled.div`
  font-size: 0.6875rem;
  color: var(--t-textFaint);
  line-height: 1.55;
`;

const ErrorText = styled.div`
  font-size: 0.6875rem; color: ${colors.pink};
  font-family: var(--font-geist-mono), monospace;
`;

const ActionBtn = styled.button`
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

const DangerBtn = styled.button`
  padding: 0.25rem 0.55rem;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  border-radius: 0.375rem;
  background: rgba(${rgb.pink}, 0.1);
  color: ${colors.pink};
  border: 1px solid rgba(${rgb.pink}, 0.5);
  &:hover:not(:disabled) { background: rgba(${rgb.pink}, 0.2); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Select = styled.select`
  padding: 0.3rem 0.5rem;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.75rem;
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--t-border);
  border-radius: 0.375rem;
  color: var(--t-text);
  &:focus { outline: none; border-color: rgba(${rgb.gold}, 0.5); }
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

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
  th, td {
    text-align: left;
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid var(--t-border);
    font-family: var(--font-geist-mono), monospace;
  }
  th {
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--t-textFaint);
    font-weight: 700;
  }
  td { color: var(--t-text); }
`;

const SecretBox = styled.div`
  padding: 0.6rem 0.75rem;
  border-radius: 0.5rem;
  background: rgba(${rgb.gold}, 0.08);
  border: 1px solid rgba(${rgb.gold}, 0.5);
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.75rem;
  color: ${colors.gold};
  word-break: break-all;
  display: flex; align-items: center; gap: 0.5rem;
`;

const Timestamp = styled.code`
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.6875rem;
  color: var(--t-textFaint);
`;

function fmt(ts: string | null): string {
  if (!ts) return "—";
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

function ServicePanel({
  status, onAction,
}: {
  status: MeshVpnStatus | null;
  onAction: (action: "restart") => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const state = status?.service.state ?? "unknown";
  const tone: "ok" | "warn" | "muted" =
    state === "running" ? "ok" :
    state === "stopped" || state === "error" ? "warn" :
    "muted";

  const restart = useCallback(async () => {
    setBusy(true); setErr(null);
    try { await onAction("restart"); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }, [onAction]);

  return (
    <Col>
      <Row>
        <StatusPill $tone={tone}>Headscale {state}</StatusPill>
        <ActionBtn type="button" onClick={restart} disabled={busy}>
          {busy ? "Restarting…" : "Restart service"}
        </ActionBtn>
      </Row>
      <Note>
        Last config modified: <Timestamp>{fmt(status?.service.lastConfigModified ?? null)}</Timestamp>
      </Note>
      {err && <ErrorText>{err}</ErrorText>}
    </Col>
  );
}

function DevicesPanel({
  status, onRevoke,
}: {
  status: MeshVpnStatus | null;
  onRevoke: (deviceId: string) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const revoke = useCallback(async (id: string) => {
    if (!(await askConfirm({
      title: "Revoke device?",
      message: "Revoke this device from the mesh? Its key will be deleted and it will need re-enrollment.",
      confirmLabel: "Revoke",
    }))) return;
    setBusyId(id); setErr(null);
    try { await onRevoke(id); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusyId(null); }
  }, [onRevoke]);

  if (!status) return <Note>Loading devices…</Note>;
  if (status.devices.length === 0) return <Note>No devices enrolled yet. Generate a pre-auth key below to add one.</Note>;

  return (
    <Col>
      <Table>
        <thead>
          <tr>
            <th>Hostname</th><th>OS</th><th>User</th><th>Mesh IP</th><th>Last seen</th><th></th>
          </tr>
        </thead>
        <tbody>
          {status.devices.map(d => (
            <tr key={d.id}>
              <td>{d.hostname}</td>
              <td>{d.os}</td>
              <td>{d.user}</td>
              <td>{d.meshIp}</td>
              <td>{fmt(d.lastSeen)}</td>
              <td style={{ textAlign: "right" }}>
                <DangerBtn type="button" onClick={() => revoke(d.id)} disabled={busyId === d.id}>
                  {busyId === d.id ? "Revoking…" : "Revoke"}
                </DangerBtn>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {err && <ErrorText>{err}</ErrorText>}
    </Col>
  );
}

function PreAuthKeysPanel({
  status, onGenerate, onRevoke,
}: {
  status: MeshVpnStatus | null;
  onGenerate: (user: string, expirationHours: number) => Promise<string>;
  onRevoke: (keyId: string) => Promise<void>;
}) {
  const [user, setUser] = useState<string>("");
  const [hours, setHours] = useState<number>(24);
  const [busy, setBusy] = useState(false);
  const [busyRevokeId, setBusyRevokeId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const users = status?.enrolledUsers ?? [];

  useEffect(() => {
    if (!user && users.length > 0) {
      setUser(users[0]);
    }
  }, [users, user]);

  const generate = useCallback(async () => {
    if (!user) return;
    setBusy(true); setErr(null); setFreshKey(null); setCopied(false);
    try {
      const key = await onGenerate(user, hours);
      setFreshKey(key);
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }, [user, hours, onGenerate]);

  const copy = useCallback(async () => {
    if (!freshKey) return;
    try {
      await navigator.clipboard.writeText(freshKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [freshKey]);

  const revoke = useCallback(async (id: string) => {
    if (!(await askConfirm({
      title: "Revoke pre-auth key?",
      message: "Revoke this pre-auth key? Any device that hasn't used it yet will fail to enroll.",
      confirmLabel: "Revoke",
    }))) return;
    setBusyRevokeId(id); setErr(null);
    try { await onRevoke(id); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusyRevokeId(null); }
  }, [onRevoke]);

  const activeKeys = useMemo(() => (status?.preAuthKeys ?? []).filter(k => !k.used), [status]);

  return (
    <Col>
      <Row>
        <Label>User:</Label>
        <Select value={user} onChange={e => setUser(e.target.value)} disabled={busy || users.length === 0}>
          {users.length === 0 && <option value="">— no users —</option>}
          {users.map(u => <option key={u} value={u}>{u}</option>)}
        </Select>
        <Label>Expires in:</Label>
        <NumberInput
          type="number" min={1} max={720} step={1}
          value={hours}
          onChange={e => setHours(Number(e.target.value))}
          disabled={busy}
        />
        <Label>hours</Label>
        <ActionBtn type="button" onClick={generate} disabled={busy || !user}>
          {busy ? "Generating…" : "Generate key"}
        </ActionBtn>
      </Row>

      {freshKey && (
        <SecretBox>
          <span style={{ flex: 1 }}>{freshKey}</span>
          <ActionBtn type="button" onClick={copy}>{copied ? "Copied" : "Copy"}</ActionBtn>
        </SecretBox>
      )}
      {freshKey && (
        <Note>
          Shown once. Copy now — refreshing this modal will hide it. The remote device runs
          <code> headscale up --authkey &lt;key&gt;</code> to enroll.
        </Note>
      )}

      {err && <ErrorText>{err}</ErrorText>}

      <Note style={{ marginTop: "0.4rem" }}>Active keys ({activeKeys.length})</Note>
      {activeKeys.length === 0 ? (
        <Note>None.</Note>
      ) : (
        <Table>
          <thead>
            <tr><th>User</th><th>Created</th><th>Expires</th><th>Reusable</th><th></th></tr>
          </thead>
          <tbody>
            {activeKeys.map(k => (
              <tr key={k.id}>
                <td>{k.user}</td>
                <td>{fmt(k.createdAt)}</td>
                <td>{fmt(k.expiresAt)}</td>
                <td>{k.reusable ? "yes" : "no"}</td>
                <td style={{ textAlign: "right" }}>
                  <DangerBtn type="button" onClick={() => revoke(k.id)} disabled={busyRevokeId === k.id}>
                    {busyRevokeId === k.id ? "Revoking…" : "Revoke"}
                  </DangerBtn>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Col>
  );
}

function UfwSshRulePanel({ status }: { status: MeshVpnStatus | null }) {
  if (!status) return <Note>Loading rule…</Note>;
  const ufw = status.ufw;
  if (!ufw) return <Note>UFW status unavailable.</Note>;
  // Defensive: tolerate a degraded payload (missing arrays) instead of crashing.
  const allowedSources = ufw.allowedSources ?? [];
  const exceptions = ufw.exceptions ?? [];
  return (
    <Col>
      <Row>
        <StatusPill $tone={ufw.active ? "ok" : "warn"}>
          {ufw.active ? `Port ${ufw.port} restricted` : `Port ${ufw.port} OPEN / NOT ENFORCED`}
        </StatusPill>
      </Row>
      <Note>
        Allowed sources: {allowedSources.length === 0 ? "—" : allowedSources.join(", ")}
      </Note>
      {exceptions.length > 0 && (
        <Note>Per-IP exceptions: {exceptions.join(", ")}</Note>
      )}
    </Col>
  );
}

export type MeshVpnControlModalProps = {
  onClose: () => void;
};

export default function MeshVpnControlModal({ onClose }: MeshVpnControlModalProps) {
  const [status, setStatus] = useState<MeshVpnStatus | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/hardening/mesh-vpn/status", {
        credentials: "same-origin", cache: "no-store",
      });
      if (res.status === 401 || res.status === 403) { setForbidden(true); return; }
      if (!res.ok) return;
      setStatus(await res.json());
    } catch { /* swallow — degraded render */ }
  }, []);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  const serviceAction = useCallback(async (action: "restart") => {
    const res = await fetch(`/api/hardening/mesh-vpn/service/${action}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b.error ?? `HTTP ${res.status}`);
    }
    await refreshStatus();
  }, [refreshStatus]);

  const revokeDevice = useCallback(async (deviceId: string) => {
    // TODO: backend endpoint /api/hardening/mesh-vpn/devices/:id DELETE not yet implemented
    const res = await fetch(`/api/hardening/mesh-vpn/devices/${encodeURIComponent(deviceId)}`, {
      method: "DELETE", credentials: "same-origin",
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b.error ?? `HTTP ${res.status}`);
    }
    await refreshStatus();
  }, [refreshStatus]);

  const generateKey = useCallback(async (user: string, expirationHours: number): Promise<string> => {
    // TODO: backend endpoint /api/hardening/mesh-vpn/preauth-keys POST not yet implemented
    const res = await fetch("/api/hardening/mesh-vpn/preauth-keys", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user, expirationHours }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b.error ?? `HTTP ${res.status}`);
    }
    const data: { key: string } = await res.json();
    await refreshStatus();
    return data.key;
  }, [refreshStatus]);

  const revokeKey = useCallback(async (keyId: string) => {
    // TODO: backend endpoint /api/hardening/mesh-vpn/preauth-keys/:id DELETE not yet implemented
    const res = await fetch(`/api/hardening/mesh-vpn/preauth-keys/${encodeURIComponent(keyId)}`, {
      method: "DELETE", credentials: "same-origin",
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b.error ?? `HTTP ${res.status}`);
    }
    await refreshStatus();
  }, [refreshStatus]);

  if (forbidden) {
    return (
      <HardeningControlModal
        title="Mesh VPN Hardening"
        subtitle="Admin only — your account does not have access."
        onClose={onClose}
        sections={[]}
        auditLogView={<Note>Sign in as an admin to view the mesh VPN surface.</Note>}
      />
    );
  }

  const sections: HCMSection[] = [
    {
      id: "service",
      title: "Headscale service",
      qmbm:
        "Headscale is the self-hosted mesh VPN control plane. It tracks which devices belong in your private network and helps them find each other.",
      body: <ServicePanel status={status} onAction={serviceAction} />,
    },
    {
      id: "devices",
      title: "Enrolled devices",
      qmbm:
        "An enrolled device has exchanged keys with Headscale and joined the private mesh. It gets a stable 100.x.x.x mesh IP and can reach other enrolled devices directly, regardless of which network it's on. Revoking deletes the device's key — the device must re-enroll with a fresh pre-auth key.",
      body: <DevicesPanel status={status} onRevoke={revokeDevice} />,
    },
    {
      id: "preauth-keys",
      title: "Pre-auth keys",
      qmbm:
        "A pre-auth key is a one-time secret used by a new device to join the mesh without an interactive login. Generate one here, then run `headscale up --authkey <key>` on the remote device. The key is shown ONCE — copy it immediately. If you lose it, revoke and generate a new one.",
      body: (
        <PreAuthKeysPanel
          status={status}
          onGenerate={generateKey}
          onRevoke={revokeKey}
        />
      ),
    },
    {
      id: "ufw-ssh",
      title: "UFW SSH rule",
      qmbm:
        "SSH on RCS lives on port 27720 and is firewalled to the mesh subnet (100.64.0.0/10) only — public-internet brute force is blocked at the network layer. Any IP listed under exceptions can also reach 27720 (e.g. a static admin IP). Devices outside both lists cannot even reach SSH, regardless of credentials.",
      body: <UfwSshRulePanel status={status} />,
    },
  ];

  return (
    <HardeningControlModal
      title="Mesh VPN Hardening"
      subtitle="Headscale control plane, enrolled devices, pre-auth keys, UFW SSH rule — all controls in one place."
      onClose={onClose}
      sections={sections}
      auditLogView={
        <AuditLogTimeline
          endpoint="/api/hardening/mesh-vpn/audit-log"
          kinds={["enrollment", "key-gen", "key-revoke", "device-revoke", "ufw-change", "service"]}
        />
      }
    />
  );
}
