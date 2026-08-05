"use client";
// Villagers → Platform & Analytics → "Dashboard Storage". The CDN file manager and the fleet's storage
// rules, in the one place they belong: the Config button inside opens the gear that sets the caps,
// prices, lifecycle timings and the reaper switch governing the very files listed underneath.
//
// It mounts StorageSurface DIRECTLY rather than iframing /dashboard/storage. The iframe route
// (DashboardPageModal) exists for full pages, and pointing a tile at it here produced Office's own
// navbar rendered a second time inside the modal. A component mount has no chrome of its own, so the
// modal frame is the only frame.

import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { StorageSurface } from "@/app/components/storage/StorageSurface";
import { colors, rgb } from "@/app/theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalBody,
} from "@/app/styled";
import NeonX from "../NeonX";

// Wider than the default modal: this one holds a file grid, and squeezing it to a settings-card width
// would put two cards per row on a 15" screen.
const WideContainer = styled(ModalContainer)`
  max-width: min(96vw, 1180px);
  width: min(96vw, 1180px);
`;

const Sub = styled.span`
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(${rgb.pink}, 0.75);
`;

export default function DashboardStorageModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });

  return (
    <ModalBackdrop onClick={onClose}>
      <WideContainer onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <ModalTitle style={{ color: colors.pink }}>Dashboard Storage</ModalTitle>
            <Sub>files &amp; fleet config</Sub>
          </ModalHeaderLeft>
          <NeonX accent="pink" onClick={onClose} title="Close (Esc)" />
        </ModalHeader>
        {/* Half the usual top padding: the surface's own first row is a control band, not prose, and
            the default 1.5rem left it floating a long way under the header. */}
        <ModalBody $padding="0.75rem 1rem 1.25rem">
          <StorageSurface embedded />
        </ModalBody>
      </WideContainer>
    </ModalBackdrop>
  );
}
