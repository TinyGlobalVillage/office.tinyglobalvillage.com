import { SVGProps } from "react";

export default function PollIcon({ size = 16, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <path d="M6 20V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 20V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 20v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M3 20h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
