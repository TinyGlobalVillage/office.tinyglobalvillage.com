import { SVGProps } from "react";

/** Vertical 3-dot "more actions" glyph. Pairs with a round trigger button on
 *  a card corner (Template Gallery tiles). Filled dots, not outlined — at
 *  14–16px an outlined dot reads as mush. */
export default function MoreIcon({
  size = 16,
  ...rest
}: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <circle cx="12" cy="5" r="1.9" fill="currentColor" />
      <circle cx="12" cy="12" r="1.9" fill="currentColor" />
      <circle cx="12" cy="19" r="1.9" fill="currentColor" />
    </svg>
  );
}
