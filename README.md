# MAT Pilates

Public landing page for MAT Pilates in Canning, scheduled to open on July 25, 2026.

## Current scope

The application presents the studio identity, method, classes, informational schedule, and contact section in a single responsive landing page.

It includes:

- method, classes, studio, and contact sections;
- internal navigation and Instagram integration;
- a reusable visual system with tokens, components, and Montserrat typography;
- SVG brand assets and an adaptive favicon for light and dark schemes.

## Stack

- Next.js 16 with the App Router
- React 19 and TypeScript
- Tailwind CSS 4
- ESLint

## Requirements

- Node.js 20.9 or later
- npm

## Installation

```bash
npm install
```

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the development server with Turbopack. |
| `npm run lint` | Runs ESLint rules. |
| `npm run build` | Creates the production build and validates TypeScript. |
| `npm run start` | Starts the compiled application; requires `npm run build` first. |
| `npm run figma:bridge:build` | Builds the local Codex–Figma typography bridge. |
| `npm run figma:bridge:check` | Type-checks, tests, and builds the local bridge. |
| `npm run figma:bridge:start` | Starts the built bridge over MCP STDIO. |

To validate the main changes:

```bash
npm run lint
npm run build
```

## Repository structure

| Path | Responsibility |
| --- | --- |
| `src/app/` | Application routes, global layout, styles, and metadata. |
| `src/components/` | Reusable UI components. |
| `src/lib/` | Shared data and utilities, including the landing page's structured content. |
| `public/` | Public static assets, such as brand variants. |
| `docs/` | Supporting technical documentation and decisions. |
| `tools/mat-figma-bridge/` | Local MCP server and Figma Desktop plugin for font-safe typography operations. |

## Additional documentation

- [Design system](docs/design-system.md)
- [Local Codex–Figma bridge](docs/figma-local-bridge.md)
- [Repository conventions](AGENTS.md)
