import type { FontRole } from "./contracts";

export const FONT_POLICY: Readonly<Record<FontRole, FontName>> = Object.freeze({
  regular: Object.freeze({ family: "Neue Montreal", style: "Regular" }),
  medium: Object.freeze({ family: "Neue Montreal", style: "Medium" }),
  bold: Object.freeze({ family: "Neue Montreal", style: "Bold" }),
});

const ROLE_BY_KEY = new Map(
  Object.entries(FONT_POLICY).map(([role, font]) => [
    `${font.family}\u0000${font.style}`,
    role as FontRole,
  ]),
);

const FORBIDDEN_STYLE_PATTERN = /(^|\s)(600|semi[\s-]?bold)(\s|$)/i;

type MatStylePlatform = "mobile" | "desktop" | "compact";
type MatSemanticStyle =
  | "h1"
  | "h2"
  | "h3"
  | "body"
  | "body s"
  | "button"
  | "label";

const FONT_ROLE_BY_SEMANTIC_STYLE: Readonly<
  Record<Exclude<MatSemanticStyle, "label">, FontRole>
> = Object.freeze({
  h1: "bold",
  h2: "medium",
  h3: "medium",
  body: "regular",
  "body s": "regular",
  button: "regular",
});

export function fontNameForRole(role: FontRole): FontName {
  return FONT_POLICY[role];
}

export function fontRoleForMatTextStyleName(
  styleName: string,
): FontRole | null {
  const normalizedName = styleName
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/");
  const match =
    /^(?:mat (mobile|desktop|compact)\/)?(h1|h2|h3|body s|body|button|label)(?: (mobile|desktop|compact))?$/.exec(
      normalizedName,
    );
  if (match === null) {
    return null;
  }

  const namespacedPlatform = match[1] as MatStylePlatform | undefined;
  const semanticStyle = match[2] as MatSemanticStyle;
  const explicitPlatform = match[3] as MatStylePlatform | undefined;
  if (
    namespacedPlatform !== undefined &&
    explicitPlatform !== undefined &&
    explicitPlatform !== namespacedPlatform
  ) {
    return null;
  }

  if (semanticStyle === "label") {
    const platform = namespacedPlatform ?? explicitPlatform;
    if (platform === undefined) {
      return null;
    }
    return platform === "mobile" ? "regular" : "medium";
  }
  return FONT_ROLE_BY_SEMANTIC_STYLE[semanticStyle];
}

export function roleForFontName(fontName: FontName): FontRole | null {
  return ROLE_BY_KEY.get(`${fontName.family}\u0000${fontName.style}`) ?? null;
}

export function isAllowedFontName(fontName: FontName): boolean {
  return roleForFontName(fontName) !== null;
}

export function assertAllowedFontName(fontName: FontName): FontRole {
  if (FORBIDDEN_STYLE_PATTERN.test(fontName.style)) {
    throw bridgeFontError(
      "FONT_WEIGHT_REJECTED",
      `El peso "${fontName.style}" está prohibido. Use Regular, Medium o Bold.`,
    );
  }

  const role = roleForFontName(fontName);
  if (role === null) {
    throw bridgeFontError(
      "FONT_NOT_ALLOWED",
      `La fuente "${fontName.family} / ${fontName.style}" no pertenece a la política MAT.`,
    );
  }
  return role;
}

export async function inspectFontAvailability(): Promise<
  Array<{ role: FontRole; fontName: FontName; available: boolean }>
> {
  const availableFonts = await figma.listAvailableFontsAsync();
  const availableKeys = new Set(
    availableFonts.map(({ fontName }) => `${fontName.family}\u0000${fontName.style}`),
  );

  return (Object.keys(FONT_POLICY) as FontRole[]).map((role) => {
    const fontName = fontNameForRole(role);
    return {
      role,
      fontName,
      available: availableKeys.has(`${fontName.family}\u0000${fontName.style}`),
    };
  });
}

export async function loadFontRoles(roles: Iterable<FontRole>): Promise<void> {
  const uniqueRoles = new Set(roles);
  const availability = await inspectFontAvailability();
  const unavailable = availability.filter(
    ({ role, available }) => uniqueRoles.has(role) && !available,
  );

  if (unavailable.length > 0) {
    throw bridgeFontError(
      "FONT_UNAVAILABLE",
      `No están disponibles localmente: ${unavailable
        .map(({ fontName }) => `${fontName.family} / ${fontName.style}`)
        .join(", ")}.`,
    );
  }

  await Promise.all(
    Array.from(uniqueRoles, (role) => figma.loadFontAsync(fontNameForRole(role))),
  );
}

function bridgeFontError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}
