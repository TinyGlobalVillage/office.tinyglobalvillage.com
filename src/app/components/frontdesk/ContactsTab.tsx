"use client";

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import type { Contact, ContactKind } from "@/lib/frontdesk/types";
import ContactCardModal from "./ContactCardModal";
import { PhoneIcon, ChatIcon, EditIcon, TrashIcon } from "../icons";

type Scope = "all" | "client" | "employee";

// ── Styled ───────────────────────────────────────────────────────

const Wrap = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem;
  border-bottom: 1px solid rgba(${rgb.gold}, 0.12);
  background: rgba(${rgb.gold}, 0.03);
`;

const Search = styled.input`
  flex: 1;
  min-width: 10rem;
  padding: 0.45rem 0.6rem;
  font-size: 0.8125rem;
  background: rgba(0, 0, 0, 0.3);
  color: var(--t-textBase);
  border: 1px solid rgba(${rgb.gold}, 0.3);
  border-radius: 0.5rem;
  outline: none;
  &:focus { border-color: rgba(${rgb.gold}, 0.6); }
  [data-theme="light"] & { background: rgba(255, 255, 255, 0.7); }
`;

const ScopeChip = styled.button<{ $active: boolean }>`
  padding: 0.35rem 0.7rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 0.375rem;
  cursor: pointer;
  background: ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.22)` : "transparent")};
  border: 1px solid ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.55)` : "var(--t-border)")};
  color: ${(p) => (p.$active ? colors.gold : "var(--t-textFaint)")};
`;

const AddBtn = styled.button`
  padding: 0.45rem 0.7rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  border-radius: 0.5rem;
  border: 1px dashed rgba(${rgb.gold}, 0.55);
  background: rgba(${rgb.gold}, 0.08);
  color: ${colors.gold};
  cursor: pointer;
  text-transform: uppercase;
  &:hover { background: rgba(${rgb.gold}, 0.2); }
`;

const List = styled.ul`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const Row = styled.li`
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.25rem 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  transition: background 0.12s;

  &:hover {
    background: rgba(${rgb.gold}, 0.08);
  }
  &:hover .row-actions { opacity: 1; }
`;

const RowName = styled.div`
  font-weight: 600;
  color: var(--t-textBase);
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;

const RowSub = styled.div`
  grid-column: 1 / -1;
  font-size: 0.75rem;
  color: var(--t-textGhost);
  display: flex;
  gap: 0.75rem;
`;

const KindBadge = styled.span<{ $kind: ContactKind }>`
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 1px 6px;
  border-radius: 0.25rem;
  background: ${(p) => (p.$kind === "employee" ? `rgba(${rgb.cyan}, 0.15)` : `rgba(${rgb.gold}, 0.16)`)};
  color: ${(p) => (p.$kind === "employee" ? colors.cyan : colors.gold)};
  text-transform: uppercase;
`;

const RowActions = styled.div.attrs({ className: "row-actions" })`
  display: flex;
  gap: 0.3rem;
  opacity: 0;
  transition: opacity 0.12s;

  @media (max-width: 768px) {
    opacity: 1;
  }
`;

const IconBtn = styled.button`
  width: 1.75rem;
  height: 1.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.35rem;
  background: transparent;
  border: 1px solid var(--t-border);
  color: var(--t-textFaint);
  cursor: pointer;
  &:hover { background: rgba(${rgb.gold}, 0.14); color: ${colors.gold}; }
  svg { width: 12px; height: 12px; }
`;

const DangerIconBtn = styled(IconBtn)`
  &:hover { background: rgba(${rgb.pink}, 0.14); color: ${colors.pink}; }
`;

const Empty = styled.div`
  text-align: center;
  padding: 2rem 0;
  color: var(--t-textGhost);
  font-size: 0.8125rem;
`;

// ── Component ────────────────────────────────────────────────────

export default function ContactsTab() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [scope, setScope] = useState<Scope>("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ contact: Contact | null; mode: "view" | "edit" | "new" } | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (scope !== "all") params.set("kind", scope);
    if (search.trim()) params.set("search", search.trim());
    try {
      const res = await fetch(`/api/frontdesk/contacts?${params.toString()}`);
      if (!res.ok) return;
      const j = await res.json();
      setContacts(j.contacts ?? []);
    } catch { /* ignore */ }
  }, [scope, search]);

  useEffect(() => {
    const id = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(id);
  }, [load, search]);

  const onSaved = (c: Contact) => {
    setContacts(prev => {
      const idx = prev.findIndex(x => x.id === c.id);
      if (idx < 0) return [c, ...prev];
      const next = prev.slice();
      next[idx] = c;
      return next;
    });
    setModal({ contact: c, mode: "view" });
  };

  const onDeleted = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  const dialContact = (c: Contact, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!c.phone) return;
    window.dispatchEvent(new CustomEvent("frontdesk-dial-prefill", { detail: { to: c.phone } }));
  };

  const smsContact = (c: Contact, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!c.phone) return;
    window.dispatchEvent(new CustomEvent("frontdesk-sms-open", { detail: { peer: c.phone } }));
  };

  return (
    <Wrap>
      <Toolbar>
        <ScopeChip $active={scope === "all"} onClick={() => setScope("all")}>All</ScopeChip>
        <ScopeChip $active={scope === "client"} onClick={() => setScope("client")}>Clients</ScopeChip>
        <ScopeChip $active={scope === "employee"} onClick={() => setScope("employee")}>Employees</ScopeChip>
        <Search
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, company, phone…"
        />
        <AddBtn onClick={() => setModal({ contact: null, mode: "new" })}>+ Add</AddBtn>
      </Toolbar>

      {contacts.length === 0 ? (
        <Empty>{search ? "No matches." : "No contacts yet."}</Empty>
      ) : (
        <List>
          {contacts.map(c => (
            <Row key={c.id} onClick={() => setModal({ contact: c, mode: "view" })}>
              <RowName>
                <KindBadge $kind={c.kind}>{c.kind}</KindBadge>
                {c.name}
              </RowName>
              <RowActions>
                <IconBtn title="Call" onClick={(e) => dialContact(c, e)} disabled={!c.phone}>
                  <PhoneIcon size={12} />
                </IconBtn>
                <IconBtn title="SMS" onClick={(e) => smsContact(c, e)} disabled={!c.phone}>
                  <ChatIcon size={12} />
                </IconBtn>
                <IconBtn title="Edit" onClick={(e) => { e.stopPropagation(); setModal({ contact: c, mode: "edit" }); }}>
                  <EditIcon size={12} />
                </IconBtn>
                <DangerIconBtn
                  title="Delete"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!window.confirm(`Delete ${c.name}?`)) return;
                    await fetch(`/api/frontdesk/contacts/${c.id}`, { method: "DELETE" });
                    onDeleted(c.id);
                  }}
                >
                  <TrashIcon size={12} />
                </DangerIconBtn>
              </RowActions>
              <RowSub>
                {c.company && <span>{c.company}</span>}
                {c.phone && <span>{c.phone}</span>}
                {c.email && <span>{c.email}</span>}
              </RowSub>
            </Row>
          ))}
        </List>
      )}

      {modal && (
        <ContactCardModal
          contact={modal.contact}
          mode={modal.mode}
          onClose={() => setModal(null)}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
    </Wrap>
  );
}
