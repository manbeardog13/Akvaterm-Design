# ADR 0002: Frontend foundation stack

- **Status:** Proposed
- **Date:** 2026-08-12
- **Decision:** Start with a single-page web application using modular component architecture and route-state driven journey stages, before adding backend heavy processing.

## Context

The initial repository has no existing architecture; a simple, componentized frontend shell reduces initial coupling while preserving future service boundaries.

## Consequences

- Faster iteration on interaction quality
- Clear future API boundaries for vision and recommendation services
- Lower integration risk during phase two/three
