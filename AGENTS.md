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

## Workflow and branches

- Every versioned change, including code, documentation, and configuration, must be linked to an open GitHub Issue.
- Move the related GitHub Project item to `Doing` when implementation starts.
- Create feature branches from an updated `dev` branch using `feature/<short-description>`.
- Do not commit or push directly to `dev` or `main`.
- Open Pull Requests from `feature/*` into `dev`.
- Include `Closes #<issue-number>` in the Pull Request description when the change completes an Issue.
- Before opening a Pull Request, run the validation relevant to the change.
- After merging into `dev`, move the Project item to `Done` and delete the merged `feature/*` branch.
- Promote changes from `dev` to `main` through a separate Pull Request only.

## Tooling and validation

- The application uses Next.js with the App Router, TypeScript, Tailwind CSS, and ESLint.
- Use the npm commands documented in `README.md` for installation, development, linting, and production builds.
- For documentation-only changes, run `git diff --check`.
- For UI or application-code changes, run `npm run lint` and `npm run build`.
- If a change combines documentation with UI or application code, run all applicable checks.
- Do not assume environment variables or generated configuration exist before they are introduced.
- When adding application tooling, document its supported commands and required local configuration in `README.md`.
