"use client";

import { useRef, useState, useEffect } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";

/* ------------------------------------------------------------------ */
/*  Styled                                                            */
/* ------------------------------------------------------------------ */

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  flex-shrink: 0;
  border-bottom: 1px solid var(--t-border);
`;

const SwitcherWrap = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
`;

const TriggerBtn = styled.button<{ $open: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.625rem;
  border-radius: 0.5rem;
  text-align: left;
  transition: all 0.15s ease;
  background: ${(p) =>
    p.$open ? `rgba(${rgb.cyan}, 0.1)` : "var(--t-surface)"};
  border: 1px solid var(--t-border);
  cursor: pointer;

  &:hover {
    background: ${(p) =>
      p.$open ? `rgba(${rgb.cyan}, 0.1)` : "var(--t-inputBg)"};
  }
`;

const Avatar = styled.span`
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 9999px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.625rem;
  font-weight: 700;
  background: rgba(${rgb.cyan}, 0.2);
  color: ${colors.cyan};
`;

const AvatarLg = styled(Avatar)`
  width: 1.5rem;
  height: 1.5rem;
  font-size: 0.6875rem;
  background: rgba(${rgb.cyan}, 0.15);
`;

const InfoBlock = styled.div`
  flex: 1;
  min-width: 0;
`;

const AccountName = styled.div<{ $highlight?: boolean }>`
  font-size: 0.75rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${(p) => (p.$highlight ? colors.cyan : "var(--t-text)")};
`;

const AccountEmail = styled.div`
  font-size: 0.625rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--t-textFaint);
`;

const LockBadge = styled.span<{ $unlocked: boolean }>`
  font-size: 0.5625rem;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  flex-shrink: 0;
  background: ${(p) =>
    p.$unlocked
      ? `rgba(${rgb.green}, 0.15)`
      : `rgba(${rgb.gold}, 0.15)`};
  color: ${(p) =>
    p.$unlocked
      ? `rgba(${rgb.green}, 0.8)`
      : `rgba(${rgb.gold}, 0.8)`};
  border: 1px solid
    ${(p) =>
      p.$unlocked
        ? `rgba(${rgb.green}, 0.3)`
        : `rgba(${rgb.gold}, 0.3)`};
`;

const LockIcon = styled.span<{ $unlocked: boolean }>`
  font-size: 0.5625rem;
  color: ${(p) =>
    p.$unlocked
      ? `rgba(${rgb.green}, 0.6)`
      : `rgba(${rgb.gold}, 0.6)`};
`;

const Chevron = styled.span`
  font-size: 0.625rem;
  color: var(--t-textGhost);
`;

const Dropdown = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0.25rem;
  width: 100%;
  z-index: 50;
  border-radius: 0.75rem;
  overflow: hidden;
  background: var(--t-bg);
  border: 1px solid rgba(${rgb.cyan}, 0.15);
  box-shadow: 0 8px 40px var(--t-overlay);

  [data-theme="light"] & {
    background: var(--t-bg);
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15);
  }
`;

const DropdownItem = styled.button<{ $selected: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  text-align: left;
  transition: all 0.15s ease;
  background: ${(p) =>
    p.$selected ? `rgba(${rgb.cyan}, 0.08)` : "transparent"};
  border: none;
  border-bottom: 1px solid var(--t-border);
  cursor: pointer;

  &:hover {
    background: var(--t-surface);
  }
`;

const CheckMark = styled.span`
  font-size: 0.625rem;
  color: rgba(${rgb.cyan}, 0.6);
`;

const SettingsBtn = styled.button`
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s ease;
  color: var(--t-textMuted);
  font-size: 1.375rem;
  background: transparent;
  border: none;
  cursor: pointer;

  &:hover {
    background: var(--t-surface);
  }
`;

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export type AccountMeta = {
  key: string;
  email: string;
  label: string;
  personal: boolean;
  unlocked: boolean;
};

type Props = {
  accounts: AccountMeta[];
  selected: string;
  onSelect: (key: string) => void;
  onSettings: () => void;
};

export default function AccountSwitcher({
  accounts,
  selected,
  onSelect,
  onSettings,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const current = accounts.find((a) => a.key === selected);

  return (
    <Bar>
      <SwitcherWrap ref={ref}>
        <TriggerBtn onClick={() => setOpen((p) => !p)} $open={open}>
          <Avatar>{current?.label?.[0] ?? "?"}</Avatar>
          <InfoBlock>
            <AccountName>{current?.label ?? "—"}</AccountName>
            <AccountEmail>{current?.email ?? ""}</AccountEmail>
          </InfoBlock>
          {current?.personal && (
            <LockBadge $unlocked={current.unlocked}>
              {current.unlocked ? "🔓" : "🔒"}
            </LockBadge>
          )}
          <Chevron>▾</Chevron>
        </TriggerBtn>

        {open && (
          <Dropdown>
            {accounts.map((acc) => (
              <DropdownItem
                key={acc.key}
                onClick={() => {
                  onSelect(acc.key);
                  setOpen(false);
                }}
                $selected={acc.key === selected}
              >
                <AvatarLg>{acc.label[0]}</AvatarLg>
                <InfoBlock>
                  <AccountName $highlight={acc.key === selected}>
                    {acc.label}
                  </AccountName>
                  <AccountEmail>{acc.email}</AccountEmail>
                </InfoBlock>
                {acc.personal && (
                  <LockIcon $unlocked={acc.unlocked}>
                    {acc.unlocked ? "🔓" : "🔒"}
                  </LockIcon>
                )}
                {acc.key === selected && <CheckMark>✓</CheckMark>}
              </DropdownItem>
            ))}
          </Dropdown>
        )}
      </SwitcherWrap>

      <SettingsBtn onClick={onSettings} title="Email settings">
        ⚙
      </SettingsBtn>
    </Bar>
  );
}
