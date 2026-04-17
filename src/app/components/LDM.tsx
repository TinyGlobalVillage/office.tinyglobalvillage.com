"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styled from "styled-components";
import { useTheme } from "./ThemeProvider";
import { colors, rgb } from "@/app/theme";

const DISMISS_KEY = "tgv-ldm-dismiss-light-alert";

type LDMProps = {
  size?: number;
  accentColor?: string;
};

const Wrap = styled.div`
  position: relative;
`;

const ToggleBtn = styled.button<{ $size: number; $isDark: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${(p) => p.$size}px;
  height: ${(p) => p.$size}px;
  border-radius: ${(p) => p.$size * 0.3}px;
  border: 1px solid ${(p) => (p.$isDark ? "var(--t-borderStrong)" : "rgba(0,0,0,0.12)")};
  background: ${(p) => (p.$isDark ? "var(--t-inputBg)" : "rgba(0,0,0,0.06)")};
  cursor: pointer;
  transition: all 0.15s;
`;

const Popup = styled.div<{ $accent: string }>`
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 0.5rem;
  z-index: 200;
  width: 240px;
  border-radius: 0.75rem;
  overflow: hidden;
  background: var(--t-surface);
  border: 1px solid ${(p) => p.$accent}44;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7), 0 0 20px ${(p) => p.$accent}22;
  backdrop-filter: blur(8px);

  [data-theme="light"] & {
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12), 0 0 20px ${(p) => p.$accent}08;
  }
`;

const PopupInner = styled.div`
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const PopupHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const PopupTitle = styled.span<{ $accent: string }>`
  font-size: 0.6875rem;
  font-weight: 700;
  color: ${(p) => p.$accent};
`;

const PopupText = styled.p`
  font-size: 0.6875rem;
  color: var(--t-textMuted);
  line-height: 1.625;
  margin: 0;
`;

const BtnRow = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const StayBtn = styled.button<{ $accent: string }>`
  flex: 1;
  padding: 0.375rem;
  border-radius: 0.5rem;
  font-size: 0.625rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  color: #fff;
  background: linear-gradient(135deg, ${(p) => p.$accent}, #a855f7);
`;

const SwitchBtn = styled.button`
  flex: 1;
  padding: 0.375rem;
  border-radius: 0.5rem;
  font-size: 0.625rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  background: var(--t-inputBg);
  border: 1px solid var(--t-borderStrong);
  color: var(--t-textMuted);
`;

const CheckLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  margin-top: 0.125rem;
`;

const Checkbox = styled.input`
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 0.25rem;
  accent-color: ${colors.pink};
`;

const CheckText = styled.span`
  font-size: 0.625rem;
  color: var(--t-textFaint);
`;

export default function LDM({ size = 28, accentColor = "#ff4ecb" }: LDMProps) {
  const { theme, setTheme } = useTheme();
  const [showAlert, setShowAlert] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [dontShow, setDontShow] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!showAlert) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setShowAlert(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowAlert(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [showAlert]);

  const handleToggle = useCallback(() => {
    if (theme === "dark") {
      if (!dismissed) {
        setShowAlert(true);
      } else {
        setTheme("light");
      }
    } else {
      setTheme("dark");
    }
  }, [theme, dismissed, setTheme]);

  const handleContinueToLight = () => {
    if (dontShow) {
      localStorage.setItem(DISMISS_KEY, "1");
      setDismissed(true);
    }
    setShowAlert(false);
    setTheme("light");
  };

  const handleStayDark = () => {
    if (dontShow) {
      localStorage.setItem(DISMISS_KEY, "1");
      setDismissed(true);
    }
    setShowAlert(false);
  };

  const isDark = theme === "dark";
  const r = size / 2;
  const orbR = size * 0.32;
  const rayLen = size * 0.18;
  const rayDist = size * 0.42;

  return (
    <Wrap ref={wrapRef}>
      <ToggleBtn
        $size={size}
        $isDark={isDark}
        onClick={handleToggle}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        <svg width={size * 0.7} height={size * 0.7} viewBox={`0 0 ${size} ${size}`}>
          {isDark ? (
            <>
              <circle cx={r} cy={r} r={orbR} fill={accentColor} opacity={0.9} />
              <circle
                cx={r + orbR * 0.35}
                cy={r - orbR * 0.3}
                r={orbR * 0.75}
                fill="var(--t-bg)"
              />
            </>
          ) : (
            <>
              <circle cx={r} cy={r} r={orbR} fill={colors.gold} />
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
                const rad = (deg * Math.PI) / 180;
                const x1 = r + Math.cos(rad) * rayDist;
                const y1 = r + Math.sin(rad) * rayDist;
                const x2 = r + Math.cos(rad) * (rayDist + rayLen);
                const y2 = r + Math.sin(rad) * (rayDist + rayLen);
                return (
                  <line
                    key={deg}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={colors.gold}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                );
              })}
            </>
          )}
        </svg>
      </ToggleBtn>

      {showAlert && (
        <Popup $accent={accentColor}>
          <PopupInner>
            <PopupHeader>
              <span style={{ fontSize: "1.125rem" }}>🌙</span>
              <PopupTitle $accent={accentColor}>Dark mode is greener</PopupTitle>
            </PopupHeader>
            <PopupText>
              Dark pixels use less power on OLED screens. Staying dark reduces your
              energy footprint.
            </PopupText>
            <BtnRow>
              <StayBtn $accent={accentColor} onClick={handleStayDark}>
                Stay dark
              </StayBtn>
              <SwitchBtn onClick={handleContinueToLight}>Switch anyway</SwitchBtn>
            </BtnRow>
            <CheckLabel>
              <Checkbox
                type="checkbox"
                checked={dontShow}
                onChange={(e) => setDontShow(e.target.checked)}
              />
              <CheckText>Do not show again</CheckText>
            </CheckLabel>
          </PopupInner>
        </Popup>
      )}
    </Wrap>
  );
}
