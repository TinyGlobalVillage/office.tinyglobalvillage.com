"use client";

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalBody,
  CloseBtn,
} from "../../styled";
import type { Did, DidAssignment } from "@/lib/frontdesk/types";
import { TrashIcon } from "../icons";

type Profile = { username: string; displayName: string };

// ── Styled ───────────────────────────────────────────────────────

const Section = styled.div`
  & + & { margin-top: 1.25rem; }
`;

const SectionHead = styled.h3`
  margin: 0 0 0.5rem;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: ${colors.gold};
`;

const DidList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

const DidRow = styled.li`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.25rem 0.5rem;
  padding: 0.65rem 0.75rem;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--t-border);
`;

const DidHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
`;

const DidLabel = styled.input`
  flex: 1;
  padding: 0.35rem 0.5rem;
  font-size: 0.8125rem;
  background: var(--t-inputBg);
  border: 1px solid var(--t-border);
  border-radius: 0.35rem;
  color: var(--t-textBase);
  font-weight: 600;
  outline: none;
`;

const DidNum = styled.div`
  font-family: var(--font-geist-mono), monospace;
  color: ${colors.gold};
  font-size: 0.8125rem;
`;

const Select = styled.select`
  padding: 0.35rem 0.5rem;
  font-size: 0.75rem;
  background: var(--t-inputBg);
  color: var(--t-textBase);
  border: 1px solid var(--t-border);
  border-radius: 0.35rem;
`;

const AddGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
`;

const Input = styled.input`
  padding: 0.45rem 0.6rem;
  font-size: 0.8125rem;
  background: var(--t-inputBg);
  color: var(--t-textBase);
  border: 1px solid var(--t-border);
  border-radius: 0.5rem;
`;

const CheckboxRow = styled.label`
  grid-column: 1 / -1;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--t-textFaint);
`;

const FooterRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.85rem 1.5rem;
  border-top: 1px solid var(--t-border);
  background: rgba(${rgb.gold}, 0.03);
`;

const Btn = styled.button<{ $variant: "primary" | "ghost" | "danger" }>`
  padding: 0.55rem 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  border-radius: 0.5rem;
  cursor: pointer;
  background: ${(p) =>
    p.$variant === "primary" ? `rgba(${rgb.gold}, 0.2)` :
    p.$variant === "danger" ? `rgba(${rgb.pink}, 0.2)` :
    "transparent"};
  border: 1px solid ${(p) =>
    p.$variant === "primary" ? `rgba(${rgb.gold}, 0.55)` :
    p.$variant === "danger" ? `rgba(${rgb.pink}, 0.55)` :
    "var(--t-border)"};
  color: ${(p) =>
    p.$variant === "primary" ? colors.gold :
    p.$variant === "danger" ? colors.pink :
    "var(--t-textBase)"};
  &:hover { filter: brightness(1.12); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const IconBtn = styled.button`
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.35rem;
  background: transparent;
  border: 1px solid var(--t-border);
  color: var(--t-textFaint);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  svg { width: 12px; height: 12px; }
  &:hover { background: rgba(${rgb.pink}, 0.14); color: ${colors.pink}; }
`;

const Err = styled.div`
  color: ${colors.pink};
  font-size: 0.75rem;
  margin-top: 0.5rem;
`;

// ── Helpers ──────────────────────────────────────────────────────

function serializeAssignment(a: DidAssignment): string {
  if (a.kind === "user") return `user:${a.username}`;
  return a.kind;
}
function parseAssignment(raw: string): DidAssignment {
  if (raw === "frontdesk") return { kind: "frontdesk" };
  if (raw === "unassigned") return { kind: "unassigned" };
  if (raw.startsWith("user:")) return { kind: "user", username: raw.slice(5) };
  return { kind: "frontdesk" };
}

// ── Component ────────────────────────────────────────────────────

export default function DidManagerModal(props: {
  onClose: () => void;
}) {
  const { onClose } = props;
  const [dids, setDids] = useState<Did[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [newPhone, setNewPhone] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newAssignment, setNewAssignment] = useState<DidAssignment>({ kind: "frontdesk" });
  const [provision, setProvision] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [didsRes, usersRes] = await Promise.all([
      fetch("/api/frontdesk/dids"),
      fetch("/api/users/profile"),
    ]);
    if (didsRes.ok) setDids((await didsRes.json()).dids ?? []);
    if (usersRes.ok) setProfiles((await usersRes.json()).profiles ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateDid = async (id: string, patch: { label?: string; assignment?: DidAssignment }) => {
    const res = await fetch(`/api/frontdesk/dids/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const j = await res.json();
      setDids(prev => prev.map(d => (d.id === id && j.did ? j.did : d)));
    }
  };

  const releaseDid = async (id: string) => {
    if (!window.confirm("Release this DID? This deactivates it locally (and on Telnyx if provisioned).")) return;
    const res = await fetch(`/api/frontdesk/dids/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDids(prev => prev.filter(d => d.id !== id));
    } else {
      const j = await res.json().catch(() => ({ error: `Delete failed (${res.status})` }));
      setError(j.error ?? "Delete failed");
    }
  };

  const createDid = async () => {
    if (!newPhone.trim()) { setError("Phone number required."); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/frontdesk/dids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: newPhone.trim(),
          label: newLabel.trim(),
          assignment: newAssignment,
          provision,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: `Create failed (${res.status})` }));
        setError(j.error ?? "Create failed");
        return;
      }
      const j = await res.json();
      setDids(prev => [...prev, j.did]);
      setNewPhone("");
      setNewLabel("");
      setNewAssignment({ kind: "frontdesk" });
      setProvision(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="gold" onClick={(e) => e.stopPropagation()} $maxWidth="40rem">
        <ModalHeader>
          <ModalHeaderLeft>
            <ModalTitle $color={colors.gold}>DID manager</ModalTitle>
          </ModalHeaderLeft>
          <CloseBtn onClick={onClose} title="Close">✕</CloseBtn>
        </ModalHeader>
        <ModalBody>
          <Section>
            <SectionHead>Active numbers</SectionHead>
            {dids.length === 0 ? (
              <div style={{ color: "var(--t-textGhost)", fontSize: "0.8125rem" }}>
                No DIDs registered yet.
              </div>
            ) : (
              <DidList>
                {dids.map(d => (
                  <DidRow key={d.id}>
                    <DidHead>
                      <DidLabel
                        defaultValue={d.label}
                        onBlur={(e) => {
                          if (e.target.value !== d.label) updateDid(d.id, { label: e.target.value });
                        }}
                      />
                      <DidNum>{d.e164}</DidNum>
                      <IconBtn title="Release" onClick={() => releaseDid(d.id)}>
                        <TrashIcon size={12} />
                      </IconBtn>
                    </DidHead>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.75rem", gridColumn: "1 / -1" }}>
                      <span style={{ color: "var(--t-textFaint)" }}>Routes to:</span>
                      <Select
                        value={serializeAssignment(d.assignment)}
                        onChange={(e) => updateDid(d.id, { assignment: parseAssignment(e.target.value) })}
                      >
                        <option value="frontdesk">Front desk (shift worker)</option>
                        <option value="unassigned">Unassigned (voicemail only)</option>
                        {profiles.map(p => (
                          <option key={p.username} value={`user:${p.username}`}>
                            {p.displayName} ({p.username})
                          </option>
                        ))}
                      </Select>
                      {d.telnyxId && <span style={{ color: "var(--t-textFaint)" }}>telnyx: {d.telnyxId}</span>}
                    </div>
                  </DidRow>
                ))}
              </DidList>
            )}
          </Section>

          <Section>
            <SectionHead>Add a number</SectionHead>
            <AddGrid>
              <Input
                placeholder="+1 555 123 4567"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                inputMode="tel"
              />
              <Input
                placeholder="Label (e.g. TGV Main)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
              <Select
                value={serializeAssignment(newAssignment)}
                onChange={(e) => setNewAssignment(parseAssignment(e.target.value))}
              >
                <option value="frontdesk">Front desk (shift worker)</option>
                <option value="unassigned">Unassigned</option>
                {profiles.map(p => (
                  <option key={p.username} value={`user:${p.username}`}>
                    {p.displayName}
                  </option>
                ))}
              </Select>
              <CheckboxRow>
                <input type="checkbox" checked={provision} onChange={(e) => setProvision(e.target.checked)} />
                Provision via Telnyx (orders a new number; otherwise registers an existing DID)
              </CheckboxRow>
            </AddGrid>
            {error && <Err>{error}</Err>}
          </Section>
        </ModalBody>
        <FooterRow>
          <Btn type="button" $variant="ghost" onClick={onClose} disabled={busy}>Close</Btn>
          <Btn type="button" $variant="primary" onClick={createDid} disabled={busy || !newPhone.trim()}>Add DID</Btn>
        </FooterRow>
      </ModalContainer>
    </ModalBackdrop>
  );
}
