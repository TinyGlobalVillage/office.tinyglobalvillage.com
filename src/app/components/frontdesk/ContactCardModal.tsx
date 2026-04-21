"use client";

import { useState, useEffect } from "react";
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
import type { Contact, ContactKind } from "@/lib/frontdesk/types";

// ── Styled ───────────────────────────────────────────────────────

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.85rem;

  @media (min-width: 540px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const FieldLabel = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: var(--t-textFaint);
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;

const Input = styled.input`
  padding: 0.55rem 0.75rem;
  font-size: 0.875rem;
  color: var(--t-textBase);
  background: var(--t-inputBg);
  border: 1px solid var(--t-border);
  border-radius: 0.5rem;
  outline: none;

  &:focus { border-color: rgba(${rgb.gold}, 0.55); }
`;

const Textarea = styled.textarea`
  min-height: 4.5rem;
  padding: 0.55rem 0.75rem;
  font-size: 0.8125rem;
  color: var(--t-textBase);
  background: var(--t-inputBg);
  border: 1px solid var(--t-border);
  border-radius: 0.5rem;
  outline: none;
  resize: vertical;

  &:focus { border-color: rgba(${rgb.gold}, 0.55); }
`;

const KindRow = styled.div`
  display: inline-flex;
  gap: 0.35rem;
`;

const KindChip = styled.button<{ $active: boolean }>`
  padding: 0.35rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 0.4rem;
  cursor: pointer;
  background: ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.2)` : "transparent")};
  border: 1px solid ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.55)` : "var(--t-border)")};
  color: ${(p) => (p.$active ? colors.gold : "var(--t-textFaint)")};
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
`;

// ── Types ────────────────────────────────────────────────────────

export type ContactDraft = {
  id?: string;
  kind: ContactKind;
  name: string;
  phone: string;
  email: string;
  company: string;
  notes: string;
};

function emptyDraft(): ContactDraft {
  return { kind: "client", name: "", phone: "", email: "", company: "", notes: "" };
}

function fromContact(c: Contact): ContactDraft {
  return {
    id: c.id,
    kind: c.kind,
    name: c.name,
    phone: c.phone ?? "",
    email: c.email ?? "",
    company: c.company ?? "",
    notes: c.notes,
  };
}

// ── Component ────────────────────────────────────────────────────

export default function ContactCardModal(props: {
  contact: Contact | null;
  mode: "view" | "edit" | "new";
  onClose: () => void;
  onSaved: (contact: Contact) => void;
  onDeleted?: (id: string) => void;
}) {
  const { contact, mode, onClose, onSaved, onDeleted } = props;
  const [draft, setDraft] = useState<ContactDraft>(emptyDraft);
  const [editing, setEditing] = useState(mode !== "view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(contact ? fromContact(contact) : emptyDraft());
    setEditing(mode !== "view");
    setError(null);
  }, [contact, mode]);

  const save = async () => {
    if (!draft.name.trim()) { setError("Name is required."); return; }
    setBusy(true);
    setError(null);
    try {
      const url = draft.id ? `/api/frontdesk/contacts/${draft.id}` : "/api/frontdesk/contacts";
      const method = draft.id ? "PATCH" : "POST";
      const payload = { ...draft };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: `Save failed (${res.status})` }));
        setError(j.error ?? "Save failed");
        return;
      }
      const j = await res.json();
      onSaved(j.contact);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!draft.id) return;
    if (!window.confirm(`Delete ${draft.name}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/frontdesk/contacts/${draft.id}`, { method: "DELETE" });
      if (res.ok) {
        onDeleted?.(draft.id);
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  const readOnly = !editing;

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="gold" onClick={(e) => e.stopPropagation()} $maxWidth="34rem">
        <ModalHeader>
          <ModalHeaderLeft>
            <ModalTitle $color={colors.gold}>
              {mode === "new" ? "New contact" : editing ? "Edit contact" : draft.name || "Contact"}
            </ModalTitle>
          </ModalHeaderLeft>
          <CloseBtn onClick={onClose} title="Close">✕</CloseBtn>
        </ModalHeader>

        <ModalBody>
          <KindRow style={{ marginBottom: "0.9rem" }}>
            <KindChip
              type="button"
              $active={draft.kind === "client"}
              onClick={() => !readOnly && setDraft(d => ({ ...d, kind: "client" }))}
              disabled={readOnly}
            >Client</KindChip>
            <KindChip
              type="button"
              $active={draft.kind === "employee"}
              onClick={() => !readOnly && setDraft(d => ({ ...d, kind: "employee" }))}
              disabled={readOnly}
            >Employee</KindChip>
          </KindRow>

          <FieldGrid>
            <FieldLabel>
              Name
              <Input
                value={draft.name}
                readOnly={readOnly}
                onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}
              />
            </FieldLabel>
            <FieldLabel>
              Phone
              <Input
                value={draft.phone}
                readOnly={readOnly}
                inputMode="tel"
                placeholder="+15551234567"
                onChange={(e) => setDraft(d => ({ ...d, phone: e.target.value }))}
              />
            </FieldLabel>
            <FieldLabel>
              Email
              <Input
                value={draft.email}
                readOnly={readOnly}
                inputMode="email"
                onChange={(e) => setDraft(d => ({ ...d, email: e.target.value }))}
              />
            </FieldLabel>
            <FieldLabel>
              Company
              <Input
                value={draft.company}
                readOnly={readOnly}
                onChange={(e) => setDraft(d => ({ ...d, company: e.target.value }))}
              />
            </FieldLabel>
          </FieldGrid>

          <FieldLabel style={{ marginTop: "0.85rem" }}>
            Notes
            <Textarea
              value={draft.notes}
              readOnly={readOnly}
              onChange={(e) => setDraft(d => ({ ...d, notes: e.target.value }))}
            />
          </FieldLabel>

          {error && <div style={{ marginTop: "0.75rem", color: colors.pink, fontSize: "0.8125rem" }}>{error}</div>}
        </ModalBody>

        <FooterRow>
          <div>
            {draft.id && editing && (
              <Btn type="button" $variant="danger" onClick={remove} disabled={busy}>Delete</Btn>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Btn type="button" $variant="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
            {!editing ? (
              <Btn type="button" $variant="primary" onClick={() => setEditing(true)}>Edit</Btn>
            ) : (
              <Btn type="button" $variant="primary" onClick={save} disabled={busy}>Save</Btn>
            )}
          </div>
        </FooterRow>
      </ModalContainer>
    </ModalBackdrop>
  );
}
