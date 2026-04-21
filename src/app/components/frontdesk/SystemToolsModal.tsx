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
import type { Did, DidAssignment, ShiftAssignment } from "@/lib/frontdesk/types";
import { TrashIcon } from "../icons";
import NeonLineDDM from "./NeonLineDDM";

type Profile = { username: string; displayName: string; role?: "admin" | "employee" };

// ── Styled ───────────────────────────────────────────────────────

const Section = styled.div`
  & + & {
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid rgba(${rgb.gold}, 0.15);
  }
`;

const SectionHead = styled.h3`
  margin: 0 0 0.5rem;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: ${colors.gold};
`;

const SectionHint = styled.div`
  font-size: 0.75rem;
  color: var(--t-textGhost);
  margin: -0.25rem 0 0.5rem;
`;

const UserList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const UserRow = styled.li<{ $active: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.7rem;
  border-radius: 0.4rem;
  cursor: pointer;
  background: ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.18)` : "rgba(255,255,255,0.02)")};
  border: 1px solid ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.55)` : "var(--t-border)")};
  color: var(--t-textBase);
  font-weight: ${(p) => (p.$active ? 700 : 500)};
  font-size: 0.8125rem;
  &:hover { background: rgba(${rgb.gold}, 0.12); }
`;

const UnassignRow = styled(UserRow)`
  font-style: italic;
  color: var(--t-textGhost);
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
  padding: 0.6rem 0.7rem;
  border-radius: 0.45rem;
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
  padding: 0.3rem 0.5rem;
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
  padding: 0.3rem 0.45rem;
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
  margin-top: 0.6rem;
`;

const Input = styled.input`
  padding: 0.4rem 0.55rem;
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

const IconBtn = styled.button`
  width: 1.65rem;
  height: 1.65rem;
  border-radius: 0.35rem;
  background: transparent;
  border: 1px solid var(--t-border);
  color: var(--t-textFaint);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  svg { width: 11px; height: 11px; }
  &:hover { background: rgba(${rgb.pink}, 0.14); color: ${colors.pink}; }
`;

const Btn = styled.button<{ $variant: "primary" | "ghost" }>`
  padding: 0.45rem 0.85rem;
  font-size: 0.8125rem;
  font-weight: 600;
  border-radius: 0.5rem;
  cursor: pointer;
  background: ${(p) => (p.$variant === "primary" ? `rgba(${rgb.gold}, 0.2)` : "transparent")};
  border: 1px solid ${(p) => (p.$variant === "primary" ? `rgba(${rgb.gold}, 0.55)` : "var(--t-border)")};
  color: ${(p) => (p.$variant === "primary" ? colors.gold : "var(--t-textBase)")};
  &:hover { filter: brightness(1.12); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const FlashHint = styled.div<{ $ok?: boolean }>`
  font-size: 0.75rem;
  color: ${(p) => (p.$ok ? colors.green : colors.pink)};
  margin-top: 0.4rem;
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

export default function SystemToolsModal(props: {
  onClose: () => void;
  onShiftSaved?: (shift: ShiftAssignment) => void;
  onDidsChanged?: () => void;
}) {
  const { onClose, onShiftSaved, onDidsChanged } = props;

  // Data
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [dids, setDids] = useState<Did[]>([]);
  const [shift, setShift] = useState<ShiftAssignment | null>(null);

  // Default-line selection
  const [defaultFlash, setDefaultFlash] = useState<string | null>(null);

  // Shift picker
  const [shiftSelected, setShiftSelected] = useState<string | null>(null);
  const [savingShift, setSavingShift] = useState(false);

  // DID add form
  const [newPhone, setNewPhone] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newAssignment, setNewAssignment] = useState<DidAssignment>({ kind: "frontdesk" });
  const [provision, setProvision] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [didsRes, usersRes, shiftRes] = await Promise.all([
      fetch("/api/frontdesk/dids"),
      fetch("/api/users/profile"),
      fetch("/api/frontdesk/shift"),
    ]);
    if (didsRes.ok) setDids((await didsRes.json()).dids ?? []);
    if (usersRes.ok) setProfiles((await usersRes.json()).profiles ?? []);
    if (shiftRes.ok) {
      const j = await shiftRes.json();
      setShift(j.shift ?? null);
      setShiftSelected(j.shift?.username ?? null);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeDids = dids.filter(d => !d.releasedAt);
  const currentDefault = activeDids.find(d => d.assignment.kind === "frontdesk") ?? activeDids[0] ?? null;

  // Select a new default: promote this DID to frontdesk, demote others.
  const setDefault = async (didId: string) => {
    setDefaultFlash(null);
    const toPromote = activeDids.find(d => d.id === didId);
    if (!toPromote) return;
    const toDemote = activeDids.filter(d => d.id !== didId && d.assignment.kind === "frontdesk");
    try {
      await Promise.all([
        ...toDemote.map(d => fetch(`/api/frontdesk/dids/${d.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignment: { kind: "unassigned" } }),
        })),
        fetch(`/api/frontdesk/dids/${didId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignment: { kind: "frontdesk" } }),
        }),
      ]);
      await load();
      onDidsChanged?.();
      setDefaultFlash(`Default set to ${toPromote.label} — ${toPromote.e164}`);
      setTimeout(() => setDefaultFlash(null), 3000);
    } catch {
      setDefaultFlash("Failed to update default line");
    }
  };

  const saveShift = async () => {
    setSavingShift(true);
    try {
      const res = await fetch("/api/frontdesk/shift", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: shiftSelected }),
      });
      if (res.ok) {
        const j = await res.json();
        setShift(j.shift);
        onShiftSaved?.(j.shift);
      }
    } finally {
      setSavingShift(false);
    }
  };

  const updateDid = async (id: string, patch: { label?: string; assignment?: DidAssignment }) => {
    const res = await fetch(`/api/frontdesk/dids/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const j = await res.json();
      setDids(prev => prev.map(d => (d.id === id && j.did ? j.did : d)));
      onDidsChanged?.();
    }
  };

  const releaseDid = async (id: string) => {
    if (!window.confirm("Release this DID? This deactivates it locally (and on Telnyx if provisioned).")) return;
    const res = await fetch(`/api/frontdesk/dids/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDids(prev => prev.filter(d => d.id !== id));
      onDidsChanged?.();
    }
  };

  const createDid = async () => {
    if (!newPhone.trim()) { setAddError("Phone number required."); return; }
    setAddBusy(true);
    setAddError(null);
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
        setAddError(j.error ?? "Create failed");
        return;
      }
      const j = await res.json();
      setDids(prev => [...prev, j.did]);
      setNewPhone("");
      setNewLabel("");
      setNewAssignment({ kind: "frontdesk" });
      setProvision(false);
      onDidsChanged?.();
    } finally {
      setAddBusy(false);
    }
  };

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="gold" onClick={(e) => e.stopPropagation()} $maxWidth="44rem">
        <ModalHeader>
          <ModalHeaderLeft>
            <ModalTitle $color={colors.gold}>Front Desk · System Tools</ModalTitle>
          </ModalHeaderLeft>
          <CloseBtn onClick={onClose} title="Close">✕</CloseBtn>
        </ModalHeader>
        <ModalBody>
          {/* ── Default outbound line ─────────────────────── */}
          <Section>
            <SectionHead>Default outbound line</SectionHead>
            <SectionHint>
              Selecting a number here makes it the default caller-ID and the inbound front-desk target. Changes apply instantly.
            </SectionHint>
            {activeDids.length === 0 ? (
              <div style={{ color: "var(--t-textGhost)", fontSize: "0.8125rem" }}>
                No DIDs yet — add one below.
              </div>
            ) : (
              <NeonLineDDM
                value={currentDefault?.id ?? null}
                onChange={(id) => setDefault(id)}
                title="Default outbound line"
                options={activeDids.map(d => ({
                  id: d.id,
                  label: d.label,
                  sublabel: d.e164,
                  meta: d.assignment.kind === "frontdesk" ? "★ current" : undefined,
                }))}
              />
            )}
            {defaultFlash && <FlashHint $ok={!defaultFlash.startsWith("Failed")}>{defaultFlash}</FlashHint>}
          </Section>

          {/* ── Shift worker ──────────────────────────────── */}
          <Section>
            <SectionHead>Today&apos;s shift worker</SectionHead>
            <SectionHint>
              Current: <strong>{shift?.username ?? "— (ring all online)"}</strong>
              {shift?.updatedAt && <> · set by {shift.updatedBy} {new Date(shift.updatedAt).toLocaleString()}</>}
            </SectionHint>
            <UserList>
              <UnassignRow $active={shiftSelected === null} onClick={() => setShiftSelected(null)}>
                <span>No assignment (ring all online)</span>
                {shiftSelected === null && <span>✓</span>}
              </UnassignRow>
              {profiles.map(p => (
                <UserRow
                  key={p.username}
                  $active={shiftSelected === p.username}
                  onClick={() => setShiftSelected(p.username)}
                >
                  <span>
                    {p.displayName}{" "}
                    <small style={{ color: "var(--t-textFaint)" }}>({p.username})</small>
                  </span>
                  {shiftSelected === p.username && <span>✓</span>}
                </UserRow>
              ))}
            </UserList>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.6rem" }}>
              <Btn type="button" $variant="primary" onClick={saveShift} disabled={savingShift}>
                {savingShift ? "Saving…" : "Save shift"}
              </Btn>
            </div>
          </Section>

          {/* ── DIDs manager ──────────────────────────────── */}
          <Section>
            <SectionHead>DIDs</SectionHead>
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
                    <div style={{
                      display: "flex", gap: "0.5rem", alignItems: "center",
                      fontSize: "0.75rem", gridColumn: "1 / -1",
                    }}>
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
                      {d.telnyxId && (
                        <span style={{ color: "var(--t-textFaint)" }}>telnyx: {d.telnyxId}</span>
                      )}
                    </div>
                  </DidRow>
                ))}
              </DidList>
            )}

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
                <input
                  type="checkbox"
                  checked={provision}
                  onChange={(e) => setProvision(e.target.checked)}
                />
                Provision via Telnyx (orders a new number)
              </CheckboxRow>
            </AddGrid>
            {addError && <FlashHint>{addError}</FlashHint>}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.6rem" }}>
              <Btn
                type="button"
                $variant="primary"
                onClick={createDid}
                disabled={addBusy || !newPhone.trim()}
              >
                {addBusy ? "Adding…" : "Add DID"}
              </Btn>
            </div>
          </Section>
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}
