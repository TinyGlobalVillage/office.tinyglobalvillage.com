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
import type { ShiftAssignment } from "@/lib/frontdesk/types";

type Profile = { username: string; displayName: string; role?: "admin" | "employee" };

const FooterRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.85rem 1.5rem;
  border-top: 1px solid var(--t-border);
  background: rgba(${rgb.gold}, 0.03);
`;

const Btn = styled.button<{ $variant: "primary" | "ghost" }>`
  padding: 0.55rem 1rem;
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
  padding: 0.55rem 0.75rem;
  border-radius: 0.5rem;
  cursor: pointer;
  background: ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.18)` : "rgba(255,255,255,0.02)")};
  border: 1px solid ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.55)` : "var(--t-border)")};
  color: var(--t-textBase);
  font-weight: ${(p) => (p.$active ? 700 : 500)};

  &:hover { background: rgba(${rgb.gold}, 0.12); }
`;

const UnassignRow = styled(UserRow)`
  font-style: italic;
  color: var(--t-textGhost);
`;

const CurrentLine = styled.div`
  margin: -0.25rem 0 1rem;
  font-size: 0.8125rem;
  color: var(--t-textGhost);
`;

export default function ShiftWorkerModal(props: {
  onClose: () => void;
  onSaved?: (shift: ShiftAssignment) => void;
}) {
  const { onClose, onSaved } = props;
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [current, setCurrent] = useState<ShiftAssignment | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [usersRes, shiftRes] = await Promise.all([
      fetch("/api/users/profile"),
      fetch("/api/frontdesk/shift"),
    ]);
    if (usersRes.ok) {
      const j = await usersRes.json();
      setProfiles(j.profiles ?? []);
    }
    if (shiftRes.ok) {
      const j = await shiftRes.json();
      setCurrent(j.shift ?? null);
      setSelected(j.shift?.username ?? null);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/frontdesk/shift", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: selected }),
      });
      if (res.ok) {
        const j = await res.json();
        onSaved?.(j.shift);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="gold" onClick={(e) => e.stopPropagation()} $maxWidth="28rem">
        <ModalHeader>
          <ModalHeaderLeft>
            <ModalTitle $color={colors.gold}>Today&apos;s shift worker</ModalTitle>
          </ModalHeaderLeft>
          <CloseBtn onClick={onClose} title="Close">✕</CloseBtn>
        </ModalHeader>
        <ModalBody>
          <CurrentLine>
            Current: <strong>{current?.username ?? "— (ring all online)"}</strong>
            {current?.updatedAt && (
              <>
                {" "}· set by {current.updatedBy} {new Date(current.updatedAt).toLocaleString()}
              </>
            )}
          </CurrentLine>
          <UserList>
            <UnassignRow $active={selected === null} onClick={() => setSelected(null)}>
              <span>No assignment (ring all online)</span>
              {selected === null && <span>✓</span>}
            </UnassignRow>
            {profiles.map(p => (
              <UserRow
                key={p.username}
                $active={selected === p.username}
                onClick={() => setSelected(p.username)}
              >
                <span>{p.displayName} <small style={{ color: "var(--t-textFaint)" }}>({p.username})</small></span>
                {selected === p.username && <span>✓</span>}
              </UserRow>
            ))}
          </UserList>
        </ModalBody>
        <FooterRow>
          <Btn type="button" $variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
          <Btn type="button" $variant="primary" onClick={save} disabled={saving}>Save</Btn>
        </FooterRow>
      </ModalContainer>
    </ModalBackdrop>
  );
}
