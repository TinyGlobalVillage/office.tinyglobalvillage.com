import { SVGProps } from "react";

/**
 * Desk phone silhouette — handset resting on a base with keypad dots.
 * Intentionally distinct from `PhoneIcon` (handset-only) so the drawer tab +
 * Front Desk surfaces read as "reception / switchboard" rather than "call now".
 */
export default function DrawerFrontDeskIcon({
  size = 16,
  ...rest
}: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      {/* Base / body */}
      <path d="M4 18h16l-1.5-6.5h-13L4 18Z" />
      <path d="M4 18v2h16v-2" />
      {/* Handset resting on top */}
      <path d="M6.5 11.5c0-2.8 2.5-5 5.5-5s5.5 2.2 5.5 5" />
      <path d="M5.3 11.5h2.4v1.4H5.3z" />
      <path d="M16.3 11.5h2.4v1.4h-2.4z" />
      {/* Keypad dots */}
      <circle cx="9" cy="16" r="0.55" fill="currentColor" />
      <circle cx="12" cy="16" r="0.55" fill="currentColor" />
      <circle cx="15" cy="16" r="0.55" fill="currentColor" />
    </svg>
  );
}
