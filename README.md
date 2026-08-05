# MAT Pilates

Responsive public landing page for MAT Pilates in Canning. It is a static discovery and contact experience that presents the studio and routes prospective clients to direct communication channels.

## Current scope

The application presents the studio identity, Hot Mat method, class catalog, confirmed weekly schedule, studio, location, and contact paths in a single responsive landing page.

It includes:

- the Hot Mat method and a catalog of 11 classes with intensity and environment information;
- a responsive weekly schedule linked bidirectionally to the confirmed class catalog;
- a studio gallery, location details, progressive map, and external directions;
- internal navigation, Instagram integration, and direct WhatsApp calls to action;
- a reusable visual system with tokens, components, and Neue Montreal typography;
- SVG brand assets and an adaptive favicon for light and dark schemes.

The weekly schedule is confirmed from August 3, 2026. Instructors, prices, packs, promotions, reservations, and other operational or commercial data remain undefined until they are incorporated into the canonical documentary source with confirmed status.

## Content authority

The project's documentary library is the canonical source for approved business decisions. `src/lib/site-content.ts` is the typed runtime mirror of that confirmed content; it is not a source for inventing or approving commercial information.

## Stack

- Next.js 16 with the App Router
- React 19 and TypeScript
- Tailwind CSS 4
- Motion 12 for stateful interaction, presence, and gestures
- ESLint and Stylelint

## Requirements

- Node.js 20.9 or later
- npm

## Installation

```bash
npm install
npx playwright install chromium firefox webkit
```

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the development server with Turbopack. |
| `npm run lint` | Runs the JavaScript/TypeScript and CSS linters sequentially. |
| `npm run lint:js` | Runs ESLint rules. |
| `npm run lint:css` | Runs Stylelint over CSS files under `src/`. |
| `npm run build` | Creates the production build and validates TypeScript. |
| `npm run start` | Starts the compiled application; requires `npm run build` first. |
| `npm run test:e2e` | Runs the complete Chromium suite plus functional coverage in Firefox and WebKit. |
| `npm run test:e2e:functional` | Runs structural and interaction tests in Chromium without visual snapshots. |
| `npm run test:e2e:smoke` | Runs the minimum public checks tagged with `@smoke` in Chromium, Firefox, and WebKit. |
| `npm run test:e2e:cross-browser` | Runs the full functional suite in Chromium, Firefox, and WebKit. |
| `npm run test:e2e:report` | Opens the latest local Playwright HTML report. |
| `npm run test:visual` | Compares the landing against the approved visual baselines. |
| `npm run test:visual:update` | Replaces visual baselines after an intentional, reviewed visual change. |
| `npm run figma:bridge:build` | Builds the local Codex–Figma typography bridge. |
| `npm run figma:bridge:check` | Type-checks, tests, and builds the local bridge. |
| `npm run figma:bridge:start` | Starts the built bridge over MCP STDIO. |

Before delivering any change:

```bash
npm run lint
npm run build
npm run test:e2e:functional
```

For changes to UI, CSS, typography, content, or geometry, also run:

```bash
npm run test:visual
```

To mirror CI's full cross-browser functional job with a single worker, set `CI` for the command in a POSIX shell:

```bash
CI=true npm run test:e2e:cross-browser -- --reporter=line
```

In PowerShell, set and remove the variable explicitly:

```powershell
$env:CI = "true"
npm run test:e2e:cross-browser -- --reporter=line
Remove-Item Env:CI
```

## Delivery workflow

Every versioned change starts from an Issue and declares one delivery classification:

- **Repository-only:** documentation, tests, GitHub configuration, or other changes that do not alter the application runtime. They may reach `main` without publishing a new Production deployment.
- **Preview-only:** work validated through a Vercel Preview that remains on `feature/*` or `integration/*` and stays out of `dev`.
- **Production-eligible:** runtime or public-content work that stays out of `dev` until it is selected for an authorized publication.
- **Pending decision:** work whose delivery impact is not yet known; keep it on a pre-`dev` branch until it is classified.

`dev` is continuously promotable: every change merged into it must be authorized to participate in the next complete promotion to `main`. A completed change can remain on its feature branch with a validated Preview and its Project card in `Ready`; technical completion does not authorize integration or publication.

Use `integration/<short-description>` when multiple feature branches must be validated together before they are eligible for `dev`. Feature Pull Requests may target that integration branch, but integration branches never target `main`. After the complete set is authorized, merge it into `dev` through a Pull Request and delete the integration branch only after confirming that its commit is reachable from `dev`.

Vercel always builds Preview deployments. In Production, `vercel.json` skips the build only when the commit is limited to `.github/**`, `docs/**`, `tests/**`, `AGENTS.md`, or `README.md`; any other change or an inconclusive comparison builds normally.

When investigating an intermittent browser failure, reproduce the affected test before rerunning the complete suite:

```bash
npx playwright test path/to/spec.ts --project=webkit --grep "test title" --workers=1 --repeat-each=10
```

## Visual regression

Playwright starts an isolated production server on `127.0.0.1:3218`. Chromium covers the documented responsive families, exact breakpoint boundaries, mobile navigation focus and exit locking, class disclosure behavior, gallery reduced motion and swipe navigation, keyboard focus, document overflow, and representative DPR 1 and DPR 2 renders. Firefox and WebKit run functional tests only; visual snapshots remain restricted to Chromium on Windows.

Approved Windows baselines live beside the tests under `tests/e2e/*-snapshots/`. Functional and structural tests remain separate from tests tagged with `@visual`; the minimum public navigation and schedule checks use `@smoke`. The Google Maps iframe is masked because its external rendering is nondeterministic; its eligibility and container geometry are tested separately. Playwright reports, traces, failure screenshots, and videos under `playwright-report/` and `test-results/` are transient, ignored by Git and excluded from linting.

Run `npm run test:visual:update` only when a visual change is intentional and approved. Inspect each failure diff first, update the snapshots, inspect the resulting Git diff, and then rerun `npm run test:visual` without the update flag. Never run the update command automatically in CI. CI compares the existing Windows baselines on a Windows runner and uploads failure artifacts without replacing them.

GitHub Actions runs lint and build, the full Chromium functional suite, cross-browser smoke coverage, and the Windows visual suite for pull requests into `integration/**`, `dev`, or `main`. Pull requests into `main` and manual workflow runs also execute the full functional suite in Chromium, Firefox, and WebKit. The full cross-browser job is expected to be skipped on pull requests into `integration/**` or `dev`; a skipped job is not evidence that the suite passed. Always verify check results against the pull request's current head commit. Reports and failure artifacts are retained for seven days.

The Linux Chromium functional job intentionally installs Chromium with Playwright's `--only-shell` option. Smoke and full cross-browser jobs install Chromium, Firefox, and WebKit with their system dependencies, while Windows visual regression keeps the Chromium installation that produces the approved baselines. Keep these browser boundaries unchanged unless a separate, measured CI change explicitly revises them.

A `Repository-only` promotion is complete after the exact `main` commit and required checks are verified. A `Production-eligible` promotion is complete only after the deployment status for the exact `main` merge commit succeeds and the canonical URL responds with the expected public content.

After a Playwright run, `npm run lint` must continue to pass even when local reports, traces, screenshots, or videos exist. The suite starts an isolated production server on port 3218; do not reuse a development server for acceptance runs.

## SEO configuration

- The official production and canonical URL is `https://matpilatescn.com`. The `www` variant redirects permanently to the apex domain.
- `SITE_URL` must remain set to `https://matpilatescn.com` in Vercel Production. If it is unavailable in another environment, the application uses Vercel's production URL or `https://mat-pilates.vercel.app` as a technical fallback.
- `SITE_INDEXING_ENABLED` must be set to `true` in Vercel Production to allow search-engine indexing. The site remains `noindex` by default, and Preview deployments remain `noindex` even if the variable is present.
- `/robots.txt` and `/sitemap.xml` are generated from the same canonical URL and indexing policy.
- Cloudflare is the registrar and authoritative DNS provider. The apex and `www` records remain DNS-only because Vercel terminates HTTPS and serves production traffic.

## Repository structure

| Path | Responsibility |
| --- | --- |
| `src/app/` | Application routes, global layout, styles, and metadata. |
| `src/components/` | Reusable UI components. |
| `src/lib/` | Shared data and utilities, including the landing page's structured content. |
| `public/` | Static assets consumed at runtime, including brand, icon, and photography files. |
| `docs/` | Supporting technical documentation and decisions. |
| `tools/mat-figma-bridge/` | Local MCP server and Figma Desktop plugin for font-safe typography operations. |

## Additional documentation

- [Design system](docs/design-system.md)
- [Local Codex–Figma bridge](docs/figma-local-bridge.md)
- [Repository conventions](AGENTS.md)
