import { SVGProps } from "react";

export default function PhoneIcon({ size = 16, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <path
        d="M6.5 3h2.6l1.6 4-2.1 1.3a13 13 0 0 0 6.1 6.1l1.3-2.1 4 1.6v2.6a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
