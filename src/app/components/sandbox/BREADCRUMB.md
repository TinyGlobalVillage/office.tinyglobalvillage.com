# sandbox — breadcrumb

> Status: verified · 2026-08-02

**One-liner:** the Office Sandbox modal — one surface, three views behind a header [[PillBar]]: **Components** (groups of atoms), **Atom Library** (solitary atoms), **SVG Lab** (icons).

**Composition law (Gio 2026-08-02):** an **Atom is solitary**; a **Component is a group of atoms**. Nothing is both. Canon: `~/.claude/vocabulary/Atom.md`.

**Stack:** Next.js client components + styled-components (no Tailwind). Auth via `requireAuth`; runtime state under `data/` (gitignored).
**Source-of-truth files:** `registry.tsx` (entry catalog + `tier`), `atom-lab/atomSpec.ts` (the atom model), `SandboxModal.tsx` (host + view switch).

## Key files / dirs
- `SandboxModal.tsx` — the host: header PillBar, files column (collapses to a FILES rail), code pane, view switch. Owns `labView` and the SVG-Lab→atom apply bridge.
- `registry.tsx` — every catalog entry (`SandboxEntry`). **`tier`** routes it: `"component"` shows in the Components column, `"atom"` means its design home is the Atom Library (the row stays for code/summary/styles/deploy).
- `atom-lab/atomSpec.ts` — `AtomSpec` + `clampSpec` (the only sanitizer) + `SPEC_LIMITS`. Pure TS: shared by the client and the API route.
- `atom-lab/atomRegistry.tsx` — `AtomDef`s (spec-driven renderers) + `SpecIcon` (manifest icon or saved SVG variant, fully repainted from the spec).
- `atom-lab/AtomLabView.tsx` — Atom Library surface: menu drawer | canvas stage | Atomic Editor. Undo/redo, debounced auto-save, header-DDM on collapse.
- `atom-lab/componentDoc.ts` + `atom-lab/ComponentComposer.tsx` — the "baby editor": atoms placed on a canvas, saved as a reusable component (data, no codegen).
- `catalogBridge.tsx` — mirrors page-editor catalog blocks in as extra categories.
- `CatalogBlockEditor.tsx` · `SandboxEditToolbar.tsx` · `SandboxClaudeDrawer.tsx` · `useDraftStore.ts` — edit-mode: drafts, data editing, Claude assist, deploy.
- `ComponentPicker.tsx` — the header SBDM over registry components.

## Storage
- `data/atom-lab/<key>.json` — one saved `AtomSpec` per atom · `data/atom-lab/components/` — saved composed components · `data/svg-lab/` — saved SVG variants. All index+entry layout, all gitignored (per-box runtime state; a deploy must never clobber them).
- APIs: `src/app/api/atom-lab/specs`, `src/app/api/atom-lab/components`, `src/app/api/svg-lab/variants`.

## Related
`../svg-lab/` (SVG Lab surface + manifest) · `~/.claude/vocabulary/Atom.md`, `AtomLibrary.md`, `AtomSpec.md`, `AtomicEditor.md`, `ComponentComposer.md`, `SVGLab.md` · project `CLAUDE.md`
