# Implementation Roadmap

## Milestone 1: Foundation documents and architecture (this file)

- Deliver required journey/UX/vision/engineering docs
- Define council review gates
- Build ADR set

## Milestone 2: Prototype shell

- Create journey shell and flow state manager
- Implement Existing/New entry split
- Add cinematic stage placeholders and ambient transitions

## Milestone 3: Existing bathroom flow v1

- Add dimensions + room preview
- Add door placement interaction
- Add wall capture sequence and confirmation pipeline (mock service)
- Add reconstruction progress stage

## Milestone 4: AI-assisted reconstruction

- Add pluggable vision adapter service boundary
- Add user confirmation controls for detected fixtures
- Add confidence-aware handoff exports

Status 2026-08-12: scaffolded against the mock adapter (ADR 0005–0007) — the
service boundary, confirmation controls with second-angle flow, isometric
reconstruction view and confidence-aware exports are in place. A real vision
backend remains open for the ratification review.

## Milestone 5: Recommendation layer

- Add curated recommendation cards with rationale
- Add Feroterm domain adapter (initially CSV/import fixture)

## Milestone 6: polish and readiness

- Accessibility and reduced-motion pass
- Performance baseline checks
- Security and privacy control pass
- Multi-agent review and ADR closure
