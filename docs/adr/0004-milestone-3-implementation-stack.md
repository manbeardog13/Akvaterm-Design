# ADR 0004: Implementation stack for milestone 3

- **Status:** Accepted (scoped to milestone 3; re-review at the milestone 4 gate)
- **Date:** 2026-08-12
- **Decision:** Remain dependency-free through milestone 3: native ES modules,
  SVG for all spatial views (room draft, door placement, reconstruction), the
  Web Animations API for motion, and no build tooling. Framework, 3D engine and
  bundler decisions are deferred to the milestone 4 gate, behind the
  `VisionService` adapter boundary defined in docs/component-inventory.md.

## Context

docs/repository-audit.md lists "select implementation stack" as an open item.
ADR 0002 chose a componentized single-page shell. Milestone 3 needs interactive
dimension/door/capture/confirmation flows — none of which require a framework,
and adding one now would couple the repo to tooling before the AI-vision
milestone defines the real constraints (3D reconstruction, asset pipeline).

## Rationale

- `index.html` opened directly in a browser stays the entire run story
  (root README promise: no build dependencies in this milestone).
- SVG covers 2D top-down spatial interaction with full accessibility and
  trivially testable geometry; a 3D engine decision belongs with milestone 4's
  reconstruction work, not before it.
- Native ES modules already give the component boundaries ADR 0002 asked for
  (`data.js`, `motion.js`, `controls.js`, `app.js`).

## Consequences

- Zero install/build risk for milestone 3 review loops.
- A framework migration, if ever needed, happens against stable service
  boundaries with the motion tokens (ADR 0003) preserved as-is.
- The milestone 4 gate must explicitly revisit: 3D/scene engine, asset
  pipeline, and test tooling.
