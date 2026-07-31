# MAT Design System

## Authority and status

This is a hybrid specification that distinguishes confirmed design rules from the current implementation:

- [MAT - Foundations](https://www.figma.com/design/IcAaBXTryXYQLsFBIp5YgY/MAT-Pilates?node-id=66-10) is normative for brand tokens, typography, and confirmed design-system values. The brandbook is supporting material when Foundations does not resolve a value.
- The application source is authoritative for the composition and behavior currently implemented in the landing page.
- The project documentary library is authoritative for approved business content. Application content mirrors confirmed decisions; it does not create them.
- The existing Desktop, Desktop Compact, and Mobile Figma frames are historical composition references. They no longer represent the complete landing page and must not be used as visual-regression or acceptance baselines.

Normative rules, implemented behavior, and known differences are identified explicitly below. Documenting an implementation difference does not authorize a code or Figma change.

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
| Keyboard focus on light surfaces | `brand/deep-burgundy` |
| Keyboard focus on dark surfaces | `brand/pale-pink` |

### Keyboard focus

The normative keyboard-focus treatment uses a 2 px outline with a 4 px offset, matching the current implementation.

Light surfaces inherit `--mat-focus-ring-on-light` (`brand/deep-burgundy`), while charcoal and burgundy surfaces inherit `--mat-focus-ring-on-dark` (`brand/pale-pink`). A light component nested inside a dark section must restore the light-surface token so the indicator contrasts with its immediate background.

## Typography

The confirmed family is Neue Montreal. The brandbook specifies Thin for auxiliary text, Bold for H1, Medium for H2, and Regular for body and the base CTA role. Foundations limits the web system to Regular, Medium, and Bold and shows auxiliary text as Regular. Buttons use Regular at every breakpoint; labels use Regular on Mobile and Medium on Desktop and Desktop Compact. Light is not used as a substitute for Thin.

Regular, Medium, and Bold are implemented across Mobile, Desktop, and Desktop Compact.

### Mobile

| Style | Weight | Size | Line height | Letter spacing | Case |
| --- | --- | ---: | ---: | ---: | --- |
| `MAT mobile/H1 Mobile` | Bold | 56 px | 49 px | -1.4 px | Uppercase |
| `MAT mobile/H2 Mobile` | Medium | 32 px | 32 px | -0.4 px | Uppercase |
| `MAT mobile/H3 Mobile` | Medium | 24 px | 31 px | 0 px | Uppercase |
| `MAT mobile/Body Mobile` | Regular | 16 px | 26 px | 0 px | Sentence |
| `MAT mobile/Body S Mobile` | Regular | 14 px | 22 px | 0 px | Sentence |
| `MAT mobile/Label Mobile` | Regular | 12 px | 16 px | 0.8 px | Uppercase |
| `MAT mobile/Button Mobile` | Regular | 14 px | 20 px | 0.2 px | Uppercase |

### Desktop

| Style | Weight | Size | Line height | Letter spacing | Case |
| --- | --- | ---: | ---: | ---: | --- |
| `MAT desktop/H1 Desktop` | Bold | 100 px | 76.75 px | 0 px | Uppercase |
| `MAT desktop/H2 desktop` | Medium | 64 px | 58 px | -0.4 px | Uppercase |
| `MAT desktop/H3 Desktop` | Medium | 40 px | 43 px | 0 px | Uppercase |
| `MAT desktop/Body Desktop` | Regular | 30 px | 38 px | 0 px | Sentence |
| `MAT desktop/Body S Desktop` | Regular | 24 px | 30 px | 0 px | Sentence |
| `MAT desktop/Label Desktop` | Medium | 18 px | 16 px | 0.8 px | Uppercase |
| `MAT desktop/Button Desktop` | Regular | 22 px | 20 px | 0.2 px | Uppercase |

### Desktop Compact

| Style | Weight | Size | Line height | Letter spacing | Case |
| --- | --- | ---: | ---: | ---: | --- |
| `MAT compact/H1 Compact` | Bold | 80 px | 73.68 px (92.1%) | 0 px | Uppercase |
| `MAT compact/H2 Compact` | Medium | 48 px | 58 px | -0.4 px | Uppercase |
| `MAT compact/H3 Compact` | Medium | 32 px | 43 px | 0 px | Uppercase |
| `MAT compact/Body Compact` | Regular | 24 px | 30 px | 0 px | Sentence |
| `MAT compact/Body S Compact` | Regular | 20 px | 30 px | 0 px | Sentence |
| `MAT compact/Label Compact` | Medium | 16 px | 16 px | 0.8 px | Uppercase |
| `MAT compact/Button Compact` | Regular | 18 px | 20 px | 0.2 px | Uppercase |

## Layout

### Reusable scale

| Category | Values |
| --- | --- |
| Spacing | 8 / 12 / 16 / 24 / 32 / 48 px |
| Radius | 0 / 8 / 16 / 24 px / full |

### Responsive contract

| Mode | Condition | Typography | Navigation | Container |
| --- | --- | --- | --- | --- |
| Mobile | Less than 768 px wide | Mobile | Fullscreen menu | 24 px gutter; 720 px maximum |
| Tablet | 768 px or wider and less than 1024 px wide | Mobile | Fullscreen menu | 24 px gutter; 720 px maximum |
| Compact Narrow Short | 1024 px or wider and less than 1280 px wide; 700 px tall or shorter | Compact with reduced hero density | Horizontal | 60 px gutter; 1160 px maximum |
| Compact Narrow | 1024 px or wider and less than 1280 px wide; taller than 700 px | Compact | Horizontal | 60 px gutter; 1160 px maximum |
| Compact Content | 1280 px or wider; shorter than 901 px | Compact for landing content; Desktop for hero and navigation | Horizontal | 60 px gutter; 1320 px maximum |
| Desktop | 1280 px or wider; 901 px tall or taller | Desktop | Horizontal | 60 px gutter; 1320 px maximum |

Width defines the composition and available height defines its content density. Therefore, 1077 x 609 is Compact Narrow Short, 1024 x 768 is Compact Narrow, 1280 x 720 is Compact Content, and 1280 x 901 is Desktop.

Within the tablet range from 768 px inclusive to 1024 px exclusive, sections use intrinsic height and normal document scrolling at every viewport height. The viewport minus the header is a minimum-height floor, not a fixed-height boundary; content must remain accessible instead of being clipped when a landscape or split-screen viewport is short.

In Tablet portrait, Hot Mat is content-sized instead of using the viewport-height floor. Its closing copy keeps the section's 32 px bottom inset, avoiding unused vertical space after the content.

### CSS organization

`src/app/globals.css` owns the global foundation: Tailwind imports, design tokens, reset and accessibility, typography and shared primitives, header and menu, mobile-first landing sections, and responsive modes. The footer uses the component-scoped `src/components/site-footer.module.css` stylesheet.

The cascade is ordered from mobile-first foundations into Tablet, shared wide rules, a shared compact-content foundation, Compact Narrow, Compact Narrow Short, shared desktop rules, Compact Content, and Desktop. Shared compact-content values appear before the mode-specific blocks; Compact Content keeps only the explicit restorations required after desktop primitives take effect. Cross-cutting capability queries, such as the horizontal action flow and progressive map eligibility, are named separately instead of being appended as anonymous breakpoint patches.

Keep one final source of truth for each property within a responsive context. A grouped shared rule may be followed by a component-specific extension, but a later generic patch must not silently repair earlier specificity or ordering. Component roles may explicitly outrank a shared typography primitive when both classes are present, as with the catalog title role over `mat-h3`.

The four composition families are Mobile/Tablet, Compact Narrow, Compact Content, and Desktop. They are implemented through the six non-overlapping width/height ranges in the table above, plus one tablet-landscape adjustment inside the Tablet range. Layout should prefer intrinsic sizing, maximum-width containers, and `clamp()` over new one-off breakpoints. Content sections must not combine a rigid height with clipping; overflow cropping is reserved for media wrappers.

Adjacent CSS media queries overlap at their exact boundary because the stylesheet uses the prefix notation required by its lint configuration. The later composition in the stylesheet takes precedence at 768, 1024, and 1280 px wide and at 901 px tall, producing the non-overlapping modes documented above without fractional gaps.

Containers remain fluid until their maximum width and are centered afterwards. Section backgrounds remain full-width. Images preserve their crop with `cover`; implementations must not scale the complete Figma canvas proportionally. Sections grow with content, so frame heights are composition references rather than fixed implementation heights. In Compact Narrow Short and Compact Content, the studio gallery has a 640 px height floor and may extend below a short viewport so portrait images remain legible.

Classes and reservation use a 32 px vertical content inset in Mobile and Tablet, and a 60 px inset in Compact Narrow, Compact Content, and Desktop. In wide compositions, the reservation copy and image stretch between those limits so the content envelope preserves the same top and bottom spacing. Manifesto and footer retain their own component-specific vertical rhythm.

The studio map is progressive, non-essential content. It is shown in landscape compositions that are at least 900 px wide and 600 px tall, occupies the full width of the studio copy column, and reserves at least 240 px before its lazy-loaded iframe mounts. Once visible, it grows to absorb the column's remaining vertical space while preserving its 32 px top margin, 16 px bottom margin, and the section's outer spacing. Narrower, shorter, and portrait compositions do not render or reserve space for the map. The address and `Cómo llegar` link remain available as the location fallback in every mode.

### Visual regression contract

Playwright renders the production build with Chromium, the bundled Neue Montreal files, the `es-AR` locale, the Buenos Aires timezone, light color scheme, and reduced motion. Animations are disabled for screenshots. The external Google Maps rendering is masked, while its responsive presence is asserted independently.

| Viewport | DPR | Composition and boundary |
| --- | ---: | --- |
| 320 x 568 | 1 | Mobile minimum and reflow |
| 390 x 844 | 1 and 2 | Primary Mobile and high-density media |
| 812 x 375 | 1 | Tablet landscape and short height |
| 768 x 1024 | 1 | Inclusive Tablet boundary |
| 1023 x 768 | 1 | Last width before Compact Narrow |
| 1024 x 768 | 1 | Inclusive Compact Narrow boundary |
| 1077 x 609 | 1 | Compact Narrow Short |
| 1279 x 820 | 1 | Last width before Compact Content/Desktop width |
| 1280 x 720 | 1 | Inclusive Compact Content width |
| 1280 x 901 | 1 | Exact Desktop height boundary |
| 1440 x 1000 | 1 | Desktop |

Full-page snapshots cover the representative 320, 390, 768, 1077, 1280 x 720, 1280 x 901, and 1440 compositions. Structural tests cover the remaining boundaries, navigation mode, map eligibility, intrinsic section sizing, horizontal overflow, and the classes/reservation vertical content inset. Interaction tests cover menu focus transfer, exclusive class disclosures, reduced-motion gallery control, and the documented focus outline.

Baseline updates require an intentional visual decision. Failure artifacts under `test-results/` are diagnostic only and must not be committed. Windows baselines are stored next to their spec files; CI on another operating system requires separately approved platform baselines.

### Composition values

| Reference | Confirmed composition |
| --- | --- |
| Desktop | Detail and header 20 px; cards 36 px; section and gutter 60 px; editorial gap 80 px; radius 16 / 24 / full |
| Mobile / Tablet | Controls 8 px; groups 12 px; content 16 px; gutter 24 px; sections 32 px; radius 8 / 24 / full |
| Compact Narrow and Content | Detail and header 20 px; controls 24 px; cards 36 px; panel 48 px; section and gutter 60 px; editorial gap 80 px; radius 16 / 24 / full |

Distances produced by `Space Between` are local mathematical results and are not reusable tokens. This includes values such as 25, 35, 79, 81, and 128 px that preserve the approved outer geometry.

## Motion and interaction

- The manifesto marquee moves continuously in the default motion mode. With `prefers-reduced-motion: reduce`, its animation and transform are removed so the concepts remain static.
- Class names animate only when they overflow their available title viewport. With reduced motion, the title animation is removed.
- The studio gallery advances automatically every five seconds when it has multiple images and is not paused. Clicking the gallery or pressing Enter or Space toggles pause and resume.
- The gallery starts paused when the user prefers reduced motion. Its accessible name reports the available action and current image, and `aria-pressed` exposes the paused state.

## Effects

| Style | Value | Usage |
| --- | --- | --- |
| `MAT/Shadow/Mobile` | 0 4px 4px rgb(0 0 0 / 18%) | Mobile navigation, landing body CTAs, Hot Mat pillar cards, and class cards; wider modes remove it where explicitly overridden |

## Historical Figma composition references

The following frames preserve design history and menu-specific context. They do not represent the current full-page copy, class catalog, studio gallery, map, or section composition, and they are not acceptance baselines.

- Desktop: [node `492:193`](https://www.figma.com/design/IcAaBXTryXYQLsFBIp5YgY/MAT-Pilates?node-id=492-193)
- Desktop Compact, Narrow and Short: [node `264:4`](https://www.figma.com/design/IcAaBXTryXYQLsFBIp5YgY/MAT-Pilates?node-id=264-4)
- Mobile landing and closed navigation: [node `492:194`](https://www.figma.com/design/IcAaBXTryXYQLsFBIp5YgY/MAT-Pilates?node-id=492-194)
- Mobile open menu: node `497:534` inside the Mobile page.

The implementation uses the exact responsive wordmark exports from Figma under `public/brand/`, plus WOFF2 exports of the supplied Regular, Medium, and Bold font files under `src/app/fonts/`, loaded once from the root layout through `next/font/local`. The original OTF files remain in the project library. The mobile menu toggle draws both the hamburger and close states with CSS; it does not consume a separate close-icon asset.
