# Akvaterm-Design

Designer Akvaterm App

## Mission

Premium bathroom renovation journey for local renovation customers.

## Canonical scope

- Bathroom renovations only.
- Guided dual flow: Existing Bathroom and New Bathroom.
- AI-assisted reconstruction and recommendations with explicit user consent and confirmation.

## Repository status

- Stage: Milestone 3 interactive pass complete; milestone 4 scaffolded
  - vision adapter boundary
  - second-angle flow
  - isometric reconstruction view
  - confidence-aware handoff exports
  - remote vision endpoint at `/api/vision`
- Canonical remote: https://github.com/manbeardog13/Akvaterm-Design.git

## Working agreements

AI collaborators and their humans: read [COLLABORATION.md](COLLABORATION.md) before your
first change. It carries the binding ADRs, hard constraints, workflow rules,
and usage instructions for this repository.

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

No build step and no dependencies: a static server is only needed because the
app uses native ES modules, which browsers block over `file://`.

## Public deployment (Vercel)

The app is deployable as a static front end with a serverless endpoint at
`/api/vision`.

1. Push this repository to GitHub.
2. Import into Vercel with framework preset set to `Other`.
3. Configure project environment variables:
   - `GEMINI_API_KEY` (required for remote vision)
   - `GEMINI_MODEL` (optional, defaults to `gemini-1.5-flash`)
4. Deploy.

`/api/vision` uses environment variables only. Keep API keys in your deployment
environment and never commit a keys file.

Without `GEMINI_API_KEY` the endpoint still responds, falling back to the
built-in deterministic detection set — the app stays usable, it simply is not
doing real vision.

For local preview with remote-adapter emulation, set the same variables in your
local process before launching a static server.

Every push to `main` redeploys.

## Development checks

Runtime has zero dependencies; the E2E suite is dev-only (ADR 0007):

```
npm install
npx playwright install chromium
npm test
```

Set `PLAYWRIGHT_CHROMIUM_PATH` to reuse an existing Chromium build instead of
downloading one.
