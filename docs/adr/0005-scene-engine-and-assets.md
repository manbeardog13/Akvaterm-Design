# ADR 0005: Scene engine and asset policy for milestone 4

- **Status:** Accepted (scoped to the milestone 4 prototype; Codex ratification
  pending after its usage window resets 2026-08-18)
- **Date:** 2026-08-12
- **Decision:** Render the reconstructed room as a dependency-free 2.5D
  isometric SVG projection (`src/isometric.js`), with a top-down plan toggle.
  Defer any true-3D engine (WebGL/Three.js or similar) until a real vision
  backend exists and defines the actual reconstruction data. Asset policy:
  vector-first — no binary media committed to the repository; user photos never
  leave the device in the prototype.

## Context

The milestone 4 gate (docs/multi-agent-review.md) required a 3D/scene engine
and asset pipeline decision. Toni directed the gate be held today rather than
waiting for Codex's return. Committing to a 3D engine before the vision
backend's output format is known would lock the hardest dependency in the
stack against imagined data.

## Rationale

- Isometric SVG delivers the cinematic "digital twin" feel with zero runtime
  dependencies, full keyboard/screen-reader accessibility, and testable
  geometry — consistent with ADR 0004.
- The renderer sits behind the same view boundary as the top-down plan, so a
  future 3D scene replaces a view module, not the journey logic.
- Vector-first assets keep the repo reviewable and the privacy promise simple.

## Consequences

- Milestone 4 review loops run with no install step.
- The 3D engine decision is explicitly re-queued for the first milestone with
  a real `VisionService` backend (see ADR 0006).
- If photorealistic material previews become a requirement earlier, this ADR
  must be revisited rather than worked around.
