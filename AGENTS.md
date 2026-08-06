# MAT Pilates Repository Guide

This file contains repository-specific guidance. Follow global Codex guidance for general working practices.

## Product and source of truth

- Treat `README.md` as the source of truth for stable product context. Treat the GitHub Project and its linked Issues as the source of truth for the current delivery stage and work status.
- Keep the user-facing experience and approved product copy in Spanish.
- Store approved commercial content and the class catalog in `src/lib/site-content.ts`. Keep published weekly availability and its derived summaries in `src/lib/schedule-content.ts`; do not duplicate schedule data.
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
- Before submitting a typography write, check bridge status and exact font availability, audit the exact scope, and use current node IDs and fresh fingerprints. Do not call `mat_figma_propose_typography_patch` without explicit task-level user authorization for that exact scope: submission is the effectful action and starts automatic application, with no manual `Aplicar` confirmation in Figma Desktop.
- Use the official Figma connector for layout, components, colors, variables, prototyping, and other non-typographic work. Split mixed tasks into non-typographic structure first, local typography second, and a final local preview and re-audit.
- If the bridge is disconnected or an exact Neue Montreal Regular, Medium, or Bold pair is unavailable, stop. Never substitute Montserrat, Inter, an approximate weight, or another font.
- Do not write to the original MAT Foundations file without explicit authorization. After an approved typography write, inspect the returned preview and re-audit the exact affected scope.

## Workflow and branches

- Every versioned change, including code, documentation, and configuration, must be linked to an open GitHub Issue.
- Use your own authenticated GitHub account and confirm that it has the repository and Project permissions required for the requested external actions.
- Classify each Issue and Pull Request as exactly one of `Repository-only`, `Preview-only`, `Production-eligible`, or `Pending decision`.
- Keep `dev` continuously promotable: everything merged into it must be authorized to participate in the next complete promotion to `main`.
- Keep `Preview-only` and `Pending decision` work on `feature/*` or `integration/*`. Keep `Production-eligible` work there until it is selected for an authorized publication.
- Move the related GitHub Project item to `Doing` when implementation starts. Move it to `Ready` when implementation and its Preview are validated but integration, publication, dependencies, or acceptance remain pending; `Ready` does not require a merge into `dev`.
- Before branching, inspect the worktree, fetch and prune the remote, and fast-forward the local `dev` branch. Create feature branches from that updated `dev` branch using `feature/<short-description>`.
- Do not commit or push directly to `integration/*`, `dev`, or `main`.
- Open Pull Requests from `feature/*` into `dev` only when the complete change is authorized for the next promotion to `main`. Before requesting review, manually link the related Issue and Pull Request in GitHub's `Development` section, confirm that the Project card shows it in `Linked pull requests`, and run the relevant validation. A textual `#<issue-number>` or `Refs #<issue-number>` is only a cross-reference and is not that evidence.
- When interdependent work must be validated together before it is eligible for `dev`, create `integration/<short-description>` from the updated `dev`, merge its `feature/*` branches through Pull Requests, and keep the integration branch out of `main`.
- Verify required checks against the Pull Request's current head commit before merging. For a `dev` to `main` promotion, record the Pull Request's head and base commits, fetch the remote immediately before merging, and confirm that they still match `origin/dev` and `origin/main`; if either moved, stop and revalidate. Do not bypass protection after a deterministic failure; diagnose it and deliver the correction through an Issue-linked feature branch before continuing the promotion.
- After merging a feature branch, delete it locally and remotely only after confirming that its commit is reachable from its intended base branch. Delete an integration branch only after its complete authorized commit is reachable from `dev`.
- Before promoting `dev`, inspect the complete `main...dev` difference and confirm that every included Issue is authorized. Promote through a separate Pull Request from `dev` to `main`, using the most restrictive included delivery classification and `Closes #<issue-number>` for every completed Issue.
- Mark `Repository-only` work as `Done` after its exact `main` commit and checks are verified. Mark `Production-eligible` work as `Done` only after the exact `main` deployment is verified. Then fast-forward the local `dev` and `main` branches from their remotes, compare the local and remote tips, and confirm that the worktree is clean.

### GitHub Project card taxonomy

- A Project card tracks its Issue. Apply and change labels on the Issue, then verify that the card's `Labels` field reflects them; do not use the title or a manual card note as a label substitute.
- Every Issue that enters implementation carries exactly one roadmap-stage label: `etapa-1` or `etapa-2`. Assign it before moving its card to `Doing`.
- `Sin definir` is an intake-only form value. Keep that card in `Ideas` or `To Do`; select its stage and apply the matching roadmap label before implementation starts.
- `maintenance` is additive and only identifies technical maintenance: dependencies, CI, tooling, repository hygiene, or the GitHub delivery workflow. It does not replace the stage label or delivery classification.
- Use an additional scope label such as `bug` or `documentation` only when it describes the primary work. Labels may coexist, but no label may contradict the Issue's actual scope.
- Project `Status` (`Ideas`, `To Do`, `Doing`, `Ready`, `Done`) is the workflow field, not a label. `Delivery classification` is its dedicated Project field and must also match the canonical declaration in the Issue and Pull Request; neither value is represented by a GitHub label.
- For Pull Requests targeting a non-default branch such as `dev` or `integration/*`, manually link the related Issue and Pull Request in GitHub's `Development` section and confirm the Project's `Linked pull requests` field. `Refs #<issue>` remains an optional readable cross-reference, not evidence of a link. For Pull Requests targeting the default branch `main`, use `Closes #<issue>` for each completed Issue so GitHub records the link and closes it on merge. Do not encode PR numbers as labels.

## Tooling and validation

- The application uses Next.js with the App Router, TypeScript, Tailwind CSS, and ESLint.
- Use the npm commands documented in `README.md` for installation, development, linting, and production builds.
- For documentation-only changes, run `git diff --check`.
- For application-code changes without visual impact, run `npm run lint`, `npm run build`, and the focused functional coverage that exercises the change.
- For UI, CSS, typography, content, or geometry changes, also run `npm run test:e2e:functional` and `npm run test:visual`.
- For browser or CI failures, reproduce the affected test and browser first, then run the complete CI-equivalent suite documented in `README.md` before publishing the correction.
- If a change combines documentation with UI or application code, run all applicable checks.
- Do not assume environment variables or generated configuration exist before they are introduced.
- When adding application tooling, document its supported commands and required local configuration in `README.md`.
