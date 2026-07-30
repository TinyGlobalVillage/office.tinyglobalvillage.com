// Media Reducer — format registry + QMBM copy.
// One entry per output format, per media kind. The `desc` lines are the QMBM
// cards next to the file-type DDM: ≤25 words each, plus a one-line use case
// (Gio's spec, 2026-07-30). Keep them tight — they're read in a popover.

export type MediaKind = "image" | "video";

export type ImgFormat = "webp" | "jpeg" | "png" | "avif" | "gif";
export type VidFormat = "h264" | "h265" | "vp9" | "gif";

export type FormatInfo = {
  key: string;
  /** DDM label */
  label: string;
  /** output file extension (with dot) */
  ext: string;
  /** mime of the produced file ("" = decided by server response) */
  mime: string;
  /** QMBM: ≤25-word explanation */
  desc: string;
  /** QMBM: one-line use case */
  useCase: string;
};

export const IMAGE_FORMATS: Record<ImgFormat, FormatInfo> = {
  webp: {
    key: "webp", label: "WebP", ext: ".webp", mime: "image/webp",
    desc: "The modern web workhorse — 25–35% smaller than JPEG at the same quality, with transparency and animation support.",
    useCase: "Default for every photo or graphic headed to a website.",
  },
  jpeg: {
    key: "jpeg", label: "JPEG", ext: ".jpg", mime: "image/jpeg",
    desc: "The universal photograph format — efficient for rich, colorful scenes; no transparency; readable by everything with a screen.",
    useCase: "Email, print pipelines, maximum-compatibility sharing.",
  },
  png: {
    key: "png", label: "PNG", ext: ".png", mime: "image/png",
    desc: "Pixel-perfect and lossless with full transparency — crisp edges, but file size climbs fast with detail.",
    useCase: "Logos, screenshots, UI art, images containing text.",
  },
  avif: {
    key: "avif", label: "AVIF", ext: ".avif", mime: "image/avif",
    desc: "The newest codec — sharpest quality per byte, roughly half the size of JPEG; slower to encode, newer browser support.",
    useCase: "Hero images and banners for modern browsers.",
  },
  gif: {
    key: "gif", label: "GIF", ext: ".gif", mime: "image/gif",
    desc: "The vintage loop format — 256 colors, chunky files, plays absolutely everywhere.",
    useCase: "Short silent loops, reactions, tiny animations.",
  },
};

export const VIDEO_FORMATS: Record<VidFormat, FormatInfo> = {
  h264: {
    key: "h264", label: "H.264 (MP4)", ext: ".mp4", mime: "video/mp4",
    desc: "The universal codec — plays on everything from old phones to smart TVs; larger files than its modern rivals.",
    useCase: "Default for sharing and embedding anywhere.",
  },
  h265: {
    key: "h265", label: "H.265 (MP4)", ext: ".mp4", mime: "video/mp4",
    desc: "H.264's successor — about 40% smaller at the same quality; excellent on Apple devices, patchy on older browsers.",
    useCase: "Archives and Apple-centric delivery.",
  },
  vp9: {
    key: "vp9", label: "VP9 (WebM)", ext: ".webm", mime: "video/webm",
    desc: "Google's royalty-free codec — small files, native in Chrome and Firefox; Safari joined late.",
    useCase: "Web embeds where MP4 weight hurts.",
  },
  gif: {
    key: "gif", label: "GIF", ext: ".gif", mime: "image/gif",
    desc: "Turns video into a silent looping image — enormous per second of footage, so keep clips short.",
    useCase: "Previews, docs, chat reactions.",
  },
};

/** Ordered lists for the DDM + QMBM cards. */
export const IMAGE_FORMAT_ORDER: ImgFormat[] = ["webp", "jpeg", "png", "avif", "gif"];
export const VIDEO_FORMAT_ORDER: VidFormat[] = ["h264", "h265", "vp9", "gif"];

export function fmtBytes(n: number): string {
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1024).toFixed(0)} KB`;
}
