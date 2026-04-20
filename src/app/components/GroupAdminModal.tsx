"use client";

import { useMemo, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../theme";
import { UserAvatar, type MemberProfile } from "./ChatSettingsModal";
import { CancelIcon, TrashIcon } from "./icons";

type Visibility = "open" | "restricted" | "invisible";

export type GroupForAdmin = {
  id: string;
  name: string;
  createdBy: string;
  memberIds: string[];
  admins: string[];
  visibility?: Visibility;
};

const Overlay = styled.div`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(2px);
  z-index: 400;
  display: flex; align-items: center; justify-content: center;
`;

const Modal = styled.div`
  width: min(520px, 94vw);
  max-height: 84vh;
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
  display: flex; flex-direction: column; gap: 0.9rem;
`;

const Section = styled.div`
  display: flex; flex-direction: column; gap: 0.4rem;
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

const InlineRow = styled.div`
  display: flex; gap: 0.4rem; align-items: center;
`;

const GhostBtn = styled.button`
  padding: 0.4rem 0.7rem;
  font-size: 0.6875rem;
  border-radius: 8px;
  background: transparent;
  border: 1px solid var(--t-border);
  color: var(--t-text);
  cursor: pointer;
  &:hover { background: rgba(255,255,255,0.04); }
  &:disabled { opacity: 0.4; cursor: default; }
`;

const PrimaryBtn = styled.button`
  padding: 0.4rem 0.75rem;
  font-size: 0.6875rem;
  border-radius: 8px;
  background: rgba(${rgb.green}, 0.16);
  border: 1px solid rgba(${rgb.green}, 0.5);
  color: ${colors.green};
  cursor: pointer;
  &:hover { box-shadow: 0 0 8px rgba(${rgb.green}, 0.35); }
  &:disabled { opacity: 0.4; cursor: default; box-shadow: none; }
`;

const DangerBtn = styled.button`
  padding: 0.4rem 0.75rem;
  font-size: 0.6875rem;
  border-radius: 8px;
  background: rgba(${rgb.red}, 0.12);
  border: 1px solid rgba(${rgb.red}, 0.45);
  color: ${colors.red};
  cursor: pointer;
  &:hover { box-shadow: 0 0 8px rgba(${rgb.red}, 0.35); }
  &:disabled { opacity: 0.4; cursor: default; box-shadow: none; }
`;

const VisRow = styled.div`
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem;
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
`;

const VisName = styled.span`
  font-size: 0.75rem; font-weight: 600;
`;

const VisNote = styled.span`
  font-size: 0.6875rem; color: var(--t-textMuted);
`;

const MemberList = styled.div`
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--t-border);
  border-radius: 8px;
  padding: 0.3rem;
  display: flex; flex-direction: column; gap: 2px;
`;

const MemberRow = styled.div`
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.3rem 0.45rem;
  border-radius: 6px;
  color: var(--t-text);
  &:hover { background: rgba(255,255,255,0.04); }
`;

const RowName = styled.span`
  font-size: 0.75rem;
`;

const RowBadge = styled.span<{ $kind: "admin" | "creator" }>`
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 6px;
  border-radius: 999px;
  background: ${(p) => p.$kind === "creator" ? `rgba(${rgb.green}, 0.14)` : "rgba(255,255,255,0.06)"};
  color: ${(p) => p.$kind === "creator" ? colors.green : "var(--t-textMuted)"};
`;

const RowSpacer = styled.div`
  flex: 1;
`;

const AddRow = styled.div`
  display: flex; gap: 0.3rem; align-items: center;
  margin-top: 0.35rem;
`;

const Select = styled.select`
  flex: 1;
  padding: 0.35rem 0.5rem;
  font-size: 0.75rem;
  border-radius: 6px;
  background: var(--t-inputBg);
  border: 1px solid var(--t-border);
  color: var(--t-text);
`;

const Footer = styled.div`
  display: flex; justify-content: space-between; gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--t-border);
`;

const ErrorMsg = styled.div`
  font-size: 0.6875rem;
  color: ${colors.red};
`;

const Hint = styled.div`
  font-size: 0.6875rem;
  color: var(--t-textMuted);
`;

type Props = {
  group: GroupForAdmin;
  profiles: MemberProfile[];
  currentUser: string;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
};

export default function GroupAdminModal({ group, profiles, currentUser, onClose, onChanged, onDeleted }: Props) {
  const [name, setName] = useState(group.name);
  const [visibility, setVisibility] = useState<Visibility>(group.visibility ?? "open");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [addSelect, setAddSelect] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isAdmin = group.admins.includes(currentUser);
  const isCreator = group.createdBy === currentUser;

  const memberProfiles = useMemo(
    () => group.memberIds.map((u) => profiles.find((p) => p.username === u) ?? {
      username: u, displayName: u, accentColor: "#888",
    } as MemberProfile),
    [group.memberIds, profiles]
  );

  const nonMembers = useMemo(
    () => profiles.filter((p) => p.username !== currentUser && !group.memberIds.includes(p.username)),
    [profiles, group.memberIds, currentUser]
  );

  async function patch(op: string, extra: Record<string, unknown> = {}) {
    if (!isAdmin) { setError("Admins only"); return false; }
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat/group/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: group.id, patch: { op, ...extra } }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        const errField = (data as { error?: string }).error;
        setError(errField ?? `HTTP ${res.status}`);
        return false;
      }
      onChanged();
      return true;
    } catch (e) {
      const msg = e instanceof Error ? (e as Error).message : String(e);
      setError(msg);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const saveRename = async () => {
    if (name.trim() && name.trim() !== group.name) {
      await patch("rename", { value: name.trim() });
    }
  };

  const saveVisibility = async (v: Visibility) => {
    setVisibility(v);
    await patch("setVisibility", { value: v });
  };

  const addMember = async () => {
    if (!addSelect) return;
    const ok = await patch("addMembers", { usernames: [addSelect] });
    if (ok) setAddSelect("");
  };

  const removeMember = async (u: string) => {
    await patch("removeMembers", { usernames: [u] });
  };

  const promote = async (u: string) => {
    await patch("promote", { username: u });
  };

  const demote = async (u: string) => {
    await patch("demote", { username: u });
  };

  const leave = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/chat/group/join?groupId=${encodeURIComponent(group.id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        const errField = (data as { error?: string }).error;
        setError(errField ?? `HTTP ${res.status}`);
        return;
      }
      onChanged();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? (e as Error).message : String(e);
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const deleteGroup = async () => {
    const ok = await patch("deleteGroup");
    if (ok) { onDeleted(); onClose(); }
  };

  return (
    <Overlay onMouseDown={onClose}>
      <Modal onMouseDown={(e) => e.stopPropagation()}>
        <Header>
          <Title>Manage · {group.name}</Title>
          <CloseBtn onClick={onClose} title="Close"><CancelIcon size={14} /></CloseBtn>
        </Header>
        <Body>
          {isAdmin ? (
            <>
              <Section>
                <Label>Name</Label>
                <InlineRow>
                  <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
                  <PrimaryBtn onClick={saveRename} disabled={busy || !name.trim() || name.trim() === group.name}>
                    Save
                  </PrimaryBtn>
                </InlineRow>
              </Section>

              <Section>
                <Label>Visibility</Label>
                <VisRow>
                  <VisCard $active={visibility === "open"} onClick={() => saveVisibility("open")}>
                    <VisName>Open</VisName>
                    <VisNote>Anyone can see &amp; join</VisNote>
                  </VisCard>
                  <VisCard $active={visibility === "restricted"} onClick={() => saveVisibility("restricted")}>
                    <VisName>Restricted</VisName>
                    <VisNote>Visible, invite to join</VisNote>
                  </VisCard>
                  <VisCard $active={visibility === "invisible"} onClick={() => saveVisibility("invisible")}>
                    <VisName>Invisible</VisName>
                    <VisNote>Only members see</VisNote>
                  </VisCard>
                </VisRow>
              </Section>

              <Section>
                <Label>Members ({memberProfiles.length})</Label>
                <MemberList>
                  {memberProfiles.map((p) => {
                    const isMemberCreator = p.username === group.createdBy;
                    const isMemberAdmin = group.admins.includes(p.username);
                    return (
                      <MemberRow key={p.username}>
                        <UserAvatar profile={p} size={22} />
                        <RowName>{p.displayName}</RowName>
                        {isMemberCreator && <RowBadge $kind="creator">Creator</RowBadge>}
                        {!isMemberCreator && isMemberAdmin && <RowBadge $kind="admin">Admin</RowBadge>}
                        <RowSpacer />
                        {!isMemberCreator && !isMemberAdmin && (
                          <GhostBtn onClick={() => promote(p.username)} disabled={busy}>Promote</GhostBtn>
                        )}
                        {!isMemberCreator && isMemberAdmin && (
                          <GhostBtn onClick={() => demote(p.username)} disabled={busy}>Demote</GhostBtn>
                        )}
                        {!isMemberCreator && (
                          <GhostBtn onClick={() => removeMember(p.username)} disabled={busy}>
                            <TrashIcon size={12} />
                          </GhostBtn>
                        )}
                      </MemberRow>
                    );
                  })}
                </MemberList>
                {nonMembers.length > 0 && (
                  <AddRow>
                    <Select value={addSelect} onChange={(e) => setAddSelect(e.target.value)}>
                      <option value="">Add member…</option>
                      {nonMembers.map((p) => (
                        <option key={p.username} value={p.username}>{p.displayName}</option>
                      ))}
                    </Select>
                    <PrimaryBtn onClick={addMember} disabled={busy || !addSelect}>Add</PrimaryBtn>
                  </AddRow>
                )}
              </Section>
            </>
          ) : (
            <Hint>You&apos;re a member of this group. Only admins can modify settings.</Hint>
          )}

          {error && <ErrorMsg>{error}</ErrorMsg>}
        </Body>
        <Footer>
          <div>
            {isCreator && isAdmin && (
              confirmDelete ? (
                <InlineRow>
                  <Hint>Delete this group permanently?</Hint>
                  <DangerBtn onClick={deleteGroup} disabled={busy}>Yes, delete</DangerBtn>
                  <GhostBtn onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</GhostBtn>
                </InlineRow>
              ) : (
                <DangerBtn onClick={() => setConfirmDelete(true)} disabled={busy}>Delete group</DangerBtn>
              )
            )}
            {!isCreator && (
              <DangerBtn onClick={leave} disabled={busy}>Leave group</DangerBtn>
            )}
          </div>
          <GhostBtn onClick={onClose}>Done</GhostBtn>
        </Footer>
      </Modal>
    </Overlay>
  );
}
