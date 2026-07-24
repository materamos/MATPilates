import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  fingerprint,
} from "../shared/fingerprint.js";

describe("canonicalJson", () => {
  it("sorts object keys recursively while preserving array order", () => {
    const value = {
      zebra: 2,
      alpha: {
        second: "b",
        first: "a",
      },
      items: [
        { y: 2, x: 1 },
        "MAT",
        null,
      ],
    };

    expect(canonicalJson(value)).toBe(
      '{"alpha":{"first":"a","second":"b"},"items":[{"x":1,"y":2},"MAT",null],"zebra":2}',
    );
  });

  it("omits undefined object properties without changing the input", () => {
    const value = {
      keep: "value",
      omit: undefined,
      nested: {
        present: true,
        missing: undefined,
      },
    };

    expect(canonicalJson(value)).toBe(
      '{"keep":"value","nested":{"present":true}}',
    );
    expect(Object.hasOwn(value, "omit")).toBe(true);
    expect(Object.hasOwn(value.nested, "missing")).toBe(true);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects non-finite values (%s)",
    (value) => {
      expect(() => canonicalJson({ value })).toThrow(
        "Fingerprint values must be finite.",
      );
    },
  );
});

describe("fingerprint", () => {
  it("returns the SHA-256 digest of the canonical UTF-8 JSON", () => {
    const value = {
      z: ["Neue Montréal", true, null],
      a: "MAT",
    };
    const canonical = canonicalJson(value);
    const expected = createHash("sha256")
      .update(canonical, "utf8")
      .digest("hex");

    expect(fingerprint(value)).toBe(expected);
    expect(fingerprint(value)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces the same digest for semantically equivalent key orders", () => {
    const left = {
      font: { family: "Neue Montreal", style: "Medium" },
      size: 16,
    };
    const right = {
      size: 16,
      font: { style: "Medium", family: "Neue Montreal" },
    };

    expect(fingerprint(left)).toBe(fingerprint(right));
  });

  it("changes when an observed typography value changes", () => {
    const regular = {
      font: { family: "Neue Montreal", style: "Regular" },
      size: 16,
    };
    const medium = {
      font: { family: "Neue Montreal", style: "Medium" },
      size: 16,
    };

    expect(fingerprint(regular)).not.toBe(fingerprint(medium));
  });
});
