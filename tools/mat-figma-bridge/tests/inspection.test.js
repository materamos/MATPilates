import { afterEach, describe, expect, it } from "vitest";

import { fingerprintParent } from "../plugin/src/fingerprints.js";
import {
  auditTypography,
  getNodeSnapshot,
} from "../plugin/src/inspection.js";

afterEach(() => {
  delete globalThis.figma;
});

describe("inspection scope", () => {
  it("rejects a node audit whose node belongs to another page", async () => {
    const currentPage = {
      id: "page-current",
      name: "Current",
      type: "PAGE",
      parent: null,
      selection: [],
    };
    const otherPage = {
      id: "page-other",
      name: "Other",
      type: "PAGE",
      parent: null,
    };
    const otherNode = {
      id: "other-node",
      name: "Other frame",
      type: "FRAME",
      parent: otherPage,
      visible: true,
      width: 320,
      height: 200,
    };

    Object.defineProperty(globalThis, "figma", {
      configurable: true,
      writable: true,
      value: {
        currentPage,
        getNodeByIdAsync: async (id) =>
          id === otherNode.id ? otherNode : null,
      },
    });

    await expect(
      auditTypography({ scope: "node", nodeId: otherNode.id }),
    ).rejects.toMatchObject({
      code: "NODE_OUTSIDE_SCOPE",
    });
  });

  it("exposes the exact parent fingerprint needed to create a text node", async () => {
    const page = {
      id: "page-current",
      name: "Current",
      type: "PAGE",
      parent: null,
      selection: [],
    };
    const frame = {
      id: "frame-parent",
      name: "Parent",
      type: "FRAME",
      parent: page,
      visible: true,
      locked: false,
      width: 320,
      height: 200,
      children: [],
      findAllWithCriteria: () => [],
    };
    page.children = [frame];
    Object.defineProperty(globalThis, "figma", {
      configurable: true,
      writable: true,
      value: {
        currentPage: page,
        getNodeByIdAsync: async (id) =>
          id === frame.id ? frame : id === page.id ? page : null,
      },
    });

    await expect(getNodeSnapshot(frame.id, false)).resolves.toMatchObject({
      id: frame.id,
      fingerprint: fingerprintParent(frame),
    });
    await expect(getNodeSnapshot(page.id, false)).resolves.toMatchObject({
      id: page.id,
      fingerprint: fingerprintParent(page),
    });
  });

  it("rejects get_node scopes above the protocol descendant limit", async () => {
    const page = {
      id: "page-current",
      name: "Current",
      type: "PAGE",
      parent: null,
      selection: [],
    };
    const descendants = Array.from({ length: 1_001 }, (_, index) => ({
      id: `text-${index}`,
      type: "TEXT",
    }));
    const frame = {
      id: "oversized-frame",
      name: "Oversized",
      type: "FRAME",
      parent: page,
      visible: true,
      locked: false,
      width: 320,
      height: 200,
      children: descendants,
      findAllWithCriteria: () => descendants,
    };
    Object.defineProperty(globalThis, "figma", {
      configurable: true,
      writable: true,
      value: {
        currentPage: page,
        getNodeByIdAsync: async (id) => (id === frame.id ? frame : null),
      },
    });

    await expect(getNodeSnapshot(frame.id, false)).rejects.toMatchObject({
      code: "NODE_SCOPE_TOO_LARGE",
    });
  });
});
