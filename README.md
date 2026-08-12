# Akvaterm-Design

Designer Akvaterm App

## Mission

Premium bathroom renovation journey for local renovation customers.

## Canonical scope

- Bathroom renovations only.
- Guided dual flow: Existing Bathroom and New Bathroom.
- AI-assisted reconstruction and recommendations with explicit user consent and confirmation.

## Repository status

- Stage: Milestone 3 interactive pass complete; milestone 4 scaffolded — vision
  adapter boundary, second-angle flow, isometric reconstruction view, and
  confidence-aware handoff exports (ADR 0005–0007, mock adapter).
- Canonical remote: https://github.com/manbeardog13/Akvaterm-Design.git

## Documentation

- [Foundation docs index](docs/README.md)
- [Product vision](docs/product-vision.md)
- [Customer journey](docs/customer-journey.md)
- [Information architecture](docs/information-architecture.md)
- [UX blueprint](docs/ux-blueprint.md)
- [Implementation roadmap](docs/implementation-roadmap.md)
- [ADR registry](docs/adr/README.md)

## Run the prototype

From the repo root, serve the folder with any static file server and open it:

```
python -m http.server 8000
# then visit http://localhost:8000
```

No build step and no dependencies — a static server is only needed because the
app uses native ES modules, which browsers block over `file://`.

## Development checks

Runtime has zero dependencies; the E2E suite is dev-only (ADR 0007):

```
npm install
npx playwright install chromium
npm test
```

Set `PLAYWRIGHT_CHROMIUM_PATH` to reuse an existing Chromium build instead of
downloading one.
