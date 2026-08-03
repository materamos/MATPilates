import { describe, expect, it } from "vitest";

import {
  MAX_PATCH_CHARACTERS,
  MAX_PATCH_NODES,
  MAX_PATCH_OPERATIONS,
  PATCH_TTL_MS,
  PROTOCOL_VERSION,
} from "../shared/constants.js";
import {
  buildPatchProposal,
  PatchProposalInputSchema,
  ResponseMessageSchema,
  ToolInputs,
  ToolOutputSchemas,
} from "../shared/protocol.js";

const FINGERPRINT = "a".repeat(64);

function createTextStyleOperation(index = 0) {
  return {
    op: "create_text_style",
    tempId: `style-${index}`,
    name: `Desktop/Body ${index}`,
    typography: {
      fontRole: "regular",
      fontSize: 16,
    },
  };
}

function patchInput(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    title: "Normalize MAT typography",
    summary: "Bind the selected text to an approved local text style.",
    fileKey: "MAT-file-key",
    pageId: "66:11",
    selectionIds: [],
    preview: {
      nodeId: "66:11",
      maxDimension: 1_280,
    },
    operations: [createTextStyleOperation()],
    ...overrides,
  };
}

describe("typography patch protocol", () => {
  it("requires a post-apply preview target in every proposal", () => {
    const { preview: _preview, ...withoutPreview } = patchInput();
    expect(PatchProposalInputSchema.safeParse(withoutPreview).success).toBe(
      false,
    );
  });

  it("allows export_preview to use the current single-node selection", () => {
    expect(ToolInputs.exportPreview.parse({})).toEqual({
      maxDimension: 1_280,
    });
  });

  it("requires mutually exclusive success and error response fields", () => {
    expect(
      ResponseMessageSchema.safeParse({
        v: PROTOCOL_VERSION,
        type: "response",
        id: "request-1",
        ok: true,
      }).success,
    ).toBe(false);
    expect(
      ResponseMessageSchema.safeParse({
        v: PROTOCOL_VERSION,
        type: "response",
        id: "request-1",
        ok: false,
      }).success,
    ).toBe(false);
  });

  it("rejects incomplete structured status output", () => {
    expect(
      ToolOutputSchemas.status.safeParse({
        ok: true,
        data: {
          bridge: {
            connected: false,
          },
          plugin: null,
        },
      }).success,
    ).toBe(false);
  });

  it.each([
    ["semibold alias", "semibold"],
    ["numeric weight", 600],
    ["raw Figma style", "SemiBold"],
  ])("rejects an unsupported fontRole expressed as %s", (_label, fontRole) => {
    const proposal = patchInput({
      operations: [
        {
          ...createTextStyleOperation(),
          typography: {
            fontRole,
          },
        },
      ],
    });

    expect(PatchProposalInputSchema.safeParse(proposal).success).toBe(false);
  });

  it("rejects a raw fontStyle property even when its value names an installed style", () => {
    const proposal = patchInput({
      operations: [
        {
          ...createTextStyleOperation(),
          typography: {
            fontStyle: "SemiBold",
          },
        },
      ],
    });

    expect(PatchProposalInputSchema.safeParse(proposal).success).toBe(false);
  });

  it.each([
    [
      "proposal",
      patchInput({
        arbitraryJavaScript: "figma.currentPage.remove()",
      }),
    ],
    [
      "operation",
      patchInput({
        operations: [
          {
            ...createTextStyleOperation(),
            deleteExistingStyle: true,
          },
        ],
      }),
    ],
    [
      "typography",
      patchInput({
        operations: [
          {
            ...createTextStyleOperation(),
            typography: {
              fontRole: "regular",
              rawFontName: {
                family: "Another Family",
                style: "Regular",
              },
            },
          },
        ],
      }),
    ],
  ])("rejects unknown properties at the %s level", (_level, proposal) => {
    expect(PatchProposalInputSchema.safeParse(proposal).success).toBe(false);
  });

  it.each([
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
  ])("rejects %s in numeric typography properties", (_label, fontSize) => {
    const proposal = patchInput({
      operations: [
        {
          ...createTextStyleOperation(),
          typography: {
            fontRole: "regular",
            fontSize,
          },
        },
      ],
    });

    expect(PatchProposalInputSchema.safeParse(proposal).success).toBe(false);
  });

  it("rejects more than 100 operations", () => {
    const proposal = patchInput({
      operations: Array.from(
        { length: MAX_PATCH_OPERATIONS + 1 },
        (_, index) => createTextStyleOperation(index),
      ),
    });

    expect(PatchProposalInputSchema.safeParse(proposal).success).toBe(false);
  });

  it("rejects more than 500 aggregate direct targets", () => {
    const selectionIds = Array.from(
      { length: MAX_PATCH_NODES },
      (_, index) => `selection-${index}`,
    );
    const proposal = patchInput({
      selectionIds,
      operations: [
        {
          op: "bind_text_style",
          nodeId: "one-more-target",
          expectedFingerprint: FINGERPRINT,
          style: {
            kind: "existing",
            styleId: "style-existing",
            expectedFingerprint: FINGERPRINT,
          },
        },
      ],
    });

    const result = PatchProposalInputSchema.safeParse(proposal);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: `A patch may affect at most ${MAX_PATCH_NODES} direct nodes.`,
          }),
        ]),
      );
    }
  });

  it.each([
    ["empty", 4, 4],
    ["inverted", 8, 3],
  ])("rejects an %s text range", (_label, start, end) => {
    const proposal = patchInput({
      operations: [
        {
          op: "set_text_range",
          nodeId: "375:12",
          expectedFingerprint: FINGERPRINT,
          start,
          end,
          typography: {
            fontRole: "medium",
          },
        },
      ],
    });

    expect(PatchProposalInputSchema.safeParse(proposal).success).toBe(false);
  });

  it("rejects a text range with an empty typography object", () => {
    const proposal = patchInput({
      operations: [
        {
          op: "set_text_range",
          nodeId: "375:12",
          expectedFingerprint: FINGERPRINT,
          start: 0,
          end: 4,
          typography: {},
        },
      ],
    });

    expect(PatchProposalInputSchema.safeParse(proposal).success).toBe(false);
  });

  it("accepts a fingerprinted text-box width operation", () => {
    const proposal = patchInput({
      operations: [
        {
          op: "set_text_box_width",
          nodeId: "860:142",
          expectedFingerprint: FINGERPRINT,
          width: 680,
        },
      ],
    });

    expect(PatchProposalInputSchema.safeParse(proposal).success).toBe(true);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid text-box width of %s",
    (width) => {
      const proposal = patchInput({
        operations: [
          {
            op: "set_text_box_width",
            nodeId: "860:142",
            expectedFingerprint: FINGERPRINT,
            width,
          },
        ],
      });

      expect(PatchProposalInputSchema.safeParse(proposal).success).toBe(false);
    },
  );

  it("rejects overlapping ranges on the same text node", () => {
    const proposal = patchInput({
      operations: [
        {
          op: "set_text_range",
          nodeId: "375:12",
          expectedFingerprint: FINGERPRINT,
          start: 0,
          end: 8,
          typography: { fontRole: "regular" },
        },
        {
          op: "set_text_range",
          nodeId: "375:12",
          expectedFingerprint: FINGERPRINT,
          start: 7,
          end: 12,
          typography: { fontRole: "medium" },
        },
      ],
    });

    expect(PatchProposalInputSchema.safeParse(proposal).success).toBe(false);
  });

  it("rejects patches carrying more than the aggregate character limit", () => {
    const characters = "a".repeat(20_000);
    const proposal = patchInput({
      operations: Array.from({ length: 6 }, (_, index) => ({
        op: "create_text_node",
        parentId: `parent-${index}`,
        expectedParentFingerprint: FINGERPRINT,
        tempId: `node-${index}`,
        characters,
        typography: { fontRole: "regular" },
      })),
    });

    const result = PatchProposalInputSchema.safeParse(proposal);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: `A patch may carry at most ${MAX_PATCH_CHARACTERS} UTF-16 code units.`,
          }),
        ]),
      );
    }
  });

  it("builds a protocol v1 proposal with the exact five-minute TTL", () => {
    const now = new Date("2026-07-24T12:00:00.000Z");
    const input = PatchProposalInputSchema.parse(patchInput());

    const proposal = buildPatchProposal(
      input,
      {
        patchId: "patch-1",
        clientRequestId: "client-request-1",
      },
      now,
    );

    expect(PROTOCOL_VERSION).toBe(1);
    expect(proposal).toMatchObject({
      protocolVersion: 1,
      patchId: "patch-1",
      clientRequestId: "client-request-1",
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + PATCH_TTL_MS).toISOString(),
    });
    expect(
      Date.parse(proposal.expiresAt) - Date.parse(proposal.createdAt),
    ).toBe(PATCH_TTL_MS);
  });
});
