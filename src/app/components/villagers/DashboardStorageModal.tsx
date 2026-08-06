"use client";
// Villagers → Platform & Analytics → "Dashboard Storage". The CDN file manager and the fleet's storage
// rules, in the one place they belong: the Config button inside opens the gear that sets the caps,
// prices, lifecycle timings and the reaper switch governing the very files listed underneath.
//
// It mounts StorageSurface DIRECTLY rather than iframing /dashboard/storage. The iframe route
// (DashboardPageModal) exists for full pages, and pointing a tile at it here produced Office's own
// navbar rendered a second time inside the modal. A component mount has no chrome of its own, so the
// modal frame is the only frame.

import { useEffect } from "react";
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

// The inset is the BACKDROP's padding and it is the ONLY thing setting the margin — the card fills
// whatever that leaves, in both axes, so all four gaps are the same number of pixels on any screen.
//
// That means no width cap. A cap is what made them unequal: 1180px against a 1232px box left 26px of
// slack per side on top of the padding, so the sides read 50 and the top and bottom 24. A file grid is
// happy to be wide — it just gets more columns — so the cap was buying nothing and costing symmetry.
const INSET = "1.5rem";

const EvenBackdrop = styled(ModalBackdrop)`
  padding: ${INSET};
`;

const WideContainer = styled(ModalContainer)`
  width: 100%;
  max-width: 100%;
  max-height: 100%;
`;

const Sub = styled.span`
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(${rgb.pink}, 0.75);
`;

export default function DashboardStorageModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });

  // The page behind keeps its own scrollbar otherwise, so the operator sees two — and a wheel over the
  // backdrop scrolls the Villagers grid underneath instead of the file list they are looking at.
  useEffect(() => {
    // BOTH elements: the scrollbar this was showing belongs to the root, not the body, so locking only
    // one of them left it in place.
    const targets = [document.documentElement, document.body];
    const previous = targets.map((el) => el.style.overflow);
    targets.forEach((el) => { el.style.overflow = "hidden"; });
    return () => {
      targets.forEach((el, i) => { el.style.overflow = previous[i]; });
    };
  }, []);

  return (
    <EvenBackdrop onClick={onClose}>
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
    </EvenBackdrop>
  );
}
