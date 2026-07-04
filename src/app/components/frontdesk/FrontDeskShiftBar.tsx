"use client";

/**
 * FrontDeskShiftBar — persistent across all Front Desk drawer tabs.
 *
 * Sits between the drawer's TabBar and the active tab's content. Shows the
 * current on-shift user and (for execs) admin actions: Tools, Shift, DIDs,
 * Saved Calls.
 *
 * Was previously embedded inside PhoneTab; lifted here so settings/shift
 * controls are reachable from every tab (Phone, SMS, Contacts, Alerts).
 *
 * Cross-tab sync: when admin saves something via one of the modals, this
 * component dispatches a `frontdesk-data-changed` window event so the
 * individual tabs (PhoneTab in particular) can refresh their local state.
 */

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import type { ShiftAssignment } from "@/lib/frontdesk/types";
import ShiftWorkerModal from "./ShiftWorkerModal";
import DidManagerModal from "./DidManagerModal";
import SystemToolsModal from "./SystemToolsModal";
import Tooltip from "../ui/Tooltip";
import { EditIcon, SettingsIcon } from "../icons";

const EXEC_USERNAMES = new Set(["admin", "marmar"]);

// ── Styled (mirrors what was previously inline in PhoneTab) ──────

const Bar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  margin: 0 0.75rem 0.5rem;
  border-radius: 0.5rem;
  background: rgba(${rgb.gold}, 0.05);
  border: 1px solid rgba(${rgb.gold}, 0.2);
  font-size: 0.8125rem;
  flex-shrink: 0;
`;

const Label = styled.span`
  color: var(--t-textFaint);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 0.6875rem;
  font-weight: 700;
`;

const Name = styled.span`
  color: ${colors.gold};
  font-weight: 600;
  margin-left: 0.35rem;
`;

const AdminRow = styled.div`
  display: flex;
  gap: 0.35rem;
`;

const AdminBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.55rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: transparent;
  border: 1px solid rgba(${rgb.gold}, 0.4);
  border-radius: 0.35rem;
  color: ${colors.gold};
  cursor: pointer;
  &:hover { background: rgba(${rgb.gold}, 0.14); }
  svg { width: 10px; height: 10px; }
`;

type ModalKind = "tools" | "shift" | "dids" | "saved" | null;

export const FRONTDESK_DATA_CHANGED_EVENT = "frontdesk-data-changed";

export default function FrontDeskShiftBar() {
  const [shift, setShift] = useState<ShiftAssignment | null>(null);
  const [me, setMe] = useState<{ username: string } | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);

  const isExec = me ? EXEC_USERNAMES.has(me.username) : false;

  const refresh = useCallback(async () => {
    try {
      const [shiftRes, meRes] = await Promise.all([
        fetch("/api/frontdesk/shift"),
        fetch("/api/users/me"),
      ]);
      if (shiftRes.ok) setShift((await shiftRes.json()).shift ?? null);
      if (meRes.ok) {
        const j = await meRes.json();
        setMe({ username: j.username });
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 15_000);
    const handler = () => void refresh();
    window.addEventListener(FRONTDESK_DATA_CHANGED_EVENT, handler);
    return () => {
      clearInterval(id);
      window.removeEventListener(FRONTDESK_DATA_CHANGED_EVENT, handler);
    };
  }, [refresh]);

  const broadcast = useCallback(() => {
    window.dispatchEvent(new CustomEvent(FRONTDESK_DATA_CHANGED_EVENT));
  }, []);

  return (
    <>
      <Bar>
        <div>
          <Label>On shift</Label>
          <Name>{shift?.username ?? "— (ring all online)"}</Name>
        </div>
        {isExec && (
          <AdminRow>
            <Tooltip accent={colors.gold} label="System tools">
              <AdminBtn type="button" onClick={() => setModal("tools")}>
              <SettingsIcon size={10} /> Tools
              </AdminBtn>
            </Tooltip>
            <Tooltip accent={colors.gold} label="Assign today's shift worker">
              <AdminBtn type="button" onClick={() => setModal("shift")}>
                <EditIcon size={10} /> Shift
              </AdminBtn>
            </Tooltip>
            <Tooltip accent={colors.gold} label="Manage phone lines (DIDs)">
              <AdminBtn type="button" onClick={() => setModal("dids")}>
                <EditIcon size={10} /> DIDs
              </AdminBtn>
            </Tooltip>
          </AdminRow>
        )}
      </Bar>

      {modal === "tools" && (
        <SystemToolsModal
          onClose={() => { setModal(null); broadcast(); }}
          onShiftSaved={(s) => { setShift(s); broadcast(); }}
          onDidsChanged={broadcast}
        />
      )}
      {modal === "shift" && (
        <ShiftWorkerModal
          onClose={() => setModal(null)}
          onSaved={(s) => { setShift(s); broadcast(); }}
        />
      )}
      {modal === "dids" && (
        <DidManagerModal
          onClose={() => { setModal(null); broadcast(); }}
        />
      )}
    </>
  );
}
