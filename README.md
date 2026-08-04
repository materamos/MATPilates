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
- ESLint and Stylelint

## Requirements

- Node.js 20.9 or later
- npm

## Installation

```bash
npm install
npx playwright install chromium
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
| `npm run test:e2e` | Builds the production application and runs the complete Playwright suite. |
| `npm run test:e2e:functional` | Runs structural and interaction tests without visual snapshots. |
| `npm run test:e2e:smoke` | Runs the minimum public navigation and schedule checks tagged with `@smoke`. |
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

## Visual regression

Playwright starts an isolated production server on `127.0.0.1:3218`. The suite covers the documented responsive families, exact breakpoint boundaries, mobile navigation focus, class disclosure behavior, gallery reduced motion, keyboard focus, document overflow, and representative DPR 1 and DPR 2 renders.

Approved Windows baselines live beside the tests under `tests/e2e/*-snapshots/`. Functional and structural tests remain separate from tests tagged with `@visual`; the minimum public navigation and schedule checks use `@smoke`. The Google Maps iframe is masked because its external rendering is nondeterministic; its eligibility and container geometry are tested separately. Playwright reports, traces, failure screenshots, and videos under `playwright-report/` and `test-results/` are transient, ignored by Git and excluded from linting.

Run `npm run test:visual:update` only when a visual change is intentional and approved. Inspect each failure diff first, update the snapshots, inspect the resulting Git diff, and then rerun `npm run test:visual` without the update flag. Never run the update command automatically in CI. A future CI integration must generate or approve baselines for its own operating system instead of silently replacing the Windows references.

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
