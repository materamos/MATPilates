import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fingerprintParent,
  fingerprintTextNode,
  fingerprintTextStyle,
} from "../plugin/src/fingerprints.js";
import { publicErrorCodeForInternalCode } from "../plugin/src/contracts.js";
import { assertAllowedFontName } from "../plugin/src/font-policy.js";
import { PatchEngine, toBridgeError } from "../plugin/src/patch-engine.js";
import { EventMessageSchema } from "../shared/protocol.js";

const NOW = Date.parse("2026-07-24T15:00:00.000Z");
const FILE_KEY = "MAT-file-key";
const PAGE_ID = "66:11";
const PARENT_ID = "frame-foundations";
const EXISTING_STYLE_ID = "style-existing";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("PatchEngine safety harness", () => {
  it("preserves the public preview-size error code", () => {
    expect(publicErrorCodeForInternalCode("PREVIEW_TOO_LARGE")).toBe(
      "PREVIEW_TOO_LARGE",
    );
  });

  it("keeps coded errors JSON-serializable when details are absent", () => {
    const codedError = Object.assign(new Error("Synthetic failure"), {
      code: "SYNTHETIC_FAILURE",
    });
    const technicalError = toBridgeError(codedError);

    expect(technicalError).not.toHaveProperty("details");
    expect(
      EventMessageSchema.safeParse({
        v: 1,
        type: "event",
        event: "patch_status",
        payload: { error: technicalError },
      }).success,
    ).toBe(true);
  });

  it("accepts an exact target on a non-active page without a visible selection", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const otherPage = {
      id: "other-page",
      name: "Other page",
      type: "PAGE",
      parent: null,
      children: [],
      selection: [],
    };
    const otherParent = {
      id: "other-frame",
      name: "Other frame",
      type: "FRAME",
      parent: otherPage,
      visible: true,
      locked: false,
      width: 320,
      height: 200,
      children: [],
      exportAsync: vi.fn(async () => validPngBytes()),
      appendChild: vi.fn((node) => {
        node.parent = otherParent;
        if (!otherParent.children.includes(node)) {
          otherParent.children.push(node);
        }
      }),
    };
    otherPage.children.push(otherParent);
    harness.nodes.set(otherPage.id, otherPage);
    harness.nodes.set(otherParent.id, otherParent);

    const crossPageProposal = proposal([
      {
        op: "create_text_node",
        parentId: otherParent.id,
        expectedParentFingerprint: fingerprintParent(otherParent),
        tempId: "cross-page-text",
        characters: "Exact cross-page typography",
        typography: {
          fontRole: "regular",
        },
      },
    ]);
    crossPageProposal.pageId = otherPage.id;
    crossPageProposal.selectionIds = [otherParent.id];
    crossPageProposal.preview = {
      nodeId: otherParent.id,
      maxDimension: 1_280,
    };

    const pending = await engine.propose(crossPageProposal);
    expect(pending).toMatchObject({
      status: "pending_approval",
    });
    const applied = await engine.approve(
      pending.patchId,
      pending.approvalDigest,
    );

    expect(applied).toMatchObject({ status: "applied" });
    expect(globalThis.figma.currentPage).toBe(harness.page);
    expect(otherParent.appendChild).toHaveBeenCalledTimes(1);
    expect(harness.createText).toHaveBeenCalledTimes(1);
  });

  it("rejects writes inside a main component because instance impact is not enumerated", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const component = {
      id: "main-component",
      name: "Main component",
      type: "COMPONENT",
      parent: harness.page,
      visible: true,
      locked: false,
      width: 320,
      height: 200,
      children: [],
      appendChild: vi.fn(),
    };
    harness.page.children.push(component);
    harness.nodes.set(component.id, component);

    await expect(
      engine.propose(
        proposal([
          {
            op: "create_text_node",
            parentId: component.id,
            expectedParentFingerprint: fingerprintParent(component),
            tempId: "component-text",
            characters: "Must not propagate to instances",
            typography: {
              fontRole: "regular",
            },
          },
        ]),
      ),
    ).rejects.toMatchObject({
      code: "COMPONENT_WRITE_REJECTED",
    });
    expect(harness.createText).not.toHaveBeenCalled();
    expect(harness.loadFontAsync).not.toHaveBeenCalled();
    expect(harness.commitUndo).not.toHaveBeenCalled();
  });

  it.each(["COMPONENT", "INSTANCE"])(
    "allows binding an exact local text style inside a %s",
    async (parentType) => {
      const harness = installFigmaHarness();
      const engine = new PatchEngine(vi.fn());
      harness.existingStyle.boundVariables = {
        fontFamily: { type: "VARIABLE_ALIAS", id: "variable-font-family" },
        fontSize: { type: "VARIABLE_ALIAS", id: "variable-font-size" },
        fontStyle: { type: "VARIABLE_ALIAS", id: "variable-font-style" },
      };
      const component = {
        id: `style-binding-${parentType.toLowerCase()}`,
        name: "Style binding parent",
        type: parentType,
        parent: harness.page,
        visible: true,
        locked: false,
        width: 320,
        height: 200,
        children: [],
        appendChild: vi.fn(),
      };
      const textNode = attachTextNode(harness, "component-label", "MAT");
      harness.parent.children = harness.parent.children.filter(
        (child) => child !== textNode,
      );
      textNode.parent = component;
      component.children.push(textNode);
      harness.page.children.push(component);
      harness.nodes.set(component.id, component);

      const pending = await engine.propose(
        proposal([
          {
            op: "bind_text_style",
            nodeId: textNode.id,
            expectedFingerprint: fingerprintTextNode(textNode),
            style: {
              kind: "existing",
              styleId: EXISTING_STYLE_ID,
              expectedFingerprint: fingerprintTextStyle(harness.existingStyle),
            },
          },
        ]),
      );
      const applied = await engine.approve(
        pending.patchId,
        pending.approvalDigest,
      );

      expect(applied).toMatchObject({ status: "applied" });
      expect(textNode.setTextStyleIdAsync).toHaveBeenCalledWith(
        EXISTING_STYLE_ID,
      );
    },
  );

  it("rejects explicit x/y placement inside an Auto Layout parent", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    harness.parent.layoutMode = "HORIZONTAL";

    await expect(
      engine.propose(
        proposal([
          {
            op: "create_text_node",
            parentId: PARENT_ID,
            expectedParentFingerprint: fingerprintParent(harness.parent),
            tempId: "auto-layout-positioned",
            characters: "Auto Layout child",
            x: 24,
            y: 24,
            typography: { fontRole: "regular" },
          },
        ]),
      ),
    ).rejects.toMatchObject({
      code: "AUTO_LAYOUT_POSITION_REJECTED",
    });
    expect(harness.createText).not.toHaveBeenCalled();
    expect(harness.commitUndo).not.toHaveBeenCalled();
  });

  it("rejects new text nodes inside Grid containers in v0.1", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    harness.parent.layoutMode = "GRID";

    await expect(
      engine.propose(
        proposal([
          {
            op: "create_text_node",
            parentId: PARENT_ID,
            expectedParentFingerprint: fingerprintParent(harness.parent),
            tempId: "grid-child",
            characters: "Unsupported Grid child",
            typography: { fontRole: "regular" },
          },
        ]),
      ),
    ).rejects.toMatchObject({
      code: "GRID_LAYOUT_REJECTED",
    });
    expect(harness.createText).not.toHaveBeenCalled();
    expect(harness.commitUndo).not.toHaveBeenCalled();
  });

  it("classifies a concurrent fingerprint change as stale before any write", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const expectedParentFingerprint = fingerprintParent(harness.parent);
    const patch = proposal([
      {
        op: "create_text_node",
        parentId: PARENT_ID,
        expectedParentFingerprint,
        tempId: "new-heading",
        name: "Heading",
        characters: "MAT Pilates",
        typography: {
          fontRole: "bold",
          fontSize: 48,
        },
      },
    ]);

    const pending = await engine.propose(patch);
    harness.parent.name = "Changed concurrently";

    const result = await engine.approve(
      pending.patchId,
      pending.approvalDigest,
    );

    expect(result).toMatchObject({
      status: "stale",
      error: {
        code: "STALE_FINGERPRINT",
      },
    });
    expect(engine.getPendingStatus()).toBeNull();
    expect(harness.loadFontAsync).not.toHaveBeenCalled();
    expect(harness.commitUndo).not.toHaveBeenCalled();
    expect(harness.createTextStyle).not.toHaveBeenCalled();
    expect(harness.createText).not.toHaveBeenCalled();
    expect(harness.triggerUndo).not.toHaveBeenCalled();
    expect(harness.parent.appendChild).not.toHaveBeenCalled();
  });

  it("invalidates a text patch when the layer name changes after proposal", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const textNode = attachTextNode(harness, "renamed-text", "Before");
    const pending = await engine.propose(
      proposal([
        {
          op: "set_characters",
          nodeId: textNode.id,
          expectedFingerprint: fingerprintTextNode(textNode),
          characters: "After",
        },
      ]),
    );
    textNode.name = "Manual rename";
    textNode.autoRename = false;

    const result = await engine.approve(
      pending.patchId,
      pending.approvalDigest,
    );

    expect(result).toMatchObject({
      status: "stale",
      error: { code: "STALE_FINGERPRINT" },
    });
    expect(harness.commitUndo).not.toHaveBeenCalled();
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("invalidates a text patch when a complete-style paragraph field changes", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const textNode = attachTextNode(harness, "trimmed-text", "Before");
    const pending = await engine.propose(
      proposal([
        {
          op: "set_characters",
          nodeId: textNode.id,
          expectedFingerprint: fingerprintTextNode(textNode),
          characters: "After",
        },
      ]),
    );
    textNode.leadingTrim = "CAP_HEIGHT";

    const result = await engine.approve(
      pending.patchId,
      pending.approvalDigest,
    );

    expect(result).toMatchObject({
      status: "stale",
      error: { code: "STALE_FINGERPRINT" },
    });
    expect(harness.commitUndo).not.toHaveBeenCalled();
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("invalidates a text patch when a sibling is inserted after proposal", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const textNode = attachTextNode(harness, "layout-text", "Before");
    const pending = await engine.propose(
      proposal([
        {
          op: "set_characters",
          nodeId: textNode.id,
          expectedFingerprint: fingerprintTextNode(textNode),
          characters: "After",
        },
      ]),
    );
    attachTextNode(harness, "late-sibling", "Concurrent sibling");

    const result = await engine.approve(
      pending.patchId,
      pending.approvalDigest,
    );

    expect(result).toMatchObject({
      status: "stale",
      error: { code: "STALE_FINGERPRINT" },
    });
    expect(textNode.characters).toBe("Before");
    expect(harness.commitUndo).not.toHaveBeenCalled();
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("invalidates a text patch when a descendant of a layout sibling changes", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const textNode = attachTextNode(harness, "nested-layout-text", "Before");
    const siblingFrame = attachFrameNode(
      harness,
      harness.parent,
      "responsive-sibling",
    );
    const nestedFillChild = attachFrameNode(
      harness,
      siblingFrame,
      "nested-fill-child",
    );
    const pending = await engine.propose(
      proposal([
        {
          op: "set_characters",
          nodeId: textNode.id,
          expectedFingerprint: fingerprintTextNode(textNode),
          characters: "After",
        },
      ]),
    );
    nestedFillChild.width = 240;

    const result = await engine.approve(
      pending.patchId,
      pending.approvalDigest,
    );

    expect(result).toMatchObject({
      status: "stale",
      error: { code: "STALE_FINGERPRINT" },
    });
    expect(textNode.characters).toBe("Before");
    expect(harness.commitUndo).not.toHaveBeenCalled();
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("rejects an update_text_style operation whose values are already exact", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());

    await expect(
      engine.propose(
        proposal([
          {
            op: "update_text_style",
            styleId: EXISTING_STYLE_ID,
            expectedFingerprint: fingerprintTextStyle(harness.existingStyle),
            description: harness.existingStyle.description,
            typography: {
              fontRole: "regular",
              fontSize: 16,
              lineHeight: { unit: "PIXELS", value: 24 },
              letterSpacing: { unit: "PERCENT", value: 0 },
              textCase: "ORIGINAL",
              textDecoration: "NONE",
            },
          },
        ]),
      ),
    ).rejects.toMatchObject({ code: "NO_OP_OPERATION" });
    expect(harness.commitUndo).not.toHaveBeenCalled();
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("rejects a bind_text_style operation when the exact style is already bound", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const textNode = attachTextNode(harness, "bound-text", "MAT");
    matchTextNodeToStyle(textNode, harness.existingStyle);

    await expect(
      engine.propose(
        proposal([
          {
            op: "bind_text_style",
            nodeId: textNode.id,
            expectedFingerprint: fingerprintTextNode(textNode),
            style: {
              kind: "existing",
              styleId: EXISTING_STYLE_ID,
              expectedFingerprint: fingerprintTextStyle(
                harness.existingStyle,
              ),
            },
          },
        ]),
      ),
    ).rejects.toMatchObject({ code: "NO_OP_OPERATION" });
    expect(harness.commitUndo).not.toHaveBeenCalled();
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("rejects a set_text_range operation whose style and values are already exact", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const textNode = attachTextNode(harness, "exact-range", "MAT");
    matchTextNodeToStyle(textNode, harness.existingStyle);

    await expect(
      engine.propose(
        proposal([
          {
            op: "set_text_range",
            nodeId: textNode.id,
            expectedFingerprint: fingerprintTextNode(textNode),
            start: 0,
            end: 3,
            style: {
              kind: "existing",
              styleId: EXISTING_STYLE_ID,
              expectedFingerprint: fingerprintTextStyle(
                harness.existingStyle,
              ),
            },
            typography: {
              fontRole: "regular",
              fontSize: 16,
              lineHeight: { unit: "PIXELS", value: 24 },
              letterSpacing: { unit: "PERCENT", value: 0 },
              textCase: "ORIGINAL",
              textDecoration: "NONE",
            },
          },
        ]),
      ),
    ).rejects.toMatchObject({ code: "NO_OP_OPERATION" });
    expect(harness.commitUndo).not.toHaveBeenCalled();
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("rejects a range style plus typography when its projected final state is already exact", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const textNode = attachTextNode(harness, "projected-range", "MAT");
    matchTextNodeToStyle(textNode, harness.existingStyle);
    textNode.fontSize = 20;

    await expect(
      engine.propose(
        proposal([
          {
            op: "set_text_range",
            nodeId: textNode.id,
            expectedFingerprint: fingerprintTextNode(textNode),
            start: 0,
            end: 3,
            style: {
              kind: "existing",
              styleId: EXISTING_STYLE_ID,
              expectedFingerprint: fingerprintTextStyle(
                harness.existingStyle,
              ),
            },
            typography: {
              fontSize: 20,
            },
          },
        ]),
      ),
    ).rejects.toMatchObject({ code: "NO_OP_OPERATION" });
    expect(harness.commitUndo).not.toHaveBeenCalled();
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("accepts rebinding the same style when a text-style override must be cleared", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const textNode = attachTextNode(harness, "overridden-style", "MAT");
    matchTextNodeToStyle(textNode, harness.existingStyle);
    addTextStyleOverride(textNode);

    const pending = await engine.propose(
      proposal([
        {
          op: "bind_text_style",
          nodeId: textNode.id,
          expectedFingerprint: fingerprintTextNode(textNode),
          style: {
            kind: "existing",
            styleId: EXISTING_STYLE_ID,
            expectedFingerprint: fingerprintTextStyle(
              harness.existingStyle,
            ),
          },
        },
      ]),
    );

    expect(pending).toMatchObject({
      status: "pending_approval",
      patchId: expect.any(String),
    });
  });

  it("rejects whole-node style rebinding when the text contains a hyperlink", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const textNode = attachTextNode(harness, "linked-style", "MAT");
    matchTextNodeToStyle(textNode, harness.existingStyle);
    addHyperlink(textNode);

    await expect(
      engine.propose(
        proposal([
          {
            op: "bind_text_style",
            nodeId: textNode.id,
            expectedFingerprint: fingerprintTextNode(textNode),
            style: {
              kind: "existing",
              styleId: EXISTING_STYLE_ID,
              expectedFingerprint: fingerprintTextStyle(
                harness.existingStyle,
              ),
            },
          },
        ]),
      ),
    ).rejects.toMatchObject({
      code: "HYPERLINK_PRESERVATION_REQUIRED",
    });
    expect(harness.commitUndo).not.toHaveBeenCalled();
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("accepts reapplying a range style when the same style has an override", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const textNode = attachTextNode(harness, "overridden-range", "MAT");
    matchTextNodeToStyle(textNode, harness.existingStyle);
    addTextStyleOverride(textNode);

    const pending = await engine.propose(
      proposal([
        {
          op: "set_text_range",
          nodeId: textNode.id,
          expectedFingerprint: fingerprintTextNode(textNode),
          start: 0,
          end: 3,
          style: {
            kind: "existing",
            styleId: EXISTING_STYLE_ID,
            expectedFingerprint: fingerprintTextStyle(
              harness.existingStyle,
            ),
          },
        },
      ]),
    );

    expect(pending).toMatchObject({
      status: "pending_approval",
      patchId: expect.any(String),
    });
  });

  it("rejects projected range rebinding when the range contains a hyperlink", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const textNode = attachTextNode(
      harness,
      "projected-range-override",
      "MAT",
    );
    matchTextNodeToStyle(textNode, harness.existingStyle);
    textNode.fontSize = 20;
    addHyperlink(textNode);

    await expect(
      engine.propose(
        proposal([
          {
            op: "set_text_range",
            nodeId: textNode.id,
            expectedFingerprint: fingerprintTextNode(textNode),
            start: 0,
            end: 3,
            style: {
              kind: "existing",
              styleId: EXISTING_STYLE_ID,
              expectedFingerprint: fingerprintTextStyle(
                harness.existingStyle,
              ),
            },
            typography: {
              fontSize: 20,
            },
          },
        ]),
      ),
    ).rejects.toMatchObject({
      code: "HYPERLINK_PRESERVATION_REQUIRED",
    });
    expect(harness.commitUndo).not.toHaveBeenCalled();
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("rejects full content replacement when the text contains a hyperlink", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const textNode = attachTextNode(harness, "linked-copy", "Before");
    addHyperlink(textNode);

    await expect(
      engine.propose(
        proposal([
          {
            op: "set_characters",
            nodeId: textNode.id,
            expectedFingerprint: fingerprintTextNode(textNode),
            characters: "After",
          },
        ]),
      ),
    ).rejects.toMatchObject({
      code: "HYPERLINK_PRESERVATION_REQUIRED",
    });
    expect(harness.commitUndo).not.toHaveBeenCalled();
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("replaces content while preserving bound typography variables", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const textNode = attachTextNode(harness, "bound-copy", "Before");
    textNode.boundVariables = {
      fontFamily: [{ type: "VARIABLE_ALIAS", id: "variable-font-family" }],
      fontStyle: [{ type: "VARIABLE_ALIAS", id: "variable-font-style" }],
    };

    const pending = await engine.propose(
      proposal([
        {
          op: "set_characters",
          nodeId: textNode.id,
          expectedFingerprint: fingerprintTextNode(textNode),
          characters: "After",
        },
      ]),
    );
    const applied = await engine.approve(
      pending.patchId,
      pending.approvalDigest,
    );

    expect(applied).toMatchObject({ status: "applied" });
    expect(textNode.characters).toBe("After");
    expect(textNode.boundVariables).toEqual({
      fontFamily: [{ type: "VARIABLE_ALIAS", id: "variable-font-family" }],
      fontStyle: [{ type: "VARIABLE_ALIAS", id: "variable-font-style" }],
    });
    expect(harness.commitUndo).toHaveBeenCalled();
  });

  it("rejects set_characters when the exact content is already present", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const textNode = attachTextNode(harness, "same-copy", "MAT");

    await expect(
      engine.propose(
        proposal([
          {
            op: "set_characters",
            nodeId: textNode.id,
            expectedFingerprint: fingerprintTextNode(textNode),
            characters: "MAT",
          },
        ]),
      ),
    ).rejects.toMatchObject({ code: "NO_OP_OPERATION" });
    expect(harness.commitUndo).not.toHaveBeenCalled();
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("does not run native Undo when Figma ignores an attempted write", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const textNode = attachTextNode(harness, "ignored-write", "Before");
    textNode.deleteCharacters.mockImplementation(() => undefined);
    textNode.insertCharacters.mockImplementation(() => undefined);
    const pending = await engine.propose(
      proposal([
        {
          op: "set_characters",
          nodeId: textNode.id,
          expectedFingerprint: fingerprintTextNode(textNode),
          characters: "After",
        },
      ]),
    );

    const result = await engine.approve(
      pending.patchId,
      pending.approvalDigest,
    );

    expect(result).toMatchObject({
      status: "failed_rolled_back",
      error: { code: "NO_DOCUMENT_CHANGE" },
    });
    expect(textNode.characters).toBe("Before");
    expect(harness.triggerUndo).not.toHaveBeenCalled();
    expect(harness.parent.exportAsync).not.toHaveBeenCalled();
  });

  it("does not run native Undo when an operation fails before changing Figma", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const textNode = attachTextNode(harness, "failed-binding", "MAT");
    textNode.setTextStyleIdAsync.mockRejectedValueOnce(
      new Error("Figma rejected the style binding"),
    );
    const pending = await engine.propose(
      proposal([
        {
          op: "bind_text_style",
          nodeId: textNode.id,
          expectedFingerprint: fingerprintTextNode(textNode),
          style: {
            kind: "existing",
            styleId: EXISTING_STYLE_ID,
            expectedFingerprint: fingerprintTextStyle(harness.existingStyle),
          },
        },
      ]),
    );

    const result = await engine.approve(
      pending.patchId,
      pending.approvalDigest,
    );

    expect(result).toMatchObject({
      status: "failed_rolled_back",
      error: { code: "PATCH_APPLY_FAILED" },
    });
    expect(textNode.textStyleId).toBe("");
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("renders every user-supplied operation field in the approval detail", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const expectedParentFingerprint = fingerprintParent(harness.parent);
    const expectedStyleFingerprint = fingerprintTextStyle(
      harness.existingStyle,
    );

    const pending = await engine.propose(
      proposal([
        {
          op: "create_text_style",
          tempId: "new-style",
          name: "Desktop/H1",
          description: "Primary marketing heading",
          typography: {
            fontRole: "bold",
            fontSize: 42,
            lineHeight: { unit: "PERCENT", value: 120 },
            letterSpacing: { unit: "PIXELS", value: -1.5 },
            textCase: "UPPER",
            textDecoration: "UNDERLINE",
          },
        },
        {
          op: "update_text_style",
          styleId: EXISTING_STYLE_ID,
          expectedFingerprint: expectedStyleFingerprint,
          name: "Desktop/Body",
          description: "Long-form body copy",
          typography: {
            fontRole: "medium",
            fontSize: 18,
            lineHeight: { unit: "PIXELS", value: 28 },
            letterSpacing: { unit: "PERCENT", value: 2 },
            textCase: "ORIGINAL",
            textDecoration: "NONE",
          },
        },
        {
          op: "create_text_node",
          parentId: PARENT_ID,
          expectedParentFingerprint,
          tempId: "new-node",
          name: "Hero eyebrow",
          characters: "Canning, Buenos Aires",
          x: 12.5,
          y: 24,
          width: 320,
          style: {
            kind: "created",
            tempId: "new-style",
          },
          typography: {
            fontRole: "bold",
            fontSize: 14,
            lineHeight: { unit: "AUTO" },
            letterSpacing: { unit: "PERCENT", value: 4 },
            textCase: "TITLE",
            textDecoration: "STRIKETHROUGH",
          },
        },
      ]),
    );

    expect(pending.summary.operationDetails).toHaveLength(3);
    expect(pending.summary.operationDetails[0]).toContain("Desktop/H1");
    expect(pending.summary.operationDetails[0]).toContain(
      "Primary marketing heading",
    );
    expect(pending.summary.operationDetails[0]).toContain(
      "Neue Montreal Bold",
    );
    expect(pending.summary.operationDetails[0]).toContain("42px");
    expect(pending.summary.operationDetails[0]).toContain("interlínea 120%");
    expect(pending.summary.operationDetails[0]).toContain("tracking -1.5px");
    expect(pending.summary.operationDetails[0]).toContain("caja UPPER");
    expect(pending.summary.operationDetails[0]).toContain(
      "decoración UNDERLINE",
    );

    expect(pending.summary.operationDetails[1]).toContain(EXISTING_STYLE_ID);
    expect(pending.summary.operationDetails[1]).toContain("Desktop/Body");
    expect(pending.summary.operationDetails[1]).toContain(
      "Long-form body copy",
    );
    expect(pending.summary.operationDetails[1]).toContain(
      "Neue Montreal Medium",
    );
    expect(pending.summary.operationDetails[1]).toContain("18px");
    expect(pending.summary.operationDetails[1]).toContain("interlínea 28px");
    expect(pending.summary.operationDetails[1]).toContain("tracking 2%");
    expect(pending.summary.operationDetails[1]).toContain("caja ORIGINAL");
    expect(pending.summary.operationDetails[1]).toContain("decoración NONE");

    expect(pending.summary.operationDetails[2]).toContain("new-node");
    expect(pending.summary.operationDetails[2]).toContain(PARENT_ID);
    expect(pending.summary.operationDetails[2]).toContain("Hero eyebrow");
    expect(pending.summary.operationDetails[2]).toContain("x 12.5px");
    expect(pending.summary.operationDetails[2]).toContain("y 24px");
    expect(pending.summary.operationDetails[2]).toContain("ancho 320px");
    expect(pending.summary.operationDetails[2]).toContain(
      "Canning, Buenos Aires",
    );
    expect(pending.summary.operationDetails[2]).toContain("unidades UTF-16");
    expect(pending.summary.operationDetails[2]).toContain(
      "estilo nuevo new-style",
    );
    expect(pending.summary.operationDetails[2]).toContain(
      "Neue Montreal Bold",
    );
    expect(pending.summary.operationDetails[2]).toContain("14px");
    expect(pending.summary.operationDetails[2]).toContain(
      "interlínea automática",
    );
    expect(pending.summary.operationDetails[2]).toContain("tracking 4%");
    expect(pending.summary.operationDetails[2]).toContain("caja TITLE");
    expect(pending.summary.operationDetails[2]).toContain(
      "decoración STRIKETHROUGH",
    );
  });

  it("marks bounded copy previews when whitespace is normalized or content is truncated", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const characters = `First line\n${"x".repeat(100)}`;

    const pending = await engine.propose(
      proposal([
        {
          op: "create_text_node",
          parentId: PARENT_ID,
          expectedParentFingerprint: fingerprintParent(harness.parent),
          tempId: "long-copy",
          characters,
          typography: {
            fontRole: "regular",
          },
        },
      ]),
    );

    expect(pending.summary.operationDetails[0]).toContain(
      "vista previa truncada",
    );
    expect(pending.summary.operationDetails[0]).toContain(
      "espacios y saltos normalizados",
    );
    expect(pending.summary.operationDetails[0]).toContain(
      `${characters.length} unidades UTF-16`,
    );
  });

  it.each([
    ["numeric fontRole 600", { fontRole: 600, fontSize: 16 }],
    [
      "raw fontStyle property",
      { fontRole: "regular", fontSize: 16, fontStyle: "SemiBold" },
    ],
  ])("rejects %s before preparing a proposal", async (_label, typography) => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());

    await expect(
      engine.propose(
        proposal([
          {
            op: "create_text_style",
            tempId: "unsafe-style",
            name: "Unsafe",
            typography,
          },
        ]),
      ),
    ).rejects.toMatchObject({
      code: "INVALID_PATCH",
    });

    expect(engine.getPendingStatus()).toBeNull();
    expect(harness.createTextStyle).not.toHaveBeenCalled();
    expect(harness.createText).not.toHaveBeenCalled();
    expect(harness.commitUndo).not.toHaveBeenCalled();
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it.each(["600", "SemiBold", "Semi Bold", "Semi-Bold"])(
    "rejects the raw Neue Montreal style %s with the weight-specific error",
    (style) => {
      let thrown;
      try {
        assertAllowedFontName({
          family: "Neue Montreal",
          style,
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toMatchObject({
        code: "FONT_WEIGHT_REJECTED",
      });
    },
  );

  it("rejecting an approved proposal leaves the simulated Figma document unchanged", async () => {
    const harness = installFigmaHarness();
    const statuses = vi.fn();
    const engine = new PatchEngine(statuses);
    const expectedParentFingerprint = fingerprintParent(harness.parent);
    const expectedStyleFingerprint = fingerprintTextStyle(
      harness.existingStyle,
    );
    const originalStyle = {
      name: harness.existingStyle.name,
      description: harness.existingStyle.description,
    };
    const originalChildren = [...harness.parent.children];

    const pending = await engine.propose(
      proposal([
        {
          op: "update_text_style",
          styleId: EXISTING_STYLE_ID,
          expectedFingerprint: expectedStyleFingerprint,
          name: "Changed name",
          description: "Changed description",
        },
        {
          op: "create_text_node",
          parentId: PARENT_ID,
          expectedParentFingerprint,
          tempId: "not-created",
          characters: "This must never be written",
          typography: {
            fontRole: "regular",
          },
        },
      ]),
    );

    const result = engine.reject(pending.patchId);

    expect(result.status).toBe("rejected");
    expect(result).not.toHaveProperty("error");
    expect(
      EventMessageSchema.safeParse({
        v: 1,
        type: "event",
        event: "patch_status",
        payload: result,
      }).success,
    ).toBe(true);
    expect(engine.getPendingStatus()).toBeNull();
    expect(engine.getStatus(pending.patchId)?.status).toBe("rejected");
    expect(harness.existingStyle).toMatchObject(originalStyle);
    expect(harness.parent.children).toEqual(originalChildren);
    expect(harness.loadFontAsync).not.toHaveBeenCalled();
    expect(harness.createTextStyle).not.toHaveBeenCalled();
    expect(harness.createText).not.toHaveBeenCalled();
    expect(harness.commitUndo).not.toHaveBeenCalled();
    expect(harness.triggerUndo).not.toHaveBeenCalled();
    expect(harness.parent.appendChild).not.toHaveBeenCalled();
    expect(statuses.mock.calls.map(([snapshot]) => snapshot.status)).toEqual([
      "pending_approval",
      "rejected",
    ]);
  });

  it("preserves adjacent formatting when applying one mixed text range", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const textNode = attachTextNode(harness, "mixed-range", "ABCD");
    const baseSegment =
      textNode.getStyledTextSegments.getMockImplementation()([], 0, 4)[0];
    const ranges = [
      { start: 0, end: 2, fontSize: 12 },
      { start: 2, end: 4, fontSize: 24 },
    ];
    const originalAdjacentRange = { ...ranges[1] };

    textNode.fontSize = figma.mixed;
    textNode.getStyledTextSegments.mockImplementation(
      (_fields, start = 0, end = textNode.characters.length) =>
        ranges
          .filter((range) => range.start < end && range.end > start)
          .map((range) => ({
            ...baseSegment,
            start: Math.max(range.start, start),
            end: Math.min(range.end, end),
            fontName: textNode.fontName,
            fontSize: range.fontSize,
          })),
    );
    textNode.getRangeFontSize.mockImplementation((start, end) => {
      const exactRange = ranges.find(
        (range) => range.start === start && range.end === end,
      );
      return exactRange?.fontSize ?? figma.mixed;
    });
    textNode.setRangeFontSize.mockImplementation((start, end, fontSize) => {
      const exactRange = ranges.find(
        (range) => range.start === start && range.end === end,
      );
      if (exactRange === undefined) {
        throw new Error("The test received an unexpected range.");
      }
      exactRange.fontSize = fontSize;
    });

    const pending = await engine.propose(
      proposal([
        {
          op: "set_text_range",
          nodeId: textNode.id,
          expectedFingerprint: fingerprintTextNode(textNode),
          start: 0,
          end: 2,
          typography: { fontSize: 18 },
        },
      ]),
    );
    const applied = await engine.approve(
      pending.patchId,
      pending.approvalDigest,
    );

    expect(applied.status).toBe("applied");
    expect(textNode.setRangeFontSize).toHaveBeenCalledTimes(1);
    expect(textNode.setRangeFontSize).toHaveBeenCalledWith(0, 2, 18);
    expect(ranges[0]).toEqual({ start: 0, end: 2, fontSize: 18 });
    expect(ranges[1]).toEqual(originalAdjacentRange);
  });

  it("returns the post-apply PNG, affected nodes, and arms undo after settling", async () => {
    const harness = installFigmaHarness();
    const statuses = vi.fn();
    const engine = new PatchEngine(statuses);

    const applied = await applyCreatedTextPatch(engine, harness);

    expect(applied).toMatchObject({
      status: "applied",
      result: {
        affectedNodeIds: ["created-text-1"],
        createdNodeIds: ["created-text-1"],
        affectedNodes: [
          {
            id: "created-text-1",
            name: "Created body",
            nameTruncated: false,
            type: "TEXT",
            pageId: PAGE_ID,
            pageName: "Foundations",
          },
        ],
        postApplyPreview: {
          mimeType: "image/png",
          width: 2,
          height: 1,
          byteLength: 24,
          nodeId: PARENT_ID,
          fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
        undo: {
          state: "settling",
          expiresAt: NOW + 5 * 60_000,
        },
      },
    });
    expect(harness.parent.exportAsync).toHaveBeenCalledOnce();
    expect(engine.getStatusForBridge(applied.patchId)).toMatchObject({
      status: "applied",
      postApplyPreviewData: expect.stringMatching(/^[A-Za-z0-9+/]+=*$/),
    });

    await vi.advanceTimersByTimeAsync(750);

    expect(engine.getStatus(applied.patchId)).toMatchObject({
      status: "applied",
      result: {
        undo: {
          state: "available",
          expiresAt: NOW + 5 * 60_000,
        },
      },
    });
    expect(
      statuses.mock.calls.map(([snapshot]) => ({
        status: snapshot.status,
        undo: snapshot.result?.undo.state,
      })),
    ).toEqual([
      { status: "pending_approval", undo: undefined },
      { status: "applying", undo: undefined },
      { status: "applied", undo: "settling" },
      { status: "applied", undo: "available" },
    ]);
  });

  it("rolls back a mutation when post-apply PNG export fails", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const exportStarted = deferred();
    const releaseExport = deferred();
    harness.parent.exportAsync.mockImplementationOnce(() => {
      exportStarted.resolve();
      return releaseExport.promise;
    });

    const applying = applyCreatedTextPatch(engine, harness);
    await exportStarted.promise;
    engine.handleDocumentChanges([
      { id: "created-text-1", origin: "LOCAL", type: "CREATE" },
    ]);
    releaseExport.reject(new Error("Synthetic export failure"));
    await vi.advanceTimersByTimeAsync(1_600);
    const result = await applying;

    expect(result).toMatchObject({
      status: "failed_rolled_back",
      error: {
        code: "PATCH_APPLY_FAILED",
        message: "Synthetic export failure",
      },
    });
    expect(harness.createText).toHaveBeenCalledOnce();
    expect(harness.triggerUndo).toHaveBeenCalledOnce();
    expect(harness.commitUndo).toHaveBeenCalledOnce();
    expect(harness.parent.children).toEqual([]);
    expect(harness.nodes.has("created-text-1")).toBe(false);
    expect(engine.isWriteBlocked()).toBe(false);
  });

  it("undoes the latest safe batch with exactly one native Undo", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const applied = await applyCreatedTextPatch(engine, harness);
    await vi.advanceTimersByTimeAsync(750);

    const undoing = engine.undoLatest(applied.patchId);
    await vi.advanceTimersByTimeAsync(750);
    const undone = await undoing;

    expect(undone).toMatchObject({
      status: "undone",
      result: {
        undo: {
          state: "completed",
        },
      },
    });
    expect(harness.triggerUndo).toHaveBeenCalledOnce();
    expect(harness.parent.children).toEqual([]);
    expect(harness.nodes.has("created-text-1")).toBe(false);
    expect(engine.getStatusForBridge(applied.patchId)).not.toHaveProperty(
      "postApplyPreviewData",
    );
    expect(engine.isWriteBlocked()).toBe(false);
  });

  it("invalidates settling undo when an unexpected local document ID changes", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const applied = await applyCreatedTextPatch(engine, harness);

    const result = engine.handleDocumentChanges([
      {
        id: "unrelated-node",
        origin: "LOCAL",
        type: "PROPERTY_CHANGE",
        properties: ["name"],
      },
    ]);
    await vi.advanceTimersByTimeAsync(750);

    expect(result).toMatchObject({
      status: "applied",
      result: {
        undo: {
          state: "unavailable",
          reason: "document_changed",
        },
      },
    });
    await expect(engine.undoLatest(applied.patchId)).rejects.toMatchObject({
      code: "UNDO_UNAVAILABLE",
    });
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("accepts a delayed expected local document event while undo is settling", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const applied = await applyCreatedTextPatch(engine, harness);

    engine.handleDocumentChanges([
      { id: "created-text-1", origin: "LOCAL", type: "CREATE" },
    ]);
    await vi.advanceTimersByTimeAsync(750);

    expect(engine.getStatus(applied.patchId)).toMatchObject({
      status: "applied",
      result: {
        undo: {
          state: "available",
        },
      },
    });
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("invalidates even a matching local document event after undo becomes available", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const applied = await applyCreatedTextPatch(engine, harness);
    await vi.advanceTimersByTimeAsync(750);

    const result = engine.handleDocumentChanges([
      { id: "created-text-1", origin: "LOCAL", type: "CREATE" },
    ]);

    expect(result).toMatchObject({
      status: "applied",
      result: {
        undo: {
          state: "unavailable",
          reason: "document_changed",
        },
      },
    });
    await expect(engine.undoLatest(applied.patchId)).rejects.toMatchObject({
      code: "UNDO_UNAVAILABLE",
    });
  });

  it("invalidates a changed property that was not part of the approved operation", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    await applyCreatedTextPatch(engine, harness);

    const result = engine.handleDocumentChanges([
      {
        id: "created-text-1",
        origin: "LOCAL",
        type: "PROPERTY_CHANGE",
        properties: ["opacity"],
      },
    ]);

    expect(result).toMatchObject({
      result: {
        undo: {
          state: "unavailable",
          reason: "document_changed",
        },
      },
    });
  });

  it("invalidates undo for a remote change even when it targets an expected ID", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    await applyCreatedTextPatch(engine, harness);

    const result = engine.handleDocumentChanges([
      { id: "created-text-1", origin: "REMOTE", type: "CREATE" },
    ]);

    expect(result).toMatchObject({
      status: "applied",
      result: {
        undo: {
          state: "unavailable",
          reason: "document_changed",
        },
      },
    });
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("stops as stale when plugin focus is lost before the first write", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const fontLoadStarted = deferred();
    const releaseFontLoad = deferred();
    harness.loadFontAsync.mockImplementationOnce(() => {
      fontLoadStarted.resolve();
      return releaseFontLoad.promise;
    });
    const pending = await engine.propose(
      proposal([
        {
          op: "create_text_node",
          parentId: PARENT_ID,
          expectedParentFingerprint: fingerprintParent(harness.parent),
          tempId: "focus-safe-node",
          characters: "No write after focus loss",
          typography: { fontRole: "regular" },
        },
      ]),
    );

    const applying = engine.approve(
      pending.patchId,
      pending.approvalDigest,
    );
    await fontLoadStarted.promise;
    engine.invalidateUndo("focus_left");
    releaseFontLoad.resolve();
    const result = await applying;

    expect(result).toMatchObject({
      status: "stale",
      error: { code: "STALE_FINGERPRINT" },
    });
    expect(harness.createText).not.toHaveBeenCalled();
    expect(harness.commitUndo).not.toHaveBeenCalled();
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("halts as indeterminate without native Undo when focus is lost after a write", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const exportStarted = deferred();
    const releaseExport = deferred();
    harness.parent.exportAsync.mockImplementationOnce(() => {
      exportStarted.resolve();
      return releaseExport.promise;
    });

    const applying = applyCreatedTextPatch(engine, harness);
    await exportStarted.promise;
    engine.invalidateUndo("focus_left");
    releaseExport.resolve(validPngBytes());
    const result = await applying;

    expect(result).toMatchObject({
      status: "indeterminate",
      error: {
        code: "CONCURRENT_CHANGE_DURING_APPLY",
        details: { reason: "focus_left" },
      },
    });
    expect(engine.isWriteBlocked()).toBe(true);
    expect(harness.triggerUndo).not.toHaveBeenCalled();
    expect(harness.nodes.has("created-text-1")).toBe(true);
  });

  it("treats an unapproved property on the affected node as concurrent", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const textNode = attachTextNode(harness, "same-target-opacity", "MAT");
    const exportStarted = deferred();
    const releaseExport = deferred();
    harness.parent.exportAsync.mockImplementationOnce(() => {
      exportStarted.resolve();
      return releaseExport.promise;
    });
    const pending = await engine.propose(
      proposal([
        {
          op: "bind_text_style",
          nodeId: textNode.id,
          expectedFingerprint: fingerprintTextNode(textNode),
          style: {
            kind: "existing",
            styleId: EXISTING_STYLE_ID,
            expectedFingerprint: fingerprintTextStyle(harness.existingStyle),
          },
        },
      ]),
    );

    const applying = engine.approve(
      pending.patchId,
      pending.approvalDigest,
    );
    await exportStarted.promise;
    engine.handleDocumentChanges([
      {
        id: textNode.id,
        origin: "LOCAL",
        type: "PROPERTY_CHANGE",
        properties: ["opacity"],
      },
    ]);
    releaseExport.resolve(validPngBytes());
    const result = await applying;

    expect(result).toMatchObject({
      status: "indeterminate",
      error: {
        code: "CONCURRENT_CHANGE_DURING_APPLY",
        details: {
          reason: "document_changed",
        },
      },
    });
    expect(engine.isWriteBlocked()).toBe(true);
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("prioritizes a concurrent change over a simultaneous preview failure", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const exportStarted = deferred();
    const releaseExport = deferred();
    harness.parent.exportAsync.mockImplementationOnce(() => {
      exportStarted.resolve();
      return releaseExport.promise;
    });

    const applying = applyCreatedTextPatch(engine, harness);
    await exportStarted.promise;
    engine.handleDocumentChanges([
      {
        id: "unrelated-node",
        origin: "LOCAL",
        type: "PROPERTY_CHANGE",
        properties: ["name"],
      },
    ]);
    releaseExport.reject(new Error("Preview disappeared concurrently"));
    const result = await applying;

    expect(result).toMatchObject({
      status: "indeterminate",
      error: {
        code: "CONCURRENT_CHANGE_DURING_APPLY",
        details: {
          reason: "document_changed",
          causeCode: "PATCH_APPLY_FAILED",
        },
      },
    });
    expect(engine.isWriteBlocked()).toBe(true);
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("keeps concurrency monitoring active while deciding whether rollback is safe", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const exportStarted = deferred();
    const releaseExport = deferred();
    const lookupStarted = deferred();
    const releaseLookup = deferred();
    harness.parent.exportAsync.mockImplementationOnce(() => {
      exportStarted.resolve();
      return releaseExport.promise;
    });

    const applying = applyCreatedTextPatch(engine, harness);
    await exportStarted.promise;
    engine.handleDocumentChanges([
      { id: "created-text-1", origin: "LOCAL", type: "CREATE" },
    ]);
    globalThis.figma.getNodeByIdAsync.mockImplementationOnce(async (nodeId) => {
      lookupStarted.resolve();
      await releaseLookup.promise;
      return harness.nodes.get(nodeId) ?? null;
    });
    releaseExport.reject(new Error("Synthetic failure before rollback"));
    await lookupStarted.promise;
    engine.handleDocumentChanges([
      {
        id: "late-user-change",
        origin: "LOCAL",
        type: "PROPERTY_CHANGE",
        properties: ["opacity"],
      },
    ]);
    releaseLookup.resolve();
    const result = await applying;

    expect(result).toMatchObject({
      status: "indeterminate",
      error: {
        code: "CONCURRENT_CHANGE_DURING_APPLY",
        details: {
          reason: "document_changed",
          causeCode: "PATCH_APPLY_FAILED",
        },
      },
    });
    expect(engine.isWriteBlocked()).toBe(true);
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("accepts bounded Auto Layout reflow events caused by its own write", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const sibling = attachTextNode(harness, "layout-sibling", "Sibling");
    const exportStarted = deferred();
    const releaseExport = deferred();
    harness.parent.exportAsync.mockImplementationOnce(() => {
      exportStarted.resolve();
      return releaseExport.promise;
    });

    const applying = applyCreatedTextPatch(engine, harness);
    await exportStarted.promise;
    engine.handleDocumentChanges([
      {
        id: harness.parent.id,
        origin: "LOCAL",
        type: "PROPERTY_CHANGE",
        properties: ["height"],
      },
      {
        id: sibling.id,
        origin: "LOCAL",
        type: "PROPERTY_CHANGE",
        properties: ["x", "relativeTransform"],
      },
      {
        id: "created-text-1",
        origin: "LOCAL",
        type: "PROPERTY_CHANGE",
        properties: ["fontName"],
      },
    ]);
    releaseExport.resolve(validPngBytes());
    const result = await applying;

    expect(result).toMatchObject({
      status: "applied",
      result: { undo: { state: "settling" } },
    });
    expect(engine.isWriteBlocked()).toBe(false);
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("accepts complete text-style binding properties emitted by Figma", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const textNode = attachTextNode(harness, "binding-properties", "MAT");
    const exportStarted = deferred();
    const releaseExport = deferred();
    harness.parent.exportAsync.mockImplementationOnce(() => {
      exportStarted.resolve();
      return releaseExport.promise;
    });
    const pending = await engine.propose(
      proposal([
        {
          op: "bind_text_style",
          nodeId: textNode.id,
          expectedFingerprint: fingerprintTextNode(textNode),
          style: {
            kind: "existing",
            styleId: EXISTING_STYLE_ID,
            expectedFingerprint: fingerprintTextStyle(harness.existingStyle),
          },
        },
      ]),
    );

    const applying = engine.approve(
      pending.patchId,
      pending.approvalDigest,
    );
    await exportStarted.promise;
    engine.handleDocumentChanges([
      {
        id: textNode.id,
        origin: "LOCAL",
        type: "PROPERTY_CHANGE",
        properties: [
          "textStyleId",
          "fontName",
          "leadingTrim",
          "paragraphIndent",
          "paragraphSpacing",
          "listSpacing",
          "hangingPunctuation",
          "hangingList",
        ],
      },
    ]);
    releaseExport.resolve(validPngBytes());
    const result = await applying;

    expect(result).toMatchObject({
      status: "applied",
      result: { undo: { state: "settling" } },
    });
    expect(engine.isWriteBlocked()).toBe(false);
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it.each(["type", "fontName"])(
    "accepts the exact %s style event for its own font-role update",
    async (property) => {
      const harness = installFigmaHarness();
      const engine = new PatchEngine(vi.fn());
      const exportStarted = deferred();
      const releaseExport = deferred();
      harness.parent.exportAsync.mockImplementationOnce(() => {
        exportStarted.resolve();
        return releaseExport.promise;
      });
      const pending = await engine.propose(
        proposal([
          {
            op: "update_text_style",
            styleId: EXISTING_STYLE_ID,
            expectedFingerprint: fingerprintTextStyle(harness.existingStyle),
            typography: { fontRole: "bold" },
          },
        ]),
      );

      const applying = engine.approve(
        pending.patchId,
        pending.approvalDigest,
      );
      await exportStarted.promise;
      engine.handleDocumentChanges([
        {
          id: EXISTING_STYLE_ID,
          origin: "LOCAL",
          type: "STYLE_PROPERTY_CHANGE",
          properties: [property],
        },
      ]);
      releaseExport.resolve(validPngBytes());
      const result = await applying;

      expect(result).toMatchObject({
        status: "applied",
        result: { undo: { state: "settling" } },
      });
      expect(engine.isWriteBlocked()).toBe(false);
    },
  );

  it("does not trigger stale Undo after invalidation during its async verification", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const applied = await applyCreatedTextPatch(engine, harness);
    await vi.advanceTimersByTimeAsync(750);
    const lookupStarted = deferred();
    const releaseLookup = deferred();
    globalThis.figma.getNodeByIdAsync.mockImplementationOnce(async (nodeId) => {
      lookupStarted.resolve();
      await releaseLookup.promise;
      return harness.nodes.get(nodeId) ?? null;
    });

    const undoing = engine.undoLatest(applied.patchId);
    await lookupStarted.promise;
    engine.invalidateUndo("focus_left");
    releaseLookup.resolve();
    const result = await undoing;

    expect(result).toMatchObject({
      status: "applied",
      result: {
        undo: {
          state: "unavailable",
          reason: "focus_left",
        },
      },
    });
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("accepts the exact inverse document event emitted by native Undo", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const applied = await applyCreatedTextPatch(engine, harness);
    await vi.advanceTimersByTimeAsync(750);
    const originalUndo = harness.triggerUndo.getMockImplementation();
    harness.triggerUndo.mockImplementationOnce(async () => {
      engine.handleDocumentChanges([
        { id: "created-text-1", origin: "LOCAL", type: "DELETE" },
      ]);
      await originalUndo();
    });

    const undoing = engine.undoLatest(applied.patchId);
    await vi.advanceTimersByTimeAsync(750);
    const result = await undoing;

    expect(result).toMatchObject({
      status: "undone",
      result: { undo: { state: "completed" } },
    });
    expect(harness.triggerUndo).toHaveBeenCalledOnce();
  });

  it("invalidates undo after a post-apply change without invoking native Undo", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const applied = await applyCreatedTextPatch(engine, harness);
    await vi.advanceTimersByTimeAsync(750);
    const createdNode = harness.nodes.get("created-text-1");
    createdNode.characters = "Changed outside the bridge";

    const result = await engine.undoLatest(applied.patchId);

    expect(result).toMatchObject({
      status: "applied",
      result: {
        undo: {
          state: "unavailable",
          reason: "document_changed",
        },
      },
    });
    expect(harness.triggerUndo).not.toHaveBeenCalled();
    expect(harness.nodes.has("created-text-1")).toBe(true);
    expect(harness.parent.children).toHaveLength(1);
  });

  it("rejects an Undo whose Auto Layout geometry was not fully restored", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const originalAppend = harness.parent.appendChild.getMockImplementation();
    harness.parent.appendChild.mockImplementationOnce((node) => {
      originalAppend(node);
      harness.parent.height = 760;
    });
    const applied = await applyCreatedTextPatch(engine, harness);
    await vi.advanceTimersByTimeAsync(750);

    const undoing = engine.undoLatest(applied.patchId);
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await undoing;

    expect(result).toMatchObject({
      status: "indeterminate",
      result: {
        undo: {
          state: "unavailable",
          reason: "verification_failed",
        },
      },
      error: { code: "UNDO_VERIFICATION_FAILED" },
    });
    expect(harness.triggerUndo).toHaveBeenCalledOnce();
    expect(engine.isWriteBlocked()).toBe(true);
    expect(harness.parent.height).toBe(760);
  });

  it.each(["range", "new node"])(
    "rejects a %s font override that conflicts with its linked style",
    async (operationKind) => {
      const harness = installFigmaHarness();
      const engine = new PatchEngine(vi.fn());
      const expectedStyleFingerprint = fingerprintTextStyle(
        harness.existingStyle,
      );
      const textNode = attachTextNode(harness, "existing-text", "MAT");
      const operation =
        operationKind === "range"
          ? {
              op: "set_text_range",
              nodeId: textNode.id,
              expectedFingerprint: fingerprintTextNode(textNode),
              start: 0,
              end: 3,
              style: {
                kind: "existing",
                styleId: EXISTING_STYLE_ID,
                expectedFingerprint: expectedStyleFingerprint,
              },
              typography: {
                fontRole: "bold",
              },
            }
          : {
              op: "create_text_node",
              parentId: PARENT_ID,
              expectedParentFingerprint: fingerprintParent(harness.parent),
              tempId: "conflicting-node",
              characters: "MAT",
              style: {
                kind: "existing",
                styleId: EXISTING_STYLE_ID,
                expectedFingerprint: expectedStyleFingerprint,
              },
              typography: {
                fontRole: "bold",
              },
            };

      await expect(engine.propose(proposal([operation]))).rejects.toMatchObject({
        code: "SEMANTIC_FONT_ROLE_MISMATCH",
      });
      expect(harness.createText).not.toHaveBeenCalled();
      expect(harness.loadFontAsync).not.toHaveBeenCalled();
      expect(harness.commitUndo).not.toHaveBeenCalled();
      expect(harness.triggerUndo).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["range", "update first"],
    ["range", "reference first"],
    ["new node", "update first"],
    ["new node", "reference first"],
  ])(
    "uses the projected style role for a %s when the %s",
    async (operationKind, order) => {
      const harness = installFigmaHarness();
      const engine = new PatchEngine(vi.fn());
      const textNode = attachTextNode(harness, "projected-role-text", "MAT");
      const expectedStyleFingerprint = fingerprintTextStyle(
        harness.existingStyle,
      );
      const updateOperation = {
        op: "update_text_style",
        styleId: EXISTING_STYLE_ID,
        expectedFingerprint: expectedStyleFingerprint,
        typography: { fontRole: "bold" },
      };
      const referenceOperation =
        operationKind === "range"
          ? {
              op: "set_text_range",
              nodeId: textNode.id,
              expectedFingerprint: fingerprintTextNode(textNode),
              start: 0,
              end: 3,
              style: {
                kind: "existing",
                styleId: EXISTING_STYLE_ID,
                expectedFingerprint: expectedStyleFingerprint,
              },
              typography: { fontRole: "regular" },
            }
          : {
              op: "create_text_node",
              parentId: PARENT_ID,
              expectedParentFingerprint: fingerprintParent(harness.parent),
              tempId: "projected-role-node",
              characters: "MAT",
              style: {
                kind: "existing",
                styleId: EXISTING_STYLE_ID,
                expectedFingerprint: expectedStyleFingerprint,
              },
              typography: { fontRole: "regular" },
            };
      const operations =
        order === "update first"
          ? [updateOperation, referenceOperation]
          : [referenceOperation, updateOperation];

      await expect(engine.propose(proposal(operations))).rejects.toMatchObject({
        code: "SEMANTIC_FONT_ROLE_MISMATCH",
      });
      expect(harness.commitUndo).not.toHaveBeenCalled();
      expect(harness.createText).not.toHaveBeenCalled();
    },
  );

  it("allows a semantic rename that preserves variable-bound font-role fields", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    harness.existingStyle.boundVariables = {
      fontFamily: { type: "VARIABLE_ALIAS", id: "variable-font-family" },
      fontStyle: { type: "VARIABLE_ALIAS", id: "variable-font-style" },
    };

    const pending = await engine.propose(
      proposal([
        {
          op: "update_text_style",
          styleId: EXISTING_STYLE_ID,
          expectedFingerprint: fingerprintTextStyle(harness.existingStyle),
          name: "MAT desktop/Body desktop",
        },
      ]),
    );
    const applied = await engine.approve(
      pending.patchId,
      pending.approvalDigest,
    );

    expect(applied).toMatchObject({ status: "applied" });
    expect(harness.existingStyle).toMatchObject({
      name: "MAT desktop/Body desktop",
      boundVariables: {
        fontFamily: { type: "VARIABLE_ALIAS", id: "variable-font-family" },
        fontStyle: { type: "VARIABLE_ALIAS", id: "variable-font-style" },
      },
    });
    expect(harness.loadFontAsync).toHaveBeenCalledWith({
      family: "Neue Montreal",
      style: "Regular",
    });
    expect(harness.commitUndo).toHaveBeenCalled();
  });

  it("still rejects a semantic font-role change when its fields are variable-bound", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    harness.existingStyle.boundVariables = {
      fontFamily: { type: "VARIABLE_ALIAS", id: "variable-font-family" },
    };

    await expect(
      engine.propose(
        proposal([
          {
            op: "update_text_style",
            styleId: EXISTING_STYLE_ID,
            expectedFingerprint: fingerprintTextStyle(harness.existingStyle),
            typography: { fontRole: "bold" },
          },
        ]),
      ),
    ).rejects.toMatchObject({
      code: "VARIABLE_BOUND_STYLE_REJECTED",
    });
    expect(harness.commitUndo).not.toHaveBeenCalled();
    expect(harness.loadFontAsync).not.toHaveBeenCalled();
  });

  it("rejects a style write on an empty text node with bound typography variables", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const textNode = attachTextNode(harness, "empty-bound-text", "");
    textNode.boundVariables = {
      fontFamily: [{ type: "VARIABLE_ALIAS", id: "variable-font-family" }],
    };

    await expect(
      engine.propose(
        proposal([
          {
            op: "bind_text_style",
            nodeId: textNode.id,
            expectedFingerprint: fingerprintTextNode(textNode),
            style: {
              kind: "existing",
              styleId: EXISTING_STYLE_ID,
              expectedFingerprint: fingerprintTextStyle(
                harness.existingStyle,
              ),
            },
          },
        ]),
      ),
    ).rejects.toMatchObject({
      code: "VARIABLE_BOUND_TEXT_REJECTED",
    });
    expect(harness.loadFontAsync).not.toHaveBeenCalled();
    expect(harness.commitUndo).not.toHaveBeenCalled();
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("rejects a range-only typography change when the current range is not Neue Montreal", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const textNode = attachTextNode(harness, "inter-range", "MAT");
    textNode.fontName = { family: "Inter", style: "Regular" };

    await expect(
      engine.propose(
        proposal([
          {
            op: "set_text_range",
            nodeId: textNode.id,
            expectedFingerprint: fingerprintTextNode(textNode),
            start: 0,
            end: 3,
            typography: {
              fontSize: 18,
            },
          },
        ]),
      ),
    ).rejects.toMatchObject({
      code: "FONT_NOT_ALLOWED",
    });
    expect(harness.loadFontAsync).not.toHaveBeenCalled();
    expect(harness.commitUndo).not.toHaveBeenCalled();
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("migrates an out-of-policy style even when a locked component consumer is affected", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const component = {
      id: "consumer-component",
      name: "Consumer component",
      type: "COMPONENT",
      parent: harness.page,
      visible: true,
      locked: false,
      width: 320,
      height: 200,
      children: [],
      appendChild: vi.fn(),
    };
    const consumer = makeTextNode("locked-style-consumer");
    consumer.parent = component;
    consumer.characters = "Consumer";
    consumer.fontName = { family: "Inter", style: "Regular" };
    consumer.textStyleId = EXISTING_STYLE_ID;
    consumer.locked = true;
    component.children.push(consumer);
    harness.page.children.push(component);
    harness.nodes.set(component.id, component);
    harness.nodes.set(consumer.id, consumer);
    harness.existingStyle.fontName = {
      family: "Inter",
      style: "Regular",
    };
    harness.existingStyle.getStyleConsumersAsync.mockResolvedValue([
      {
        node: consumer,
        fields: ["textStyleId"],
      },
    ]);

    const pending = await engine.propose(
      proposal([
        {
          op: "update_text_style",
          styleId: EXISTING_STYLE_ID,
          expectedFingerprint: fingerprintTextStyle(harness.existingStyle),
          typography: {
            fontRole: "regular",
          },
        },
      ]),
    );
    const applied = await engine.approve(
      pending.patchId,
      pending.approvalDigest,
    );

    expect(applied).toMatchObject({
      status: "applied",
      result: {
        affectedNodeIds: [consumer.id],
      },
    });
    expect(harness.existingStyle.fontName).toEqual({
      family: "Neue Montreal",
      style: "Regular",
    });
    expect(harness.commitUndo).toHaveBeenCalledTimes(2);
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it("invalidates an empty text-node patch when a variable binding is added after proposal", async () => {
    const harness = installFigmaHarness();
    const engine = new PatchEngine(vi.fn());
    const textNode = attachTextNode(harness, "empty-stale-text", "");
    const pending = await engine.propose(
      proposal([
        {
          op: "bind_text_style",
          nodeId: textNode.id,
          expectedFingerprint: fingerprintTextNode(textNode),
          style: {
            kind: "existing",
            styleId: EXISTING_STYLE_ID,
            expectedFingerprint: fingerprintTextStyle(harness.existingStyle),
          },
        },
      ]),
    );
    textNode.boundVariables = {
      fontFamily: [{ type: "VARIABLE_ALIAS", id: "late-variable" }],
    };

    const result = await engine.approve(
      pending.patchId,
      pending.approvalDigest,
    );

    expect(result).toMatchObject({
      status: "stale",
      error: {
        code: "STALE_FINGERPRINT",
      },
    });
    expect(harness.loadFontAsync).not.toHaveBeenCalled();
    expect(harness.commitUndo).not.toHaveBeenCalled();
    expect(harness.triggerUndo).not.toHaveBeenCalled();
  });

  it.each(["create", "update"])(
    "rejects a MAT H1 %s using medium before any write",
    async (operationKind) => {
      const harness = installFigmaHarness();
      const engine = new PatchEngine(vi.fn());
      const operation =
        operationKind === "create"
          ? {
              op: "create_text_style",
              tempId: "invalid-h1",
              name: "MAT mobile/H1 Mobile",
              typography: {
                fontRole: "medium",
                fontSize: 48,
              },
            }
          : {
              op: "update_text_style",
              styleId: EXISTING_STYLE_ID,
              expectedFingerprint: fingerprintTextStyle(
                harness.existingStyle,
              ),
              name: "MAT desktop/H1 desktop",
              typography: {
                fontRole: "medium",
              },
            };

      await expect(
        engine.propose(proposal([operation])),
      ).rejects.toMatchObject({
        code: "SEMANTIC_FONT_ROLE_MISMATCH",
      });
      expect(harness.createTextStyle).not.toHaveBeenCalled();
      expect(harness.createText).not.toHaveBeenCalled();
      expect(harness.loadFontAsync).not.toHaveBeenCalled();
      expect(harness.commitUndo).not.toHaveBeenCalled();
      expect(harness.triggerUndo).not.toHaveBeenCalled();
      expect(harness.parent.exportAsync).not.toHaveBeenCalled();
    },
  );
});

function proposal(operations) {
  return {
    protocolVersion: 1,
    patchId: "patch-test",
    clientRequestId: "request-test",
    title: "Test typography patch",
    summary: "Exercise the local approval boundary.",
    fileKey: FILE_KEY,
    pageId: PAGE_ID,
    selectionIds: [],
    preview: {
      nodeId: PARENT_ID,
      maxDimension: 1_280,
    },
    createdAt: new Date(NOW).toISOString(),
    expiresAt: new Date(NOW + 5 * 60_000).toISOString(),
    operations,
  };
}

async function applyCreatedTextPatch(engine, harness) {
  const pending = await engine.propose(
    proposal([
      {
        op: "create_text_node",
        parentId: PARENT_ID,
        expectedParentFingerprint: fingerprintParent(harness.parent),
        tempId: "created-body",
        name: "Created body",
        characters: "Safe local typography",
        typography: {
          fontRole: "regular",
          fontSize: 16,
          lineHeight: { unit: "PIXELS", value: 24 },
        },
      },
    ]),
  );
  const result = await engine.approve(
    pending.patchId,
    pending.approvalDigest,
  );
  if (result.status === "applied") {
    engine.handleDocumentChanges([
      { id: "created-text-1", origin: "LOCAL", type: "CREATE" },
    ]);
  }
  return result;
}

function installFigmaHarness() {
  const page = {
    id: PAGE_ID,
    name: "Foundations",
    type: "PAGE",
    parent: null,
    children: [],
    selection: [],
  };
  const appendChild = vi.fn((node) => {
    node.parent = parent;
    if (!parent.children.includes(node)) {
      parent.children.push(node);
    }
  });
  const parent = {
    id: PARENT_ID,
    name: "Foundations",
    type: "FRAME",
    parent: page,
    visible: true,
    locked: false,
    width: 1_280,
    height: 720,
    children: [],
    exportAsync: vi.fn(async () => validPngBytes()),
    appendChild,
  };
  page.children.push(parent);
  const existingStyle = {
    id: EXISTING_STYLE_ID,
    key: "style-key",
    type: "TEXT",
    name: "Existing body",
    description: "Existing description",
    remote: false,
    fontName: { family: "Neue Montreal", style: "Regular" },
    fontSize: 16,
    lineHeight: { unit: "PIXELS", value: 24 },
    letterSpacing: { unit: "PERCENT", value: 0 },
    textCase: "ORIGINAL",
    textDecoration: "NONE",
    leadingTrim: "NONE",
    paragraphIndent: 0,
    paragraphSpacing: 0,
    listSpacing: 0,
    hangingPunctuation: false,
    hangingList: false,
    boundVariables: {},
    getStyleConsumersAsync: vi.fn(async () => []),
  };
  const nodes = new Map([
    [PAGE_ID, page],
    [PARENT_ID, parent],
  ]);
  const styles = new Map([[EXISTING_STYLE_ID, existingStyle]]);
  const createdNodes = [];
  const createdStyles = [];
  const createTextStyle = vi.fn(() => {
    const style = makeTextStyle(`created-style-${createdStyles.length + 1}`);
    styles.set(style.id, style);
    createdStyles.push(style);
    return style;
  });
  const createText = vi.fn(() => {
    const node = makeTextNode(`created-text-${createdNodes.length + 1}`);
    nodes.set(node.id, node);
    createdNodes.push(node);
    return node;
  });
  const commitUndo = vi.fn();
  const originalParentName = parent.name;
  const originalParentChildren = [...parent.children];
  const originalStyle = snapshotTextStyle(existingStyle);
  const restoreInitialState = () => {
    parent.name = originalParentName;
    parent.children.splice(0, parent.children.length, ...originalParentChildren);
    for (const child of originalParentChildren) {
      child.parent = parent;
    }
    for (const node of createdNodes) {
      nodes.delete(node.id);
      node.parent = null;
    }
    for (const style of createdStyles) {
      styles.delete(style.id);
    }
    Object.assign(existingStyle, cloneValue(originalStyle));
  };
  const triggerUndo = vi.fn(async () => {
    restoreInitialState();
  });
  const loadFontAsync = vi.fn(async () => undefined);

  Object.defineProperty(globalThis, "figma", {
    configurable: true,
    writable: true,
    value: {
      mixed: Symbol("figma.mixed"),
      fileKey: FILE_KEY,
      currentPage: page,
      getNodeByIdAsync: vi.fn(
        async (nodeId) => nodes.get(nodeId) ?? null,
      ),
      getStyleByIdAsync: vi.fn(
        async (styleId) => styles.get(styleId) ?? null,
      ),
      listAvailableFontsAsync: vi.fn(async () => [
        {
          fontName: { family: "Neue Montreal", style: "Regular" },
        },
        {
          fontName: { family: "Neue Montreal", style: "Medium" },
        },
        {
          fontName: { family: "Neue Montreal", style: "Bold" },
        },
      ]),
      loadAllPagesAsync: vi.fn(async () => undefined),
      loadFontAsync,
      createTextStyle,
      createText,
      commitUndo,
      triggerUndo,
    },
  });

  return {
    page,
    parent,
    existingStyle,
    nodes,
    styles,
    createdNodes,
    createdStyles,
    createTextStyle,
    createText,
    commitUndo,
    triggerUndo,
    loadFontAsync,
  };
}

function attachTextNode(harness, id, characters) {
  const node = makeTextNode(id);
  node.parent = harness.parent;
  node.characters = characters;
  node.fontName = { family: "Neue Montreal", style: "Regular" };
  harness.parent.children.push(node);
  harness.nodes.set(node.id, node);
  return node;
}

function attachFrameNode(harness, parent, id) {
  const node = {
    id,
    name: id,
    type: "FRAME",
    parent,
    visible: true,
    locked: false,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    relativeTransform: [
      [1, 0, 0],
      [0, 1, 0],
    ],
    children: [],
  };
  parent.children.push(node);
  harness.nodes.set(node.id, node);
  return node;
}

function matchTextNodeToStyle(node, style) {
  node.textStyleId = style.id;
  node.fontName = cloneValue(style.fontName);
  node.fontSize = style.fontSize;
  node.lineHeight = cloneValue(style.lineHeight);
  node.letterSpacing = cloneValue(style.letterSpacing);
  node.textCase = style.textCase;
  node.textDecoration = style.textDecoration;
  node.leadingTrim = style.leadingTrim;
  node.paragraphIndent = style.paragraphIndent;
  node.paragraphSpacing = style.paragraphSpacing;
  node.listSpacing = style.listSpacing;
  node.hangingPunctuation = style.hangingPunctuation;
  node.hangingList = style.hangingList;
}

function addTextStyleOverride(node) {
  const getBaseSegments = node.getStyledTextSegments.getMockImplementation();
  node.getStyledTextSegments.mockImplementation((...args) =>
    getBaseSegments(...args).map((segment) => ({
      ...segment,
      textStyleOverrides: [{ type: "SEMANTIC_WEIGHT" }],
    })),
  );
}

function addHyperlink(node) {
  const getBaseSegments = node.getStyledTextSegments.getMockImplementation();
  node.getStyledTextSegments.mockImplementation((...args) =>
    getBaseSegments(...args).map((segment) => ({
      ...segment,
      hyperlink: { type: "URL", value: "https://example.com" },
      textStyleOverrides: [
        ...segment.textStyleOverrides,
        { type: "HYPERLINK" },
      ],
    })),
  );
}

function makeTextNode(id) {
  const node = {
    id,
    name: "",
    type: "TEXT",
    parent: null,
    visible: true,
    locked: false,
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    characters: "",
    autoRename: true,
    textStyleId: "",
    fontName: { family: "Inter", style: "Regular" },
    fontSize: 12,
    lineHeight: { unit: "AUTO" },
    letterSpacing: { unit: "PERCENT", value: 0 },
    textCase: "ORIGINAL",
    textDecoration: "NONE",
    leadingTrim: "NONE",
    paragraphIndent: 0,
    paragraphSpacing: 0,
    listSpacing: 0,
    hangingPunctuation: false,
    hangingList: false,
    relativeTransform: [
      [1, 0, 0],
      [0, 1, 0],
    ],
    textAutoResize: "WIDTH_AND_HEIGHT",
    hasMissingFont: false,
    boundVariables: {},
    getStyledTextSegments: vi.fn((_fields, start = 0, end) => [
      {
        start,
        end: end ?? node.characters.length,
        fontName: node.fontName,
        fontSize: node.fontSize,
        fontWeight: 400,
        fontStyle: node.fontName.style,
        textStyleId: node.textStyleId,
        fillStyleId: "",
        lineHeight: node.lineHeight,
        letterSpacing: node.letterSpacing,
        textCase: node.textCase,
        textDecoration: node.textDecoration,
        textDecorationStyle: "SOLID",
        textDecorationOffset: { unit: "AUTO" },
        textDecorationThickness: { unit: "AUTO" },
        textDecorationColor: null,
        textDecorationSkipInk: true,
        fills: [],
        listOptions: { type: "NONE" },
        listSpacing: 0,
        indentation: 0,
        paragraphIndent: 0,
        paragraphSpacing: 0,
        hyperlink: null,
        boundVariables: {},
        textStyleOverrides: [],
        openTypeFeatures: {},
      },
    ]),
    setTextStyleIdAsync: vi.fn(async (styleId) => {
      node.textStyleId = styleId;
    }),
    getRangeTextStyleId: vi.fn(() => node.textStyleId),
    setRangeTextStyleIdAsync: vi.fn(async (_start, _end, styleId) => {
      node.textStyleId = styleId;
    }),
    getRangeFontName: vi.fn(() => node.fontName),
    setRangeFontName: vi.fn((_start, _end, fontName) => {
      node.fontName = fontName;
    }),
    getRangeFontSize: vi.fn(() => node.fontSize),
    setRangeFontSize: vi.fn((_start, _end, fontSize) => {
      node.fontSize = fontSize;
    }),
    getRangeLineHeight: vi.fn(() => node.lineHeight),
    setRangeLineHeight: vi.fn((_start, _end, lineHeight) => {
      node.lineHeight = lineHeight;
    }),
    getRangeLetterSpacing: vi.fn(() => node.letterSpacing),
    setRangeLetterSpacing: vi.fn((_start, _end, letterSpacing) => {
      node.letterSpacing = letterSpacing;
    }),
    getRangeTextCase: vi.fn(() => node.textCase),
    setRangeTextCase: vi.fn((_start, _end, textCase) => {
      node.textCase = textCase;
    }),
    getRangeTextDecoration: vi.fn(() => node.textDecoration),
    setRangeTextDecoration: vi.fn((_start, _end, textDecoration) => {
      node.textDecoration = textDecoration;
    }),
    insertCharacters: vi.fn((start, characters) => {
      node.characters =
        node.characters.slice(0, start) +
        characters +
        node.characters.slice(start);
    }),
    deleteCharacters: vi.fn((start, end) => {
      node.characters =
        node.characters.slice(0, start) + node.characters.slice(end);
    }),
    resize: vi.fn((width, height) => {
      node.width = width;
      node.height = height;
    }),
  };
  return node;
}

function makeTextStyle(id) {
  return {
    id,
    key: `${id}-key`,
    type: "TEXT",
    name: "",
    description: "",
    remote: false,
    fontName: { family: "Neue Montreal", style: "Regular" },
    fontSize: 16,
    lineHeight: { unit: "AUTO" },
    letterSpacing: { unit: "PERCENT", value: 0 },
    textCase: "ORIGINAL",
    textDecoration: "NONE",
    leadingTrim: "NONE",
    paragraphIndent: 0,
    paragraphSpacing: 0,
    listSpacing: 0,
    hangingPunctuation: false,
    hangingList: false,
    boundVariables: {},
    getStyleConsumersAsync: vi.fn(async () => []),
  };
}

function snapshotTextStyle(style) {
  return {
    name: style.name,
    description: style.description,
    fontName: cloneValue(style.fontName),
    fontSize: style.fontSize,
    lineHeight: cloneValue(style.lineHeight),
    letterSpacing: cloneValue(style.letterSpacing),
    textCase: style.textCase,
    textDecoration: style.textDecoration,
  };
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function validPngBytes(width = 2, height = 1) {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  bytes.set([73, 72, 68, 82], 12);
  writeUint32BigEndian(bytes, 16, width);
  writeUint32BigEndian(bytes, 20, height);
  return bytes;
}

function writeUint32BigEndian(bytes, offset, value) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}
