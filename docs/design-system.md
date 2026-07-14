# MAT design system

The first landing implementation uses semantic CSS custom properties defined in `src/app/globals.css`.

- Color: default, brand, inverse, primary text, inverse text, and primary action roles.
- Spacing: 4, 8, 12, 16, 24, 32, 48, and 64 pixel equivalents.
- Radius: 8, 16, 24, and full.
- Typography: Montserrat, loaded through `next/font` in the root layout.

Components use semantic variables rather than primitive hex values. The landing content and provisional schedule are centralized in `src/lib/site-content.ts` to make later approved-content updates local and explicit.
