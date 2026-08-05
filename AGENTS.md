# MAT Pilates Repository Guide

This file contains repository-specific guidance. Follow global Codex guidance for general working practices.

## Product and source of truth

- Treat `README.md` as the source of truth for product context and current project stage.
- Keep the user-facing experience and approved product copy in Spanish.
- Store structured landing page content, including commercial information and schedules, in `src/lib/site-content.ts`.
- Do not invent or alter commercial data, schedules, contact details, or other business information without approved input.

## Source layout and implementation

- Keep application routes, layouts, and route-specific UI in `src/app/`.
- Place reusable UI components in `src/components/`.
- Place shared utilities and application logic in `src/lib/`.
- Store publicly served static assets in `public/`.
- Record durable project decisions and supporting material in `docs/`.
- Keep route-specific code close to its route; extract code to `components` or `lib` only when it is reused or has a clear shared responsibility.
- Keep `lib` independent from presentation concerns where practical.
- Prefer small, explicit modules and preserve the responsibilities of these directories.

## Design system

- Use [MAT — Foundations](https://www.figma.com/design/IcAaBXTryXYQLsFBIp5YgY/MAT-Pilates?node-id=66-10) and `docs/design-system.md` as the design references for visual tokens and typography.
- Treat values marked `TBD` as unresolved. Do not infer, substitute, or implement them until they are confirmed.
- Do not treat the target design-system documentation as evidence that its tokens are already implemented in source code.

### Figma typography routing

- Use the local `mat_figma_bridge` documented in `docs/figma-local-bridge.md` whenever Figma work creates, edits, measures, or binds text or text styles that depend on the locally installed Neue Montreal family.
- Before proposing a typography write, check bridge status and exact font availability, audit the exact scope, and use current node IDs and fresh fingerprints. A proposal never authorizes a write; the user must review it and press `Aplicar` in Figma Desktop.
- Use the official Figma connector for layout, components, colors, variables, prototyping, and other non-typographic work. Split mixed tasks into non-typographic structure first, local typography second, and a final local preview and re-audit.
- If the bridge is disconnected or an exact Neue Montreal Regular, Medium, or Bold pair is unavailable, stop. Never substitute Montserrat, Inter, an approximate weight, or another font.
- Do not write to the original MAT Foundations file without explicit authorization. After an approved typography write, inspect the returned preview and re-audit the exact affected scope.

## Workflow and branches

- Every versioned change, including code, documentation, and configuration, must be linked to an open GitHub Issue.
- Use your own authenticated GitHub account and confirm that it has the repository and Project permissions required for the requested external actions.
- Classify each Issue and Pull Request as repository-only, Preview-only, Production-eligible, or pending a delivery decision.
- Move the related GitHub Project item to `Doing` when implementation starts. Move it to `Ready` when implementation is integrated and validated but publication or acceptance remains pending.
- Before branching, inspect the worktree, fetch and prune the remote, and fast-forward the local `dev` branch. Create feature branches from that updated `dev` branch using `feature/<short-description>`.
- Do not commit or push directly to `dev` or `main`.
- Open Pull Requests from `feature/*` into `dev`, reference the related Issue, and run the relevant validation before requesting review.
- Verify required checks against the Pull Request's current head commit before merging. Do not bypass protection after a deterministic failure; diagnose it and deliver the correction through an Issue-linked feature branch before continuing the promotion.
- After merging into `dev`, delete the merged feature branch locally and remotely only after confirming that its commit is reachable from `dev`.
- Promote changes from `dev` to `main` through a separate Pull Request only when their delivery classification allows it. Include `Closes #<issue-number>` for each completed Issue so GitHub closes it when the default branch is updated.
- Mark repository-only work as `Done` after its exact `main` commit and checks are verified. Mark Production-eligible work as `Done` only after the exact `main` deployment is verified. Then fast-forward the local `dev` and `main` branches from their remotes, compare the local and remote tips, and confirm that the worktree is clean.

## Tooling and validation

- The application uses Next.js with the App Router, TypeScript, Tailwind CSS, and ESLint.
- Use the npm commands documented in `README.md` for installation, development, linting, and production builds.
- For documentation-only changes, run `git diff --check`.
- For UI or application-code changes, run `npm run lint` and `npm run build`.
- For browser or CI failures, reproduce the affected test and browser first, then run the complete CI-equivalent suite documented in `README.md` before publishing the correction.
- If a change combines documentation with UI or application code, run all applicable checks.
- Do not assume environment variables or generated configuration exist before they are introduced.
- When adding application tooling, document its supported commands and required local configuration in `README.md`.
