"use client";
// RequestTenantAccessModal — Office operator surface for admin-mutation-consent / villager-dashboard
// -canon P6. An admin picks a tenant + the scopes they need, sends a consent request; the tenant
// owner approves on their dashboard; a code is emailed back here, which the admin enters to activate
// the grant. Talks to /api/admin/consent/{tenants,request,outgoing,redeem}. Self-contained.
import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { ACCESS_SCOPES } from "@tgv/module-consent/components/scopes";

interface Tenant {
  id: string;
  name: string;
  deploy_status?: string | null;
}
interface Outgoing {
  id: string;
  kind: string;
  status: string;
  dashboardName: string | null;
  createdAt: string;
}

export default function RequestTenantAccessModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [outgoing, setOutgoing] = useState<Outgoing[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [scopes, setScopes] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [code, setCode] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadOutgoing = useCallback(async () => {
    const r = await fetch("/api/admin/consent/outgoing", { cache: "no-store" });
    if (r.ok) setOutgoing((await r.json()).outgoing ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/admin/consent/tenants", { cache: "no-store" });
      if (r.ok) {
        const t = (await r.json()).tenants ?? [];
        setTenants(t);
        setTenantId(t[0]?.id ?? "");
      }
    })();
    loadOutgoing();
  }, [loadOutgoing]);

  const toggle = (k: string) =>
    setScopes((p) => {
      const n = new Set(p);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const send = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/consent/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetSiteId: tenantId, scopes: Array.from(scopes), note: note.trim() || undefined }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) setErr(j?.error || `Failed (${r.status})`);
      else {
        setMsg("Request sent. The tenant gets an email + an in-dashboard request; once they approve you'll be emailed a code.");
        setScopes(new Set());
        setNote("");
        await loadOutgoing();
      }
    } finally {
      setBusy(false);
    }
  };

  const redeem = async (id: string) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/consent/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: id, code: code[id] ?? "" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) setErr(j?.error || `Bad code (${r.status})`);
      else {
        setMsg("Grant active.");
        await loadOutgoing();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Backdrop onClick={onClose}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <H>Request tenant access</H>
        <Muted>
          Ask a tenant for consent-gated, time-boxed access to act on their account. They approve on
          their dashboard and pick exactly what to grant. Money scopes are the highest trust.
        </Muted>

        <Field>
          <Lbl>Tenant</Lbl>
          <Select value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.deploy_status && t.deploy_status !== "live" ? ` (${t.deploy_status})` : ""}
              </option>
            ))}
          </Select>
        </Field>

        <Field>
          <Lbl>Scopes you need</Lbl>
          {ACCESS_SCOPES.map((s) => (
            <Check key={s.key}>
              <input type="checkbox" checked={scopes.has(s.key)} onChange={() => toggle(s.key)} />
              {s.label}
              {s.money && <Money>money</Money>}
            </Check>
          ))}
        </Field>

        <Field>
          <Lbl>Reason (optional)</Lbl>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why you need access" />
        </Field>

        {err && <Err>{err}</Err>}
        {msg && <Ok>{msg}</Ok>}

        <Row>
          <Btn onClick={onClose}>Close</Btn>
          <Btn $primary disabled={busy || !tenantId || scopes.size === 0} onClick={send}>
            {busy ? "Sending…" : "Send request"}
          </Btn>
        </Row>

        {outgoing.length > 0 && (
          <Outgoing>
            <Lbl>Your requests</Lbl>
            {outgoing.map((o) => (
              <OutRow key={o.id}>
                <span>
                  {o.dashboardName ?? "Tenant"} — <Status>{o.status}</Status>
                </span>
                {o.status === "code_sent" && (
                  <CodeRow>
                    <Code
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={code[o.id] ?? ""}
                      onChange={(e) => setCode((p) => ({ ...p, [o.id]: e.target.value.replace(/\D/g, "") }))}
                    />
                    <Btn $primary disabled={busy || (code[o.id]?.length ?? 0) !== 6} onClick={() => redeem(o.id)}>
                      Activate
                    </Btn>
                  </CodeRow>
                )}
              </OutRow>
            ))}
          </Outgoing>
        )}
      </Panel>
    </Backdrop>
  );
}

const Backdrop = styled.div`position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:1000;`;
const Panel = styled.div`width:min(480px,94vw);max-height:88vh;overflow:auto;background:#16161c;border:1px solid #2a2a33;border-radius:14px;padding:20px;display:flex;flex-direction:column;gap:12px;color:#eee;`;
const H = styled.div`font-weight:700;font-size:16px;`;
const Muted = styled.div`font-size:12px;opacity:.7;`;
const Field = styled.div`display:flex;flex-direction:column;gap:6px;`;
const Lbl = styled.div`font-size:11px;text-transform:uppercase;letter-spacing:.04em;opacity:.55;`;
const Select = styled.select`font-size:14px;padding:9px 11px;border-radius:9px;background:#0e0e12;color:inherit;border:1px solid #2a2a33;`;
const Input = styled.input`font-size:14px;padding:9px 11px;border-radius:9px;background:#0e0e12;color:inherit;border:1px solid #2a2a33;`;
const Check = styled.label`display:flex;gap:8px;align-items:center;font-size:13px;`;
const Money = styled.span`color:#fbbf24;font-size:11px;`;
const Row = styled.div`display:flex;gap:8px;justify-content:flex-end;`;
const Btn = styled.button<{ $primary?: boolean }>`
  font-size:13px;padding:8px 14px;border-radius:9px;cursor:pointer;border:1px solid #2a2a33;
  background:${(p) => (p.$primary ? "#3b82f6" : "transparent")};color:${(p) => (p.$primary ? "#fff" : "inherit")};
  &:disabled{opacity:.5;cursor:default;}
`;
const Err = styled.div`font-size:12px;color:#f87171;`;
const Ok = styled.div`font-size:12px;color:#7cffb9;`;
const Outgoing = styled.div`display:flex;flex-direction:column;gap:8px;border-top:1px solid #2a2a33;padding-top:12px;`;
const OutRow = styled.div`display:flex;flex-direction:column;gap:6px;font-size:13px;`;
const Status = styled.span`opacity:.7;`;
const CodeRow = styled.div`display:flex;gap:8px;align-items:center;`;
const Code = styled.input`font-size:14px;padding:6px 10px;border-radius:8px;background:#0e0e12;color:inherit;border:1px solid #2a2a33;width:110px;letter-spacing:3px;`;
