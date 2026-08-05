# docs/artifacts

Self-contained HTML pages built to explain or pitch something — design proposals,
walkthroughs, comparisons. Open one in a browser; there is no build step and no
external request (the Artifact CSP forbids them, so everything is inlined).

They are kept because the thinking in them outlives the conversation that produced
them. A proposal that was declined is still the record of why.

| File | What it is | Status |
|---|---|---|
| `canvas-mode-parameters-and-choreography.html` | The two new authoring surfaces Canvas Mode would add to the Sandbox — bounded parameter knobs, and driver→target choreography with a progress scrubber. Both panels are working, not pictures. Built for the resonantweaver migration (2026-08-05); the same machinery is what demo-fliring needs. | proposal, undecided |

## Prior art the Canvas Mode proposal draws on

Named here rather than in the page, because the page is the pitch and this is the
homework.

- **Blender's driver system** — where the vocabulary comes from. You bind one
  property to another and the binding is the editable thing; the evaluation is not.
- **Rive** — the closest modern web analogue. A designer edits a state machine and
  its inputs; the runtime owns the frame loop. That is exactly our data/code line.
- **Webflow Interactions** — the wiring UI, web-native: driver (scroll, mouse,
  click) → target (an element property) → easing curve.
- **Lottie** — the serialisation guarantee. Motion is authored elsewhere, exported
  as data, and replayed by a runtime against a progress value you can scrub. Nobody
  retypes the animation, which is the same reason our first `rf-journey` row is
  generated from `chakraSections.ts` rather than re-authored.
- **After Effects** — the pick whip, and the timeline as the primary instrument.
