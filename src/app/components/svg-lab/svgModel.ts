/**
 * SVG Lab model — serialize a rendered icon, extract editable layers, apply
 * edits back onto the markup, and sanitize round-tripped SVG.
 *
 * parse/apply use DOMParser and are CLIENT-ONLY (the lab modal is ssr:false).
 * sanitizeSvgMarkup is pure string work so the variants API can share it.
 */

export type ViewBox = { x: number; y: number; w: number; h: number };

export type LayerInfo = {
  idx: number;
  tag: string;
  label: string;
  authoredFill: string | null;
  authoredStroke: string | null;
  authoredStrokeWidth: string | null;
  authoredTransform: string | null;
};

export type LayerEdit = {
  /** null = keep authored value; "currentColor"/"none"/#hex all valid. */
  fill: string | null;
  stroke: string | null;
  strokeWidth: number | null;
  opacity: number | null;
  dx: number;
  dy: number;
  hidden: boolean;
};

export const EMPTY_LAYER_EDIT: LayerEdit = {
  fill: null,
  stroke: null,
  strokeWidth: null,
  opacity: null,
  dx: 0,
  dy: 0,
  hidden: false,
};

const PAINTABLE = "path,circle,rect,line,polyline,polygon,ellipse";

export type ParsedSvg = {
  layers: LayerInfo[];
  viewBox: ViewBox | null;
  width: number | null;
  height: number | null;
};

function parseDoc(markup: string): { doc: Document; root: SVGSVGElement } | null {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== "svg") return null;
  return { doc, root: root as unknown as SVGSVGElement };
}

export function parseSvg(markup: string): ParsedSvg | null {
  const parsed = parseDoc(markup);
  if (!parsed) return null;
  const { root } = parsed;
  const vbRaw = root.getAttribute("viewBox");
  let viewBox: ViewBox | null = null;
  if (vbRaw) {
    const p = vbRaw.trim().split(/[\s,]+/).map(Number);
    if (p.length === 4 && p.every((v) => Number.isFinite(v))) viewBox = { x: p[0], y: p[1], w: p[2], h: p[3] };
  }
  const width = parseFloat(root.getAttribute("width") ?? "");
  const height = parseFloat(root.getAttribute("height") ?? "");
  const nodes = Array.from(root.querySelectorAll(PAINTABLE));
  const tagCount = new Map<string, number>();
  const layers: LayerInfo[] = nodes.map((el, idx) => {
    const tag = el.tagName.toLowerCase();
    const nth = (tagCount.get(tag) ?? 0) + 1;
    tagCount.set(tag, nth);
    return {
      idx,
      tag,
      label: `${tag} ${nth}`,
      authoredFill: el.getAttribute("fill"),
      authoredStroke: el.getAttribute("stroke"),
      authoredStrokeWidth: el.getAttribute("stroke-width"),
      authoredTransform: el.getAttribute("transform"),
    };
  });
  return {
    layers,
    viewBox,
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null,
  };
}

export function applyEdits(
  markup: string,
  opts: {
    viewBox: ViewBox | null;
    width: number;
    height: number;
    edits: LayerEdit[];
    layers: LayerInfo[];
    /** Replace every currentColor with a concrete color (export baking). */
    bakeColor?: string;
  },
): string {
  const parsed = parseDoc(markup);
  if (!parsed) return markup;
  const { root } = parsed;
  if (opts.viewBox) root.setAttribute("viewBox", `${opts.viewBox.x} ${opts.viewBox.y} ${opts.viewBox.w} ${opts.viewBox.h}`);
  root.setAttribute("width", String(opts.width));
  root.setAttribute("height", String(opts.height));
  const nodes = Array.from(root.querySelectorAll(PAINTABLE));
  nodes.forEach((el, idx) => {
    const edit = opts.edits[idx];
    const info = opts.layers[idx];
    if (!edit || !info) return;
    if (edit.hidden) el.setAttribute("display", "none");
    else el.removeAttribute("display");
    if (edit.fill !== null) el.setAttribute("fill", edit.fill);
    if (edit.stroke !== null) el.setAttribute("stroke", edit.stroke);
    if (edit.strokeWidth !== null) el.setAttribute("stroke-width", String(edit.strokeWidth));
    if (edit.opacity !== null) el.setAttribute("opacity", String(edit.opacity));
    const move = edit.dx !== 0 || edit.dy !== 0 ? `translate(${edit.dx} ${edit.dy})` : "";
    const authored = info.authoredTransform ?? "";
    const t = `${move}${move && authored ? " " : ""}${authored}`;
    if (t) el.setAttribute("transform", t);
    else el.removeAttribute("transform");
  });
  let out = new XMLSerializer().serializeToString(root);
  if (opts.bakeColor) out = out.replaceAll("currentColor", opts.bakeColor);
  return out;
}

/**
 * Strip active content from round-tripped SVG. Pure string ops so it runs in
 * API routes too. Belt-and-braces: markup here originates from our own icon
 * components, but saved variants re-render via dangerouslySetInnerHTML.
 */
export function sanitizeSvgMarkup(markup: string): string {
  return markup
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script[^>]*\/>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/<(iframe|object|embed)[\s\S]*?(<\/\1\s*>|\/>)/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/(xlink:href|href)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, "");
}

export function fmtViewBox(vb: ViewBox): string {
  const r = (v: number) => Math.round(v * 100) / 100;
  return `${r(vb.x)} ${r(vb.y)} ${r(vb.w)} ${r(vb.h)}`;
}
