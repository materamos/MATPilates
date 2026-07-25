# MAT Design System

This document mirrors the confirmed system in [MAT - Foundations](https://www.figma.com/design/IcAaBXTryXYQLsFBIp5YgY/MAT-Pilates?node-id=66-10) and the current Desktop and Mobile compositions. Figma is the visual source of truth; the brandbook is supporting material when Foundations does not resolve a value.

## Color

### Brand primitives

`MAT Color` contains one `Value` mode and these six primitives. Semantic aliases in source code are implementation conveniences, not additional Figma variables.

| Figma token | Value | Canonical CSS variable |
| --- | --- | --- |
| `brand/charcoal` | `#2B2B2B` | `--mat-color-charcoal` |
| `brand/desaturated-beige` | `#E2D9CD` | `--mat-color-desaturated-beige` |
| `brand/pearl-neutral` | `#F1EDE6` | `--mat-color-pearl-neutral` |
| `brand/deep-burgundy` | `#5F1B22` | `--mat-color-deep-burgundy` |
| `brand/pale-pink` | `#FADADD` | `--mat-color-pale-pink` |
| `brand/blue-grey` | `#8FA0C2` | `--mat-color-blue-grey` |

### Interface roles

| Role | Primitive |
| --- | --- |
| Default surface | `brand/pearl-neutral` |
| Brand or muted surface | `brand/desaturated-beige` |
| Accent surface and primary action | `brand/deep-burgundy` |
| Inverse surface and primary text | `brand/charcoal` |
| Highlight text or surface | `brand/pale-pink` |
| Cool supporting surface | `brand/blue-grey` |
| Inverse text and icons | `brand/pearl-neutral` |
| Subtle inverse border | `brand/desaturated-beige` |

## Typography

The confirmed family is Neue Montreal. The brandbook specifies Thin for auxiliary text, Bold for H1, Medium for H2, and Regular for body and the base CTA role. Current Foundations limits the web system to Regular, Medium, and Bold and shows auxiliary text as Regular; the responsive product designs further resolve interface labels and buttons as Medium. The code follows those newer Figma decisions and does not substitute Light for Thin.

Only Regular, Medium, and Bold are implemented. Desktop Compact typography remains pending.

### Mobile

| Style | Weight | Size | Line height | Letter spacing | Case |
| --- | --- | ---: | ---: | ---: | --- |
| `MAT mobile/H1 Mobile` | Bold | 56 px | 49 px | -1.4 px | Uppercase |
| `MAT mobile/H2 Mobile` | Medium | 32 px | 28 px | -0.4 px | Uppercase |
| `MAT mobile/H3 Mobile` | Medium | 24 px | 31 px | 0 px | Uppercase |
| `MAT mobile/Body Mobile` | Regular | 16 px | 26 px | 0 px | Sentence |
| `MAT mobile/Body S Mobile` | Regular | 14 px | 22 px | 0 px | Sentence |
| `MAT mobile/Label Mobile` | Regular | 12 px | 16 px | 0.8 px | Uppercase |
| `MAT mobile/Button Mobile` | Medium | 14 px | 20 px | 0.2 px | Uppercase |

### Desktop

| Style | Weight | Size | Line height | Letter spacing | Case |
| --- | --- | ---: | ---: | ---: | --- |
| `MAT desktop/H1 Desktop` | Bold | 100 px | 76.75 px | 0 px | Uppercase |
| `MAT desktop/H2 desktop` | Medium | 64 px | 58 px | -0.4 px | Uppercase |
| `MAT desktop/H3 Desktop` | Medium | 40 px | 43 px | 0 px | Uppercase |
| `MAT desktop/Body Desktop` | Regular | 30 px | 38 px | 0 px | Sentence |
| `MAT desktop/Body S Desktop` | Regular | 24 px | 30 px | 0 px | Sentence |
| `MAT desktop/Label Desktop` | Medium | 18 px | 16 px | 0.8 px | Uppercase |
| `MAT desktop/Button Desktop` | Medium | 22 px | 20 px | 0.2 px | Uppercase |

## Layout

### Reusable scale

| Category | Values |
| --- | --- |
| Spacing | 8 / 12 / 16 / 24 / 32 px |
| Radius | 8 / 16 / 24 px / full |

### Breakpoint composition

| Reference | Confirmed composition |
| --- | --- |
| Desktop, 1440 px | Detail and header 20 px; cards 36 px; section and gutter 60 px; editorial gap 80 px; radius 16 / 24 / full |
| Mobile, 390 px | Controls 8 px; groups 12 px; content 16 px; gutter 24 px; sections 32 px; radius 8 / 24 / full |
| Desktop Compact | Pending. Narrow and Short values must not be promoted to shared tokens until both designs are approved. |

Until Desktop Compact is resolved, the menu uses the confirmed Mobile composition below 1440 px and switches to the confirmed Desktop composition at 1440 px. This is an explicit fallback, not the final Narrow or Short design.

## Menu references

- Desktop: [node `497:305`](https://www.figma.com/design/IcAaBXTryXYQLsFBIp5YgY/MAT-Pilates?node-id=497-305)
- Mobile landing and closed navigation: [node `492:194`](https://www.figma.com/design/IcAaBXTryXYQLsFBIp5YgY/MAT-Pilates?node-id=492-194)
- Mobile open menu: node `497:534` inside the Mobile page.

The implementation uses the exact responsive wordmark and close-icon exports from Figma under `public/brand/` and `public/icons/`, plus the supplied Regular, Medium, and Bold font files under `public/fonts/`.
