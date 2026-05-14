// Serialize a shared_templates row back to a TypeScript source file that
// matches the shape consumed by @tgv/module-component-library/page-templates.
//
// Round-trip:
//   DB row (label, description, category, slugs)
//   + model_json (chrome + sections[].config.props)
//   →
//   export const default<Cap>Template: DefaultPageTemplate = { ... }
//
// model_json stores PageModel (sections have id/enabled/blocks/config.props);
// the file format stores DefaultPageTemplate (sections have type/props
// only). We strip per-instance fields (UUIDs, etc.) so the serialized
// output is stable across re-deploys of the same logical template.

export type SerializeArgs = {
  templateId: string;
  label: string;
  description: string;
  category: string;
  thumbnail?: string | null;
  suggestedSlug: string;
  suggestedTitle: string;
  /** PageModel snapshot from shared_templates.model_json */
  model: unknown;
};

type PageModelSection = {
  type?: string;
  config?: { props?: Record<string, unknown> };
  // id/enabled/blocks intentionally ignored
};

type PageModelChrome = {
  navEnabled?: boolean;
  footerEnabled?: boolean;
  footerHeight?: number;
};

type PageModelShape = {
  chrome?: PageModelChrome;
  sections?: PageModelSection[];
};

function exportNameFromId(templateId: string): string {
  // "default-about" → "defaultAboutTemplate"
  // "services-grid-3col" → "servicesGrid3colTemplate"
  const stripped = templateId.replace(/^default-/, "default-");
  const camel = stripped
    .split("-")
    .map((part, i) =>
      i === 0
        ? part
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join("");
  return `${camel}Template`;
}

function filenameFromId(templateId: string): string {
  // "default-about" → "about.ts", "services-grid-3col" → "services-grid-3col.ts"
  const stripped = templateId.startsWith("default-")
    ? templateId.slice("default-".length)
    : templateId;
  // Restrict to a-z0-9- to avoid path traversal / weird chars.
  const safe = stripped.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  return `${safe}.ts`;
}

function quote(s: string): string {
  // Single-quoted to match the existing file style. Escape backslashes
  // and single quotes; preserve unicode (the source files use plain UTF-8).
  return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

const IDENT_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

function formatKey(k: string): string {
  return IDENT_RE.test(k) ? k : quote(k);
}

// Recursive TS literal serializer. Output style matches the hand-written
// template files in @tgv/module-component-library/page-templates/*.ts:
//   - single-quoted strings
//   - bare-identifier keys when valid (quoted otherwise)
//   - 2-space indent per nesting level
//   - trailing comma after every value
function formatValue(v: unknown, indent: number): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  if (typeof v === "string") return quote(v);

  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    const inner = " ".repeat(indent + 2);
    const outer = " ".repeat(indent);
    const items = v.map((item) => `${inner}${formatValue(item, indent + 2)},`);
    return `[\n${items.join("\n")}\n${outer}]`;
  }

  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    const inner = " ".repeat(indent + 2);
    const outer = " ".repeat(indent);
    const lines = entries.map(
      ([k, val]) => `${inner}${formatKey(k)}: ${formatValue(val, indent + 2)},`,
    );
    return `{\n${lines.join("\n")}\n${outer}}`;
  }

  // Fallback: stringify whatever it is and hope.
  return JSON.stringify(v);
}

function serializeChrome(chrome: PageModelChrome | undefined): string {
  if (!chrome) return "  chrome: {\n    navEnabled: true,\n    footerEnabled: true,\n  },\n";
  const lines: string[] = ["  chrome: {"];
  if (chrome.navEnabled !== undefined) {
    lines.push(`    navEnabled: ${chrome.navEnabled},`);
  }
  if (chrome.footerEnabled !== undefined) {
    lines.push(`    footerEnabled: ${chrome.footerEnabled},`);
  }
  if (chrome.footerHeight !== undefined) {
    lines.push(`    footerHeight: ${chrome.footerHeight},`);
  }
  lines.push("  },");
  return lines.join("\n") + "\n";
}

function serializeSections(sections: PageModelSection[] | undefined): string {
  if (!sections || sections.length === 0) return "  sections: [],\n";
  const parts: string[] = ["  sections: ["];
  for (const s of sections) {
    if (!s.type) continue;
    const props = s.config?.props ?? {};
    parts.push("    {");
    parts.push(`      type: ${quote(s.type)},`);
    // formatValue starts at column 6 inside the props object body.
    parts.push(`      props: ${formatValue(props, 6)},`);
    parts.push("    },");
  }
  parts.push("  ],");
  return parts.join("\n") + "\n";
}

export function serializeTemplate(args: SerializeArgs): {
  filename: string;
  source: string;
  exportName: string;
} {
  const filename = filenameFromId(args.templateId);
  const exportName = exportNameFromId(args.templateId);
  const model = (args.model ?? {}) as PageModelShape;

  const header = `// Auto-generated by Office sandbox Deploy. Edit in Office → Sandbox →
// Page Templates → Edit (JSON), then Deploy to overwrite this file.
//
// Round-trip source: shared_templates row template_id=${quote(args.templateId)}.
// Manual edits here are preserved until the next Deploy overwrites them.

import type { DefaultPageTemplate } from './types';

export const ${exportName}: DefaultPageTemplate = {
  id: ${quote(args.templateId)},
  label: ${quote(args.label)},
  description:
    ${quote(args.description)},
  category: ${quote(args.category)},
  suggestedSlug: ${quote(args.suggestedSlug)},
  suggestedTitle: ${quote(args.suggestedTitle)},
`;

  const thumb =
    args.thumbnail && args.thumbnail.trim()
      ? `  thumbnail: ${quote(args.thumbnail)},\n`
      : "";

  const body =
    header +
    thumb +
    serializeSections(model.sections) +
    serializeChrome(model.chrome) +
    "};\n";

  return { filename, source: body, exportName };
}
