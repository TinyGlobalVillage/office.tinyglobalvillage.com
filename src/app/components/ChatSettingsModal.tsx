"use client";

import { useState, useEffect, useRef, useCallback, ChangeEvent } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import { ModalBackdrop, CloseBtn, PillButton } from "@/app/styled";
import { hexToRgb } from "./ProfileModal";

/* ── Types ─────────────────────────────────────────────────────── */

export type UserRole = "admin" | "employee";

export type MemberProfile = {
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  avatarUrl: string;
  accentColor: string;
  title: string;
  bio?: string;
};

export type ChatSettings = {
  showTimestamps: boolean;
  timestampFormat: "relative" | "time" | "datetime";
  fontSize: "xs" | "sm" | "base";
  myFont: string;
};

const TS_FORMATS: { label: string; value: ChatSettings["timestampFormat"] }[] = [
  { label: "Relative (just now)", value: "relative" },
  { label: "Time (3:42 PM)", value: "time" },
  { label: "Full (Apr 15, 3:42)", value: "datetime" },
];
const FONT_SIZES: { label: string; value: ChatSettings["fontSize"] }[] = [
  { label: "Small", value: "xs" },
  { label: "Normal", value: "sm" },
  { label: "Large", value: "base" },
];
const FONTS = [
  { label: "Sans", value: "sans", css: "sans-serif" },
  { label: "Mono", value: "mono", css: "monospace" },
  { label: "Serif", value: "serif", css: "serif" },
];

const MEMBERS_PER_PAGE = 5;

/* ── Styled ────────────────────────────────────────────────────── */

const Backdrop = styled(ModalBackdrop)`
  z-index: 80;
  padding: 0;
`;

const Modal = styled.div`
  position: fixed;
  z-index: 81;
  display: flex;
  flex-direction: column;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(96vw, 520px);
  max-height: 85vh;
  background: var(--t-surface);
  border: 1px solid rgba(${rgb.pink}, 0.2);
  border-radius: 20px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.85), 0 0 40px rgba(${rgb.pink}, 0.08);

  [data-theme="light"] & {
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.12), 0 0 40px rgba(${rgb.pink}, 0.04);
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  flex-shrink: 0;
  border-bottom: 1px solid var(--t-border);
`;

const TabGroup = styled.div`
  display: flex;
  align-items: center;
  border-radius: 9999px;
  padding: 0.125rem;
  background: var(--t-inputBg);
  border: 1px solid var(--t-borderStrong);
`;

const TabBtn = styled.button<{ $active?: boolean }>`
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  border: 1px solid ${(p) => (p.$active ? `rgba(${rgb.pink}, 0.4)` : "transparent")};
  background: ${(p) => (p.$active ? `rgba(${rgb.pink}, 0.2)` : "transparent")};
  color: ${(p) => (p.$active ? colors.pink : "var(--t-textFaint)")};
  cursor: pointer;
  transition: all 0.15s;
`;

const CountBadge = styled.span`
  font-size: 0.5625rem;
  font-weight: 700;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  background: rgba(${rgb.pink}, 0.12);
  border: 1px solid rgba(${rgb.pink}, 0.3);
  color: ${colors.pink};
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
  scrollbar-width: thin;
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

const SectionLabel = styled.p`
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--t-textFaint);
  margin: 0 0 0.75rem;
`;

const Divider = styled.div`
  width: 100%;
  height: 1px;
  background: var(--t-border);
`;

const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
`;

const ToggleLabel = styled.span`
  font-size: 0.6875rem;
  color: var(--t-textMuted);
`;

const Toggle = styled.button<{ $on?: boolean }>`
  width: 2.5rem;
  height: 1.25rem;
  border-radius: 9999px;
  border: none;
  position: relative;
  cursor: pointer;
  transition: all 0.15s;
  background: ${(p) => (p.$on ? `rgba(${rgb.pink}, 0.7)` : "var(--t-inputBg)")};
`;

const ToggleThumb = styled.span<{ $on?: boolean }>`
  position: absolute;
  top: 0.125rem;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  transition: all 0.15s;
  left: ${(p) => (p.$on ? "calc(100% - 1.125rem)" : "0.125rem")};
  background: ${(p) => (p.$on ? "#fff" : "var(--t-textFaint)")};
`;

const RadioBtn = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.6875rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  border: none;
  transition: all 0.15s;
  text-align: left;
  cursor: pointer;
  background: ${(p) => (p.$active ? `rgba(${rgb.pink}, 0.1)` : "transparent")};
  color: ${(p) => (p.$active ? colors.pink : "var(--t-textFaint)")};
`;

const RadioCircle = styled.span<{ $active?: boolean }>`
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  border: 1px solid ${(p) => (p.$active ? colors.pink : "var(--t-textGhost)")};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const RadioDot = styled.span`
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
  background: ${colors.pink};
`;

const OptionGrid = styled.div`
  display: flex;
  gap: 0.25rem;
`;

const OptionBtn = styled.button<{ $active?: boolean }>`
  flex: 1;
  padding: 0.25rem;
  border-radius: 0.5rem;
  font-size: 0.625rem;
  transition: all 0.15s;
  cursor: pointer;
  background: ${(p) => (p.$active ? `rgba(${rgb.pink}, 0.15)` : "var(--t-inputBg)")};
  border: 1px solid ${(p) => (p.$active ? `rgba(${rgb.pink}, 0.5)` : "var(--t-borderStrong)")};
  color: ${(p) => (p.$active ? colors.pink : "var(--t-textFaint)")};
`;

const SubLabel = styled.p`
  font-size: 0.625rem;
  color: var(--t-textFaint);
  margin: 0 0 0.25rem;
`;

const AvatarWrap = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const AvatarOverlay = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  opacity: 0;
  transition: opacity 0.15s;

  ${AvatarWrap}:hover & {
    opacity: 1;
  }
`;

const ProfileInput = styled.input<{ $accent?: string }>`
  background: transparent;
  outline: none;
  font-size: 0.75rem;
  color: var(--t-text);
  border-radius: 0.5rem;
  padding: 0.375rem 0.75rem;
  width: 100%;
  border: 1px solid ${(p) => (p.$accent ? `${p.$accent}44` : "var(--t-borderStrong)")};
`;

const ProfileTextarea = styled.textarea`
  background: transparent;
  outline: none;
  font-size: 0.75rem;
  color: var(--t-textMuted);
  border-radius: 0.5rem;
  padding: 0.375rem 0.75rem;
  width: 100%;
  resize: none;
  border: 1px solid var(--t-borderStrong);
`;

const SaveBtn = styled.button<{ $accent: string }>`
  font-size: 0.625rem;
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  transition: all 0.15s;
  cursor: pointer;
  background: rgba(${(p) => hexToRgb(p.$accent)}, 0.18);
  border: 1px solid ${(p) => p.$accent}55;
  color: ${(p) => p.$accent};

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

const StorageBar = styled.div`
  width: 100%;
  height: 0.375rem;
  border-radius: 9999px;
  overflow: hidden;
  margin-bottom: 0.75rem;
  background: var(--t-inputBg);
`;

const StorageFill = styled.div<{ $pct: number }>`
  height: 100%;
  border-radius: 9999px;
  transition: all 0.3s;
  width: ${(p) => Math.min(100, p.$pct)}%;
  background: ${(p) => (p.$pct > 80 ? colors.red : p.$pct > 60 ? colors.gold : colors.green)};
`;

const ClearBtn = styled.button`
  width: 100%;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.375rem;
  border-radius: 0.5rem;
  transition: all 0.15s;
  cursor: pointer;
  background: rgba(${rgb.red}, 0.1);
  border: 1px solid rgba(${rgb.red}, 0.3);
  color: ${colors.red};
`;

const SearchWrap = styled.div`
  position: relative;
`;

const SearchIcon = styled.span`
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.75rem;
  color: var(--t-textGhost);
`;

const SearchInput = styled.input`
  width: 100%;
  background: transparent;
  outline: none;
  font-size: 0.75rem;
  color: var(--t-textMuted);
  border-radius: 0.75rem;
  padding: 0.5rem 0.75rem 0.5rem 2rem;
  border: 1px solid var(--t-borderStrong);
`;

const SearchClear = styled.button`
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.75rem;
  color: var(--t-textGhost);
  border: none;
  background: none;
  cursor: pointer;

  &:hover {
    color: var(--t-textMuted);
  }
`;

const MemberCard = styled.div<{ $accent?: string; $self?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  background: ${(p) =>
    p.$self ? `rgba(${hexToRgb(p.$accent || colors.pink)}, 0.08)` : "var(--t-inputBg)"};
  border: 1px solid ${(p) => (p.$self ? `${p.$accent || colors.pink}33` : "var(--t-border)")};
`;

const MemberName = styled.span`
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--t-text);
  line-height: 1.2;
`;

const MemberYou = styled.span`
  font-size: 0.5rem;
  color: var(--t-textFaint);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
`;

const MemberEmail = styled.p`
  font-size: 0.625rem;
  color: var(--t-textFaint);
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0.125rem 0 0;
`;

const RoleBadge = styled.span<{ $admin?: boolean }>`
  font-size: 0.5rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.125rem 0.375rem;
  border-radius: 9999px;
  background: ${(p) => (p.$admin ? `rgba(${rgb.gold}, 0.15)` : "var(--t-inputBg)")};
  border: 1px solid ${(p) => (p.$admin ? `rgba(${rgb.gold}, 0.4)` : "var(--t-borderStrong)")};
  color: ${(p) => (p.$admin ? colors.gold : "var(--t-textFaint)")};
`;

const RoleSelect = styled.select`
  font-size: 0.625rem;
  border-radius: 0.5rem;
  padding: 0.25rem 0.5rem;
  outline: none;
  cursor: pointer;
  background: var(--t-inputBg);
  border: 1px solid var(--t-borderStrong);
  color: var(--t-textMuted);
`;

const PagerRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.25rem;
`;

const PagerBtn = styled.button`
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  transition: all 0.15s;
  cursor: pointer;
  background: rgba(${rgb.pink}, 0.1);
  border: 1px solid rgba(${rgb.pink}, 0.3);
  color: ${colors.pink};

  &:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }
`;

const PagerInfo = styled.span`
  font-size: 0.625rem;
  color: var(--t-textFaint);
  font-variant-numeric: tabular-nums;
`;

const ErrorText = styled.p`
  font-size: 0.5625rem;
  color: ${colors.red};
  margin: 0;
`;

const HintText = styled.p`
  font-size: 0.625rem;
  color: var(--t-textGhost);
  margin: 0;
`;

const SavingText = styled.span`
  font-size: 0.5625rem;
  color: var(--t-textFaint);
`;

/* ── Avatar component ──────────────────────────────────────────── */

export function UserAvatar({
  profile,
  size = 32,
}: {
  profile: Pick<MemberProfile, "displayName" | "accentColor" | "avatarUrl">;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const hasImg = profile.avatarUrl && !imgError;

  if (hasImg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatarUrl}
        alt={profile.displayName}
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          border: `1.5px solid ${profile.accentColor}66`,
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${profile.accentColor}44, ${profile.accentColor}18)`,
        border: `1.5px solid ${profile.accentColor}66`,
        color: profile.accentColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {profile.displayName[0]?.toUpperCase()}
    </div>
  );
}

/* ── Settings tab ──────────────────────────────────────────────── */

function SettingsTab({
  settings,
  onChange,
  currentUser,
  myProfile,
  isAdmin,
  storagePercent,
  onClearChat,
  onProfileRefresh,
}: {
  settings: ChatSettings;
  onChange: (s: ChatSettings) => void;
  currentUser: string;
  myProfile: MemberProfile | undefined;
  isAdmin: boolean;
  storagePercent: number;
  onClearChat: () => void;
  onProfileRefresh: () => void;
}) {
  const set = (patch: Partial<ChatSettings>) => onChange({ ...settings, ...patch });

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const [editName, setEditName] = useState(myProfile?.displayName ?? "");
  const [editEmail, setEditEmail] = useState(myProfile?.email ?? "");
  const [editTitle, setEditTitle] = useState(myProfile?.title ?? "");
  const [editBio, setEditBio] = useState(myProfile?.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (myProfile) {
      setEditName(myProfile.displayName);
      setEditEmail(myProfile.email ?? "");
      setEditTitle(myProfile.title ?? "");
      setEditBio(myProfile.bio ?? "");
    }
  }, [myProfile]);

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError("");
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await fetch("/api/users/avatar", { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json();
        setAvatarError(d.error ?? "Upload failed");
      } else {
        onProfileRefresh();
      }
    } catch {
      setAvatarError("Upload failed");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const saveProfile = async () => {
    if (!editName.trim()) return;
    setSaveError("");
    setSaving(true);
    try {
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: editName.trim(),
          email: editEmail.trim(),
          title: editTitle.trim(),
          bio: editBio.trim(),
        }),
      });
      if (!res.ok) setSaveError("Save failed");
      else onProfileRefresh();
    } finally {
      setSaving(false);
    }
  };

  const accent = myProfile?.accentColor ?? colors.pink;

  return (
    <Section>
      <div>
        <SectionLabel>Identity</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <AvatarWrap>
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              style={{ border: "none", background: "none", cursor: "pointer", position: "relative" }}
              title="Click to change avatar"
            >
              {myProfile && <UserAvatar profile={myProfile} size={56} />}
              <AvatarOverlay>
                <span style={{ color: "#fff", fontSize: "0.75rem" }}>📷</span>
              </AvatarOverlay>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleAvatarChange}
            />
            {uploadingAvatar && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.6)",
                }}
              >
                <span style={{ fontSize: "0.5625rem", color: "#fff" }}>…</span>
              </div>
            )}
          </AvatarWrap>

          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <ProfileInput
              $accent={accent}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Display name"
              style={{ fontWeight: 700, fontSize: "0.875rem" }}
            />
            <ProfileInput
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="Email address"
              type="email"
            />
            <ProfileInput
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Title / role"
            />
            <ProfileTextarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              placeholder="Bio…"
              rows={2}
            />
            {avatarError && <ErrorText>{avatarError}</ErrorText>}
            {saveError && <ErrorText>{saveError}</ErrorText>}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <HintText>Click avatar to change photo</HintText>
              <SaveBtn $accent={accent} onClick={saveProfile} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </SaveBtn>
            </div>
          </div>
        </div>
      </div>

      <Divider />

      <div>
        <SectionLabel>Timestamps</SectionLabel>
        <ToggleRow>
          <ToggleLabel>Show timestamps</ToggleLabel>
          <Toggle $on={settings.showTimestamps} onClick={() => set({ showTimestamps: !settings.showTimestamps })}>
            <ToggleThumb $on={settings.showTimestamps} />
          </Toggle>
        </ToggleRow>
        {settings.showTimestamps && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", paddingLeft: "0.25rem" }}>
            {TS_FORMATS.map((f) => (
              <RadioBtn
                key={f.value}
                $active={settings.timestampFormat === f.value}
                onClick={() => set({ timestampFormat: f.value })}
              >
                <RadioCircle $active={settings.timestampFormat === f.value}>
                  {settings.timestampFormat === f.value && <RadioDot />}
                </RadioCircle>
                {f.label}
              </RadioBtn>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionLabel>Appearance</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div>
            <SubLabel>Font size</SubLabel>
            <OptionGrid>
              {FONT_SIZES.map((f) => (
                <OptionBtn
                  key={f.value}
                  $active={settings.fontSize === f.value}
                  onClick={() => set({ fontSize: f.value })}
                >
                  {f.label}
                </OptionBtn>
              ))}
            </OptionGrid>
          </div>
          <div>
            <SubLabel>Font family</SubLabel>
            <OptionGrid>
              {FONTS.map((f) => (
                <OptionBtn
                  key={f.value}
                  $active={settings.myFont === f.value}
                  onClick={() => set({ myFont: f.value })}
                  style={{ fontFamily: f.css }}
                >
                  {f.label}
                </OptionBtn>
              ))}
            </OptionGrid>
          </div>
        </div>
      </div>

      {isAdmin && (
        <>
          <Divider />
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <SectionLabel style={{ margin: 0 }}>Chat storage</SectionLabel>
              <span style={{ fontSize: "0.5625rem", color: "var(--t-textFaint)" }}>{storagePercent}%</span>
            </div>
            <StorageBar>
              <StorageFill $pct={storagePercent} />
            </StorageBar>
            <ClearBtn onClick={onClearChat}>🗑 Clear All Chat &amp; Files</ClearBtn>
          </div>
        </>
      )}
    </Section>
  );
}

/* ── Members tab ───────────────────────────────────────────────── */

function MembersTab({
  profiles,
  currentUser,
  isAdmin,
  onRoleChange,
}: {
  profiles: MemberProfile[];
  currentUser: string;
  isAdmin: boolean;
  onRoleChange: (username: string, role: UserRole) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [changing, setChanging] = useState<string | null>(null);

  const filtered = profiles.filter((p) => {
    const q = query.toLowerCase();
    return (
      p.displayName.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.username.toLowerCase().includes(q) ||
      p.role.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / MEMBERS_PER_PAGE));
  const pageItems = filtered.slice(page * MEMBERS_PER_PAGE, (page + 1) * MEMBERS_PER_PAGE);

  useEffect(() => {
    setPage(0);
  }, [query]);

  const handleRoleChange = async (username: string, role: UserRole) => {
    setChanging(username);
    await onRoleChange(username, role);
    setChanging(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <SearchWrap>
        <SearchIcon>🔍</SearchIcon>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members…"
        />
        {query && <SearchClear onClick={() => setQuery("")}>✕</SearchClear>}
      </SearchWrap>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {pageItems.length === 0 ? (
          <p style={{ fontSize: "0.75rem", color: "var(--t-textGhost)", textAlign: "center", padding: "1.5rem 0" }}>
            No members found.
          </p>
        ) : (
          pageItems.map((p) => {
            const isSelf = p.username === currentUser;
            const canChangeRole = isAdmin && !isSelf;
            return (
              <MemberCard key={p.username} $accent={p.accentColor} $self={isSelf}>
                <UserAvatar profile={p} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <MemberName>{p.displayName}</MemberName>
                    {isSelf && <MemberYou>(you)</MemberYou>}
                    <RoleBadge $admin={p.role === "admin"}>{p.role}</RoleBadge>
                  </div>
                  <MemberEmail>{p.email}</MemberEmail>
                </div>
                {canChangeRole ? (
                  <div style={{ flexShrink: 0 }}>
                    {changing === p.username ? (
                      <SavingText>Saving…</SavingText>
                    ) : (
                      <RoleSelect
                        value={p.role}
                        onChange={(e) => handleRoleChange(p.username, e.target.value as UserRole)}
                      >
                        <option value="admin">Admin</option>
                        <option value="employee">Employee</option>
                      </RoleSelect>
                    )}
                  </div>
                ) : (
                  <div style={{ flexShrink: 0, width: 72 }} />
                )}
              </MemberCard>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <PagerRow>
          <PagerBtn disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            ←
          </PagerBtn>
          <PagerInfo>
            {page + 1} / {totalPages}
            <span style={{ color: "var(--t-textGhost)", marginLeft: "0.375rem" }}>
              ({filtered.length} member{filtered.length !== 1 ? "s" : ""})
            </span>
          </PagerInfo>
          <PagerBtn
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            →
          </PagerBtn>
        </PagerRow>
      )}
    </div>
  );
}

/* ── Main modal ────────────────────────────────────────────────── */

type ModalTab = "settings" | "members";

export default function ChatSettingsModal({
  settings,
  onSettingsChange,
  profiles,
  currentUser,
  storagePercent,
  onClearChat,
  onClose,
  onProfileRefresh,
}: {
  settings: ChatSettings;
  onSettingsChange: (s: ChatSettings) => void;
  profiles: MemberProfile[];
  currentUser: string;
  storagePercent: number;
  onClearChat: () => void;
  onClose: () => void;
  onProfileRefresh: () => void;
}) {
  const [tab, setTab] = useState<ModalTab>("settings");

  const myProfile = profiles.find((p) => p.username === currentUser);
  const isAdmin = myProfile?.role === "admin";

  const handleRoleChange = useCallback(
    async (username: string, role: UserRole) => {
      await fetch("/api/users/role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, role }),
      });
      onProfileRefresh();
    },
    [onProfileRefresh]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [onClose]);

  return (
    <>
      <Backdrop onClick={onClose} />
      <Modal>
        <Header>
          <TabGroup>
            {(
              [
                { id: "settings", label: "⚙ Settings" },
                { id: "members", label: "👥 Members" },
              ] as { id: ModalTab; label: string }[]
            ).map((t) => (
              <TabBtn key={t.id} $active={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
              </TabBtn>
            ))}
          </TabGroup>
          {tab === "members" && <CountBadge>{profiles.length}</CountBadge>}
          <div style={{ marginLeft: "auto" }}>
            <CloseBtn onClick={onClose}>✕</CloseBtn>
          </div>
        </Header>

        <Body>
          {tab === "settings" && (
            <SettingsTab
              settings={settings}
              onChange={onSettingsChange}
              currentUser={currentUser}
              myProfile={myProfile}
              isAdmin={isAdmin}
              storagePercent={storagePercent}
              onClearChat={onClearChat}
              onProfileRefresh={onProfileRefresh}
            />
          )}
          {tab === "members" && (
            <MembersTab
              profiles={profiles}
              currentUser={currentUser}
              isAdmin={isAdmin}
              onRoleChange={handleRoleChange}
            />
          )}
        </Body>
      </Modal>
    </>
  );
}
