import {
  MAX_PATCH_NODES,
  PATCH_TTL_MS,
  type BridgeTechnicalError,
  type FontRole,
  type PatchOperation,
  type PatchStatusSnapshot,
  type TypographyPatch,
  type TypographyProperties,
  type UiPatchSummary,
  typographyPatchSchema,
} from "./contracts";
import {
  fingerprintParent,
  fingerprintTextNode,
  fingerprintTextStyle,
  getTextSegmentsForFingerprint,
  hashCanonical,
} from "./fingerprints";
import {
  assertAllowedFontName,
  fontNameForRole,
  loadFontRoles,
  roleForFontName,
} from "./font-policy";
import {
  findTextStyleUsages,
  getParentById,
  getTextNodeById,
  getTextStyleById,
} from "./inspection";

type StyleReference = Extract<
  PatchOperation,
  { op: "bind_text_style" }
>["style"];

interface PreparedPatch {
  patch: TypographyPatch;
  snapshot: PatchStatusSnapshot;
  fingerprintsAtProposal: Map<string, string>;
  affectedNodeIds: Set<string>;
  requiredFontRoles: Set<FontRole>;
  currentFonts: Map<string, FontName>;
  styleUsageIdsAtProposal: Map<string, string[]>;
}

interface ApplyContext {
  createdStylesByTempId: Map<string, TextStyle>;
  createdNodesByTempId: Map<string, TextNode>;
  createdStyleIds: string[];
  createdNodeIds: string[];
  affectedNodeIds: Set<string>;
  mutated: boolean;
}

type PatchStatusListener = (snapshot: PatchStatusSnapshot) => void;

export class PatchEngine {
  private pending: PreparedPatch | null = null;
  private latest: PatchStatusSnapshot | null = null;
  private rollbackIntegrityCompromised = false;
  private preparingPatch = false;

  public constructor(private readonly onStatus: PatchStatusListener) {}

  public getPendingStatus(): PatchStatusSnapshot | null {
    this.expirePendingIfNeeded();
    return this.pending?.snapshot ?? null;
  }

  public isWriteBlocked(): boolean {
    return this.rollbackIntegrityCompromised;
  }

  public getStatus(patchId?: string): PatchStatusSnapshot | null {
    this.expirePendingIfNeeded();
    if (
      this.pending !== null &&
      (patchId === undefined || this.pending.patch.patchId === patchId)
    ) {
      return this.pending.snapshot;
    }
    if (
      this.latest !== null &&
      (patchId === undefined || this.latest.patchId === patchId)
    ) {
      return this.latest;
    }
    return null;
  }

  public async propose(rawPatch: unknown): Promise<PatchStatusSnapshot> {
    if (this.rollbackIntegrityCompromised) {
      throw bridgeError(
        "ROLLBACK_NOT_CONFIRMED",
        "Las escrituras están bloqueadas porque no se pudo confirmar una reversión. Cerrá y volvé a abrir el plugin.",
      );
    }
    this.expirePendingIfNeeded();
    if (this.pending !== null || this.preparingPatch) {
      throw bridgeError(
        "PATCH_ALREADY_PENDING",
        this.pending === null
          ? "Ya se está preparando otro lote."
          : `Ya existe un lote pendiente (${this.pending.patch.patchId}).`,
      );
    }

    this.preparingPatch = true;
    try {
      const parsed = typographyPatchSchema.safeParse(rawPatch);
      if (!parsed.success) {
        throw bridgeError(
          "INVALID_PATCH",
          "El lote no cumple el contrato tipográfico.",
          parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const patch = parsed.data;
      this.assertPatchTiming(patch);
      this.assertFileAndPage(patch);
      this.assertSelection(patch);

      const prepared = await this.preparePatch(patch);
      this.pending = prepared;
      this.latest = prepared.snapshot;
      this.onStatus(prepared.snapshot);
      return prepared.snapshot;
    } finally {
      this.preparingPatch = false;
    }
  }

  public cancel(patchId: string): PatchStatusSnapshot {
    const prepared = this.requirePending(patchId);
    if (prepared.snapshot.status !== "pending_approval") {
      throw bridgeError(
        "PATCH_NOT_CANCELLABLE",
        "El lote ya no puede cancelarse.",
      );
    }
    return this.finishPending("cancelled");
  }

  public reject(patchId: string): PatchStatusSnapshot {
    const prepared = this.requirePending(patchId);
    if (prepared.snapshot.status !== "pending_approval") {
      throw bridgeError(
        "PATCH_NOT_REJECTABLE",
        "El lote ya no puede rechazarse.",
      );
    }
    return this.finishPending("rejected");
  }

  public async approve(
    patchId: string,
    approvalDigest: string,
  ): Promise<PatchStatusSnapshot> {
    const prepared = this.requirePending(patchId);
    if (prepared.snapshot.status !== "pending_approval") {
      throw bridgeError(
        "PATCH_NOT_APPROVABLE",
        "El lote ya no está esperando aprobación.",
      );
    }
    if (prepared.snapshot.approvalDigest !== approvalDigest) {
      throw bridgeError(
        "APPROVAL_DIGEST_MISMATCH",
        "La confirmación no coincide con el lote revisado.",
      );
    }
    this.assertPatchTiming(prepared.patch);
    prepared.snapshot = {
      ...prepared.snapshot,
      status: "applying",
      updatedAt: Date.now(),
    };
    this.latest = prepared.snapshot;
    this.onStatus(prepared.snapshot);

    const applyContext: ApplyContext = {
      createdStylesByTempId: new Map(),
      createdNodesByTempId: new Map(),
      createdStyleIds: [],
      createdNodeIds: [],
      affectedNodeIds: new Set(prepared.affectedNodeIds),
      mutated: false,
    };

    try {
      const dimensionsBefore = await captureDimensions(
        prepared.affectedNodeIds,
      );
      await this.assertFresh(prepared);
      await loadFontRoles(prepared.requiredFontRoles);
      await loadCurrentFonts(prepared.currentFonts.values());
      await this.assertFresh(prepared);

      figma.commitUndo();
      for (const operation of prepared.patch.operations) {
        await this.applyOperation(operation, applyContext);
      }
      await this.assertPostconditions(prepared.patch, applyContext);
      figma.commitUndo();

      const dimensionsAfter = await captureDimensions(
        applyContext.affectedNodeIds,
      );
      const dimensionChanges = compareDimensions(
        dimensionsBefore,
        dimensionsAfter,
      );
      const warnings: string[] = [];
      const snapshot: PatchStatusSnapshot = {
        patchId: prepared.patch.patchId,
        approvalDigest: prepared.snapshot.approvalDigest,
        status: "applied",
        updatedAt: Date.now(),
        summary: prepared.snapshot.summary,
        result: {
          operationCount: prepared.patch.operations.length,
          affectedNodeIds: Array.from(applyContext.affectedNodeIds),
          dimensionChanges,
          createdStyleIds: applyContext.createdStyleIds,
          createdNodeIds: applyContext.createdNodeIds,
          warnings,
        },
      };

      this.pending = null;
      this.latest = snapshot;
      this.onStatus(snapshot);
      return snapshot;
    } catch (error) {
      let rollbackConfirmed = !applyContext.mutated;
      if (applyContext.mutated) {
        try {
          await figma.triggerUndo();
          rollbackConfirmed = await this.verifyRollback(
            prepared,
            applyContext,
          );
        } catch {
          rollbackConfirmed = false;
        }
      }
      if (!rollbackConfirmed) {
        this.rollbackIntegrityCompromised = true;
      }

      const technicalError = toBridgeError(
        error,
        rollbackConfirmed ? "PATCH_APPLY_FAILED" : "ROLLBACK_NOT_CONFIRMED",
      );
      const snapshot: PatchStatusSnapshot = {
        patchId: prepared.patch.patchId,
        approvalDigest: prepared.snapshot.approvalDigest,
        status: rollbackConfirmed
          ? "failed_rolled_back"
          : "failed_rollback",
        updatedAt: Date.now(),
        summary: prepared.snapshot.summary,
        error: rollbackConfirmed
          ? technicalError
          : {
              code: "ROLLBACK_NOT_CONFIRMED",
              message:
                "La aplicación falló y Figma no confirmó la reversión automática.",
              details: { causeCode: technicalError.code },
            },
      };

      this.pending = null;
      this.latest = snapshot;
      this.onStatus(snapshot);
      return snapshot;
    }
  }

  private async preparePatch(patch: TypographyPatch): Promise<PreparedPatch> {
    const fingerprints = new Map<string, string>();
    const affectedNodeIds = new Set<string>();
    const requiredFontRoles = new Set<FontRole>();
    const currentFonts = new Map<string, FontName>();
    const globalStyleNodeIds = new Set<string>();
    const styleUsageIdsAtProposal = new Map<string, string[]>();
    const createdStyles = new Map<string, number>();
    const allTempIds = new Set<string>();
    const rangesByNode = new Map<
      string,
      Array<{ start: number; end: number }>
    >();
    const contentReplacementNodes = new Set<string>();
    const fullNodeStyleOperations = new Set<string>();
    const updatedStyleIds = new Set<string>();

    patch.operations.forEach((operation, index) => {
      if ("tempId" in operation) {
        if (allTempIds.has(operation.tempId)) {
          throw bridgeError(
            "DUPLICATE_TEMP_ID",
            `El identificador temporal ${operation.tempId} está repetido.`,
          );
        }
        allTempIds.add(operation.tempId);
      }
      if (operation.op === "create_text_style") {
        createdStyles.set(operation.tempId, index);
      }
    });

    for (const [operationIndex, operation] of patch.operations.entries()) {
      collectExplicitFontRoles(operation, requiredFontRoles);

      switch (operation.op) {
        case "create_text_style": {
          if (
            operation.typography.fontRole === undefined ||
            operation.typography.fontSize === undefined
          ) {
            throw bridgeError(
              "INVALID_NEW_TEXT_STYLE",
              "Un estilo nuevo requiere fontRole y fontSize explícitos.",
            );
          }
          break;
        }

        case "update_text_style": {
          if (updatedStyleIds.has(operation.styleId)) {
            throw bridgeError(
              "CONFLICTING_STYLE_OPERATIONS",
              `El estilo ${operation.styleId} solo puede actualizarse una vez por lote.`,
            );
          }
          updatedStyleIds.add(operation.styleId);
          if (
            operation.name === undefined &&
            operation.description === undefined &&
            !hasTypographyProperties(operation.typography)
          ) {
            throw bridgeError(
              "EMPTY_STYLE_UPDATE",
              "La actualización de estilo no contiene cambios.",
            );
          }
          const style = await getTextStyleById(operation.styleId);
          assertLocalTextStyle(style);
          if (operation.typography !== undefined) {
            assertNoBoundStyleVariables(
              style,
              variableFieldsForTypography(operation.typography),
              "actualizar",
            );
          }
          assertFingerprint(
            styleKey(style.id),
            operation.expectedFingerprint,
            fingerprintTextStyle(style),
            fingerprints,
          );

          const resultingRole =
            operation.typography?.fontRole ?? roleForFontName(style.fontName);
          if (resultingRole === null) {
            assertAllowedFontName(style.fontName);
          } else {
            requiredFontRoles.add(resultingRole);
          }

          const usages = await findTextStyleUsages(style.id);
          styleUsageIdsAtProposal.set(
            style.id,
            usages.map((node) => node.id).sort(),
          );
          for (const node of usages) {
            prepareWritableTextNode(node, currentFonts);
            affectedNodeIds.add(node.id);
            globalStyleNodeIds.add(node.id);
            fingerprints.set(nodeKey(node.id), fingerprintTextNode(node));
          }
          break;
        }

        case "bind_text_style": {
          const node = await getTextNodeById(operation.nodeId);
          this.assertNodeInScope(node, patch);
          prepareWritableTextNode(node, currentFonts);
          if (
            fullNodeStyleOperations.has(node.id) ||
            contentReplacementNodes.has(node.id) ||
            (rangesByNode.get(node.id)?.length ?? 0) > 0
          ) {
            throw bridgeError(
              "CONFLICTING_TEXT_OPERATIONS",
              `La capa ${node.id} tiene operaciones de texto incompatibles.`,
            );
          }
          fullNodeStyleOperations.add(node.id);
          assertNoBoundTextVariables(
            node,
            ALL_VARIABLE_BINDABLE_TEXT_FIELDS,
            "vincular un estilo completo",
          );
          this.assertSingleStyleNode(node, "vincular un estilo completo");
          assertFingerprint(
            nodeKey(node.id),
            operation.expectedFingerprint,
            fingerprintTextNode(node),
            fingerprints,
          );
          affectedNodeIds.add(node.id);
          await this.prepareStyleReference(
            operation.style,
            operationIndex,
            createdStyles,
            fingerprints,
            requiredFontRoles,
          );
          break;
        }

        case "set_text_range": {
          const node = await getTextNodeById(operation.nodeId);
          this.assertNodeInScope(node, patch);
          prepareWritableTextNode(node, currentFonts);
          if (operation.end > node.characters.length) {
            throw bridgeError(
              "TEXT_RANGE_OUT_OF_BOUNDS",
              `El rango ${operation.start}-${operation.end} excede la capa ${node.id}.`,
            );
          }
          if (
            operation.style === undefined &&
            !hasTypographyProperties(operation.typography)
          ) {
            throw bridgeError(
              "EMPTY_RANGE_UPDATE",
              `El rango de ${node.id} no contiene cambios tipográficos.`,
            );
          }
          assertNoBoundTextVariables(
            node,
            operation.style === undefined
              ? variableFieldsForTypography(operation.typography)
              : ALL_VARIABLE_BINDABLE_TEXT_FIELDS,
            "modificar el rango",
            operation.start,
            operation.end,
          );
          assertUtf16Boundary(node.characters, operation.start, node.id);
          assertUtf16Boundary(node.characters, operation.end, node.id);
          if (contentReplacementNodes.has(node.id)) {
            throw bridgeError(
              "CONFLICTING_TEXT_OPERATIONS",
              `La capa ${node.id} no puede reemplazar contenido y modificar rangos en el mismo lote.`,
            );
          }
          if (fullNodeStyleOperations.has(node.id)) {
            throw bridgeError(
              "CONFLICTING_TEXT_OPERATIONS",
              `La capa ${node.id} no puede combinar un estilo completo con cambios de rango.`,
            );
          }
          const priorRanges = rangesByNode.get(node.id) ?? [];
          if (
            priorRanges.some(
              (range) =>
                operation.start < range.end && operation.end > range.start,
            )
          ) {
            throw bridgeError(
              "OVERLAPPING_TEXT_RANGES",
              `La capa ${node.id} contiene rangos superpuestos.`,
            );
          }
          priorRanges.push({ start: operation.start, end: operation.end });
          rangesByNode.set(node.id, priorRanges);
          assertFingerprint(
            nodeKey(node.id),
            operation.expectedFingerprint,
            fingerprintTextNode(node),
            fingerprints,
          );
          affectedNodeIds.add(node.id);
          if (operation.style !== undefined) {
            await this.prepareStyleReference(
              operation.style,
              operationIndex,
              createdStyles,
              fingerprints,
              requiredFontRoles,
            );
          }
          break;
        }

        case "set_characters": {
          const node = await getTextNodeById(operation.nodeId);
          this.assertNodeInScope(node, patch);
          prepareWritableTextNode(node, currentFonts);
          assertNoBoundTextVariables(
            node,
            ALL_VARIABLE_BINDABLE_TEXT_FIELDS,
            "reemplazar el contenido",
          );
          if (
            contentReplacementNodes.has(node.id) ||
            (rangesByNode.get(node.id)?.length ?? 0) > 0 ||
            fullNodeStyleOperations.has(node.id)
          ) {
            throw bridgeError(
              "CONFLICTING_TEXT_OPERATIONS",
              `La capa ${node.id} tiene operaciones de contenido incompatibles.`,
            );
          }
          contentReplacementNodes.add(node.id);
          this.assertSingleStyleNode(node, "reemplazar el contenido");
          if (node.fontName === figma.mixed) {
            throw bridgeError(
              "MIXED_TEXT_REJECTED",
              `La capa ${node.id} contiene fuentes mixtas.`,
            );
          }
          requiredFontRoles.add(assertAllowedFontName(node.fontName));
          assertFingerprint(
            nodeKey(node.id),
            operation.expectedFingerprint,
            fingerprintTextNode(node),
            fingerprints,
          );
          affectedNodeIds.add(node.id);
          break;
        }

        case "create_text_node": {
          const parent = await getParentById(operation.parentId);
          this.assertNodeInScope(parent, patch);
          assertWritableContainer(parent);
          assertFingerprint(
            nodeKey(parent.id),
            operation.expectedParentFingerprint,
            fingerprintParent(parent),
            fingerprints,
          );
          if (
            operation.style === undefined &&
            operation.typography?.fontRole === undefined
          ) {
            throw bridgeError(
              "MISSING_NEW_TEXT_FONT",
              "Una capa nueva requiere un estilo o un fontRole explícito.",
            );
          }
          if (operation.style !== undefined) {
            await this.prepareStyleReference(
              operation.style,
              operationIndex,
              createdStyles,
              fingerprints,
              requiredFontRoles,
            );
          }
          break;
        }
      }

      if (
        affectedNodeIds.size + countCreateTextOperations(patch.operations) >
        MAX_PATCH_NODES
      ) {
        throw bridgeError(
          "PATCH_SCOPE_TOO_LARGE",
          `El lote supera el límite de ${MAX_PATCH_NODES} nodos.`,
        );
      }
    }

    const summary = summarizePatch(
      patch,
      affectedNodeIds,
      globalStyleNodeIds,
    );
    const approvalDigest = hashCanonical({
      protocolVersion: patch.protocolVersion,
      patchId: patch.patchId,
      fileKey: patch.fileKey,
      pageId: patch.pageId,
      selectionIds: [...patch.selectionIds].sort(),
      createdAt: patch.createdAt,
      expiresAt: patch.expiresAt,
      operations: patch.operations,
      fingerprints: Array.from(fingerprints.entries()).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
      summary,
    });
    const snapshot: PatchStatusSnapshot = {
      patchId: patch.patchId,
      approvalDigest,
      status: "pending_approval",
      updatedAt: Date.now(),
      summary,
    };

    return {
      patch,
      snapshot,
      fingerprintsAtProposal: fingerprints,
      affectedNodeIds,
      requiredFontRoles,
      currentFonts,
      styleUsageIdsAtProposal,
    };
  }

  private async prepareStyleReference(
    styleRef: StyleReference,
    operationIndex: number,
    createdStyles: ReadonlyMap<string, number>,
    fingerprints: Map<string, string>,
    requiredFontRoles: Set<FontRole>,
  ): Promise<void> {
    if (styleRef.kind === "created") {
      const createIndex = createdStyles.get(styleRef.tempId);
      if (createIndex === undefined || createIndex >= operationIndex) {
        throw bridgeError(
          "INVALID_STYLE_REFERENCE",
          `La referencia ${styleRef.tempId} debe apuntar a un estilo creado antes en el mismo lote.`,
        );
      }
      return;
    }

    const style = await getTextStyleById(styleRef.styleId);
    assertLocalTextStyle(style);
    assertNoBoundStyleVariables(
      style,
      ALL_VARIABLE_BINDABLE_TEXT_FIELDS,
      "aplicar",
    );
    assertFingerprint(
      styleKey(style.id),
      styleRef.expectedFingerprint,
      fingerprintTextStyle(style),
      fingerprints,
    );
    requiredFontRoles.add(assertAllowedFontName(style.fontName));
  }

  private async assertFresh(prepared: PreparedPatch): Promise<void> {
    this.assertPatchTiming(prepared.patch);
    this.assertFileAndPage(prepared.patch);
    this.assertSelection(prepared.patch);

    for (const [key, expected] of prepared.fingerprintsAtProposal) {
      const current = await currentFingerprintForKey(key);
      if (current !== expected) {
        throw bridgeError(
          "STALE_FINGERPRINT",
          `El lote quedó obsoleto porque cambió ${key}.`,
        );
      }
    }

    for (const [styleId, expectedUsageIds] of prepared.styleUsageIdsAtProposal) {
      const currentUsageIds = (await findTextStyleUsages(styleId))
        .map((node) => node.id)
        .sort();
      if (
        currentUsageIds.length !== expectedUsageIds.length ||
        currentUsageIds.some((id, index) => id !== expectedUsageIds[index])
      ) {
        throw bridgeError(
          "STALE_FINGERPRINT",
          `Cambió el alcance global del estilo ${styleId}.`,
        );
      }
    }
  }

  private async applyOperation(
    operation: PatchOperation,
    context: ApplyContext,
  ): Promise<void> {
    switch (operation.op) {
      case "create_text_style": {
        const style = figma.createTextStyle();
        context.mutated = true;
        context.createdStylesByTempId.set(operation.tempId, style);
        context.createdStyleIds.push(style.id);
        style.name = operation.name;
        style.description = operation.description ?? "";
        applyStyleProperties(style, operation.typography);
        return;
      }

      case "update_text_style": {
        const style = await getTextStyleById(operation.styleId);
        context.mutated = true;
        if (operation.name !== undefined) {
          style.name = operation.name;
        }
        if (operation.description !== undefined) {
          style.description = operation.description;
        }
        if (operation.typography !== undefined) {
          applyStyleProperties(style, operation.typography);
        }
        return;
      }

      case "bind_text_style": {
        const node = await getTextNodeById(operation.nodeId);
        const style = await resolveStyleReference(
          operation.style,
          context.createdStylesByTempId,
        );
        context.mutated = true;
        await node.setTextStyleIdAsync(style.id);
        context.affectedNodeIds.add(node.id);
        return;
      }

      case "set_text_range": {
        const node = await getTextNodeById(operation.nodeId);
        context.mutated = true;
        if (operation.style !== undefined) {
          const style = await resolveStyleReference(
            operation.style,
            context.createdStylesByTempId,
          );
          await node.setRangeTextStyleIdAsync(
            operation.start,
            operation.end,
            style.id,
          );
        }
        if (operation.typography !== undefined) {
          applyRangeProperties(
            node,
            operation.start,
            operation.end,
            operation.typography,
          );
        }
        context.affectedNodeIds.add(node.id);
        return;
      }

      case "set_characters": {
        const node = await getTextNodeById(operation.nodeId);
        context.mutated = true;
        const originalLength = node.characters.length;
        if (operation.characters.length > 0) {
          node.insertCharacters(0, operation.characters, "AFTER");
        }
        if (originalLength > 0) {
          node.deleteCharacters(
            operation.characters.length,
            operation.characters.length + originalLength,
          );
        }
        context.affectedNodeIds.add(node.id);
        return;
      }

      case "create_text_node": {
        const parent = await getParentById(operation.parentId);
        const node = figma.createText();
        context.mutated = true;
        context.createdNodeIds.push(node.id);
        context.createdNodesByTempId.set(operation.tempId, node);
        context.affectedNodeIds.add(node.id);
        parent.appendChild(node);
        node.name = operation.name ?? "Texto";

        if (operation.style !== undefined) {
          const style = await resolveStyleReference(
            operation.style,
            context.createdStylesByTempId,
          );
          await node.setTextStyleIdAsync(style.id);
        }
        if (operation.typography !== undefined) {
          applyNodeProperties(node, operation.typography);
        }

        node.characters = operation.characters;
        if (operation.x !== undefined) {
          node.x = operation.x;
        }
        if (operation.y !== undefined) {
          node.y = operation.y;
        }
        if (operation.width !== undefined) {
          node.textAutoResize = "HEIGHT";
          node.resize(operation.width, node.height);
        } else {
          node.textAutoResize = "WIDTH_AND_HEIGHT";
        }

        return;
      }
    }
  }

  private async assertPostconditions(
    patch: TypographyPatch,
    context: ApplyContext,
  ): Promise<void> {
    for (const operation of patch.operations) {
      switch (operation.op) {
        case "create_text_style": {
          const style = context.createdStylesByTempId.get(operation.tempId);
          if (style === undefined) {
            throw bridgeError(
              "POSTCONDITION_FAILED",
              `No se encontró el estilo creado ${operation.tempId}.`,
            );
          }
          assertExactValue("nombre del estilo", style.name, operation.name);
          assertExactValue(
            "descripción del estilo",
            style.description,
            operation.description ?? "",
          );
          assertStyleTypography(style, operation.typography);
          break;
        }

        case "update_text_style": {
          const style = await getTextStyleById(operation.styleId);
          if (operation.name !== undefined) {
            assertExactValue("nombre del estilo", style.name, operation.name);
          }
          if (operation.description !== undefined) {
            assertExactValue(
              "descripción del estilo",
              style.description,
              operation.description,
            );
          }
          if (operation.typography !== undefined) {
            assertStyleTypography(style, operation.typography);
          }
          break;
        }

        case "bind_text_style": {
          const node = await getTextNodeById(operation.nodeId);
          const style = await resolveStyleReference(
            operation.style,
            context.createdStylesByTempId,
          );
          assertExactValue(
            "vínculo de estilo",
            node.textStyleId,
            style.id,
          );
          break;
        }

        case "set_text_range": {
          const node = await getTextNodeById(operation.nodeId);
          if (operation.style !== undefined) {
            const style = await resolveStyleReference(
              operation.style,
              context.createdStylesByTempId,
            );
            assertExactValue(
              "vínculo de estilo del rango",
              node.getRangeTextStyleId(operation.start, operation.end),
              style.id,
            );
          }
          if (operation.typography !== undefined) {
            assertRangeTypography(
              node,
              operation.start,
              operation.end,
              operation.typography,
            );
          }
          break;
        }

        case "set_characters": {
          const node = await getTextNodeById(operation.nodeId);
          assertExactValue(
            "contenido de la capa",
            node.characters,
            operation.characters,
          );
          break;
        }

        case "create_text_node": {
          const node = context.createdNodesByTempId.get(operation.tempId);
          if (node === undefined) {
            throw bridgeError(
              "POSTCONDITION_FAILED",
              `No se encontró la capa creada ${operation.tempId}.`,
            );
          }
          assertExactValue("contenedor de la capa", node.parent?.id, operation.parentId);
          assertExactValue(
            "nombre de la capa",
            node.name,
            operation.name ?? "Texto",
          );
          assertExactValue(
            "contenido de la capa",
            node.characters,
            operation.characters,
          );
          if (operation.style !== undefined) {
            const style = await resolveStyleReference(
              operation.style,
              context.createdStylesByTempId,
            );
            assertExactValue(
              "vínculo de estilo de la capa",
              node.textStyleId,
              style.id,
            );
          }
          if (operation.typography !== undefined) {
            assertNodeTypography(node, operation.typography);
          }
          if (operation.x !== undefined) {
            assertCloseValue("posición x", node.x, operation.x);
          }
          if (operation.y !== undefined) {
            assertCloseValue("posición y", node.y, operation.y);
          }
          if (operation.width !== undefined) {
            assertCloseValue("ancho", node.width, operation.width);
            assertExactValue(
              "autoajuste de texto",
              node.textAutoResize,
              "HEIGHT",
            );
          } else {
            assertExactValue(
              "autoajuste de texto",
              node.textAutoResize,
              "WIDTH_AND_HEIGHT",
            );
          }
          break;
        }
      }
    }
  }

  private assertSingleStyleNode(node: TextNode, action: string): void {
    const segments = getTextSegmentsForFingerprint(node);
    if (
      node.fontName === figma.mixed ||
      node.textStyleId === figma.mixed ||
      segments.length > 1
    ) {
      throw bridgeError(
        "MIXED_TEXT_REJECTED",
        `No se puede ${action} en ${node.id}: contiene segmentos mixtos.`,
      );
    }
  }

  private async verifyRollback(
    prepared: PreparedPatch,
    context: ApplyContext,
  ): Promise<boolean> {
    try {
      for (const [key, expected] of prepared.fingerprintsAtProposal) {
        if ((await currentFingerprintForKey(key)) !== expected) {
          return false;
        }
      }

      for (const [styleId, expectedUsageIds] of prepared.styleUsageIdsAtProposal) {
        const currentUsageIds = (await findTextStyleUsages(styleId))
          .map((node) => node.id)
          .sort();
        if (
          currentUsageIds.length !== expectedUsageIds.length ||
          currentUsageIds.some((id, index) => id !== expectedUsageIds[index])
        ) {
          return false;
        }
      }

      for (const styleId of context.createdStyleIds) {
        if ((await figma.getStyleByIdAsync(styleId)) !== null) {
          return false;
        }
      }
      for (const nodeId of context.createdNodeIds) {
        if ((await figma.getNodeByIdAsync(nodeId)) !== null) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  private assertSelection(patch: TypographyPatch): void {
    if (patch.selectionIds.length === 0) {
      return;
    }
    const currentIds = figma.currentPage.selection.map((node) => node.id).sort();
    const expectedIds = [...patch.selectionIds].sort();
    if (
      currentIds.length !== expectedIds.length ||
      currentIds.some((id, index) => id !== expectedIds[index])
    ) {
      throw bridgeError(
        "SELECTION_CHANGED",
        "La selección actual ya no coincide con el alcance propuesto.",
      );
    }
  }

  private assertNodeInScope(node: BaseNode, patch: TypographyPatch): void {
    if (patch.selectionIds.length === 0) {
      return;
    }
    const scopeIds = new Set(patch.selectionIds);
    let current: BaseNode | null = node;
    while (current !== null) {
      if (scopeIds.has(current.id)) {
        return;
      }
      current = current.parent;
    }
    throw bridgeError(
      "NODE_OUTSIDE_SCOPE",
      `El nodo ${node.id} está fuera de la selección propuesta.`,
    );
  }

  private assertPatchTiming(patch: TypographyPatch): void {
    const now = Date.now();
    const createdAt = Date.parse(patch.createdAt);
    const expiresAt = Date.parse(patch.expiresAt);
    if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt)) {
      throw bridgeError("INVALID_PATCH_DATE", "Las fechas del lote no son válidas.");
    }
    if (createdAt > now + 30_000) {
      throw bridgeError(
        "PATCH_FROM_FUTURE",
        "La fecha de creación del lote no es válida.",
      );
    }
    if (expiresAt <= now) {
      throw bridgeError("PATCH_EXPIRED", "El lote ya venció.");
    }
    if (expiresAt - createdAt > PATCH_TTL_MS) {
      throw bridgeError(
        "PATCH_TTL_EXCEEDED",
        "La aprobación no puede permanecer abierta más de cinco minutos.",
      );
    }
  }

  private assertFileAndPage(patch: TypographyPatch): void {
    const currentFileKey = figma.fileKey ?? null;
    if (currentFileKey === null || patch.fileKey !== currentFileKey) {
      throw bridgeError(
        "FILE_MISMATCH",
        "El lote fue preparado para otro archivo de Figma.",
      );
    }
    if (patch.pageId !== figma.currentPage.id) {
      throw bridgeError(
        "PAGE_MISMATCH",
        "El lote fue preparado para otra página de Figma.",
      );
    }
  }

  private requirePending(patchId: string): PreparedPatch {
    this.expirePendingIfNeeded();
    if (this.pending === null || this.pending.patch.patchId !== patchId) {
      throw bridgeError(
        "PATCH_NOT_PENDING",
        `No hay un lote pendiente con ID ${patchId}.`,
      );
    }
    return this.pending;
  }

  private expirePendingIfNeeded(): void {
    if (
      this.pending !== null &&
      Date.parse(this.pending.patch.expiresAt) <= Date.now() &&
      this.pending.snapshot.status === "pending_approval"
    ) {
      this.finishPending("expired", {
        code: "PATCH_EXPIRED",
        message: "El lote venció antes de recibir aprobación.",
      });
    }
  }

  private finishPending(
    status: "rejected" | "cancelled" | "expired",
    error?: BridgeTechnicalError,
  ): PatchStatusSnapshot {
    if (this.pending === null) {
      throw bridgeError("PATCH_NOT_PENDING", "No hay un lote pendiente.");
    }
    const snapshot: PatchStatusSnapshot = {
      patchId: this.pending.patch.patchId,
      approvalDigest: this.pending.snapshot.approvalDigest,
      status,
      updatedAt: Date.now(),
      summary: this.pending.snapshot.summary,
      error,
    };
    this.pending = null;
    this.latest = snapshot;
    this.onStatus(snapshot);
    return snapshot;
  }
}

function collectExplicitFontRoles(
  operation: PatchOperation,
  roles: Set<FontRole>,
): void {
  if ("typography" in operation && operation.typography?.fontRole !== undefined) {
    roles.add(operation.typography.fontRole);
  }
}

function hasTypographyProperties(
  typography: TypographyProperties | undefined,
): boolean {
  return typography !== undefined && Object.keys(typography).length > 0;
}

function countCreateTextOperations(operations: readonly PatchOperation[]): number {
  return operations.filter((operation) => operation.op === "create_text_node")
    .length;
}

function summarizePatch(
  patch: TypographyPatch,
  affectedNodeIds: ReadonlySet<string>,
  globalStyleNodeIds: ReadonlySet<string>,
): UiPatchSummary {
  const styleChanges = patch.operations.filter(
    (operation) =>
      operation.op === "create_text_style" ||
      operation.op === "update_text_style",
  ).length;
  const nodeChanges = patch.operations.length - styleChanges;
  const warnings: string[] = [];

  if (globalStyleNodeIds.size > 0) {
    warnings.push(
      `${globalStyleNodeIds.size} capas usan estilos que se actualizarán globalmente.`,
    );
  }

  return {
    patchId: patch.patchId,
    title: "Revisar lote tipográfico",
    detail:
      `${styleChanges} operaciones de estilo y ${nodeChanges} operaciones sobre capas. ` +
      "El detalle se calculó localmente desde las operaciones validadas.",
    operationCount: patch.operations.length,
    styleChanges,
    nodeChanges,
    globalStyleUpdates: patch.operations.filter(
      (operation) => operation.op === "update_text_style",
    ).length,
    impactedNodes:
      affectedNodeIds.size + countCreateTextOperations(patch.operations),
    expiresAt: Date.parse(patch.expiresAt),
    warnings,
    operationDetails: patch.operations.map(describeOperation),
  };
}

function describeOperation(
  operation: PatchOperation,
  index: number,
): string {
  const prefix = `${index + 1}.`;
  switch (operation.op) {
    case "create_text_style":
      return `${prefix} Crear estilo “${operation.name}” (${describeTypography(operation.typography)}).`;
    case "update_text_style": {
      const changes = [
        operation.name === undefined ? null : `nombre → “${operation.name}”`,
        operation.description === undefined
          ? null
          : "actualizar descripción",
        operation.typography === undefined
          ? null
          : describeTypography(operation.typography),
      ].filter((value): value is string => value !== null);
      return `${prefix} Actualizar estilo ${operation.styleId}: ${changes.join("; ")}.`;
    }
    case "bind_text_style":
      return `${prefix} Vincular capa ${operation.nodeId} a ${describeStyleReference(operation.style)}.`;
    case "set_text_range": {
      const changes = [
        operation.style === undefined
          ? null
          : describeStyleReference(operation.style),
        operation.typography === undefined
          ? null
          : describeTypography(operation.typography),
      ].filter((value): value is string => value !== null);
      return `${prefix} Modificar ${operation.nodeId}, rango ${operation.start}–${operation.end}: ${changes.join("; ")}.`;
    }
    case "set_characters":
      return `${prefix} Reemplazar el contenido de ${operation.nodeId} por ${quotedPreview(operation.characters)} (${operation.characters.length} unidades UTF-16).`;
    case "create_text_node":
      return `${prefix} Crear capa ${operation.tempId} en ${operation.parentId} con ${quotedPreview(operation.characters)}${operation.style === undefined ? "" : ` y ${describeStyleReference(operation.style)}`}${operation.typography === undefined ? "" : `; ${describeTypography(operation.typography)}`}.`;
  }
}

function describeStyleReference(style: StyleReference): string {
  return style.kind === "existing"
    ? `estilo ${style.styleId}`
    : `estilo nuevo ${style.tempId}`;
}

function describeTypography(typography: TypographyProperties): string {
  const values: string[] = [];
  if (typography.fontRole !== undefined) {
    values.push(`Neue Montreal ${capitalize(typography.fontRole)}`);
  }
  if (typography.fontSize !== undefined) {
    values.push(`${typography.fontSize}px`);
  }
  if (typography.lineHeight !== undefined) {
    values.push(
      typography.lineHeight.unit === "AUTO"
        ? "interlínea automática"
        : `interlínea ${typography.lineHeight.value}${typography.lineHeight.unit === "PIXELS" ? "px" : "%"}`,
    );
  }
  if (typography.letterSpacing !== undefined) {
    values.push(
      `tracking ${typography.letterSpacing.value}${typography.letterSpacing.unit === "PIXELS" ? "px" : "%"}`,
    );
  }
  if (typography.textCase !== undefined) {
    values.push(`caja ${typography.textCase}`);
  }
  if (typography.textDecoration !== undefined) {
    values.push(`decoración ${typography.textDecoration}`);
  }
  return values.join(", ");
}

function quotedPreview(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  const preview =
    normalized.length > 80 ? `${normalized.slice(0, 77)}…` : normalized;
  return `“${preview}”`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function applyStyleProperties(
  style: TextStyle,
  typography: TypographyProperties,
): void {
  if (typography.fontRole !== undefined) {
    style.fontName = fontNameForRole(typography.fontRole);
  }
  if (typography.fontSize !== undefined) {
    style.fontSize = typography.fontSize;
  }
  if (typography.lineHeight !== undefined) {
    style.lineHeight = typography.lineHeight;
  }
  if (typography.letterSpacing !== undefined) {
    style.letterSpacing = typography.letterSpacing;
  }
  if (typography.textCase !== undefined) {
    style.textCase = typography.textCase;
  }
  if (typography.textDecoration !== undefined) {
    style.textDecoration = typography.textDecoration;
  }
}

function applyNodeProperties(
  node: TextNode,
  typography: TypographyProperties,
): void {
  if (typography.fontRole !== undefined) {
    node.fontName = fontNameForRole(typography.fontRole);
  }
  if (typography.fontSize !== undefined) {
    node.fontSize = typography.fontSize;
  }
  if (typography.lineHeight !== undefined) {
    node.lineHeight = typography.lineHeight;
  }
  if (typography.letterSpacing !== undefined) {
    node.letterSpacing = typography.letterSpacing;
  }
  if (typography.textCase !== undefined) {
    node.textCase = typography.textCase;
  }
  if (typography.textDecoration !== undefined) {
    node.textDecoration = typography.textDecoration;
  }
}

function applyRangeProperties(
  node: TextNode,
  start: number,
  end: number,
  typography: TypographyProperties,
): void {
  if (typography.fontRole !== undefined) {
    node.setRangeFontName(start, end, fontNameForRole(typography.fontRole));
  }
  if (typography.fontSize !== undefined) {
    node.setRangeFontSize(start, end, typography.fontSize);
  }
  if (typography.lineHeight !== undefined) {
    node.setRangeLineHeight(start, end, typography.lineHeight);
  }
  if (typography.letterSpacing !== undefined) {
    node.setRangeLetterSpacing(start, end, typography.letterSpacing);
  }
  if (typography.textCase !== undefined) {
    node.setRangeTextCase(start, end, typography.textCase);
  }
  if (typography.textDecoration !== undefined) {
    node.setRangeTextDecoration(start, end, typography.textDecoration);
  }
}

function assertStyleTypography(
  style: TextStyle,
  typography: TypographyProperties,
): void {
  if (typography.fontRole !== undefined) {
    assertExactValue(
      "fuente del estilo",
      style.fontName,
      fontNameForRole(typography.fontRole),
    );
  }
  if (typography.fontSize !== undefined) {
    assertExactValue("tamaño del estilo", style.fontSize, typography.fontSize);
  }
  if (typography.lineHeight !== undefined) {
    assertExactValue(
      "interlínea del estilo",
      style.lineHeight,
      typography.lineHeight,
    );
  }
  if (typography.letterSpacing !== undefined) {
    assertExactValue(
      "tracking del estilo",
      style.letterSpacing,
      typography.letterSpacing,
    );
  }
  if (typography.textCase !== undefined) {
    assertExactValue("caja del estilo", style.textCase, typography.textCase);
  }
  if (typography.textDecoration !== undefined) {
    assertExactValue(
      "decoración del estilo",
      style.textDecoration,
      typography.textDecoration,
    );
  }
}

function assertNodeTypography(
  node: TextNode,
  typography: TypographyProperties,
): void {
  if (typography.fontRole !== undefined) {
    assertExactValue(
      "fuente de la capa",
      node.fontName,
      fontNameForRole(typography.fontRole),
    );
  }
  if (typography.fontSize !== undefined) {
    assertExactValue("tamaño de la capa", node.fontSize, typography.fontSize);
  }
  if (typography.lineHeight !== undefined) {
    assertExactValue(
      "interlínea de la capa",
      node.lineHeight,
      typography.lineHeight,
    );
  }
  if (typography.letterSpacing !== undefined) {
    assertExactValue(
      "tracking de la capa",
      node.letterSpacing,
      typography.letterSpacing,
    );
  }
  if (typography.textCase !== undefined) {
    assertExactValue("caja de la capa", node.textCase, typography.textCase);
  }
  if (typography.textDecoration !== undefined) {
    assertExactValue(
      "decoración de la capa",
      node.textDecoration,
      typography.textDecoration,
    );
  }
}

function assertRangeTypography(
  node: TextNode,
  start: number,
  end: number,
  typography: TypographyProperties,
): void {
  if (typography.fontRole !== undefined) {
    assertExactValue(
      "fuente del rango",
      node.getRangeFontName(start, end),
      fontNameForRole(typography.fontRole),
    );
  }
  if (typography.fontSize !== undefined) {
    assertExactValue(
      "tamaño del rango",
      node.getRangeFontSize(start, end),
      typography.fontSize,
    );
  }
  if (typography.lineHeight !== undefined) {
    assertExactValue(
      "interlínea del rango",
      node.getRangeLineHeight(start, end),
      typography.lineHeight,
    );
  }
  if (typography.letterSpacing !== undefined) {
    assertExactValue(
      "tracking del rango",
      node.getRangeLetterSpacing(start, end),
      typography.letterSpacing,
    );
  }
  if (typography.textCase !== undefined) {
    assertExactValue(
      "caja del rango",
      node.getRangeTextCase(start, end),
      typography.textCase,
    );
  }
  if (typography.textDecoration !== undefined) {
    assertExactValue(
      "decoración del rango",
      node.getRangeTextDecoration(start, end),
      typography.textDecoration,
    );
  }
}

function assertExactValue(
  label: string,
  actual: unknown,
  expected: unknown,
): void {
  if (
    actual === figma.mixed ||
    hashCanonical(actual) !== hashCanonical(expected)
  ) {
    throw bridgeError(
      "POSTCONDITION_FAILED",
      `No se confirmó ${label} después de aplicar el lote.`,
    );
  }
}

function assertCloseValue(
  label: string,
  actual: number,
  expected: number,
): void {
  if (Math.abs(actual - expected) > 0.01) {
    throw bridgeError(
      "POSTCONDITION_FAILED",
      `No se confirmó ${label} después de aplicar el lote.`,
    );
  }
}

async function resolveStyleReference(
  styleRef: StyleReference,
  createdStylesByTempId: ReadonlyMap<string, TextStyle>,
): Promise<TextStyle> {
  if (styleRef.kind === "existing") {
    return getTextStyleById(styleRef.styleId);
  }
  const style = createdStylesByTempId.get(styleRef.tempId);
  if (style === undefined) {
    throw bridgeError(
      "UNRESOLVED_STYLE_REFERENCE",
      `No se pudo resolver ${styleRef.tempId}.`,
    );
  }
  return style;
}

function nodeKey(id: string): string {
  return `node:${id}`;
}

function styleKey(id: string): string {
  return `text_style:${id}`;
}

function assertFingerprint(
  key: string,
  expected: string,
  current: string,
  fingerprints: Map<string, string>,
): void {
  if (current !== expected) {
    throw bridgeError(
      "STALE_FINGERPRINT",
      `La huella de ${key} ya no coincide.`,
    );
  }
  const previous = fingerprints.get(key);
  if (previous !== undefined && previous !== expected) {
    throw bridgeError(
      "INCONSISTENT_FINGERPRINT",
      `El lote contiene huellas incompatibles para ${key}.`,
    );
  }
  fingerprints.set(key, current);
}

async function currentFingerprintForKey(key: string): Promise<string> {
  if (key.startsWith("text_style:")) {
    const styleId = key.slice("text_style:".length);
    const style = await getTextStyleById(styleId);
    assertLocalTextStyle(style);
    return fingerprintTextStyle(style);
  }
  const nodeId = key.slice("node:".length);
  const node = await figma.getNodeByIdAsync(nodeId);
  if (node === null) {
    throw bridgeError("NODE_NOT_FOUND", `No se encontró el nodo ${nodeId}.`);
  }
  assertWritableNode(node);
  if (node.type === "TEXT") {
    if (node.hasMissingFont) {
      throw bridgeError(
        "FONT_UNAVAILABLE",
        `La capa ${node.id} contiene una fuente faltante.`,
      );
    }
    return fingerprintTextNode(node);
  }
  if (
    node.type !== "DOCUMENT" &&
    "children" in node &&
    "appendChild" in node
  ) {
    return fingerprintParent(node);
  }
  return hashCanonical({
    id: node.id,
    parentId: node.parent?.id ?? null,
    type: node.type,
    name: node.name,
  });
}

function prepareWritableTextNode(
  node: TextNode,
  currentFonts: Map<string, FontName>,
): void {
  assertWritableNode(node);
  if (node.hasMissingFont) {
    throw bridgeError(
      "FONT_UNAVAILABLE",
      `La capa ${node.id} contiene una fuente faltante y no puede modificarse de forma segura.`,
    );
  }

  const segments = node.getStyledTextSegments(["fontName"]);

  for (const segment of segments) {
    const fontName = segment.fontName;
    currentFonts.set(
      `${fontName.family}\u0000${fontName.style}`,
      fontName,
    );
  }
}

const ALL_VARIABLE_BINDABLE_TEXT_FIELDS = [
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
  "paragraphSpacing",
  "paragraphIndent",
] as const satisfies readonly VariableBindableTextField[];

function variableFieldsForTypography(
  typography: TypographyProperties | undefined,
): readonly VariableBindableTextField[] {
  if (typography === undefined) {
    return [];
  }

  const fields = new Set<VariableBindableTextField>();
  if (typography.fontRole !== undefined) {
    fields.add("fontFamily");
    fields.add("fontStyle");
    fields.add("fontWeight");
  }
  if (typography.fontSize !== undefined) {
    fields.add("fontSize");
  }
  if (typography.letterSpacing !== undefined) {
    fields.add("letterSpacing");
  }
  if (typography.lineHeight !== undefined) {
    fields.add("lineHeight");
  }
  return Array.from(fields);
}

function assertNoBoundStyleVariables(
  style: TextStyle,
  fields: readonly VariableBindableTextField[],
  action: string,
): void {
  const conflicts = fields.filter(
    (field) => style.boundVariables?.[field] !== undefined,
  );
  if (conflicts.length === 0) {
    return;
  }
  throw bridgeError(
    "VARIABLE_BOUND_STYLE_REJECTED",
    `No se puede ${action} el estilo ${style.id}: las propiedades ${conflicts.join(", ")} están ligadas a variables.`,
  );
}

function assertNoBoundTextVariables(
  node: TextNode,
  fields: readonly VariableBindableTextField[],
  action: string,
  start?: number,
  end?: number,
): void {
  if (fields.length === 0 || node.characters.length === 0) {
    return;
  }

  const segments =
    start === undefined || end === undefined
      ? node.getStyledTextSegments(["boundVariables"])
      : node.getStyledTextSegments(["boundVariables"], start, end);
  const conflicts = new Set<VariableBindableTextField>();
  for (const segment of segments) {
    for (const field of fields) {
      if (segment.boundVariables?.[field] !== undefined) {
        conflicts.add(field);
      }
    }
  }
  if (conflicts.size === 0) {
    return;
  }
  throw bridgeError(
    "VARIABLE_BOUND_TEXT_REJECTED",
    `No se puede ${action} en ${node.id}: las propiedades ${Array.from(conflicts).join(", ")} están ligadas a variables.`,
  );
}

function assertWritableContainer(node: BaseNode & ChildrenMixin): void {
  assertWritableNode(node);
}

function assertWritableNode(node: BaseNode): void {
  let current: BaseNode | null = node;
  while (current !== null) {
    if ("locked" in current && current.locked) {
      throw bridgeError(
        "NODE_LOCKED",
        `El nodo ${node.id} o uno de sus ancestros está bloqueado.`,
      );
    }
    if (current.type === "INSTANCE") {
      throw bridgeError(
        "INSTANCE_WRITE_REJECTED",
        `El nodo ${node.id} está dentro de una instancia y no se modificará.`,
      );
    }
    current = current.parent;
  }
}

function assertLocalTextStyle(style: TextStyle): void {
  if (style.remote) {
    throw bridgeError(
      "REMOTE_STYLE_REJECTED",
      `El estilo ${style.id} es remoto y no puede editarse con este puente.`,
    );
  }
}

function assertUtf16Boundary(
  characters: string,
  boundary: number,
  nodeId: string,
): void {
  if (boundary <= 0 || boundary >= characters.length) {
    return;
  }
  const before = characters.charCodeAt(boundary - 1);
  const after = characters.charCodeAt(boundary);
  const splitsSurrogatePair =
    before >= 0xd800 &&
    before <= 0xdbff &&
    after >= 0xdc00 &&
    after <= 0xdfff;
  if (splitsSurrogatePair) {
    throw bridgeError(
      "UTF16_BOUNDARY_REJECTED",
      `Un límite de rango en ${nodeId} corta un carácter Unicode.`,
    );
  }
}

async function loadCurrentFonts(fonts: Iterable<FontName>): Promise<void> {
  for (const fontName of fonts) {
    try {
      await figma.loadFontAsync(fontName);
    } catch {
      throw bridgeError(
        "FONT_UNAVAILABLE",
        `No se pudo cargar una fuente actual requerida por el lote (${fontName.family} / ${fontName.style}).`,
      );
    }
  }
}

async function captureDimensions(
  nodeIds: ReadonlySet<string>,
): Promise<Map<string, { width: number; height: number }>> {
  const result = new Map<string, { width: number; height: number }>();
  for (const nodeId of nodeIds) {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (node !== null && node.type === "TEXT") {
      result.set(nodeId, { width: node.width, height: node.height });
    }
  }
  return result;
}

function compareDimensions(
  before: ReadonlyMap<string, { width: number; height: number }>,
  after: ReadonlyMap<string, { width: number; height: number }>,
): Array<{
  nodeId: string;
  before: { width: number; height: number };
  after: { width: number; height: number };
}> {
  const changes: Array<{
    nodeId: string;
    before: { width: number; height: number };
    after: { width: number; height: number };
  }> = [];

  for (const [nodeId, beforeDimensions] of before) {
    const afterDimensions = after.get(nodeId);
    if (
      afterDimensions !== undefined &&
      (Math.abs(beforeDimensions.width - afterDimensions.width) > 0.01 ||
        Math.abs(beforeDimensions.height - afterDimensions.height) > 0.01)
    ) {
      changes.push({
        nodeId,
        before: beforeDimensions,
        after: afterDimensions,
      });
    }
  }
  return changes;
}

export function toBridgeError(
  error: unknown,
  fallbackCode = "PLUGIN_ERROR",
): BridgeTechnicalError {
  if (isBridgeError(error)) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }
  if (error instanceof Error) {
    return {
      code: fallbackCode,
      message: error.message || "Error técnico del plugin.",
    };
  }
  return {
    code: fallbackCode,
    message: "Error técnico del plugin.",
  };
}

function isBridgeError(
  error: unknown,
): error is Error & { code: string; details?: unknown } {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  );
}

function bridgeError(
  code: string,
  message: string,
  details?: unknown,
): Error & { code: string; details?: unknown } {
  return Object.assign(new Error(message), { code, details });
}
