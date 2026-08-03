# sandbox — breadcrumb

> Status: verified · 2026-08-02

**One-liner:** the Office Sandbox modal — one surface, four views behind a header [[PillBar]]: **Templates** · **Components** (groups of atoms) · **Atoms** (solitary atoms) · **SVGs**.

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
- `TemplateDrawer.tsx` — the Templates column: ADDM groups are the template's **category and nothing else** (status lives in the template editor's switcher DDM, not here). New categories are created here as empty groups; dragging a template into one PATCHes its `category` (the DB column stays the source of truth — the local file only remembers categories nothing has been dragged into yet). **Dashboard** is its own group at the top and opens the villager dashboard in the TGV page editor in a new tab, the same launch Modules uses. The visual tile gallery stays in Modules.

## Storage
- `data/atom-lab/<key>.json` — one saved `AtomSpec` per atom · `data/atom-lab/components/` — saved composed components · `data/svg-lab/` — saved SVG variants · `data/templates/categories.json` — sandbox-created empty template categories. All index+entry layout, all gitignored (per-box runtime state; a deploy must never clobber them).
- APIs: `src/app/api/atom-lab/specs`, `src/app/api/atom-lab/components`, `src/app/api/svg-lab/variants`, `src/app/api/editor/template-categories`. Templates themselves come from `src/app/api/editor/shared-templates/*` (`shared_templates` in tgv_db).

## Related
`../svg-lab/` (SVG Lab surface + manifest) · `~/.claude/vocabulary/Atom.md`, `AtomLibrary.md`, `AtomSpec.md`, `AtomicEditor.md`, `ComponentComposer.md`, `SVGLab.md` · project `CLAUDE.md`
