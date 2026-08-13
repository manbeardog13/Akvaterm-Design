# AGENTS.md — rules of engagement for AI-assisted work on this repository

This file is for any AI assistant (and its human) working on Akvaterm-Design.
It encodes the working agreements already in force. Read it fully before your
first change. The owner is Toni (@manbeardog13); he holds final authority on
scope, ADR acceptance, and anything public.

## 1. Read before you write

- `docs/README.md` — foundation documentation index and phase status.
- `docs/adr/README.md` — the ADR registry. **ADRs are binding.** If your change
  contradicts an Accepted ADR, do not work around it: propose a new ADR
  (next number, status `Proposed`) and stop until the owner decides.
- `docs/multi-agent-review.md` — the running review log. Append dated addenda;
  never rewrite existing entries.

## 2. Hard constraints (do not negotiate these in code)

- **Zero runtime dependencies** (ADR 0004, ADR 0005): native ES modules, SVG,
  Web Animations API. No frameworks, no build step, no CDN imports. Dev-only
  tooling belongs in `devDependencies` and must not be needed to run the app.
- **Motion goes through the tokens** (ADR 0003): all animation uses
  `src/motion.js` (MotionDirector) and the CSS custom properties. Reduced
  motion replaces every movement with fades — this is a safety rule, not a
  style preference.
- **Vision safety contract** (ADR 0006): detections arrive `pending` and every
  item requires an explicit user decision. The 0.45 confidence floor is part of
  the service response. User photos never leave the device in this prototype;
  any remote adapter requires a new ADR covering consent, retention, deletion.
- **Trust-first UX** (docs/customer-journey.md, docs/ux-blueprint.md): one
  decision per screen, no hidden defaults, every automatic suggestion is
  reversible, progress always shows context — never a bare spinner, and never
  a full catalogue (max 6 recommendations + 1 expert alternative).
- **Vector-first assets** (ADR 0005): no binary media committed to the repo.
- **UTF-8 only.** Check inherited files for stray cp1252 bytes before building
  on them.

## 3. Workflow rules

- `main` is the deployable branch — Vercel auto-deploys every push. Keep it
  green: `npm test` must pass locally before any push (see §5). Substantive or
  risky changes go on a branch with a pull request for the owner.
- Never force-push, rebase, or otherwise rewrite published history on `main`.
- **Re-read before you write.** More than one agent works in this checkout.
  `git pull` and re-read every file you are about to touch immediately before
  editing it — never write a file from a copy you read earlier in your session.
  Editing from a stale copy silently reverts the other agent's work, and
  `git add -A` will happily commit that revert. This has already happened once
  (see commit history around `7c4e213`).
- Preserve inherited work: if you find uncommitted changes in a working tree,
  checkpoint them as their own commit before adding yours — do not reset,
  clean, or absorb them silently.
- Prefer narrow staging (`git add <paths>`) over `git add -A`, and read
  `git diff --staged` before every commit. If the diff removes something you
  did not intend to remove, stop.
- Keep the tree tidy: no build artifacts, scratch files, or editor droppings.
  `.gitignore` already covers `node_modules/` and `tests/screenshots/`.
- Never commit secrets, tokens, or credentials. There are none in this repo;
  it stays that way.

## 4. Provenance and multi-agent etiquette

- Identify your agent in every commit (e.g. a `Co-Authored-By:` trailer naming
  the assistant). Say plainly in commit bodies what was done and why.
- Record substantive decisions as ADRs. Mark them `Proposed` unless the owner
  explicitly accepts; note in the ADR when another agent's ratification is
  pending, and never attribute views to an agent that was not present.
- Repository access is not publication authority. Deploy configuration,
  new external services, credential or permission changes, and anything
  user-facing outside this repo require the owner's explicit direction —
  a task description alone does not grant them.
- State only what you verified. If you did not run it, read it, or measure it,
  do not claim it.

## 5. Usage

Run the prototype (no build, no install):

```
python -m http.server 8000   # from the repo root
# open http://localhost:8000
```

Run the checks (dev-only tooling, ADR 0007):

```
npm install
npx playwright install chromium   # or set PLAYWRIGHT_CHROMIUM_PATH
npm test                          # 56-check E2E suite; must pass before pushing
```

Add checks in `tests/e2e.mjs` for any new interaction you introduce.

Deployment: Vercel, framework preset `Other` — the front end is served
statically from the repo root with no build step, plus one serverless endpoint,
`api/vision.js`, declared in `vercel.json`. Pushing to `main` redeploys.
Deployment setup is documented in `README.md` under "Public deployment".

Environment variables: `GEMINI_API_KEY` and optional `GEMINI_MODEL`, set in the
Vercel project only — never committed, and `.env.example` carries placeholders
only. Without a key the endpoint degrades to the built-in detection set rather
than failing, so a keyless deploy is a valid state. Do not add a build step, a
framework preset, or further environment variables without an ADR.

## 6. Repository map

```
index.html            journey shell (single page)
src/app.js            flow state machine, packet builder, exports
src/controls.js       per-step interaction controls
src/data.js           journey definitions, curated option data
src/motion.js         MotionDirector — the only motion authority
src/isometric.js      2.5D reconstruction renderer
src/services/vision.js VisionService adapter boundary (mock adapter default)
docs/                 foundation docs; docs/adr/ = binding decisions
tests/e2e.mjs         Playwright suite + self-contained static server
```
