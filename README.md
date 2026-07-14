# MAT Pilates

## Overview

MAT Pilates is the future digital presence for a Pilates studio. The project starts with an informative landing page that helps establish the studio's online identity before its opening and gives prospective clients a direct way to get in touch.

## Current scope

The current first stage is limited to a public landing page that:

- presents the studio and its offering;
- communicates the opening and relevant updates; and
- directs enquiries to WhatsApp.

Online booking, payments, member management, and other operational features are outside the scope of this stage.

## Project stages

Stage 1 is the landing page described above. A later stage may expand the product once the studio is operating, but its functionality and schedule have not been defined yet.

## Technology status

The application uses Next.js with the App Router, TypeScript, Tailwind CSS, and ESLint. The first stage remains a public landing page; authentication, payments, booking, and administration are not part of the current implementation.

## Commands

Install dependencies:

```bash
npm install
```

Run the local development server:

```bash
npm run dev
```

Run lint checks:

```bash
npm run lint
```

Create a production build:

```bash
npm run build
```

## Repository layout

| Path | Purpose |
| --- | --- |
| `src/app/` | Application routes and route-level UI. |
| `src/components/` | Reusable UI components. |
| `src/lib/` | Shared application logic and utilities. |
| `public/` | Static assets served by the application. |
| `docs/` | Project decisions and supporting documentation. |

## Next steps

1. Add the landing page implementation and its WhatsApp contact flow.
2. Replace provisional content with final material from the studio.
3. Configure Vercel and production deployment.
