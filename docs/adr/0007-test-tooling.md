# ADR 0007: Test tooling

- **Status:** Accepted
- **Date:** 2026-08-12
- **Decision:** Adopt Playwright as dev-only end-to-end tooling. The suite
  lives in `tests/e2e.mjs` with a self-contained static server, runs via
  `npm test`, and is the merge gate for journey-flow changes. The application
  runtime remains zero-dependency; `package.json` carries only
  `devDependencies`.

## Context

docs/repository-audit.md flagged the absence of guardrails; the milestone 3
pass was verified by an ad-hoc Playwright suite that caught real defects
(stale DOM handles, plan-geometry overflow, focus loss). The gate decision is
whether that harness becomes part of the repository.

## Rationale

- The suite already proved its value; keeping it out of the repo would make
  every future pass re-derive it.
- Playwright drives the real browser the prototype targets, including
  reduced-motion emulation and file-upload flows.
- Dev-only dependencies do not violate the "no build step, no runtime
  dependencies" promise: `index.html` still runs from any static server.

## Consequences

- `npm install && npx playwright install chromium && npm test` is the whole
  verification story (set `PLAYWRIGHT_CHROMIUM_PATH` to reuse a system build).
- Journey changes without a green run don't merge.
- CI wiring (e.g. GitHub Actions) is deliberately left for a later decision.
