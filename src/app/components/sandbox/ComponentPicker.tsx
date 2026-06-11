"use client";

// ComponentPicker — searchable component selector for sandbox edit mode.
//
// A gold SBDM (searchable dropdown) over the whole sandbox REGISTRY, grouped by category. Lives in
// the edit toolbar so an admin can switch which component they're editing WITHOUT the left file
// sidebar — collapse the sidebar and you still have this. Selecting an entry sets the modal's
// activeKey (same mechanism as clicking a sidebar row).

import SBDM, { type SBDMItem } from "@tgv/module-component-library/components/ui/SBDM";
import { REGISTRY, CATEGORIES } from "./registry";

// Category display order = the sidebar's CATEGORIES order (zone-clustered). CATEGORIES is string[].
const CAT_ORDER = new Map<string, number>(CATEGORIES.map((c, i) => [String(c), i]));

const ITEMS: SBDMItem[] = REGISTRY.map((e) => ({ key: e.key, label: e.name, group: e.category }))
  .slice()
  .sort((a, b) => {
    const ca = CAT_ORDER.get(a.group ?? "") ?? 999;
    const cb = CAT_ORDER.get(b.group ?? "") ?? 999;
    if (ca !== cb) return ca - cb;
    if ((a.group ?? "") !== (b.group ?? "")) return (a.group ?? "").localeCompare(b.group ?? "");
    return a.label.localeCompare(b.label);
  });

export default function ComponentPicker({
  activeKey,
  onSelect,
  accent = "gold",
  minTriggerWidth = 190,
}: {
  activeKey: string;
  onSelect: (key: string) => void;
  /** gold = edit-toolbar styling; pink = the Files side-menu styling. */
  accent?: "gold" | "pink";
  minTriggerWidth?: number;
}) {
  const a =
    accent === "pink"
      ? { color: "#ff4ecb", rgb: "255, 78, 203" }
      : { color: "#ffcf4a", rgb: "255, 207, 74" };
  return (
    <span style={{ ["--ddm-accent" as string]: a.color, ["--ddm-accent-rgb" as string]: a.rgb, display: "inline-flex", minWidth: 0, maxWidth: "100%" }}>
      <SBDM
        items={ITEMS}
        value={activeKey}
        onSelect={onSelect}
        placeholder="Pick a component…"
        searchPlaceholder="Search components…"
        ariaLabel="Select a component"
        minTriggerWidth={minTriggerWidth}
      />
    </span>
  );
}
