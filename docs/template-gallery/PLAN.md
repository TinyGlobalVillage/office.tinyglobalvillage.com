# Fae Template Gallery — build plan

**Goal:** a whole template gallery set in the realm of elves, faeries and gnomes. 120 reference sites
(`reference-picks.json`) are each rebuilt as a full-site template, re-themed as a fae business.

## Decisions (Gio, 2026-11-18 — settled, don't re-ask)

1. **Storage:** write straight to `shared_templates` rows (tgv_db), status `sandbox`. Gio opens, edits and
   re-publishes them from the Template Gallery.
2. **Scope:** whole site per reference, as a `kind: 'bundle'` template (home + every page the source has).
   Applying a bundle in the page editor lands its pages **as a group under Template Pages**.
3. **Header/footer:** templates stay chrome-free. Each source's header/footer is folded into the existing
   nav + footer design system: a new design tile ONLY when truly unique; near-variants become options on
   an existing tile (link alignment left/center/right, logo position, CTA slot, stacked vs inline, etc.).
   Elegance on the first pass.
4. **Photos:** live in the shared Office/TGV storage (one store, same links, two access points). Aim for
   unique photos; any one photo may be reused on **at most 5 sites**. Sources: free-licence only
   (CC0 / public domain first — Openverse, Wikimedia Commons). Hand-drawn SVG illustrations fill gaps.
5. **Copy generator:** shared `@tgv` module generating fae names, businesses, taglines, people, products,
   reviews. Each template's copy is generated once from a fixed seed (stable). The page editor gets a
   **re-roll** button to regenerate any text block.
6. **Categories:** keep real industry names (Accounting, Bakery, Yoga…); names + contents are fully fae.
7. **Species pick:** weighted random with an industry lean (gnomes → building/accounting/gardening;
   elves → law/architecture/fashion; faeries → beauty/yoga/weddings); any species can appear anywhere.
   **One species per site.** Mixed casts ONLY when egalitarian — a co-op / collective / equal
   partnership (e.g. "the Thistledown Collective, three founders: an elf, a gnome, a faerie").
   Never a hierarchy across species (no elf owner with gnome staff).

Source content rule: rebuild layout/structure only — never copy the source's text, photos or branding.

## Phases

| # | Phase | Status |
|---|---|---|
| 0 | Plan + decisions recorded | done |
| 1 | Fae generator module + editor re-roll button | |
| 2 | Bundle apply → grouped Template Pages in the editor | |
| 3 | Nav + footer system audit; options/tiles extended per reference | (rolls with batches) |
| 4 | Photo pool pipeline (free-licence fetch → shared storage, ≤5-site reuse ledger) | |
| 5+ | Templates in batches of ~10: open preview, map pages/sections, back-fill catalog atoms, insert bundle | |

Batch progress is tracked in `progress.json` (per template: status, pages, new atoms/options, photos used).
