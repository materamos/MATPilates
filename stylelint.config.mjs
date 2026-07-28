const stylelintConfig = {
  extends: ["stylelint-config-standard"],
  rules: {
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: [
          "apply",
          "config",
          "custom-variant",
          "plugin",
          "reference",
          "source",
          "tailwind",
          "theme",
          "utility",
          "variant",
        ],
      },
    ],
    "declaration-block-no-duplicate-properties": true,
    "declaration-block-no-redundant-longhand-properties": null,
    "import-notation": "string",
    "media-feature-range-notation": "prefix",
    "no-duplicate-selectors": true,
    "no-descending-specificity": null,
    "number-max-precision": 10,
    "selector-class-pattern": [
      "^(?:(?:mat|site)(?:-[a-z0-9]+)*(?:__[a-z0-9]+(?:-[a-z0-9]+)*)?(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?|sr-only)$",
      {
        message:
          "Expected class selector to follow the existing MAT/site BEM convention",
      },
    ],
  },
};

export default stylelintConfig;
