"use client";

// Modules → Component Library. The living library itself is the tgv.com Page
// Editor in library mode (a NEW TAB — the editor is a full-window harness and
// has no business inside the Office page-modal iframe). This panel explains
// the contract and holds the door. A plain anchor, not window.open: a blocked
// popup reads as "the button does nothing" (ModuleStorefrontPanel's lesson).

import styled from "styled-components";

import { colors, rgb } from "../../theme";
import { livingLibraryUrl } from "./livingLibraryUrl";

export default function ComponentLibraryPanel() {
  const href = livingLibraryUrl();
  return (
    <Wrap>
      <Lead>
        Every component the fleet&apos;s editor picker offers, editable in the real
        Page Editor. The taskbar lists the components by category; open one and
        its atom layers are the canvas. Drag a row between categories to re-group
        it, add your own categories, rename, duplicate, hide or delete.
      </Lead>
      <Steps>
        <li>
          <strong>Save</strong> keeps a staff-only draft — exactly like a page draft.
          Members keep seeing the published version.
        </li>
        <li>
          <strong>Publish library</strong> ships every draft and the category layout
          to the whole fleet at once. Pages that already placed a component are
          never touched.
        </li>
        <li>
          Classic entries (no atom layers yet) are listed greyed out — they can be
          moved and hidden but not opened until converted.
        </li>
      </Steps>
      <Door href={href} target="_blank" rel="noopener">
        Open the living library ↗
      </Door>
      <Foot>
        Opens on tinyglobalvillage.com in a new tab, signed in as you. Staff
        superadmins only.
      </Foot>
    </Wrap>
  );
}

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 44rem;
`;

const Lead = styled.p`
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.55;
  color: var(--t-text);
`;

const Steps = styled.ul`
  margin: 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  font-size: 0.86rem;
  line-height: 1.5;
  color: var(--t-textMuted);

  strong { color: ${colors.violet}; }
`;

const Door = styled.a`
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1.1rem;
  border-radius: 0.6rem;
  font-size: 0.86rem;
  font-weight: 800;
  text-decoration: none;
  color: ${colors.violet};
  background: rgba(${rgb.violet}, 0.14);
  border: 1px solid rgba(${rgb.violet}, 0.45);
  transition: background 0.15s, box-shadow 0.15s, transform 0.1s;

  &:hover {
    background: rgba(${rgb.violet}, 0.28);
    box-shadow: 0 0 12px rgba(${rgb.violet}, 0.5);
  }
  &:active { transform: translateY(1px); }
`;

const Foot = styled.div`
  font-size: 0.74rem;
  color: var(--t-textMuted);
`;
