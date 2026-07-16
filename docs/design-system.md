# MAT Design System

This document describes the target design system defined in [MAT — Foundations](https://www.figma.com/design/IcAaBXTryXYQLsFBIp5YgY/MAT-Pilates?node-id=66-10). It records confirmed values only.

## Color

### Brand primitives

| Token | Value | Canonical CSS variable |
| --- | --- | --- |
| `brand/charcoal` | `#272727` | `--mat-color-charcoal` |
| `brand/beige` | `#E1D6C7` | `--mat-color-beige` |
| `brand/ivory` | `#F4F3EB` | `--mat-color-ivory` |
| `brand/gray` | `#494745` | `--mat-color-gray` |

### Semantic roles

| Figma token | Current target | Canonical CSS variable |
| --- | --- | --- |
| `surface/default` | `brand/ivory` | `--mat-color-surface-default` |
| `surface/brand` | `brand/beige` | `--mat-color-surface-brand` |
| `surface/inverse` | `brand/charcoal` | `--mat-color-surface-inverse` |
| `text/primary` | `brand/gray` | `--mat-color-text-primary` |
| `text/inverse` | `brand/ivory` | `--mat-color-text-inverse` |
| `text/on-surface` | `brand/gray` | `--mat-color-text-on-surface` |
| `action/primary` | `brand/charcoal` | `--mat-color-action-primary` |
| `action/on-primary` | `brand/beige` | `--mat-color-action-on-primary` |
| `border/default` | `brand/charcoal` | `--mat-color-border-default` |

## Typography

Montserrat is the temporary typeface for every role. The final typeface is TBD.

| Style | Weight | Size | Line height | Letter spacing |
| --- | --- | ---: | ---: | ---: |
| `MAT/Display` | SemiBold | 56 px | 60 px | -1.4 px |
| `MAT/Heading 1` | SemiBold | 40 px | 46 px | -0.8 px |
| `MAT/Heading 2` | Medium | 32 px | 38 px | -0.4 px |
| `MAT/Heading 3` | Medium | 24 px | 31 px | 0 px |
| `MAT/Body large` | Regular | 20 px | 30 px | 0 px |
| `MAT/Body` | Regular | 16 px | 26 px | 0 px |
| `MAT/Body small` | Regular | 14 px | 22 px | 0 px |
| `MAT/Label` | Medium | 12 px | 16 px | 0.8 px |
| `MAT/Button` | SemiBold | 14 px | 20 px | 0.2 px |

## Layout

### Spacing

| Token | Value |
| --- | ---: |
| `space/1` | 4 px |
| `space/2` | 8 px |
| `space/3` | 12 px |
| `space/4` | 16 px |
| `space/6` | 24 px |
| `space/8` | 32 px |
| `space/12` | 48 px |
| `space/16` | 64 px |

### Radius

| Token | Value |
| --- | ---: |
| `radius/none` | 0 px |
| `radius/sm` | 8 px |
| `radius/md` | 16 px |
| `radius/lg` | 24 px |
| `radius/full` | 9999 px |

## Responsive implementation

These are source-code layout rules, not design-system tokens from Figma.

| Viewport range | Behavior |
| --- | --- |
| Below 1024 px | Mobile navigation and single-column section layouts. |
| 1024–1279 px | Compact desktop layout with responsive grids and fluid gutters. |
| 1280 px and above | Full desktop layout with the reference section composition. |
| 1280 px and above, up to 820 px viewport height | Compact-height desktop mode: hero and landing sections adapt to the viewport height while preserving aligned section starts. |
