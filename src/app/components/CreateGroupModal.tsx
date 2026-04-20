"use client";

import { useMemo, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../theme";
import { UserAvatar, type MemberProfile } from "./ChatSettingsModal";
import { CancelIcon } from "./icons";

type Visibility = "open" | "restricted" | "invisible";

const Overlay = styled.div`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(2px);
  z-index: 400;
  display: flex; align-items: center; justify-content: center;
`;

const Modal = styled.div`
  width: min(480px, 94vw);
  max-height: 82vh;
  display: flex; flex-direction: column;
  background: var(--t-surface);
  border: 1px solid var(--t-borderStrong);
  border-radius: 14px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.55);
  overflow: hidden;

  @media (max-width: 768px) {
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
    border-left: none;
    border-right: none;
  }
`;

const Header = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--t-border);
`;

const Title = styled.h3`
  margin: 0; font-size: 0.8125rem; color: var(--t-text);
`;

const CloseBtn = styled.button`
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 6px;
  background: transparent; border: none;
  color: var(--t-textMuted); cursor: pointer;
  &:hover { background: rgba(255,255,255,0.06); color: var(--t-text); }
`;

const Body = styled.div`
  padding: 0.85rem 1rem;
  overflow-y: auto;
  display: flex; flex-direction: column; gap: 0.75rem;
`;

const Label = styled.label`
  font-size: 0.6875rem;
  color: var(--t-textMuted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.5rem 0.65rem;
  font-size: 0.8125rem;
  border-radius: 8px;
  background: var(--t-inputBg);
  border: 1px solid var(--t-border);
  color: var(--t-text);
  outline: none;
  &:focus { border-color: rgba(${rgb.green}, 0.55); }
`;

const VisRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.4rem;
`;

const VisCard = styled.button<{ $active: boolean }>`
  display: flex; flex-direction: column; gap: 2px;
  padding: 0.5rem 0.6rem;
  border-radius: 8px;
  background: ${(p) => p.$active ? `rgba(${rgb.green}, 0.12)` : "var(--t-inputBg)"};
  border: 1px solid ${(p) => p.$active ? colors.green : "var(--t-border)"};
  color: var(--t-text);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
  &:hover { border-color: ${(p) => p.$active ? colors.green : "var(--t-borderStrong)"}; }
`;

const VisName = styled.span`
  font-size: 0.75rem; font-weight: 600;
`;

const VisNote = styled.span`
  font-size: 0.6875rem; color: var(--t-textMuted);
`;

const SearchInput = styled(Input)`
  margin-bottom: 0.35rem;
`;

const MemberList = styled.div`
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--t-border);
  border-radius: 8px;
  padding: 0.3rem;
  display: flex; flex-direction: column; gap: 2px;
`;

const MemberRow = styled.button<{ $selected: boolean }>`
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  background: ${(p) => p.$selected ? `rgba(${rgb.green}, 0.15)` : "transparent"};
  border: 1px solid ${(p) => p.$selected ? `rgba(${rgb.green}, 0.45)` : "transparent"};
  color: var(--t-text);
  cursor: pointer;
  text-align: left;
  &:hover { background: rgba(255,255,255,0.04); }
`;

const RowName = styled.span`
  font-size: 0.75rem;
`;

const RowUsername = styled.span`
  font-size: 0.6875rem;
  color: var(--t-textMuted);
`;

const SelectedStrip = styled.div`
  display: flex; flex-wrap: wrap; gap: 4px;
`;

const Chip = styled.span`
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 4px 2px 8px;
  font-size: 0.6875rem;
  border-radius: 999px;
  background: rgba(${rgb.green}, 0.14);
  border: 1px solid rgba(${rgb.green}, 0.45);
  color: ${colors.green};
`;

const ChipClose = styled.button`
  display: inline-flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; border-radius: 50%;
  background: transparent; border: none;
  color: inherit; cursor: pointer;
  &:hover { background: rgba(255,255,255,0.08); }
`;

const Footer = styled.div`
  display: flex; justify-content: flex-end; gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--t-border);
`;

const GhostBtn = styled.button`
  padding: 0.45rem 0.85rem;
  font-size: 0.75rem;
  border-radius: 8px;
  background: transparent;
  border: 1px solid var(--t-border);
  color: var(--t-text);
  cursor: pointer;
  &:hover { background: rgba(255,255,255,0.04); }
`;

const PrimaryBtn = styled.button`
  padding: 0.45rem 0.95rem;
  font-size: 0.75rem;
  border-radius: 8px;
  background: rgba(${rgb.green}, 0.18);
  border: 1px solid rgba(${rgb.green}, 0.55);
  color: ${colors.green};
  cursor: pointer;
  &:hover { box-shadow: 0 0 10px rgba(${rgb.green}, 0.4); }
  &:disabled { opacity: 0.4; cursor: default; box-shadow: none; }
`;

const Error = styled.div`
  font-size: 0.6875rem;
  color: ${colors.red};
`;

type Props = {
  profiles: MemberProfile[];
  currentUser: string;
  onClose: () => void;
  onCreated: (groupId: string) => void;
};

export default function CreateGroupModal({ profiles, currentUser, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<Visibility>("open");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const available = useMemo(
    () => profiles.filter((p) => p.username !== currentUser),
    [profiles, currentUser]
  );
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return available;
    return available.filter((p) =>
      p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q)
    );
  }, [available, query]);

  const toggleMember = (username: string) => {
    setSelected((prev) => prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]);
  };

  const submit = async () => {
    setError("");
    if (!name.trim()) { setError("Name required."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/chat/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), memberIds: selected, visibility }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? `HTTP ${res.status}`); return; }
      onCreated(data.group.id);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? (e as Error).message : String(e);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Overlay onMouseDown={onClose}>
      <Modal onMouseDown={(e) => e.stopPropagation()}>
        <Header>
          <Title>New group chat</Title>
          <CloseBtn onClick={onClose} title="Close"><CancelIcon size={14} /></CloseBtn>
        </Header>
        <Body>
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Launch War Room"
              maxLength={60}
              autoFocus
            />
          </div>

          <div>
            <Label>Visibility</Label>
            <VisRow>
              <VisCard $active={visibility === "open"} onClick={() => setVisibility("open")}>
                <VisName>Open</VisName>
                <VisNote>Anyone can see &amp; join</VisNote>
              </VisCard>
              <VisCard $active={visibility === "restricted"} onClick={() => setVisibility("restricted")}>
                <VisName>Restricted</VisName>
                <VisNote>Visible, invite to join</VisNote>
              </VisCard>
              <VisCard $active={visibility === "invisible"} onClick={() => setVisibility("invisible")}>
                <VisName>Invisible</VisName>
                <VisNote>Only members see</VisNote>
              </VisCard>
            </VisRow>
          </div>

          <div>
            <Label>Members ({selected.length})</Label>
            {selected.length > 0 && (
              <SelectedStrip style={{ margin: "0.3rem 0" }}>
                {selected.map((u) => {
                  const p = profiles.find((x) => x.username === u);
                  return (
                    <Chip key={u}>
                      {p?.displayName ?? u}
                      <ChipClose onClick={() => toggleMember(u)} title="Remove"><CancelIcon size={10} /></ChipClose>
                    </Chip>
                  );
                })}
              </SelectedStrip>
            )}
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search members…"
            />
            <MemberList>
              {filtered.length === 0 ? (
                <div style={{ fontSize: "0.75rem", color: "var(--t-textGhost)", padding: "0.4rem" }}>No matches.</div>
              ) : filtered.map((p) => {
                const isSel = selected.includes(p.username);
                return (
                  <MemberRow key={p.username} $selected={isSel} onClick={() => toggleMember(p.username)}>
                    <UserAvatar profile={p} size={22} />
                    <RowName>{p.displayName}</RowName>
                    <RowUsername>@{p.username}</RowUsername>
                  </MemberRow>
                );
              })}
            </MemberList>
          </div>

          {error && <Error>{error}</Error>}
        </Body>
        <Footer>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={submit} disabled={submitting || !name.trim()}>
            {submitting ? "Creating…" : "Create group"}
          </PrimaryBtn>
        </Footer>
      </Modal>
    </Overlay>
  );
}
