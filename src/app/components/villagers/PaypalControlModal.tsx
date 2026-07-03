"use client";

// PaypalControlModal — the operator console for the @tgv/module-paypal faucet (Villagers → PayPal
// Faucet tile). Toggle the global killswitch, enable/disable a tenant's PayPal, and set each
// tenant's public credentials (client-id / hosted-button-id / merchant email). Writes the shared
// config via /api/admin/paypal/config (requireAdmin + audited); each host reads the same file.
//
// PayPal money never touches TGV (it goes straight to the tenant's own PayPal) — so this is plain
// operator config, not a security/hardening surface. Plain modal shell (like MemberWalletModal).

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { colors, rgb } from "@/app/theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalBody,
} from "@/app/styled";
import NeonX from "../NeonX";

type TenantConfig = {
  enabled: boolean;
  label?: string;
  clientId?: string;
  hostedButtonId?: string;
  merchantEmail?: string;
};
type Config = { globalKillswitch: boolean; perTenant: Record<string, TenantConfig> };
type Msg = { kind: "ok" | "err"; text: string } | null;

const CRED_FIELDS: Array<{ key: keyof TenantConfig; label: string; placeholder: string }> = [
  { key: "label", label: "Label", placeholder: "resonantweaver.com" },
  { key: "clientId", label: "PayPal client-id", placeholder: "AY…" },
  { key: "hostedButtonId", label: "Hosted-button id", placeholder: "ABC123…" },
  { key: "merchantEmail", label: "Merchant email", placeholder: "marthe@…" },
];

export default function PaypalControlModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });

  const [config, setConfig] = useState<Config | null>(null);
  const [drafts, setDrafts] = useState<Record<string, TenantConfig>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [newKey, setNewKey] = useState("");

  const apply = (cfg: Config) => {
    setConfig(cfg);
    setDrafts({ ...cfg.perTenant });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/paypal/config", { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.config) apply(d.config as Config);
      else setMsg({ kind: "err", text: d?.error ?? `Load failed (HTTP ${res.status}).` });
    } catch {
      setMsg({ kind: "err", text: "Couldn’t reach the server." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const put = useCallback(async (patch: Record<string, unknown>): Promise<boolean> => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/paypal/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d?.error) {
        setMsg({ kind: "err", text: d?.error ? `Save failed: ${d.error}` : `Save failed (HTTP ${res.status}).` });
        return false;
      }
      if (d.config) apply(d.config as Config);
      return true;
    } catch {
      setMsg({ kind: "err", text: "Save failed — couldn’t reach the server." });
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const toggleGlobal = async () => {
    if (!config) return;
    const ok = await put({ globalKillswitch: !config.globalKillswitch });
    if (ok) setMsg({ kind: "ok", text: `Global killswitch ${!config.globalKillswitch ? "engaged" : "released"}.` });
  };

  const toggleTenant = async (key: string, enabled: boolean) => {
    const ok = await put({ tenant: { tenantKey: key, enabled } });
    if (ok) setMsg({ kind: "ok", text: `PayPal ${enabled ? "enabled" : "disabled"} for ${key}.` });
  };

  const saveCreds = async (key: string) => {
    const d = drafts[key];
    if (!d) return;
    const ok = await put({
      tenant: {
        tenantKey: key,
        label: d.label ?? "",
        clientId: d.clientId ?? "",
        hostedButtonId: d.hostedButtonId ?? "",
        merchantEmail: d.merchantEmail ?? "",
      },
    });
    if (ok) setMsg({ kind: "ok", text: `Saved credentials for ${key}.` });
  };

  const addTenant = async () => {
    const key = newKey.trim();
    if (!key) return;
    const ok = await put({ tenant: { tenantKey: key, enabled: false, label: key } });
    if (ok) {
      setNewKey("");
      setMsg({ kind: "ok", text: `Added ${key}. Set its credentials, then enable it.` });
    }
  };

  const setDraftField = (key: string, field: keyof TenantConfig, value: string) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const tenants = config ? Object.entries(config.perTenant) : [];

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="gold" $maxWidth="46rem" onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <div>
              <ModalTitle>PayPal Faucet</ModalTitle>
              <Sub>Tenant PayPal — money goes straight to their own PayPal (off-stack, no tokens)</Sub>
            </div>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          <Stack>
            {loading && <Dim>Loading…</Dim>}

            {config && (
              <>
                <GlobalRow $on={config.globalKillswitch}>
                  <div>
                    <RowTitle>Global killswitch</RowTitle>
                    <Dim>
                      {config.globalKillswitch
                        ? "ENGAGED — every tenant’s PayPal faucet is off."
                        : "Released — tenants follow their own enable flag."}
                    </Dim>
                  </div>
                  <KillBtn type="button" $on={config.globalKillswitch} disabled={busy} onClick={toggleGlobal}>
                    {config.globalKillswitch ? "Release" : "Engage"}
                  </KillBtn>
                </GlobalRow>

                {tenants.length === 0 && <Dim>No PayPal tenants yet — add one below.</Dim>}

                {tenants.map(([key, t]) => {
                  const d = drafts[key] ?? t;
                  return (
                    <Card key={key}>
                      <CardHead>
                        <div>
                          <strong>{t.label ?? key}</strong> <Mono>{key}</Mono>
                        </div>
                        <ToggleBtn
                          type="button"
                          $on={t.enabled}
                          disabled={busy}
                          onClick={() => toggleTenant(key, !t.enabled)}
                        >
                          {t.enabled ? "Enabled" : "Disabled"}
                        </ToggleBtn>
                      </CardHead>
                      <Fields>
                        {CRED_FIELDS.map((f) => (
                          <Field key={f.key}>
                            <FLabel>{f.label}</FLabel>
                            <FInput
                              value={(d[f.key] as string) ?? ""}
                              placeholder={f.placeholder}
                              onChange={(e) => setDraftField(key, f.key, e.target.value)}
                              disabled={busy}
                            />
                          </Field>
                        ))}
                      </Fields>
                      <SaveBtn type="button" disabled={busy} onClick={() => saveCreds(key)}>
                        Save credentials
                      </SaveBtn>
                    </Card>
                  );
                })}

                <AddRow>
                  <FInput
                    value={newKey}
                    placeholder="New tenant key (e.g. a site slug)"
                    onChange={(e) => setNewKey(e.target.value)}
                    disabled={busy}
                  />
                  <SaveBtn type="button" disabled={busy || !newKey.trim()} onClick={addTenant}>
                    Add tenant
                  </SaveBtn>
                </AddRow>

                {msg && (msg.kind === "ok" ? <OkText>{msg.text}</OkText> : <ErrText>{msg.text}</ErrText>)}

                <Note>
                  PayPal client-id and hosted-button-id are PUBLIC values (they ship in the page) — the
                  money settles in the tenant’s own PayPal, with their merchant-of-record and disputes.
                  Every change here is audited.
                </Note>
              </>
            )}
          </Stack>
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}

/* ── styles ─────────────────────────────────────────────────────────────── */
const Sub = styled.div`
  font-size: 0.75rem;
  color: var(--t-textFaint);
  letter-spacing: 0.04em;
  margin-top: 0.125rem;
`;
const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
`;
const GlobalRow = styled.div<{ $on: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.85rem;
  border-radius: 0.5rem;
  border: 1px solid ${(p) => (p.$on ? `rgba(${rgb.pink}, 0.5)` : "var(--t-border)")};
  background: ${(p) => (p.$on ? `rgba(${rgb.pink}, 0.08)` : "rgba(0,0,0,0.2)")};
`;
const RowTitle = styled.div`
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--t-text);
`;
const KillBtn = styled.button<{ $on: boolean }>`
  flex: none;
  padding: 0.4rem 0.9rem;
  font-size: 0.78rem;
  border-radius: 0.4rem;
  cursor: pointer;
  color: ${(p) => (p.$on ? colors.cyan : colors.pink)};
  background: ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.14)` : `rgba(${rgb.pink}, 0.14)`)};
  border: 1px solid ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.55)` : `rgba(${rgb.pink}, 0.55)`)};
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(${rgb.gold}, 0.18);
  border-radius: 0.625rem;
  background: rgba(${rgb.gold}, 0.04);
`;
const CardHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.85rem;
`;
const Mono = styled.span`
  font-family: var(--font-geist-mono), monospace;
  color: ${colors.cyan};
  font-size: 0.72rem;
`;
const ToggleBtn = styled.button<{ $on: boolean }>`
  flex: none;
  padding: 0.35rem 0.8rem;
  font-size: 0.75rem;
  border-radius: 999px;
  cursor: pointer;
  color: ${(p) => (p.$on ? "#4ade80" : "var(--t-textFaint)")};
  background: ${(p) => (p.$on ? "rgba(74, 222, 128, 0.12)" : "rgba(0,0,0,0.25)")};
  border: 1px solid ${(p) => (p.$on ? "rgba(74, 222, 128, 0.5)" : "var(--t-border)")};
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
const Fields = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;
const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
`;
const FLabel = styled.div`
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--t-textFaint);
`;
const FInput = styled.input`
  width: 100%;
  padding: 0.4rem 0.55rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--t-border);
  border-radius: 0.375rem;
  color: var(--t-text);
  font-size: 0.8rem;
  &:focus {
    outline: none;
    border-color: rgba(${rgb.cyan}, 0.6);
  }
  &:disabled {
    opacity: 0.5;
  }
`;
const SaveBtn = styled.button`
  align-self: flex-start;
  padding: 0.45rem 1rem;
  font-size: 0.8rem;
  border-radius: 0.4rem;
  cursor: pointer;
  background: rgba(${rgb.cyan}, 0.14);
  border: 1px solid rgba(${rgb.cyan}, 0.55);
  color: ${colors.cyan};
  &:hover:not(:disabled) {
    background: rgba(${rgb.cyan}, 0.24);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
const AddRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;
const Note = styled.div`
  font-size: 0.72rem;
  line-height: 1.45;
  color: var(--t-textFaint);
`;
const Dim = styled.span`
  color: var(--t-textFaint);
  font-size: 0.72rem;
`;
const ErrText = styled.div`
  font-size: 0.75rem;
  color: ${colors.pink};
`;
const OkText = styled.div`
  font-size: 0.75rem;
  color: #4ade80;
`;
