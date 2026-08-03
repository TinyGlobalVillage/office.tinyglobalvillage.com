/**
 * Component document model — a COMPONENT is a group of atoms (composition law,
 * Gio 2026-08-02: atoms are solitary, components are groups). A component is
 * DATA, never generated code: which atoms, where they sit, and how each one is
 * styled.
 *
 * Each node carries its OWN full AtomSpec, so two Buttons in one component can
 * look nothing alike and editing an atom's library defaults never silently
 * rewrites a component that already used it. Positions are percentages of the
 * component canvas, so the whole thing scales as one piece.
 *
 * Pure TS — shared by the composer and the API route. clampComponentDoc() is
 * the single sanitizer for anything off disk or the wire.
 */
import { type AtomSpec, clampSpec, DEFAULT_SPEC } from "./atomSpec";

export type ComponentNode = {
  id: string;
  /** AtomDef key this node instantiates. */
  atomKey: string;
  spec: AtomSpec;
  /** Position of the node's top-left, as % of the component canvas. */
  x: number;
  y: number;
  z: number;
};

export type ComponentDoc = {
  id: string;
  name: string;
  canvas: { width: number; height: number; bg: string; grid: boolean };
  nodes: ComponentNode[];
  updatedBy?: string;
  updatedAt?: string;
};

export const DOC_LIMITS = {
  canvas: { width: [160, 1600], height: [120, 1200] },
  pos: [-20, 120],
  z: [0, 999],
  name: 60,
  atomKey: 40,
  nodes: 40,
} as const;

export const DEFAULT_CANVAS: ComponentDoc["canvas"] = {
  width: 640,
  height: 420,
  bg: "#0b0d13",
  grid: true,
};

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const ID_RE = /^[a-z0-9-]{1,60}$/;

function num(v: unknown, min: number, max: number, fb: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fb;
  return Math.min(max, Math.max(min, n));
}

export function isValidDocId(id: string): boolean {
  return ID_RE.test(id);
}

export function slugify(name: string, fallback = "component"): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || fallback
  );
}

/** Sanitize an untrusted component doc (disk / wire). */
export function clampComponentDoc(raw: unknown, id: string): ComponentDoc {
  const r = (raw ?? {}) as Record<string, unknown>;
  const canvas = (r.canvas ?? {}) as Record<string, unknown>;
  const rawNodes = Array.isArray(r.nodes) ? r.nodes : [];
  const L = DOC_LIMITS;

  const nodes: ComponentNode[] = rawNodes.slice(0, L.nodes).map((n, i) => {
    const node = (n ?? {}) as Record<string, unknown>;
    const atomKey = typeof node.atomKey === "string" ? node.atomKey.slice(0, L.atomKey) : "";
    return {
      id: typeof node.id === "string" && ID_RE.test(node.id) ? node.id : `n${i}`,
      atomKey,
      spec: clampSpec(node.spec, DEFAULT_SPEC),
      x: num(node.x, L.pos[0], L.pos[1], 10),
      y: num(node.y, L.pos[0], L.pos[1], 10),
      z: Math.round(num(node.z, L.z[0], L.z[1], i)),
    };
  });

  return {
    id,
    name: typeof r.name === "string" ? r.name.slice(0, L.name) : id,
    canvas: {
      width: num(canvas.width, L.canvas.width[0], L.canvas.width[1], DEFAULT_CANVAS.width),
      height: num(canvas.height, L.canvas.height[0], L.canvas.height[1], DEFAULT_CANVAS.height),
      bg: typeof canvas.bg === "string" && HEX_RE.test(canvas.bg) ? canvas.bg : DEFAULT_CANVAS.bg,
      grid: typeof canvas.grid === "boolean" ? canvas.grid : DEFAULT_CANVAS.grid,
    },
    nodes,
    updatedBy: typeof r.updatedBy === "string" ? r.updatedBy.slice(0, 80) : undefined,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt.slice(0, 40) : undefined,
  };
}

export function emptyDoc(id: string, name: string): ComponentDoc {
  return { id, name, canvas: { ...DEFAULT_CANVAS }, nodes: [] };
}
