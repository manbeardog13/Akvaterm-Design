# ADR 0003: Motion and interaction-state baseline

- **Status:** Proposed
- **Date:** 2026-08-12
- **Decision:** Implement the council-reviewed motion grammar as a single
  `MotionDirector` module driven by shared tokens (CSS custom properties +
  exported `MOTION` constants), and gate journey progression on a per-step
  interaction state machine (`idle → engaged → satisfied`).

## Context

docs/motion-language.md, docs/camera-choreography.md and
docs/material-transition-language.md define the motion grammar, but milestone 2
shipped only static placeholders. Implementation needs one owner for timing,
easing and reduced-motion policy so individual controls cannot drift apart.

## Details

- Transition tokens map 1:1 to named animations: `surface_reveal`,
  `focus_shift`, `panel_bloom`, `material_flow` (Web Animations API).
- Speed tiers are enforced centrally: primary 280–450 ms, spatial 900–1600 ms,
  scenes 1.8–2.8 s; material settle uses `cubic-bezier(0.19, 1, 0.22, 1)`.
- `prefers-reduced-motion` replaces every dynamic movement with fades only,
  in both CSS and the JS director (camera-choreography safety constraint).
- Ambient idle drift stays ≤ 0.15%/s, pauses during confirmations
  (`data-idle-hold`), and theme changes precede structural changes.
- Each step's Continue action stays disabled until its control reports
  `satisfied`; every automatic suggestion requires an explicit user decision.

## Consequences

- One place to tune the premium feel; controls stay declarative.
- Accessibility (reduced motion, keyboard, aria states) is a default, not an
  afterthought.
- Future 3D/scene work can adopt the same tokens without API changes.
