import { SVGProps } from "react";

export default function AvatarIcon({
  size = 32,
  ...rest
}: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...rest}
    >
      <circle
        cx="16"
        cy="11"
        r="5.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M5.5 27c1.5-5.4 5.8-8.5 10.5-8.5s9 3.1 10.5 8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="16" cy="11" r="5.2" fill="currentColor" fillOpacity="0.08" />
      <path
        d="M5.5 27c1.5-5.4 5.8-8.5 10.5-8.5s9 3.1 10.5 8.5z"
        fill="currentColor"
        fillOpacity="0.08"
      />
    </svg>
  );
}
