"use client";

/**
 * Ringtone + browser-notifications section for the Front Desk SystemToolsModal.
 *
 * Settings persist in localStorage:
 *   frontdesk:ringtone-profile        — which RingProfile to play on inbound
 *   frontdesk:notifications-enabled   — "true" | "false"; gates Notification API
 *
 * Browser notifications also need the user to grant Notification.permission;
 * we expose a button to request it.
 */

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import {
  startInboundRing,
  stopInboundRing,
  RING_PROFILE_LABELS,
  RING_PROFILE_KEY,
  NOTIFICATIONS_ENABLED_KEY,
  type RingProfile,
} from "@/lib/frontdesk/ringTones";

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
`;

const Label = styled.div`
  font-size: 0.85rem;
  color: var(--t-text);
`;

const Hint = styled.div`
  font-size: 0.7rem;
  color: var(--t-textGhost);
  margin-top: 0.2rem;
`;

const Select = styled.select`
  background: rgba(0, 0, 0, 0.4);
  color: var(--t-text);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 0.4rem 0.6rem;
  font-size: 0.8rem;
  &:focus { outline: none; border-color: rgba(${rgb.cyan}, 0.5); }
`;

const Btn = styled.button<{ $variant?: "primary" | "ghost" }>`
  appearance: none;
  border: 1px solid
    ${({ $variant }) =>
      $variant === "primary" ? `rgba(${rgb.cyan}, 0.4)` : "rgba(255,255,255,0.15)"};
  background: ${({ $variant }) =>
    $variant === "primary" ? `rgba(${rgb.cyan}, 0.08)` : "transparent"};
  color: ${({ $variant }) => ($variant === "primary" ? colors.cyan : "var(--t-text)")};
  border-radius: 6px;
  padding: 0.4rem 0.7rem;
  font-size: 0.75rem;
  cursor: pointer;
  &:hover:not(:disabled) {
    background: ${({ $variant }) =>
      $variant === "primary" ? `rgba(${rgb.cyan}, 0.16)` : "rgba(255,255,255,0.06)"};
  }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const ToggleTrack = styled.button<{ $on: boolean }>`
  appearance: none;
  border: none;
  cursor: pointer;
  width: 38px;
  height: 20px;
  border-radius: 10px;
  position: relative;
  background: ${({ $on }) =>
    $on
      ? `linear-gradient(90deg, rgba(${rgb.cyan}, 0.3), rgba(${rgb.cyan}, 0.15))`
      : "rgba(120,120,120,0.25)"};
  flex-shrink: 0;
`;

const ToggleKnob = styled.div<{ $on: boolean }>`
  position: absolute;
  top: 2px;
  left: ${({ $on }) => ($on ? "20px" : "2px")};
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: ${({ $on }) => ($on ? colors.cyan : "#888")};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  transition: left 0.2s ease, background 0.25s ease;
`;

const Status = styled.div<{ $tone?: "ok" | "err" }>`
  font-size: 0.7rem;
  color: ${({ $tone }) =>
    $tone === "err" ? colors.pink : $tone === "ok" ? colors.cyan : "var(--t-textGhost)"};
`;

type NotifPermission = "default" | "granted" | "denied" | "unsupported";

export default function RingtoneSection() {
  const [profile, setProfile] = useState<RingProfile>("classic");
  const [notifsEnabled, setNotifsEnabled] = useState<boolean>(true);
  const [permission, setPermission] = useState<NotifPermission>("default");
  const [status, setStatus] = useState<string>("");
  const [statusTone, setStatusTone] = useState<"ok" | "err" | undefined>();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(RING_PROFILE_KEY) as RingProfile | null;
    if (saved && saved in RING_PROFILE_LABELS) setProfile(saved);
    const notifPref = window.localStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    setNotifsEnabled(notifPref !== "false");
    if (!("Notification" in window)) setPermission("unsupported");
    else setPermission(Notification.permission as NotifPermission);
  }, []);

  const saveProfile = useCallback((next: RingProfile) => {
    setProfile(next);
    window.localStorage.setItem(RING_PROFILE_KEY, next);
    setStatus(`Ringtone set to ${RING_PROFILE_LABELS[next]}.`);
    setStatusTone("ok");
  }, []);

  const previewRing = useCallback(() => {
    stopInboundRing();
    startInboundRing(profile);
    setTimeout(stopInboundRing, 4000);
  }, [profile]);

  const requestNotifPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      setStatus("Browser does not support notifications.");
      setStatusTone("err");
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotifPermission);
      if (result === "granted") {
        setStatus("Browser notifications enabled.");
        setStatusTone("ok");
      } else if (result === "denied") {
        setStatus(
          "Browser blocked notifications. Re-enable in site settings (lock icon in address bar)."
        );
        setStatusTone("err");
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
      setStatusTone("err");
    }
  }, []);

  const flipNotifs = useCallback((next: boolean) => {
    setNotifsEnabled(next);
    window.localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, next ? "true" : "false");
  }, []);

  return (
    <Wrap>
      <Row>
        <div>
          <Label>Ringtone</Label>
          <Hint>Played on every inbound call until you accept or decline.</Hint>
        </div>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <Select value={profile} onChange={(e) => saveProfile(e.target.value as RingProfile)}>
            {(Object.keys(RING_PROFILE_LABELS) as RingProfile[]).map((p) => (
              <option key={p} value={p}>{RING_PROFILE_LABELS[p]}</option>
            ))}
          </Select>
          <Btn onClick={previewRing}>▶ Preview</Btn>
        </div>
      </Row>

      <Row>
        <div>
          <Label>Browser notifications</Label>
          <Hint>
            {permission === "unsupported"
              ? "Not supported by this browser."
              : permission === "granted"
                ? "Allowed by browser. Toggle off to silence the alert without losing audio ring."
                : permission === "denied"
                  ? "Blocked by browser — re-enable in site settings."
                  : "Click 'Allow' to enable popup alerts on incoming calls."}
          </Hint>
        </div>
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          {permission === "default" && (
            <Btn $variant="primary" onClick={requestNotifPermission}>Allow</Btn>
          )}
          {permission === "granted" && (
            <ToggleTrack
              type="button"
              $on={notifsEnabled}
              aria-pressed={notifsEnabled}
              onClick={() => flipNotifs(!notifsEnabled)}
            >
              <ToggleKnob $on={notifsEnabled} />
            </ToggleTrack>
          )}
        </div>
      </Row>

      {status && <Status $tone={statusTone}>{status}</Status>}
    </Wrap>
  );
}
