"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalBody,
} from "@/app/styled";
import NeonX from "./NeonX";

type Session = {
  id: string;
  kind: "lounge" | "study" | "pair" | "user";
  name: string;
  createdBy: string | null;
  createdAt: string;
  cap: number | null;
  memberIds: string[];
  admins: string[];
  banned: string[];
  invisible: string[];
  updatedAt: string;
};

type Profile = {
  username: string;
  displayName: string;
  role?: "admin" | "employee";
};

export type SessionSettingsModalProps = {
  sessionId: string;
  onClose: () => void;
  onSessionChanged: (session: Session | null) => void;
};

// ── Styled ───────────────────────────────────────────────────────────────────

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const ADLHeader = styled.button<{ $open: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.625rem;
  background: ${p => p.$open ? `rgba(${rgb.pink}, 0.05)` : "transparent"};
  border: 1px solid ${p => p.$open ? `rgba(${rgb.pink}, 0.22)` : "var(--t-border)"};
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  color: ${p => p.$open ? colors.pink : "var(--t-textFaint)"};
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  transition: background 0.15s, border-color 0.15s, color 0.15s;

  &:hover {
    background: rgba(${rgb.pink}, 0.08);
    border-color: rgba(${rgb.pink}, 0.35);
    color: ${colors.pink};
  }
`;

const ADLLabel = styled.span` flex: 1; `;
const ADLCount = styled.span`
  font-size: 0.5625rem;
  color: rgba(${rgb.pink}, 0.55);
  font-weight: 600;
`;
const ADLSwitchTrack = styled.span<{ $on: boolean }>`
  position: relative;
  display: inline-block;
  width: 28px;
  height: 14px;
  border-radius: 999px;
  border: 1px solid ${p => p.$on ? `rgba(${rgb.pink}, 0.7)` : "var(--t-borderStrong)"};
  background: ${p => p.$on ? `rgba(${rgb.pink}, 0.2)` : "var(--t-inputBg)"};
  box-shadow: ${p => p.$on ? `0 0 8px rgba(${rgb.pink}, 0.45)` : "none"};
  transition: all 0.18s;
`;
const ADLSwitchThumb = styled.span<{ $on: boolean }>`
  position: absolute;
  top: 1px;
  left: ${p => p.$on ? "15px" : "1px"};
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${p => p.$on ? colors.pink : "var(--t-textFaint)"};
  box-shadow: ${p => p.$on
    ? `0 0 8px rgba(${rgb.pink}, 0.85), 0 0 2px rgba(${rgb.pink}, 1)`
    : "0 1px 2px rgba(0,0,0,0.3)"};
  transition: all 0.18s;
`;
const ADLBody = styled.div<{ $open: boolean }>`
  display: ${p => p.$open ? "block" : "none"};
  padding: 0.75rem 0.25rem 0.25rem;
`;

function ADLSection({ label, count, defaultOpen, children }: {
  label: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <div>
      <ADLHeader $open={open} onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <ADLLabel>{label}</ADLLabel>
        {typeof count === "number" && <ADLCount>{count}</ADLCount>}
        <ADLSwitchTrack $on={open}>
          <ADLSwitchThumb $on={open} />
        </ADLSwitchTrack>
      </ADLHeader>
      <ADLBody $open={open}>{children}</ADLBody>
    </div>
  );
}

const FieldRow = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.375rem 0.125rem;
`;

const FieldLabel = styled.span`
  font-size: 0.8125rem;
  color: var(--t-text);
`;

const FieldSub = styled.span`
  display: block;
  font-size: 0.6875rem;
  color: var(--t-textMuted);
  margin-top: 0.125rem;
`;

const TextInput = styled.input`
  min-width: 0;
  padding: 0.375rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--t-border);
  background: var(--t-inputBg);
  color: var(--t-text);
  font-size: 0.8125rem;
  outline: none;

  &:focus { border-color: rgba(${rgb.pink}, 0.5); }
`;

const NumberInput = styled(TextInput).attrs({ type: "number" })`
  width: 5rem;
  text-align: right;
`;

const MemberList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const MemberItem = styled.li`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3125rem 0.4375rem;
  border-radius: 6px;
  border: 1px solid var(--t-border);
  font-size: 0.8125rem;
`;

const MemberName = styled.span` flex: 1; `;

const InlineBtn = styled.button<{ $variant?: "danger" | "neutral" | "primary" }>`
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.25rem 0.5625rem;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s;

  ${p => p.$variant === "danger" && `
    background: rgba(${rgb.red}, 0.14);
    border-color: rgba(${rgb.red}, 0.45);
    color: #f87171;
    &:hover { background: rgba(${rgb.red}, 0.26); }
  `}
  ${p => p.$variant === "primary" && `
    background: rgba(${rgb.pink}, 0.14);
    border-color: rgba(${rgb.pink}, 0.45);
    color: ${colors.pink};
    &:hover { background: rgba(${rgb.pink}, 0.26); }
  `}
  ${p => (!p.$variant || p.$variant === "neutral") && `
    background: rgba(255,255,255,0.04);
    border-color: var(--t-border);
    color: var(--t-textMuted);
    &:hover { background: rgba(255,255,255,0.08); }
  `}

  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Empty = styled.p`
  font-size: 0.75rem;
  color: var(--t-textMuted);
  margin: 0.25rem 0;
`;

const Err = styled.p`
  font-size: 0.75rem;
  color: #f87171;
  margin: 0.25rem 0;
`;

// ── Component ────────────────────────────────────────────────────────────────

function isExec(username: string): boolean {
  return username === "admin" || username === "marmar";
}

export default function SessionSettingsModal({
  sessionId,
  onClose,
  onSessionChanged,
}: SessionSettingsModalProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<string>("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [nameDraft, setNameDraft] = useState("");
  const [capDraft, setCapDraft] = useState<number | "">("");
  const [banDraft, setBanDraft] = useState("");
  const [invDraft, setInvDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, profRes, sessRes] = await Promise.all([
        fetch("/api/users/me").then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/users/profile").then(r => r.ok ? r.json() : { profiles: [] }).catch(() => ({ profiles: [] })),
        fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      const myUsername = meRes?.username ?? meRes?.user?.username ?? "";
      setMe(myUsername);
      setProfiles(Array.isArray(profRes?.profiles) ? profRes.profiles : []);
      const s = (sessRes as { session?: Session } | null)?.session ?? null;
      setSession(s);
      if (s) {
        setNameDraft(s.name);
        setCapDraft(s.cap ?? "");
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load session");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const viewerIsAdmin =
    !!session && (isExec(me) || session.admins.includes(me));

  const patch = useCallback(async (op: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(op),
      });
      const data = await res.json().catch(() => null) as { session?: Session | null; error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? `Error ${res.status}`);
        return;
      }
      setError(null);
      const next = data?.session ?? null;
      if (next) setSession(next);
      onSessionChanged(next);
      if (!next) onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  }, [sessionId, onSessionChanged, onClose]);

  if (loading) {
    return (
      <ModalBackdrop onClick={onClose}>
        <ModalContainer $accent="pink" $maxWidth="32rem" onClick={e => e.stopPropagation()}>
          <ModalHeader>
            <ModalHeaderLeft><ModalTitle>Session settings</ModalTitle></ModalHeaderLeft>
            <NeonX accent="pink" onClick={onClose} />
          </ModalHeader>
          <ModalBody>
            <Empty>Loading session…</Empty>
          </ModalBody>
        </ModalContainer>
      </ModalBackdrop>
    );
  }

  if (!session) {
    return (
      <ModalBackdrop onClick={onClose}>
        <ModalContainer $accent="pink" $maxWidth="32rem" onClick={e => e.stopPropagation()}>
          <ModalHeader>
            <ModalHeaderLeft><ModalTitle>Session not found</ModalTitle></ModalHeaderLeft>
            <NeonX accent="pink" onClick={onClose} />
          </ModalHeader>
          <ModalBody>
            <Empty>This session no longer exists.</Empty>
          </ModalBody>
        </ModalContainer>
      </ModalBackdrop>
    );
  }

  const displayFor = (username: string) =>
    profiles.find(p => p.username === username)?.displayName ?? username;

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="pink" $maxWidth="32rem" onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <ModalTitle>{session.name} · settings</ModalTitle>
          </ModalHeaderLeft>
          <NeonX accent="pink" onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          <Stack>
            {error && <Err>✕ {error}</Err>}

            <ADLSection label="General" defaultOpen>
              <FieldRow>
                <div>
                  <FieldLabel>Name</FieldLabel>
                  <FieldSub>Visible to all members</FieldSub>
                </div>
                {viewerIsAdmin ? (
                  <div style={{ display: "flex", gap: "0.375rem" }}>
                    <TextInput
                      value={nameDraft}
                      onChange={e => setNameDraft(e.target.value)}
                      maxLength={60}
                    />
                    <InlineBtn
                      $variant="primary"
                      onClick={() => patch({ op: "rename", name: nameDraft })}
                      disabled={!nameDraft.trim() || nameDraft === session.name}
                    >Save</InlineBtn>
                  </div>
                ) : (
                  <FieldLabel>{session.name}</FieldLabel>
                )}
              </FieldRow>

              {session.kind === "pair" && (
                <FieldRow>
                  <div>
                    <FieldLabel>Member cap</FieldLabel>
                    <FieldSub>Admins can exceed the cap to observe</FieldSub>
                  </div>
                  {viewerIsAdmin ? (
                    <div style={{ display: "flex", gap: "0.375rem" }}>
                      <NumberInput
                        value={capDraft}
                        min={2}
                        max={50}
                        onChange={e => {
                          const v = e.target.value;
                          setCapDraft(v === "" ? "" : Number(v));
                        }}
                      />
                      <InlineBtn
                        $variant="primary"
                        onClick={() => patch({ op: "setCap", cap: capDraft === "" ? null : capDraft })}
                        disabled={capDraft === session.cap}
                      >Save</InlineBtn>
                    </div>
                  ) : (
                    <FieldLabel>{session.cap ?? "no limit"}</FieldLabel>
                  )}
                </FieldRow>
              )}
            </ADLSection>

            <ADLSection label="Members" count={session.memberIds.length} defaultOpen>
              {session.memberIds.length === 0 ? (
                <Empty>No one is in this room.</Empty>
              ) : (
                <MemberList>
                  {session.memberIds.map(uid => (
                    <MemberItem key={uid}>
                      <MemberName>
                        {displayFor(uid)}
                        {session.admins.includes(uid) && (
                          <span style={{ color: colors.pink, marginLeft: "0.375rem", fontSize: "0.6875rem" }}>
                            admin
                          </span>
                        )}
                        {session.invisible.includes(uid) && viewerIsAdmin && (
                          <span style={{ color: colors.violet, marginLeft: "0.375rem", fontSize: "0.6875rem" }}>
                            invisible
                          </span>
                        )}
                      </MemberName>
                      {viewerIsAdmin && uid !== me && (
                        <InlineBtn
                          $variant="danger"
                          onClick={() => patch({ op: "ban", user: uid })}
                        >Ban</InlineBtn>
                      )}
                    </MemberItem>
                  ))}
                </MemberList>
              )}
            </ADLSection>

            {viewerIsAdmin && (
              <ADLSection label="Admin controls" defaultOpen={false}>
                <FieldRow>
                  <div>
                    <FieldLabel>Add invisible member</FieldLabel>
                    <FieldSub>Joins without appearing in the member list</FieldSub>
                  </div>
                  <div style={{ display: "flex", gap: "0.375rem" }}>
                    <TextInput
                      placeholder="username"
                      value={invDraft}
                      onChange={e => setInvDraft(e.target.value)}
                    />
                    <InlineBtn
                      $variant="primary"
                      onClick={() => {
                        const u = invDraft.trim();
                        if (!u) return;
                        patch({ op: "addInvisible", user: u });
                        setInvDraft("");
                      }}
                      disabled={!invDraft.trim()}
                    >Add</InlineBtn>
                  </div>
                </FieldRow>

                {session.invisible.length > 0 && (
                  <MemberList>
                    {session.invisible.map(uid => (
                      <MemberItem key={`inv-${uid}`}>
                        <MemberName>{displayFor(uid)} <span style={{ color: colors.violet, fontSize: "0.6875rem" }}>invisible</span></MemberName>
                        <InlineBtn
                          onClick={() => patch({ op: "removeInvisible", user: uid })}
                        >Remove</InlineBtn>
                      </MemberItem>
                    ))}
                  </MemberList>
                )}

                <FieldRow>
                  <div>
                    <FieldLabel>Ban list</FieldLabel>
                    <FieldSub>Banned users cannot get a room token</FieldSub>
                  </div>
                  <div style={{ display: "flex", gap: "0.375rem" }}>
                    <TextInput
                      placeholder="username"
                      value={banDraft}
                      onChange={e => setBanDraft(e.target.value)}
                    />
                    <InlineBtn
                      $variant="danger"
                      onClick={() => {
                        const u = banDraft.trim();
                        if (!u) return;
                        patch({ op: "ban", user: u });
                        setBanDraft("");
                      }}
                      disabled={!banDraft.trim()}
                    >Ban</InlineBtn>
                  </div>
                </FieldRow>

                {session.banned.length > 0 && (
                  <MemberList>
                    {session.banned.map(uid => (
                      <MemberItem key={`ban-${uid}`}>
                        <MemberName>{displayFor(uid)}</MemberName>
                        <InlineBtn
                          onClick={() => patch({ op: "unban", user: uid })}
                        >Unban</InlineBtn>
                      </MemberItem>
                    ))}
                  </MemberList>
                )}

                <FieldRow>
                  <div>
                    <FieldLabel>Force-end session</FieldLabel>
                    <FieldSub>
                      {session.kind === "user"
                        ? "Kicks everyone and deletes this room."
                        : "Kicks everyone. Room persists."}
                    </FieldSub>
                  </div>
                  <InlineBtn
                    $variant="danger"
                    onClick={() => {
                      if (!confirm(`Force-end "${session.name}"?`)) return;
                      patch({ op: "forceEnd" });
                    }}
                  >Force end</InlineBtn>
                </FieldRow>
              </ADLSection>
            )}
          </Stack>
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}
