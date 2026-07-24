import * as z from "zod/v4";

import {
  MAX_AUDIT_TEXT_NODES,
  MAX_JSON_MESSAGE_BYTES,
  MAX_PATCH_CHARACTERS,
  MAX_PATCH_NODES,
  MAX_PATCH_OPERATIONS,
  MAX_PREVIEW_BYTES,
  MAX_PREVIEW_DIMENSION,
  PATCH_TTL_MS,
  PROTOCOL_VERSION,
} from "./constants.js";
import { utf8ByteLength } from "./utf8.js";

const IdSchema = z.string().min(1).max(128);
const FingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/);
const FiniteNumberSchema = z.number().finite();

export const FontRoleSchema = z.enum(["regular", "medium", "bold"]);
export type FontRole = z.infer<typeof FontRoleSchema>;

export const LineHeightSchema = z.discriminatedUnion("unit", [
  z.object({ unit: z.literal("AUTO") }).strict(),
  z
    .object({
      unit: z.enum(["PIXELS", "PERCENT"]),
      value: FiniteNumberSchema.min(0).max(1_000),
    })
    .strict(),
]);

export const LetterSpacingSchema = z
  .object({
    unit: z.enum(["PIXELS", "PERCENT"]),
    value: FiniteNumberSchema.min(-100).max(1_000),
  })
  .strict();

export const TypographyPropertiesSchema = z
  .object({
    fontRole: FontRoleSchema.optional(),
    fontSize: FiniteNumberSchema.min(1).max(512).optional(),
    lineHeight: LineHeightSchema.optional(),
    letterSpacing: LetterSpacingSchema.optional(),
    textCase: z
      .enum([
        "ORIGINAL",
        "UPPER",
        "LOWER",
        "TITLE",
        "SMALL_CAPS",
        "SMALL_CAPS_FORCED",
      ])
      .optional(),
    textDecoration: z.enum(["NONE", "UNDERLINE", "STRIKETHROUGH"]).optional(),
  })
  .strict();

export type TypographyProperties = z.infer<typeof TypographyPropertiesSchema>;

export const StyleReferenceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("existing"),
      styleId: IdSchema,
      expectedFingerprint: FingerprintSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("created"),
      tempId: IdSchema,
    })
    .strict(),
]);

const CreateTextStyleOperationSchema = z
  .object({
    op: z.literal("create_text_style"),
    tempId: IdSchema,
    name: z.string().min(1).max(256),
    description: z.string().max(1_000).optional(),
    typography: TypographyPropertiesSchema,
  })
  .strict();

const UpdateTextStyleOperationSchema = z
  .object({
    op: z.literal("update_text_style"),
    styleId: IdSchema,
    expectedFingerprint: FingerprintSchema,
    name: z.string().min(1).max(256).optional(),
    description: z.string().max(1_000).optional(),
    typography: TypographyPropertiesSchema.optional(),
  })
  .strict();

const BindTextStyleOperationSchema = z
  .object({
    op: z.literal("bind_text_style"),
    nodeId: IdSchema,
    expectedFingerprint: FingerprintSchema,
    style: StyleReferenceSchema,
  })
  .strict();

const SetTextRangeOperationSchema = z
  .object({
    op: z.literal("set_text_range"),
    nodeId: IdSchema,
    expectedFingerprint: FingerprintSchema,
    start: z.number().int().min(0),
    end: z.number().int().min(0),
    style: StyleReferenceSchema.optional(),
    typography: TypographyPropertiesSchema.optional(),
  })
  .strict()
  .refine((operation) => operation.end > operation.start, {
    message: "Range end must be greater than start.",
  })
  .refine((operation) => operation.style || operation.typography, {
    message: "A range operation needs a style or typography properties.",
  });

const SetCharactersOperationSchema = z
  .object({
    op: z.literal("set_characters"),
    nodeId: IdSchema,
    expectedFingerprint: FingerprintSchema,
    characters: z.string().max(20_000),
  })
  .strict();

const CreateTextNodeOperationSchema = z
  .object({
    op: z.literal("create_text_node"),
    parentId: IdSchema,
    expectedParentFingerprint: FingerprintSchema,
    tempId: IdSchema,
    name: z.string().min(1).max(256).optional(),
    characters: z.string().max(20_000),
    x: FiniteNumberSchema.optional(),
    y: FiniteNumberSchema.optional(),
    width: FiniteNumberSchema.min(1).max(100_000).optional(),
    style: StyleReferenceSchema.optional(),
    typography: TypographyPropertiesSchema.optional(),
  })
  .strict();

export const PatchOperationSchema = z.discriminatedUnion("op", [
  CreateTextStyleOperationSchema,
  UpdateTextStyleOperationSchema,
  BindTextStyleOperationSchema,
  SetTextRangeOperationSchema,
  SetCharactersOperationSchema,
  CreateTextNodeOperationSchema,
]);

export type PatchOperation = z.infer<typeof PatchOperationSchema>;

export const PatchProposalInputSchema = z
  .object({
    title: z.string().min(1).max(120),
    summary: z.string().min(1).max(1_000),
    fileKey: IdSchema,
    pageId: IdSchema,
    selectionIds: z.array(IdSchema).max(MAX_PATCH_NODES).default([]),
    operations: z.array(PatchOperationSchema).min(1).max(MAX_PATCH_OPERATIONS),
  })
  .strict()
  .superRefine((proposal, context) => {
    const nodeIds = new Set<string>(proposal.selectionIds);
    const rangesByNode = new Map<
      string,
      Array<{ start: number; end: number; operationIndex: number }>
    >();
    let totalCharacters = 0;
    for (const [operationIndex, operation] of proposal.operations.entries()) {
      if ("nodeId" in operation) nodeIds.add(operation.nodeId);
      if ("parentId" in operation) nodeIds.add(operation.parentId);
      if (
        operation.op === "set_characters" ||
        operation.op === "create_text_node"
      ) {
        totalCharacters += operation.characters.length;
      }
      if (operation.op === "set_text_range") {
        const ranges = rangesByNode.get(operation.nodeId) ?? [];
        ranges.push({
          start: operation.start,
          end: operation.end,
          operationIndex,
        });
        rangesByNode.set(operation.nodeId, ranges);
      }
    }
    if (nodeIds.size > MAX_PATCH_NODES) {
      context.addIssue({
        code: "custom",
        message: `A patch may affect at most ${MAX_PATCH_NODES} direct nodes.`,
      });
    }
    if (totalCharacters > MAX_PATCH_CHARACTERS) {
      context.addIssue({
        code: "custom",
        message: `A patch may carry at most ${MAX_PATCH_CHARACTERS} UTF-16 code units.`,
      });
    }
    for (const [nodeId, ranges] of rangesByNode) {
      ranges.sort((left, right) => left.start - right.start);
      for (let index = 1; index < ranges.length; index += 1) {
        const previous = ranges[index - 1];
        const current = ranges[index];
        if (current.start < previous.end) {
          context.addIssue({
            code: "custom",
            path: ["operations", current.operationIndex],
            message: `Text ranges for node ${nodeId} must not overlap.`,
          });
        }
      }
    }
  });

export type PatchProposalInput = z.infer<typeof PatchProposalInputSchema>;

export const PatchProposalSchema = PatchProposalInputSchema.extend({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  patchId: IdSchema,
  clientRequestId: IdSchema,
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
}).strict();

export type PatchProposal = z.infer<typeof PatchProposalSchema>;

export const PatchStatusSchema = z.enum([
  "pending_approval",
  "applying",
  "applied",
  "rejected",
  "cancelled",
  "expired",
  "stale",
  "failed_rolled_back",
  "failed_rollback",
  "indeterminate",
]);
export type PatchStatus = z.infer<typeof PatchStatusSchema>;

export const PublicErrorCodeSchema = z.enum([
  "PLUGIN_DISCONNECTED",
  "PAIRING_REQUIRED",
  "PAIRING_RATE_LIMITED",
  "PROTOCOL_MISMATCH",
  "PLUGIN_BUSY",
  "REQUEST_TIMEOUT",
  "REQUEST_CANCELLED",
  "PATCH_NOT_FOUND",
  "PATCH_EXPIRED",
  "PATCH_STALE",
  "PATCH_ALREADY_TERMINAL",
  "FONT_UNAVAILABLE",
  "UNSUPPORTED_FONT_STYLE",
  "INVALID_PLUGIN_RESPONSE",
  "PREVIEW_TOO_LARGE",
  "FIGMA_OPERATION_FAILED",
  "ROLLBACK_FAILED",
  "INTERNAL_ERROR",
]);
export type PublicErrorCode = z.infer<typeof PublicErrorCodeSchema>;

export const PublicErrorSchema = z
  .object({
    code: PublicErrorCodeSchema,
    message: z.string().min(1).max(2_000),
    retryable: z.boolean(),
    correlationId: IdSchema.optional(),
  })
  .strict();

export function resultEnvelopeSchema<T extends z.ZodType>(
  dataSchema: T,
) {
  return z
    .object({
      ok: z.boolean(),
      data: dataSchema.optional(),
      error: PublicErrorSchema.optional(),
    })
    .strict()
    .superRefine((envelope, context) => {
      if (
        envelope.ok &&
        (envelope.data === undefined || envelope.error !== undefined)
      ) {
        context.addIssue({
          code: "custom",
          message: "A successful result requires data and forbids error.",
        });
      }
      if (
        !envelope.ok &&
        (envelope.error === undefined || envelope.data !== undefined)
      ) {
        context.addIssue({
          code: "custom",
          message: "A failed result requires error and forbids data.",
        });
      }
    });
}

export type ResultEnvelope<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: z.infer<typeof PublicErrorSchema> };

export const PluginMethodSchema = z.enum([
  "status",
  "get_selection",
  "get_node",
  "list_fonts",
  "list_text_styles",
  "audit_typography",
  "export_preview",
  "propose_patch",
  "get_patch_status",
  "cancel_patch",
]);
export type PluginMethod = z.infer<typeof PluginMethodSchema>;

export const RequestMessageSchema = z
  .object({
    v: z.literal(PROTOCOL_VERSION),
    type: z.literal("request"),
    id: IdSchema,
    method: PluginMethodSchema,
    payload: z.json(),
  })
  .strict();

export const ResponseMessageSchema = z.discriminatedUnion("ok", [
  z
    .object({
      v: z.literal(PROTOCOL_VERSION),
      type: z.literal("response"),
      id: IdSchema,
      ok: z.literal(true),
      result: z.json(),
    })
    .strict(),
  z
    .object({
      v: z.literal(PROTOCOL_VERSION),
      type: z.literal("response"),
      id: IdSchema,
      ok: z.literal(false),
      error: PublicErrorSchema,
    })
    .strict(),
]);

export const EventMessageSchema = z
  .object({
    v: z.literal(PROTOCOL_VERSION),
    type: z.literal("event"),
    event: z.enum(["plugin_state", "patch_status", "heartbeat"]),
    payload: z.json(),
  })
  .strict();

export const AuthMessageSchema = z.discriminatedUnion("mode", [
  z
    .object({
      v: z.literal(PROTOCOL_VERSION),
      type: z.literal("auth"),
      mode: z.literal("pair"),
      code: z.string().regex(/^\d{6}$/),
      pluginInstallationId: IdSchema,
    })
    .strict(),
  z
    .object({
      v: z.literal(PROTOCOL_VERSION),
      type: z.literal("auth"),
      mode: z.literal("token"),
      token: z.string().min(32).max(256),
      pluginInstallationId: IdSchema,
    })
    .strict(),
]);

export const AuthResultMessageSchema = z.discriminatedUnion("ok", [
  z
    .object({
      v: z.literal(PROTOCOL_VERSION),
      type: z.literal("auth_result"),
      ok: z.literal(true),
      token: z.string().min(32).max(256).optional(),
    })
    .strict(),
  z
    .object({
      v: z.literal(PROTOCOL_VERSION),
      type: z.literal("auth_result"),
      ok: z.literal(false),
      error: PublicErrorSchema,
    })
    .strict(),
]);

export type RequestMessage = z.infer<typeof RequestMessageSchema>;
export type ResponseMessage = z.infer<typeof ResponseMessageSchema>;
export type EventMessage = z.infer<typeof EventMessageSchema>;
export type AuthMessage = z.infer<typeof AuthMessageSchema>;
export type AuthResultMessage = z.infer<typeof AuthResultMessageSchema>;

export const ToolInputs = {
  status: z.object({}).strict(),
  pairingCode: z.object({}).strict(),
  getSelection: z
    .object({ includeCharacters: z.boolean().default(false) })
    .strict(),
  getNode: z
    .object({
      nodeId: IdSchema,
      includeCharacters: z.boolean().default(false),
    })
    .strict(),
  listFonts: z
    .object({ family: z.string().min(1).max(128).optional() })
    .strict(),
  listTextStyles: z.object({}).strict(),
  auditTypography: z
    .object({
      scope: z.enum(["selection", "node", "current_page"]),
      nodeId: IdSchema.optional(),
    })
    .strict()
    .refine((input) => input.scope !== "node" || input.nodeId, {
      message: "nodeId is required for node scope.",
    }),
  exportPreview: z
    .object({
      nodeId: IdSchema,
      maxDimension: z.number().int().min(64).max(MAX_PREVIEW_DIMENSION).default(1_280),
    })
    .strict(),
  proposePatch: PatchProposalInputSchema,
  getPatchStatus: z
    .object({
      patchId: IdSchema,
      waitMs: z.number().int().min(0).max(30_000).default(0),
    })
    .strict(),
  cancelPatch: z.object({ patchId: IdSchema }).strict(),
} as const;

const TimestampMsSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const DimensionSchema = FiniteNumberSchema.nonnegative().max(1_000_000_000);
const NodeTypeSchema = z.string().min(1).max(64);
const NodeNameSchema = z.string().max(10_000);
const CanonicalValueSchema = z.json();

export const FontAvailabilitySchema = z
  .object({
    role: FontRoleSchema,
    family: z.string().min(1).max(128),
    style: z.string().min(1).max(128),
    available: z.boolean(),
  })
  .strict();

export const PatchStatusSnapshotSchema = z
  .object({
    patchId: IdSchema,
    approvalDigest: FingerprintSchema,
    status: PatchStatusSchema,
    updatedAt: TimestampMsSchema,
    summary: z
      .object({
        patchId: IdSchema,
        title: z.string().min(1).max(200),
        detail: z.string().min(1).max(2_000),
        operationCount: z.number().int().min(1).max(MAX_PATCH_OPERATIONS),
        styleChanges: z.number().int().nonnegative().max(MAX_PATCH_OPERATIONS),
        nodeChanges: z.number().int().nonnegative().max(MAX_PATCH_OPERATIONS),
        globalStyleUpdates: z
          .number()
          .int()
          .nonnegative()
          .max(MAX_PATCH_OPERATIONS),
        impactedNodes: z.number().int().nonnegative().max(MAX_PATCH_NODES),
        expiresAt: TimestampMsSchema,
        warnings: z.array(z.string().max(500)).max(20),
        operationDetails: z
          .array(z.string().min(1).max(2_000))
          .min(1)
          .max(MAX_PATCH_OPERATIONS),
      })
      .strict(),
    result: z
      .object({
        operationCount: z.number().int().min(1).max(MAX_PATCH_OPERATIONS),
        affectedNodeIds: z.array(IdSchema).max(MAX_PATCH_NODES),
        dimensionChanges: z
          .array(
            z
              .object({
                nodeId: IdSchema,
                before: z
                  .object({
                    width: DimensionSchema,
                    height: DimensionSchema,
                  })
                  .strict(),
                after: z
                  .object({
                    width: DimensionSchema,
                    height: DimensionSchema,
                  })
                  .strict(),
              })
              .strict(),
          )
          .max(MAX_PATCH_NODES),
        createdStyleIds: z.array(IdSchema).max(MAX_PATCH_OPERATIONS),
        createdNodeIds: z.array(IdSchema).max(MAX_PATCH_OPERATIONS),
        warnings: z.array(z.string().max(500)).max(20),
      })
      .strict()
      .optional(),
    error: z
      .object({
        code: z.string().min(1).max(128),
        message: z.string().min(1).max(2_000),
        details: z.json().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (snapshot.summary.patchId !== snapshot.patchId) {
      context.addIssue({
        code: "custom",
        path: ["summary", "patchId"],
        message: "Patch summary ID must match the patch ID.",
      });
    }
    if (
      snapshot.summary.operationDetails.length !==
      snapshot.summary.operationCount
    ) {
      context.addIssue({
        code: "custom",
        path: ["summary", "operationDetails"],
        message: "Patch operation details must cover every operation.",
      });
    }
    if (
      snapshot.summary.styleChanges + snapshot.summary.nodeChanges !==
      snapshot.summary.operationCount
    ) {
      context.addIssue({
        code: "custom",
        path: ["summary"],
        message: "Patch summary counts are inconsistent.",
      });
    }
    if (snapshot.status === "applied" && snapshot.result === undefined) {
      context.addIssue({
        code: "custom",
        path: ["result"],
        message: "An applied patch requires a result.",
      });
    }
    if (snapshot.status !== "applied" && snapshot.result !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["result"],
        message: "Only an applied patch may include a result.",
      });
    }
    if (
      [
        "expired",
        "stale",
        "failed_rolled_back",
        "failed_rollback",
        "indeterminate",
      ].includes(snapshot.status) &&
      snapshot.error === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["error"],
        message: "This terminal patch state requires an error.",
      });
    }
  });

const PluginStatusResultSchema = z
  .object({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    plugin: z
      .object({
        name: z.literal("MAT — Codex Bridge"),
        version: z.literal("0.1.0"),
      })
      .strict(),
    file: z
      .object({
        key: IdSchema.nullable(),
        name: NodeNameSchema,
        page: z
          .object({
            id: IdSchema,
            name: NodeNameSchema,
          })
          .strict(),
      })
      .strict(),
    selection: z
      .object({
        nodeIds: z.array(IdSchema).max(10_000),
        count: z.number().int().nonnegative().max(10_000),
        textCount: z
          .number()
          .int()
          .nonnegative()
          .max(MAX_AUDIT_TEXT_NODES + 1),
      })
      .strict(),
    fonts: z.array(FontAvailabilitySchema).max(3),
    pendingPatch: PatchStatusSnapshotSchema.nullable(),
    latestPatch: PatchStatusSnapshotSchema.nullable(),
    writeBlocked: z.boolean(),
  })
  .strict();

const TextSegmentSnapshotSchema = z
  .object({
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    fontName: CanonicalValueSchema,
    fontSize: CanonicalValueSchema,
    fontWeight: CanonicalValueSchema,
    fontStyle: CanonicalValueSchema,
    textStyleId: CanonicalValueSchema,
    fillStyleId: CanonicalValueSchema,
    lineHeight: CanonicalValueSchema,
    letterSpacing: CanonicalValueSchema,
    textCase: CanonicalValueSchema,
    textDecoration: CanonicalValueSchema,
    textDecorationStyle: CanonicalValueSchema,
    textDecorationOffset: CanonicalValueSchema,
    textDecorationThickness: CanonicalValueSchema,
    textDecorationColor: CanonicalValueSchema,
    textDecorationSkipInk: CanonicalValueSchema,
    fills: CanonicalValueSchema,
    listOptions: CanonicalValueSchema,
    listSpacing: CanonicalValueSchema,
    indentation: CanonicalValueSchema,
    paragraphIndent: CanonicalValueSchema,
    paragraphSpacing: CanonicalValueSchema,
    hyperlink: CanonicalValueSchema,
    boundVariables: CanonicalValueSchema,
    textStyleOverrides: CanonicalValueSchema,
    openTypeFeatures: CanonicalValueSchema,
  })
  .strict()
  .refine((segment) => segment.end >= segment.start, {
    message: "Text segment end must not precede start.",
  });

const TextNodeSnapshotSchema = z
  .object({
    id: IdSchema,
    parentId: IdSchema.nullable(),
    type: z.literal("TEXT"),
    name: NodeNameSchema,
    visible: z.boolean(),
    locked: z.boolean(),
    characters: z.string().max(MAX_JSON_MESSAGE_BYTES).optional(),
    characterCount: z.number().int().nonnegative(),
    characterPreview: z.string().max(120).optional(),
    truncatedPreview: z.boolean().optional(),
    textStyleId: CanonicalValueSchema,
    fontName: CanonicalValueSchema,
    fontSize: CanonicalValueSchema,
    lineHeight: CanonicalValueSchema,
    letterSpacing: CanonicalValueSchema,
    textAutoResize: z.string().min(1).max(64),
    width: DimensionSchema,
    height: DimensionSchema,
    hasMissingFont: z.boolean(),
    segments: z.array(TextSegmentSnapshotSchema).max(20_000),
    fingerprint: FingerprintSchema,
  })
  .strict();

const SelectionNodeSnapshotSchema = z
  .object({
    id: IdSchema,
    parentId: IdSchema.nullable(),
    type: NodeTypeSchema,
    name: NodeNameSchema,
    visible: z.boolean(),
    locked: z.boolean(),
    width: DimensionSchema,
    height: DimensionSchema,
  })
  .strict();

const SceneNodeSnapshotSchema = SelectionNodeSnapshotSchema.extend({
  descendantTextNodeIds: z.array(IdSchema).max(MAX_AUDIT_TEXT_NODES),
}).strict();

const BaseNodeSnapshotSchema = z
  .object({
    id: IdSchema,
    parentId: IdSchema.nullable(),
    type: NodeTypeSchema,
    name: NodeNameSchema,
  })
  .strict();

export const SelectionSnapshotSchema = z
  .object({
    fileKey: IdSchema.nullable(),
    page: z
      .object({
        id: IdSchema,
        name: NodeNameSchema,
      })
      .strict(),
    selectedNodeIds: z.array(IdSchema).max(10_000),
    nodes: z.array(SelectionNodeSnapshotSchema).max(200),
    textNodes: z.array(TextNodeSnapshotSchema).max(200),
    textNodeCount: z
      .number()
      .int()
      .nonnegative()
      .max(MAX_AUDIT_TEXT_NODES + 1),
    detailsTruncated: z.boolean(),
    selectionDetailsTruncated: z.boolean(),
  })
  .strict();

export const NodeSnapshotSchema = z.union([
  TextNodeSnapshotSchema,
  SceneNodeSnapshotSchema,
  BaseNodeSnapshotSchema,
]);

export const FontListResultSchema = z
  .object({
    family: z.literal("Neue Montreal"),
    fonts: z.array(FontAvailabilitySchema).max(3),
  })
  .strict();

const TextStyleSnapshotSchema = z
  .object({
    id: IdSchema,
    key: z.string().max(256),
    name: NodeNameSchema,
    description: z.string().max(10_000),
    remote: z.boolean(),
    fontName: CanonicalValueSchema,
    fontRole: FontRoleSchema.nullable(),
    fontSize: FiniteNumberSchema,
    lineHeight: CanonicalValueSchema,
    letterSpacing: CanonicalValueSchema,
    textCase: z.string().min(1).max(64),
    textDecoration: z.string().min(1).max(64),
    fingerprint: FingerprintSchema,
  })
  .strict();

export const TextStyleListResultSchema = z
  .object({
    styles: z.array(TextStyleSnapshotSchema).max(10_000),
  })
  .strict();

export const TypographyAuditResultSchema = z
  .object({
    fileKey: IdSchema.nullable(),
    page: z
      .object({
        id: IdSchema,
        name: NodeNameSchema,
      })
      .strict(),
    scope: z
      .object({
        scope: z.enum(["selection", "node", "current_page"]),
        nodeId: IdSchema.optional(),
      })
      .strict(),
    totals: z
      .object({
        textNodes: z.number().int().nonnegative().max(MAX_AUDIT_TEXT_NODES),
        localTextStyles: z.number().int().nonnegative().max(100_000),
        fullyBoundNodes: z.number().int().nonnegative().max(MAX_AUDIT_TEXT_NODES),
        unboundNodes: z.number().int().nonnegative().max(MAX_AUDIT_TEXT_NODES),
        mixedStyleNodes: z.number().int().nonnegative().max(MAX_AUDIT_TEXT_NODES),
        mixedFontNodes: z.number().int().nonnegative().max(MAX_AUDIT_TEXT_NODES),
        linkedLocalStyles: z.number().int().nonnegative().max(100_000),
      })
      .strict(),
    fonts: z
      .array(
        z
          .object({
            family: z.string().max(128),
            style: z.string().max(128),
            role: FontRoleSchema.nullable(),
            runs: z.number().int().positive(),
            characters: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .max(10_000),
    anomalies: z
      .array(
        z
          .object({
            nodeId: IdSchema,
            kind: z.string().min(1).max(128),
            detail: z.string().min(1).max(1_000),
          })
          .strict(),
      )
      .max(200),
    anomaliesTruncated: z.boolean(),
    anomalyCount: z.number().int().nonnegative(),
    nodes: z
      .array(
        z
          .object({
            id: IdSchema,
            parentId: IdSchema.nullable(),
            name: z.string().max(160),
            fingerprint: FingerprintSchema,
            textStyleId: CanonicalValueSchema,
            fontRoles: z.array(z.string().min(1).max(64)).max(1_000),
            fontPairs: z.array(z.string().max(260)).max(1_000),
            mixedFont: z.boolean(),
            mixedStyle: z.boolean(),
            missingFont: z.boolean(),
          })
          .strict(),
      )
      .max(200),
    detailsTruncated: z.boolean(),
    detailCount: z.number().int().nonnegative().max(200),
    omittedDetailCount: z.number().int().nonnegative(),
  })
  .strict();

export const PreviewMetadataSchema = z
  .object({
    mimeType: z.literal("image/png"),
    width: z.number().int().positive().max(MAX_PREVIEW_DIMENSION),
    height: z.number().int().positive().max(MAX_PREVIEW_DIMENSION),
    byteLength: z.number().int().nonnegative().max(MAX_PREVIEW_BYTES),
    nodeId: IdSchema,
    fingerprint: FingerprintSchema,
  })
  .strict();

export const PreviewResultSchema = PreviewMetadataSchema.extend({
  data: z
    .string()
    .max(Math.ceil(MAX_PREVIEW_BYTES / 3) * 4)
    .regex(/^[A-Za-z0-9+/]*={0,2}$/),
}).strict();

const BridgeStatusSchema = z
  .object({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    endpoint: z.string().min(1).max(256),
    listening: z.boolean(),
    paired: z.boolean(),
    connected: z.boolean(),
    pluginInstallationId: IdSchema.nullable(),
    connectedAt: z.string().datetime().nullable(),
  })
  .strict();

const PairingCodeResultSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/),
    expiresAt: z.string().datetime(),
  })
  .strict();

export const PluginResultSchemas = {
  status: PluginStatusResultSchema,
  get_selection: SelectionSnapshotSchema,
  get_node: NodeSnapshotSchema,
  list_fonts: FontListResultSchema,
  list_text_styles: TextStyleListResultSchema,
  audit_typography: TypographyAuditResultSchema,
  export_preview: PreviewResultSchema,
  propose_patch: PatchStatusSnapshotSchema,
  get_patch_status: PatchStatusSnapshotSchema,
  cancel_patch: PatchStatusSnapshotSchema,
} as const satisfies Record<PluginMethod, z.ZodType>;

export const ToolDataSchemas = {
  status: z
    .object({
      bridge: BridgeStatusSchema,
      plugin: PluginStatusResultSchema.nullable(),
    })
    .strict(),
  pairingCode: PairingCodeResultSchema,
  getSelection: SelectionSnapshotSchema,
  getNode: NodeSnapshotSchema,
  listFonts: FontListResultSchema,
  listTextStyles: TextStyleListResultSchema,
  auditTypography: TypographyAuditResultSchema,
  exportPreview: PreviewMetadataSchema,
  proposePatch: z
    .object({
      proposal: PatchProposalSchema,
      acknowledgement: PatchStatusSnapshotSchema,
    })
    .strict(),
  getPatchStatus: PatchStatusSnapshotSchema,
  cancelPatch: PatchStatusSnapshotSchema,
} as const;

export const ToolOutputSchemas = {
  status: resultEnvelopeSchema(ToolDataSchemas.status),
  pairingCode: resultEnvelopeSchema(ToolDataSchemas.pairingCode),
  getSelection: resultEnvelopeSchema(ToolDataSchemas.getSelection),
  getNode: resultEnvelopeSchema(ToolDataSchemas.getNode),
  listFonts: resultEnvelopeSchema(ToolDataSchemas.listFonts),
  listTextStyles: resultEnvelopeSchema(ToolDataSchemas.listTextStyles),
  auditTypography: resultEnvelopeSchema(ToolDataSchemas.auditTypography),
  exportPreview: resultEnvelopeSchema(ToolDataSchemas.exportPreview),
  proposePatch: resultEnvelopeSchema(ToolDataSchemas.proposePatch),
  getPatchStatus: resultEnvelopeSchema(ToolDataSchemas.getPatchStatus),
  cancelPatch: resultEnvelopeSchema(ToolDataSchemas.cancelPatch),
} as const;

export function buildPatchProposal(
  input: PatchProposalInput,
  ids: { patchId: string; clientRequestId: string },
  now = new Date(),
): PatchProposal {
  return PatchProposalSchema.parse({
    ...input,
    protocolVersion: PROTOCOL_VERSION,
    ...ids,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + PATCH_TTL_MS).toISOString(),
  });
}

export function parseJsonMessage(
  value: string,
  maxBytes = MAX_JSON_MESSAGE_BYTES,
): unknown {
  if (utf8ByteLength(value) > maxBytes) {
    throw new Error("Message exceeds the JSON size limit.");
  }
  return JSON.parse(value) as unknown;
}
