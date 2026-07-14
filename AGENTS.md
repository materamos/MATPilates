# Repository guidance

This file contains repository-specific guidance. Follow the global Codex guidance for general working practices.

## Source layout

- Keep application routes, layouts, and route-specific UI in `src/app/`.
- Place reusable UI components in `src/components/`.
- Place shared utilities and application logic in `src/lib/`.
- Store publicly served static assets in `public/`.
- Record project decisions and supporting material in `docs/`.

## Application conventions

- Treat `README.md` as the source of truth for product context and current project stage.
- Keep route-specific code close to its route; extract code to `components` or `lib` only when it is reused or has a clear shared responsibility.
- Keep `lib` independent from presentation concerns where practical.
- Prefer small, explicit modules and preserve the responsibilities of the directories above.

## Workflow and branches

- Every code change must be linked to an open GitHub Issue.
- Move the related Project item to `Doing` when implementation starts.
- Create feature branches from an updated `dev` branch using `feature/<short-description>`.
- Do not commit or push directly to `dev` or `main`.
- Open Pull Requests from `feature/*` into `dev`.
- Include `Closes #<issue-number>` in the Pull Request description when the change completes an Issue.
- Before opening a Pull Request, run the documented validation commands relevant to the change.
- After merging into `dev`, move the Project item to `Done` and delete the merged `feature/*` branch.
- Promote changes from `dev` to `main` through a separate Pull Request only.

## Tooling and documentation

- The application uses Next.js with the App Router, TypeScript, Tailwind CSS, and ESLint.
- Use the npm commands documented in `README.md` for installation, development, linting, and production builds.
- Do not assume environment variables or generated configuration exist before they are introduced.
- When adding application tooling, document its supported commands and any required local configuration in `README.md`.
- Add durable architectural or product-adjacent decisions to `docs/` rather than embedding them in source files.
