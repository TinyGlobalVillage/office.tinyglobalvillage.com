/** "#rrggbb" → "r,g,b" for rgba() strings. Its own module so a component that
 *  only needs the colour maths does not import a whole modal for it. */
export function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r},${g},${b}`;
}
