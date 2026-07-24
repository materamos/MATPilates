import { describe, expect, it } from "vitest";

import { fontRoleForMatTextStyleName } from "../plugin/src/font-policy.js";

describe("MAT semantic text-style policy", () => {
  it.each([
    ["MAT mobile/H1 Mobile", "bold"],
    ["MAT desktop/H1 desktop", "bold"],
    ["MAT mobile/H2 Mobile", "medium"],
    ["MAT desktop/H2 desktop", "medium"],
    ["MAT mobile/H3 Mobile", "medium"],
    ["MAT desktop/H3 desktop", "medium"],
    ["MAT mobile/Body Mobile", "regular"],
    ["MAT desktop/Body desktop", "regular"],
    ["MAT mobile/Body S Mobile", "regular"],
    ["MAT desktop/Body S desktop", "regular"],
    ["MAT mobile/Button Mobile", "medium"],
    ["MAT desktop/Button desktop", "medium"],
    ["MAT mobile/Label Mobile", "regular"],
    ["MAT desktop/Label desktop", "medium"],
    ["H1", "bold"],
    ["H2", "medium"],
    ["H3", "medium"],
    ["Body", "regular"],
    ["Body S", "regular"],
    ["Button", "medium"],
    ["Label mobile", "regular"],
    ["Label desktop", "medium"],
  ])("maps %s to %s", (styleName, expectedRole) => {
    expect(fontRoleForMatTextStyleName(styleName)).toBe(expectedRole);
  });

  it.each([
    ["mat MOBILE / h1 mobile", "bold"],
    ["  MAT   desktop / H2   DESKTOP  ", "medium"],
    ["Mat Mobile/Body s", "regular"],
    ["mAt DeSkToP/LaBeL", "medium"],
  ])(
    "normalizes case, spacing, and an optional matching platform suffix in %s",
    (styleName, expectedRole) => {
      expect(fontRoleForMatTextStyleName(styleName)).toBe(expectedRole);
    },
  );

  it.each([
    "",
    "MAT/H1",
    "MAT tablet/H1 tablet",
    "Label",
    "MAT mobile/H1 desktop",
    "MAT desktop/H2 mobile",
    "MAT mobile/Label desktop",
    "MAT desktop/Label mobile",
    "MAT mobile/H1 H2 Mobile",
    "MAT mobile/H1/H2",
    "MAT mobile/H10 Mobile",
    "MAT mobile/Body Small Mobile",
    "MAT mobile/Semibold Mobile",
    "MAT mobile/Button Label Mobile",
    "MAT mobile/",
  ])("returns null for an unknown or ambiguous name: %s", (styleName) => {
    expect(fontRoleForMatTextStyleName(styleName)).toBeNull();
  });
});
