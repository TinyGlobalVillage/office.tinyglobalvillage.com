"use client";

/**
 * Front Desk — Scheduled Alerts calendar.
 *
 * A team board of upcoming SCHEDULED alerts (System C `user_alerts`, visibility
 * = "team"). Surfaces alerts authored by teammates AND by RCS automations
 * (source='rcs'). DECOUPLED from tgv.com support tickets by construction.
 *
 * Views: "calendar" (month grids + list) · "list" (alerts only) · a read-only
 * "detail" card (click any alert) with assignment + workflow status + an Edit
 * button that swaps to the create/edit form. The form's When field opens a
 * TGV-styled mini calendar. Grids show ONLY the month's own days (no
 * leading/trailing spill from adjacent months).
 *
 * Persisted task fields (assignee + workStatus) live in the alert's `payload`
 * jsonb — no schema migration; distinct from the alert lifecycle `status`.
 *
 * Portaled to <body> so it clears the Front Desk drawer's transformed stacking
 * context.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled, { css } from "styled-components";
import { colors, rgb } from "../../theme";
import { CloseBtn, ModalBackdrop } from "../../styled";
import { EditIcon, EventIcon } from "../icons";
import { alertsToCalendarEvents } from "@tgv/module-calendar/alerts/calendar-source";
import {
  buildMonthsGrid,
  indexEventsByDate,
  MONTHS_IN_VIEW,
  type CalendarViewMode,
} from "@tgv/module-calendar/alerts/calendar-month";
import {
  ALL_CHANNELS,
  ALL_RECURRENCES,
  type AlertChannel,
  type AlertRecurrence,
  type PersonalAlert,
} from "@tgv/module-calendar/alerts/types";

// ── Workflow (task) status — persisted in payload.workStatus ─────────────────
type WorkStatusKey = "open" | "in_progress" | "completed" | "closed";
const WORK_STATUSES: { key: WorkStatusKey; label: string; c: string; rgbv: string }[] = [
  { key: "open", label: "Open for assignment", c: colors.gold, rgbv: rgb.gold },
  { key: "in_progress", label: "In progress", c: colors.cyan, rgbv: rgb.cyan },
  { key: "completed", label: "Completed", c: "#00dc64", rgbv: "0, 220, 100" },
  { key: "closed", label: "Closed", c: "#9aa0a6", rgbv: "154, 160, 166" },
];
const wsMeta = (k: string) => WORK_STATUSES.find((s) => s.key === k) ?? WORK_STATUSES[0];

type StaffMember = { username: string; name: string };

// Input/content ink: WHITE on dark, near-black on light (values the user types
// or that display alert content). Field LABELS are amber-gold (see Field/…).
const inkWhite = css`
  color: #ffffff;
  [data-theme="light"] & { color: #14161a; }
`;

// ── Styled ───────────────────────────────────────────────────────

// Top-align (not dead-center) so the modal sits in the upper viewport and
// leaves room below for portaled dropdowns to open without overflowing.
const Backdrop = styled(ModalBackdrop)`
  z-index: 12000;
  align-items: flex-start;
  padding-top: 5vh;
  padding-bottom: 5vh;
`;

const Shell = styled.div<{ $wide: string }>`
  position: relative;
  width: 100%;
  max-width: ${(p) => p.$wide};
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  border-radius: 1rem;
  overflow: hidden;
  background: var(--t-cardGrad);
  border: 1px solid rgba(${rgb.gold}, 0.3);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.7), 0 0 40px rgba(${rgb.gold}, 0.14);

  @media (max-width: 768px) {
    max-width: 100vw;
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid rgba(${rgb.gold}, 0.18);
  flex-shrink: 0;
`;

const Title = styled.h2`
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0;
  color: ${colors.gold};
  text-shadow: 0 0 12px rgba(${rgb.gold}, 0.5);
  [data-theme="light"] & { text-shadow: none; }
`;

const Spacer = styled.div`flex: 1;`;

const Segmented = styled.div`
  display: inline-flex;
  border: 1px solid rgba(${rgb.gold}, 0.35);
  border-radius: 0.5rem;
  overflow: hidden;
`;

const SegBtn = styled.button<{ $active: boolean }>`
  padding: 0.3rem 0.65rem;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  cursor: pointer;
  border: none;
  color: ${(p) => (p.$active ? "#0b0b0b" : colors.gold)};
  background: ${(p) => (p.$active ? colors.gold : "transparent")};
  & + & { border-left: 1px solid rgba(${rgb.gold}, 0.25); }
  &:hover:not(:disabled) { background: ${(p) => (p.$active ? colors.gold : `rgba(${rgb.gold}, 0.14)`)}; }
`;

const HeaderBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.7rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(${rgb.gold}, 0.5);
  background: rgba(${rgb.gold}, 0.14);
  color: #f7b700;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  &:hover { background: rgba(${rgb.gold}, 0.26); }
  svg { width: 12px; height: 12px; }
`;

const BackBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.3rem 0.6rem;
  border-radius: 0.5rem;
  border: 1px solid var(--t-border);
  background: transparent;
  color: var(--t-textFaint);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  &:hover { color: var(--t-textBase); border-color: rgba(${rgb.gold}, 0.4); }
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.85rem;
  flex-wrap: wrap;
`;

const NavBtn = styled.button`
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(${rgb.gold}, 0.35);
  background: rgba(${rgb.gold}, 0.1);
  color: ${colors.gold};
  font-size: 1rem;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  &:hover { background: rgba(${rgb.gold}, 0.22); }
`;

const DateBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.7rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(${rgb.gold}, 0.35);
  background: rgba(${rgb.gold}, 0.1);
  color: var(--t-textBase);
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  &:hover { background: rgba(${rgb.gold}, 0.2); }
  span { font-size: 0.5rem; color: ${colors.gold}; opacity: 0.8; }
`;

const PickerWrap = styled.div`position: relative; display: inline-flex;`;
const PickerOverlay = styled.div`position: fixed; inset: 0; z-index: 15;`;

const MonthPanel = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
  padding: 6px;
  width: 14rem;
  background: var(--t-surface);
  border: 1px solid rgba(${rgb.gold}, 0.4);
  border-radius: 0.6rem;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
`;

const YearPanel = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 14rem;
  overflow-y: auto;
  width: 7rem;
  padding: 4px;
  background: var(--t-surface);
  border: 1px solid rgba(${rgb.gold}, 0.4);
  border-radius: 0.6rem;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
`;

const PickItem = styled.button<{ $active: boolean }>`
  padding: 0.4rem 0.5rem;
  border: none;
  border-radius: 0.4rem;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
  font-family: var(--font-geist-mono), monospace;
  background: ${(p) => (p.$active ? colors.gold : "transparent")};
  color: ${(p) => (p.$active ? "#0b0b0b" : "var(--t-textBase)")};
  &:hover { background: ${(p) => (p.$active ? colors.gold : `rgba(${rgb.gold}, 0.16)`)}; }
`;

const AddBtn = styled(HeaderBtn)``;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem 1.25rem 1.25rem;
`;

const MonthsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 1rem;
`;

const MonthCard = styled.div`
  border: 1px solid var(--t-border);
  border-radius: 0.75rem;
  padding: 0.6rem;
  background: rgba(${rgb.gold}, 0.02);
`;

const MonthLabel = styled.div`
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: ${colors.gold};
  text-align: center;
  margin-bottom: 0.45rem;
`;

const WeekHead = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 2px;
  span {
    text-align: center;
    font-size: 0.5625rem;
    font-weight: 700;
    color: var(--t-textFaint);
  }
`;

const DayGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
`;

const DayCell = styled.button`
  position: relative;
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  &:hover > span { background: rgba(${rgb.gold}, 0.16); }
`;

const DayNum = styled.span<{ $has: boolean; $today: boolean; $selected: boolean; $rcs: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  font-size: 0.6875rem;
  font-weight: ${(p) => (p.$has ? 800 : 500)};
  color: ${(p) => (p.$selected ? "#0b0b0b" : "var(--t-textBase)")};
  background: ${(p) =>
    p.$selected ? colors.gold : p.$has ? `rgba(${p.$rcs ? rgb.pink : rgb.gold}, 0.22)` : "transparent"};
  border: 1px solid ${(p) =>
    p.$selected ? colors.gold : p.$has ? `rgba(${p.$rcs ? rgb.pink : rgb.gold}, 0.75)` : p.$today ? `rgba(${rgb.gold}, 0.55)` : "transparent"};
  box-shadow: ${(p) => (p.$has && !p.$selected ? `0 0 8px rgba(${p.$rcs ? rgb.pink : rgb.gold}, 0.35)` : "none")};
  transition: background 0.12s;
`;

const CountBadge = styled.span<{ $rcs: boolean }>`
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 0.85rem;
  height: 0.85rem;
  padding: 0 2px;
  border-radius: 0.5rem;
  font-size: 0.5rem;
  font-weight: 800;
  line-height: 0.85rem;
  text-align: center;
  color: #0b0b0b;
  background: ${(p) => (p.$rcs ? colors.pink : colors.gold)};
`;

const ListPane = styled.div`
  margin-top: 1rem;
  border-top: 1px solid rgba(${rgb.gold}, 0.18);
  padding-top: 0.85rem;
`;

const ListHead = styled.div`
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${colors.gold};
  margin-bottom: 0.5rem;
`;

const ItemRow = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.15rem 0.6rem;
  padding: 0.5rem 0.65rem;
  border-radius: 0.5rem;
  border: 1px solid var(--t-border);
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
  & + & { margin-top: 0.4rem; }
  &:hover { border-color: rgba(${rgb.gold}, 0.5); background: rgba(${rgb.gold}, 0.06); }
`;

const ItemTitle = styled.div`font-weight: 700; color: var(--t-textBase);`;
const ItemMeta = styled.div`
  font-size: 0.6875rem;
  color: var(--t-textGhost);
  font-family: var(--font-geist-mono), monospace;
  white-space: nowrap;
`;
const SourcePill = styled.span<{ $src: string }>`
  display: inline-block;
  font-size: 0.5625rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 0.35rem;
  color: ${(p) => (p.$src === "manual" ? colors.gold : colors.pink)};
  border: 1px solid ${(p) => (p.$src === "manual" ? `rgba(${rgb.gold}, 0.4)` : `rgba(${rgb.pink}, 0.4)`)};
`;
const StatusChip = styled.span<{ $rgbv: string; $c: string }>`
  display: inline-block;
  font-size: 0.5625rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 0.35rem;
  color: ${(p) => p.$c};
  background: rgba(${(p) => p.$rgbv}, 0.14);
  border: 1px solid rgba(${(p) => p.$rgbv}, 0.5);
`;
const ItemDesc = styled.div`grid-column: 1 / -1; font-size: 0.75rem; color: var(--t-textGhost); white-space: pre-wrap;`;
const Empty = styled.div`text-align: center; padding: 1rem 0; color: var(--t-textGhost); font-size: 0.8125rem;`;

// ── Detail view ──────────────────────────────────────────────────
const DetailTitle = styled.h3`
  font-size: 1.4rem;
  font-weight: 800;
  margin: 0 0 0.5rem;
  ${inkWhite}
  line-height: 1.2;
`;
const DetailMetaRow = styled.div`display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.85rem;`;
const WhenBig = styled.div`
  font-size: 0.95rem;
  font-weight: 700;
  color: ${colors.gold};
  font-family: var(--font-geist-mono), monospace;
`;
const DetailDesc = styled.div`
  font-size: 0.9rem;
  line-height: 1.55;
  ${inkWhite}
  white-space: pre-wrap;
  padding: 0.8rem 0.9rem;
  border-radius: 0.6rem;
  border: 1px solid var(--t-border);
  background: rgba(255, 255, 255, 0.02);
  margin-bottom: 1.1rem;
  b, strong { font-weight: 800; }
  u { text-decoration: underline; }
`;
const FieldBlock = styled.div`margin-bottom: 1.1rem;`;
const FieldLabelSm = styled.div`
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${colors.gold};
  margin-bottom: 0.45rem;
`;
const StatusPills = styled.div`display: flex; gap: 0.4rem; flex-wrap: wrap;`;
const StatusPill = styled.button<{ $active: boolean; $rgbv: string; $c: string }>`
  padding: 0.35rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  color: ${(p) => (p.$active ? "#0b0b0b" : p.$c)};
  background: ${(p) => (p.$active ? p.$c : `rgba(${p.$rgbv}, 0.1)`)};
  border: 1px solid rgba(${(p) => p.$rgbv}, ${(p) => (p.$active ? 1 : 0.4)});
  &:hover:not(:disabled) { background: ${(p) => (p.$active ? p.$c : `rgba(${p.$rgbv}, 0.22)`)}; }
  &:disabled { opacity: 0.6; cursor: default; }
`;
const DetailChannels = styled.div`font-size: 0.78rem; color: var(--t-textGhost);`;

// ── Create/edit form ─────────────────────────────────────────────
const Form = styled.div`display: flex; flex-direction: column; gap: 0.75rem; max-width: 30rem; margin: 0 auto;`;
const Field = styled.label`display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: ${colors.gold};`;
const Input = styled.input`
  padding: 0.5rem 0.7rem; font-size: 0.875rem; ${inkWhite}
  background: var(--t-inputBg); border: 1px solid var(--t-border); border-radius: 0.5rem; outline: none;
  &:focus { border-color: rgba(${rgb.gold}, 0.55); }
`;
const ChanRow = styled.div`display: flex; gap: 0.9rem; flex-wrap: wrap;`;
const Chk = styled.label`display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; text-transform: none; letter-spacing: 0; font-weight: 400; ${inkWhite} cursor: pointer; input { accent-color: ${colors.gold}; }`;
const TeamNote = styled.div`font-size: 0.7rem; color: var(--t-textGhost);`;
const FormBtns = styled.div`display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 0.4rem;`;
const Ghost = styled.button`padding: 0.5rem 0.9rem; border-radius: 0.5rem; border: 1px solid var(--t-border); background: transparent; color: var(--t-textFaint); font-size: 0.8125rem; font-weight: 600; cursor: pointer; &:hover { color: var(--t-textBase); }`;
const Primary = styled.button`padding: 0.5rem 1rem; border-radius: 0.5rem; border: none; background: ${colors.gold}; color: #0b0b0b; font-size: 0.8125rem; font-weight: 800; cursor: pointer; &:disabled { opacity: 0.4; cursor: not-allowed; }`;
const DangerBtn = styled.button`padding: 0.5rem 0.9rem; border-radius: 0.5rem; border: 1px solid rgba(${rgb.pink}, 0.5); background: rgba(${rgb.pink}, 0.12); color: ${colors.pink}; font-size: 0.8125rem; font-weight: 700; cursor: pointer; &:hover:not(:disabled) { background: rgba(${rgb.pink}, 0.22); } &:disabled { opacity: 0.4; cursor: not-allowed; }`;
const FormHead = styled.div`font-size: 0.9rem; font-weight: 800; color: ${colors.gold}; margin-bottom: 0.2rem;`;
const DelPrompt = styled.span`font-size: 0.72rem; color: ${colors.pink}; align-self: center; margin-right: auto;`;

// ── Mini date-picker (TGV-styled) ────────────────────────────────
const PickTrigger = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  font-size: 0.875rem;
  ${inkWhite}
  background: var(--t-inputBg);
  border: 1px solid var(--t-border);
  border-radius: 0.5rem;
  cursor: pointer;
  text-align: left;
  &:hover { border-color: rgba(${rgb.gold}, 0.55); }
  svg { width: 14px; height: 14px; color: ${colors.gold}; flex-shrink: 0; }
  span { flex: 1; }
`;
const MiniPop = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 30;
  width: 17rem;
  padding: 0.7rem;
  border-radius: 0.8rem;
  background: var(--t-cardGrad);
  border: 1px solid rgba(${rgb.gold}, 0.4);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.65), 0 0 26px rgba(${rgb.gold}, 0.16);
`;
const MiniHead = styled.div`display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;`;
const MiniLabel = styled.div`font-size: 0.78rem; font-weight: 800; color: ${colors.gold}; font-family: var(--font-geist-mono), monospace;`;
const MiniNav = styled.button`
  width: 1.6rem; height: 1.6rem; border-radius: 0.4rem;
  border: 1px solid rgba(${rgb.gold}, 0.35); background: rgba(${rgb.gold}, 0.1);
  color: ${colors.gold}; font-size: 0.85rem; font-weight: 800; cursor: pointer; line-height: 1;
  &:hover { background: rgba(${rgb.gold}, 0.22); }
`;
const MiniDay = styled.button<{ $selected: boolean; $today: boolean }>`
  aspect-ratio: 1 / 1;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.72rem; font-weight: ${(p) => (p.$selected ? 800 : 500)};
  border-radius: 50%;
  cursor: pointer;
  color: ${(p) => (p.$selected ? "#0b0b0b" : "var(--t-textBase)")};
  background: ${(p) => (p.$selected ? colors.gold : "transparent")};
  border: 1px solid ${(p) => (p.$selected ? colors.gold : p.$today ? `rgba(${rgb.gold}, 0.55)` : "transparent")};
  &:hover { background: ${(p) => (p.$selected ? colors.gold : `rgba(${rgb.gold}, 0.18)`)}; }
`;
const MiniTimeRow = styled.div`display: flex; align-items: center; gap: 0.5rem; margin-top: 0.6rem; padding-top: 0.6rem; border-top: 1px solid rgba(${rgb.gold}, 0.18);`;
const MiniTimeLabel = styled.span`font-size: 0.62rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--t-textFaint);`;
const MiniTime = styled.input`
  flex: 1; padding: 0.4rem 0.5rem; font-size: 0.85rem; ${inkWhite}
  background: var(--t-inputBg); border: 1px solid var(--t-border); border-radius: 0.4rem; outline: none;
  &:focus { border-color: rgba(${rgb.gold}, 0.55); }
  &::-webkit-calendar-picker-indicator { filter: invert(0.8) sepia(1) saturate(5) hue-rotate(5deg); }
`;

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── Helpers ──────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

function fmtRange(months: { label: string }[]): string {
  if (months.length === 1) return months[0].label;
  return `${months[0].label} – ${months[months.length - 1].label}`;
}

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

function fmtTime(triggerIso: string): string {
  return new Date(triggerIso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function fullWhen(triggerIso: string): string {
  return new Date(triggerIso).toLocaleString(undefined, {
    weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// datetime-local "YYYY-MM-DDTHH:mm" → parts (month 0-indexed)
function parseLocal(v: string): { y: number; m: number; d: number; hh: number; mm: number } | null {
  if (!v) return null;
  const [dp, tp] = v.split("T");
  const [y, m, d] = dp.split("-").map(Number);
  const [hh, mm] = (tp || "09:00").split(":").map(Number);
  if (!y || !m || !d) return null;
  return { y, m: m - 1, d, hh: hh || 0, mm: mm || 0 };
}
const buildLocal = (y: number, m0: number, d: number, hh: number, mm: number) =>
  `${y}-${pad(m0 + 1)}-${pad(d)}T${pad(hh)}:${pad(mm)}`;

// Plain-text preview from a (possibly rich-HTML) description, for list rows.
const stripTags = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").trim();

// Allowlist sanitizer for the rich description (staff-authored, but still
// defense-in-depth): keep only basic formatting tags, drop everything else +
// all attributes except safe style / <font size>.
const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "BR", "DIV", "P", "SPAN", "FONT"]);
function sanitizeHtml(html: string): string {
  if (typeof document === "undefined") return stripTags(html);
  const root = document.createElement("div");
  root.innerHTML = html;
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 1) {
        const el = child as HTMLElement;
        if (!ALLOWED_TAGS.has(el.tagName)) {
          while (el.firstChild) node.insertBefore(el.firstChild, el);
          node.removeChild(el);
        } else {
          for (const attr of Array.from(el.attributes)) {
            const name = attr.name.toLowerCase();
            const okStyle = name === "style" && !/url\(|expression|javascript:/i.test(attr.value);
            const okSize = name === "size" && el.tagName === "FONT";
            if (!okStyle && !okSize) el.removeAttribute(attr.name);
          }
          walk(el);
        }
      } else if (child.nodeType === 8) {
        node.removeChild(child); // comments
      }
    }
  };
  walk(root);
  return root.innerHTML;
}

// ── Mini date-picker component ───────────────────────────────────

function MiniDatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const parsed = parseLocal(value);
  const now = new Date();
  const [view, setView] = useState(() => {
    const base = parsed ?? { y: now.getFullYear(), m: now.getMonth() };
    return { y: base.y, m: base.m };
  });

  useEffect(() => {
    if (open && parsed) setView({ y: parsed.y, m: parsed.m });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const time = parsed ? `${pad(parsed.hh)}:${pad(parsed.mm)}` : "09:00";
  const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const firstDow = new Date(view.y, view.m, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const shiftMonth = (dir: number) =>
    setView((v) => {
      const m = v.m + dir;
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });

  const pickDay = (d: number) => {
    const [hh, mm] = time.split(":").map(Number);
    onChange(buildLocal(view.y, view.m, d, hh, mm));
    setOpen(false);
  };
  const setTime = (t: string) => {
    const [hh, mm] = t.split(":").map(Number);
    const base = parsed ?? { y: view.y, m: view.m, d: now.getDate() };
    onChange(buildLocal(base.y, base.m, base.d, hh || 0, mm || 0));
  };

  const label = parsed
    ? new Date(parsed.y, parsed.m, parsed.d, parsed.hh, parsed.mm).toLocaleString(undefined, {
        weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
      })
    : "Choose date & time";

  return (
    <PickerWrap style={{ display: "flex" }}>
      <PickTrigger type="button" onClick={() => setOpen((o) => !o)} style={{ width: "100%" }}>
        <EventIcon size={14} />
        <span>{label}</span>
      </PickTrigger>
      {open && (
        <>
          <PickerOverlay onClick={() => setOpen(false)} />
          <MiniPop onClick={(e) => e.stopPropagation()}>
            <MiniHead>
              <MiniNav type="button" onClick={() => shiftMonth(-1)}>‹</MiniNav>
              <MiniLabel>{MONTH_NAMES[view.m]} {view.y}</MiniLabel>
              <MiniNav type="button" onClick={() => shiftMonth(1)}>›</MiniNav>
            </MiniHead>
            <WeekHead>{WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}</WeekHead>
            <DayGrid>
              {days.map((d, idx) => {
                const iso = `${view.y}-${pad(view.m + 1)}-${pad(d)}`;
                const selected = !!parsed && parsed.y === view.y && parsed.m === view.m && parsed.d === d;
                return (
                  <MiniDay
                    key={d}
                    type="button"
                    $selected={selected}
                    $today={iso === todayIso}
                    style={idx === 0 ? { gridColumnStart: firstDow + 1 } : undefined}
                    onClick={() => pickDay(d)}
                  >
                    {d}
                  </MiniDay>
                );
              })}
            </DayGrid>
            <MiniTimeRow>
              <MiniTimeLabel>Time</MiniTimeLabel>
              <MiniTime type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </MiniTimeRow>
          </MiniPop>
        </>
      )}
    </PickerWrap>
  );
}

// ── Neon select (gold DDM) — replaces native <select> so it matches the
//    modal's neon aesthetic and its option text stays light on dark ─────────
const NeonTrigger = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  max-width: 20rem;
  padding: 0.5rem 0.7rem;
  font-size: 0.875rem;
  ${inkWhite}
  background: var(--t-inputBg);
  border: 1px solid rgba(${rgb.gold}, 0.4);
  border-radius: 0.5rem;
  cursor: pointer;
  text-align: left;
  &:hover:not(:disabled) { border-color: rgba(${rgb.gold}, 0.7); box-shadow: 0 0 10px rgba(${rgb.gold}, 0.18); }
  &:disabled { opacity: 0.5; cursor: default; }
  .arr { color: ${colors.gold}; font-size: 0.55rem; }
`;
// Portaled to <body> so the panel is never clipped by the modal Body's
// overflow and sits ABOVE the modal (z > the 12000 backdrop).
const PortalOverlay = styled.div`position: fixed; inset: 0; z-index: 12050;`;
const PortalPanel = styled.div`
  position: fixed;
  z-index: 12051;
  max-width: 24rem;
  max-height: 15rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  background: var(--t-surface);
  border: 1px solid rgba(${rgb.gold}, 0.4);
  border-radius: 0.6rem;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6), 0 0 22px rgba(${rgb.gold}, 0.16);
`;
const NeonItem = styled.button<{ $active: boolean }>`
  text-align: left;
  padding: 0.45rem 0.6rem;
  border: none;
  border-radius: 0.4rem;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: ${(p) => (p.$active ? 800 : 500)};
  color: ${(p) => (p.$active ? "#0b0b0b" : "#fff")};
  background: ${(p) => (p.$active ? colors.gold : "transparent")};
  [data-theme="light"] & { color: ${(p) => (p.$active ? "#0b0b0b" : "#14161a")}; }
  &:hover { background: ${(p) => (p.$active ? colors.gold : `rgba(${rgb.gold}, 0.16)`)}; }
`;

type Option = { value: string; label: string };
function NeonSelect({
  value, options, placeholder = "Select…", disabled, maxWidth, onChange,
}: { value: string; options: Option[]; placeholder?: string; disabled?: boolean; maxWidth?: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top?: number; bottom?: number; left: number; width: number; maxH: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cur = options.find((o) => o.value === value);
  const width = maxWidth ?? "20rem";

  const openPanel = () => {
    const el = triggerRef.current;
    if (!el) { setOpen(true); return; }
    const r = el.getBoundingClientRect();
    const margin = 10;
    const spaceBelow = window.innerHeight - r.bottom - margin;
    const spaceAbove = r.top - margin;
    const desired = Math.min(320, options.length * 40 + 10); // approx content height
    // Open downward when it fits (or there's more room below); else flip up.
    if (spaceBelow >= desired || spaceBelow >= spaceAbove) {
      setRect({ top: r.bottom + 6, left: r.left, width: r.width, maxH: Math.max(140, Math.min(desired, spaceBelow)) });
    } else {
      setRect({ bottom: window.innerHeight - r.top + 6, left: r.left, width: r.width, maxH: Math.max(140, Math.min(desired, spaceAbove)) });
    }
    setOpen(true);
  };

  return (
    <div style={{ display: "inline-flex", width, maxWidth: width, position: "relative" }}>
      <NeonTrigger
        ref={triggerRef}
        type="button"
        disabled={disabled}
        style={{ maxWidth: width }}
        onClick={() => (open ? setOpen(false) : openPanel())}
      >
        <span>{cur ? cur.label : placeholder}</span>
        <span className="arr">▼</span>
      </NeonTrigger>
      {open && rect && typeof document !== "undefined" && createPortal(
        <>
          <PortalOverlay onClick={() => setOpen(false)} />
          <PortalPanel
            style={{ top: rect.top, bottom: rect.bottom, left: rect.left, minWidth: rect.width, maxHeight: rect.maxH }}
            onClick={(e) => e.stopPropagation()}
          >
            {options.map((o) => (
              <NeonItem key={o.value} type="button" $active={o.value === value} onClick={() => { onChange(o.value); setOpen(false); }}>
                {o.label}
              </NeonItem>
            ))}
          </PortalPanel>
        </>,
        document.body
      )}
    </div>
  );
}

// ── Rich text (light tool set: bold / italic / underline / font size) ───────
const RichToolbar = styled.div`display: flex; gap: 0.25rem; margin-bottom: 0.35rem;`;
const RichBtn = styled.button`
  min-width: 1.9rem;
  height: 1.7rem;
  padding: 0 0.45rem;
  border-radius: 0.35rem;
  border: 1px solid rgba(${rgb.gold}, 0.35);
  background: rgba(${rgb.gold}, 0.1);
  color: ${colors.gold};
  font-size: 0.8rem;
  cursor: pointer;
  line-height: 1;
  &:hover { background: rgba(${rgb.gold}, 0.22); }
`;
const RichArea = styled.div`
  min-height: 4rem;
  max-height: 12rem;
  overflow-y: auto;
  padding: 0.5rem 0.7rem;
  font-size: 0.8125rem;
  line-height: 1.5;
  ${inkWhite}
  background: var(--t-inputBg);
  border: 1px solid var(--t-border);
  border-radius: 0.5rem;
  outline: none;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
  &:focus { border-color: rgba(${rgb.gold}, 0.55); }
  &:empty::before { content: attr(data-placeholder); color: var(--t-textGhost); }
`;

function RichEditor({ html, onChange }: { html: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // Sync the DOM from `html` only when not focused (avoids caret jumps while typing).
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerHTML !== html) el.innerHTML = html || "";
  }, [html]);
  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    // eslint-disable-next-line deprecation/deprecation
    document.execCommand(cmd, false, arg);
    onChange(ref.current?.innerHTML || "");
  };
  return (
    <div>
      <RichToolbar>
        <RichBtn type="button" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}><b>B</b></RichBtn>
        <RichBtn type="button" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}><i>I</i></RichBtn>
        <RichBtn type="button" title="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")}><u>U</u></RichBtn>
        <RichBtn type="button" title="Larger text" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("fontSize", "5")}>A▲</RichBtn>
        <RichBtn type="button" title="Smaller text" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("fontSize", "3")}>A▽</RichBtn>
      </RichToolbar>
      <RichArea
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Steps, links, context…"
        onInput={() => onChange(ref.current?.innerHTML || "")}
      />
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────

type ViewKind = "calendar" | "list";
type Props = {
  open: boolean;
  onClose: () => void;
  startInCreate?: boolean;
  /** When set, the modal opens straight into this alert's detail view (one-click from the tab). */
  viewAlert?: PersonalAlert | null;
};

export default function AlertsCalendarModal({ open, onClose, startInCreate = false, viewAlert = null }: Props) {
  const [alerts, setAlerts] = useState<PersonalAlert[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [kind, setKind] = useState<ViewKind>("calendar");
  const [span, setSpan] = useState<CalendarViewMode>("3");
  const [anchor, setAnchor] = useState(() => {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
  });
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [picker, setPicker] = useState<null | "month" | "year">(null);
  const [detailAlert, setDetailAlert] = useState<PersonalAlert | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savingWf, setSavingWf] = useState(false);

  // create/edit-form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [triggerLocal, setTriggerLocal] = useState("");
  const [channels, setChannels] = useState<AlertChannel[]>(["dashboard"]);
  const [recurrence, setRecurrence] = useState<AlertRecurrence>("none");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/frontdesk/team-alerts");
      if (res.ok) setAlerts(await res.json());
    } catch { /* ignore */ }
  }, []);

  const loadStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/frontdesk/staff");
      if (res.ok) setStaff((await res.json()).staff ?? []);
    } catch { /* ignore */ }
  }, []);

  const prefillFrom = (a: PersonalAlert) => {
    setEditingId(a.id);
    setTitle(a.title);
    setDescription(a.description ?? "");
    setTriggerLocal(toLocalInput(a.trigger_at));
    setChannels((a.channels as AlertChannel[]).length ? (a.channels as AlertChannel[]) : ["dashboard"]);
    setRecurrence(a.recurrence);
  };

  useEffect(() => {
    if (!open) return;
    load();
    loadStaff();
    setDeleteArmed(false);
    setSelectedIso(null);
    setPicker(null);
    setShowCreate(false);
    setEditingId(null);
    if (viewAlert) setDetailAlert(viewAlert);
    else {
      setDetailAlert(null);
      setShowCreate(startInCreate);
    }
  }, [open, load, loadStaff, startInCreate, viewAlert]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      if (picker) setPicker(null);
      else if (showCreate) closeForm();
      else if (detailAlert) setDetailAlert(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose, picker, showCreate, detailAlert]); // eslint-disable-line react-hooks/exhaustive-deps

  const count = MONTHS_IN_VIEW[span];
  const months = useMemo(() => buildMonthsGrid(anchor.year, anchor.month, count), [anchor, count]);
  const events = useMemo(() => alertsToCalendarEvents(alerts, { mode: "team" }), [alerts]);
  const byDay = useMemo(() => indexEventsByDate(events), [events]);
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const shift = (dir: number) =>
    setAnchor((a) => {
      const m = a.month + dir * count;
      return { year: a.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });

  const dayItems = selectedIso ? (byDay[selectedIso] ?? []) : [];
  const upcoming = useMemo(
    () => [...events].filter((e) => e.startIso.slice(0, 10) >= todayIso).sort((a, b) => a.startIso.localeCompare(b.startIso)),
    [events, todayIso]
  );

  const toggleChan = (c: AlertChannel) =>
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const resetForm = () => {
    setTitle(""); setDescription(""); setTriggerLocal("");
    setChannels(["dashboard"]); setRecurrence("none"); setDeleteArmed(false);
  };

  const openCreate = () => { setDetailAlert(null); setEditingId(null); resetForm(); setShowCreate(true); };
  const openDetail = (a: PersonalAlert) => { setDetailAlert(a); setShowCreate(false); };
  const openEditFromDetail = () => { if (detailAlert) { prefillFrom(detailAlert); setDeleteArmed(false); setShowCreate(true); } };
  // Cancel returns to the detail card if we came from one; else to calendar/list.
  const closeForm = () => { setShowCreate(false); setEditingId(null); resetForm(); };

  async function handleSubmit() {
    if (!title.trim() || !triggerLocal || channels.length === 0) return;
    const wasEditing = editingId;
    setBusy(true);
    try {
      const trigger_at = new Date(triggerLocal).toISOString();
      const payload = {
        title: title.trim(),
        description: stripTags(description).length > 0 ? description : undefined,
        trigger_at,
        channels,
        recurrence,
        visibility: "team",
        email_from_mode: channels.includes("email") ? "system" : null,
      };
      const res = wasEditing
        ? await fetch(`/api/frontdesk/team-alerts/${wasEditing}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
          })
        : await fetch("/api/frontdesk/team-alerts", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
          });
      if (res.ok) {
        const updated = await res.json().catch(() => null);
        resetForm();
        setEditingId(null);
        setShowCreate(false);
        if (wasEditing && updated) setDetailAlert(updated); // back to the refreshed detail card
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!editingId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/frontdesk/team-alerts/${editingId}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        resetForm(); setEditingId(null); setShowCreate(false); setDetailAlert(null);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function patchWorkflow(changes: { assignee?: string | null; workStatus?: WorkStatusKey }) {
    if (!detailAlert) return;
    setSavingWf(true);
    try {
      const res = await fetch(`/api/frontdesk/team-alerts/${detailAlert.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes),
      });
      if (res.ok) {
        const updated = await res.json().catch(() => null);
        if (updated) setDetailAlert(updated);
        await load();
      }
    } finally {
      setSavingWf(false);
    }
  }

  const renderItems = (items: typeof events) =>
    items.map((e) => {
      const wf = (e.source.payload as Record<string, unknown> | null) ?? {};
      const ws = wsMeta((wf.workStatus as string) ?? "open");
      return (
        <ItemRow key={e.id} onClick={() => openDetail(e.source)} title="Open alert">
          <ItemTitle>{e.name}</ItemTitle>
          <ItemMeta>{fmtTime(e.startIso)}</ItemMeta>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
            <SourcePill $src={e.source.source}>{e.source.source}</SourcePill>
            <StatusChip $c={ws.c} $rgbv={ws.rgbv}>{ws.label}</StatusChip>
            {e.source.recurrence !== "none" && <ItemMeta>repeats {e.source.recurrence}</ItemMeta>}
          </div>
          {e.source.description && <ItemDesc>{stripTags(e.source.description)}</ItemDesc>}
        </ItemRow>
      );
    });

  if (!open || typeof document === "undefined") return null;

  const inDetail = !!detailAlert && !showCreate;
  const wide = showCreate ? "34rem" : inDetail ? "40rem" : kind === "list" ? "40rem" : span === "1" ? "30rem" : span === "3" ? "54rem" : "70rem";

  const wf = (detailAlert?.payload as Record<string, unknown> | null) ?? {};
  const curStatus = (wf.workStatus as string) ?? "open";
  const curAssignee = (wf.assignee as string) ?? "";
  const assigneeName = curAssignee ? (staff.find((s) => s.username === curAssignee)?.name ?? curAssignee) : "";

  return createPortal(
    <Backdrop onClick={onClose}>
      <Shell $wide={wide} onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>Scheduled Alerts</Title>
          {inDetail && <BackBtn onClick={() => setDetailAlert(null)}>‹ Back</BackBtn>}
          {!showCreate && !inDetail && (
            <Segmented>
              <SegBtn $active={kind === "calendar"} onClick={() => setKind("calendar")}>Calendar</SegBtn>
              <SegBtn $active={kind === "list"} onClick={() => setKind("list")}>List</SegBtn>
            </Segmented>
          )}
          <Spacer />
          {inDetail && <HeaderBtn onClick={openEditFromDetail}><EditIcon size={12} /> Edit</HeaderBtn>}
          {!showCreate && !inDetail && <AddBtn onClick={openCreate}>＋ Add Alert</AddBtn>}
          <CloseBtn onClick={onClose} title="Close">✕</CloseBtn>
        </Header>

        <Body>
          {showCreate ? (
            <Form>
              <FormHead>{editingId ? "Edit alert" : "New alert"}</FormHead>
              <Field>
                Title
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Renew TLS cert" autoFocus />
              </Field>
              <Field>
                Details (optional)
                <RichEditor html={description} onChange={setDescription} />
              </Field>
              <Field>
                When (your local time)
                <MiniDatePicker value={triggerLocal} onChange={setTriggerLocal} />
              </Field>
              <Field>
                Channels
                <ChanRow>
                  {ALL_CHANNELS.map((c) => (
                    <Chk key={c}>
                      <input type="checkbox" checked={channels.includes(c)} onChange={() => toggleChan(c)} />
                      {c}
                    </Chk>
                  ))}
                </ChanRow>
              </Field>
              <Field>
                Repeat
                <NeonSelect
                  value={recurrence}
                  options={ALL_RECURRENCES.map((r) => ({ value: r, label: r }))}
                  onChange={(v) => setRecurrence(v as AlertRecurrence)}
                />
              </Field>
              <TeamNote>👥 This alert is shared with the whole team (visible on this calendar).</TeamNote>
              <FormBtns>
                {editingId && (
                  deleteArmed ? (
                    <>
                      <DelPrompt>Delete this alert?</DelPrompt>
                      <Ghost onClick={() => setDeleteArmed(false)} disabled={busy}>Keep</Ghost>
                      <DangerBtn onClick={handleDelete} disabled={busy}>{busy ? "Deleting…" : "Yes, delete"}</DangerBtn>
                    </>
                  ) : (
                    <DangerBtn style={{ marginRight: "auto" }} onClick={() => setDeleteArmed(true)} disabled={busy}>Delete</DangerBtn>
                  )
                )}
                {!deleteArmed && (
                  <>
                    <Ghost onClick={closeForm} disabled={busy}>Cancel</Ghost>
                    <Primary onClick={handleSubmit} disabled={busy || !title.trim() || !triggerLocal || channels.length === 0}>
                      {busy ? "Saving…" : editingId ? "Save changes" : "Create alert"}
                    </Primary>
                  </>
                )}
              </FormBtns>
            </Form>
          ) : inDetail && detailAlert ? (
            <>
              <DetailTitle>{detailAlert.title}</DetailTitle>
              <DetailMetaRow>
                <SourcePill $src={detailAlert.source}>{detailAlert.source}</SourcePill>
                <WhenBig>{fullWhen(detailAlert.trigger_at)}</WhenBig>
                {detailAlert.recurrence !== "none" && <ItemMeta>repeats {detailAlert.recurrence}</ItemMeta>}
              </DetailMetaRow>
              {detailAlert.description && <DetailDesc dangerouslySetInnerHTML={{ __html: sanitizeHtml(detailAlert.description) }} />}

              <FieldBlock>
                <FieldLabelSm>Status {savingWf && "· saving…"}</FieldLabelSm>
                <StatusPills>
                  {WORK_STATUSES.map((s) => (
                    <StatusPill
                      key={s.key}
                      $active={curStatus === s.key}
                      $c={s.c}
                      $rgbv={s.rgbv}
                      disabled={savingWf}
                      onClick={() => patchWorkflow({ workStatus: s.key })}
                    >
                      {s.label}
                    </StatusPill>
                  ))}
                </StatusPills>
              </FieldBlock>

              <FieldBlock>
                <FieldLabelSm>Assigned to</FieldLabelSm>
                <NeonSelect
                  value={curAssignee}
                  disabled={savingWf}
                  maxWidth="20rem"
                  placeholder="Open for assignment (unassigned)"
                  options={[
                    { value: "", label: "Open for assignment (unassigned)" },
                    ...staff.map((s) => ({ value: s.username, label: s.name })),
                  ]}
                  onChange={(v) => patchWorkflow({ assignee: v || null })}
                />
                {curAssignee && <ItemMeta style={{ marginTop: 6 }}>Currently: {assigneeName}</ItemMeta>}
              </FieldBlock>

              <DetailChannels>Channels: {detailAlert.channels.join(" + ")}</DetailChannels>
            </>
          ) : kind === "list" ? (
            <>
              <ListHead>Upcoming alerts</ListHead>
              {upcoming.length === 0 ? (
                <Empty>No upcoming alerts. Click ＋ Add Alert to schedule one.</Empty>
              ) : renderItems(upcoming)}
            </>
          ) : (
            <>
              <Toolbar>
                <NavBtn onClick={() => shift(-1)} title="Previous">‹</NavBtn>
                <PickerWrap>
                  <DateBtn onClick={() => setPicker((p) => (p === "month" ? null : "month"))} title="Jump to month">
                    {MONTH_NAMES[anchor.month]} <span>▾</span>
                  </DateBtn>
                  {picker === "month" && (
                    <>
                      <PickerOverlay onClick={() => setPicker(null)} />
                      <MonthPanel>
                        {MONTH_ABBR.map((m, i) => (
                          <PickItem key={m} $active={i === anchor.month} onClick={() => { setAnchor((a) => ({ ...a, month: i })); setPicker(null); }}>
                            {m}
                          </PickItem>
                        ))}
                      </MonthPanel>
                    </>
                  )}
                </PickerWrap>
                <PickerWrap>
                  <DateBtn onClick={() => setPicker((p) => (p === "year" ? null : "year"))} title="Jump to year">
                    {anchor.year} <span>▾</span>
                  </DateBtn>
                  {picker === "year" && (
                    <>
                      <PickerOverlay onClick={() => setPicker(null)} />
                      <YearPanel>
                        {Array.from({ length: 10 }, (_, k) => anchor.year - 1 + k).map((y) => (
                          <PickItem key={y} $active={y === anchor.year} onClick={() => { setAnchor((a) => ({ ...a, year: y })); setPicker(null); }}>
                            {y}
                          </PickItem>
                        ))}
                      </YearPanel>
                    </>
                  )}
                </PickerWrap>
                <NavBtn onClick={() => shift(1)} title="Next">›</NavBtn>
                <Spacer />
                <Segmented>
                  {(["1", "3", "12"] as CalendarViewMode[]).map((v) => (
                    <SegBtn key={v} $active={span === v} onClick={() => setSpan(v)}>{v}M</SegBtn>
                  ))}
                </Segmented>
              </Toolbar>

              <MonthsGrid>
                {months.map((month) => {
                  const firstDow = new Date(Date.UTC(month.year, month.monthIndex, 1)).getUTCDay();
                  const monthCells = month.cells.filter((c) => c.inMonth); // only this month's days
                  return (
                    <MonthCard key={`${month.year}-${month.monthIndex}`}>
                      <MonthLabel>{month.label}</MonthLabel>
                      <WeekHead>{WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}</WeekHead>
                      <DayGrid>
                        {monthCells.map((cell, idx) => {
                          const items = byDay[cell.iso] ?? [];
                          const hasRcs = items.some((e) => e.source.source !== "manual");
                          return (
                            <DayCell
                              key={cell.iso}
                              style={idx === 0 ? { gridColumnStart: firstDow + 1 } : undefined}
                              title={items.length ? `${items.length} alert${items.length > 1 ? "s" : ""}` : undefined}
                              onClick={() => setSelectedIso(cell.iso === selectedIso ? null : cell.iso)}
                            >
                              <DayNum $has={items.length > 0} $today={cell.iso === todayIso} $selected={cell.iso === selectedIso} $rcs={hasRcs}>
                                {cell.dayNumber}
                              </DayNum>
                              {items.length > 1 && <CountBadge $rcs={hasRcs}>{items.length}</CountBadge>}
                            </DayCell>
                          );
                        })}
                      </DayGrid>
                    </MonthCard>
                  );
                })}
              </MonthsGrid>

              <ListPane>
                <ListHead>{selectedIso ? fmtDay(selectedIso) : "Upcoming alerts"}</ListHead>
                {(selectedIso ? dayItems : upcoming).length === 0 ? (
                  <Empty>{selectedIso ? "No alerts on this day." : "No upcoming alerts. Click ＋ Add Alert to schedule one."}</Empty>
                ) : renderItems(selectedIso ? dayItems : upcoming)}
              </ListPane>
            </>
          )}
        </Body>
      </Shell>
    </Backdrop>,
    document.body
  );
}
