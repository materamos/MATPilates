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

## Tooling and documentation

- The Next.js and TypeScript setup is intentionally pending. Do not assume package scripts, test runners, environment variables, or generated configuration exist before they are introduced.
- When adding application tooling, document its supported commands and any required local configuration in `README.md`.
- Add durable architectural or product-adjacent decisions to `docs/` rather than embedding them in source files.
