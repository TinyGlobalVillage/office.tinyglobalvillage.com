import { SVGProps } from "react";

// Stylized "P" double-stroke mark for the PayPal faucet tile (no brand glyph / emoji).
export default function PaypalIcon({ size = 16, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <path d="M8 20l2-14h5a3.5 3.5 0 0 1 0 7h-4" />
      <path d="M11 20l1.6-11h4a3.2 3.2 0 0 1 0 6.4h-3.4" />
    </svg>
  );
}
