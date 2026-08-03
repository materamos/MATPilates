import {
  MAX_PATCH_NODES,
  MAX_PATCH_LAYOUT_NODES,
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
  fingerprintLayoutNode,
  fingerprintParent,
  fingerprintTextNode,
  fingerprintTextStyle,
  getTextSegmentsForFingerprint,
  hashCanonical,
} from "./fingerprints";
import {
  assertAllowedFontName,
  fontRoleForMatTextStyleName,
  fontNameForRole,
  loadFontRoles,
} from "./font-policy";
import {
  findTextStyleUsages,
  exportPreview,
  getParentById,
  getTextNodeById,
  getTextStyleById,
} from "./inspection";

type StyleReference = Extract<
  PatchOperation,
  { op: "bind_text_style" }
>["style"];

interface CreatedStyleDefinition {
  operationIndex: number;
  fontRole: FontRole | undefined;
}

interface ProjectedExistingStyleDefinition {
  style: TextStyle;
  name: string;
  fontRole: FontRole;
}

interface PreparedPatch {
  patch: TypographyPatch;
  snapshot: PatchStatusSnapshot;
  fingerprintsAtProposal: Map<string, string>;
  affectedNodeIds: Set<string>;
  requiredFontRoles: Set<FontRole>;
  currentFonts: Map<string, FontName>;
  styleUsageIdsAtProposal: Map<string, string[]>;
  expectedDocumentChanges: Map<string, ExpectedDocumentChangeRule>;
}

interface ApplyContext {
  createdStylesByTempId: Map<string, TextStyle>;
  createdNodesByTempId: Map<string, TextNode>;
  createdStyleIds: string[];
  createdNodeIds: string[];
  affectedNodeIds: Set<string>;
  expectedDocumentChanges: Map<string, ExpectedDocumentChangeRule>;
  mutated: boolean;
}

type UndoInvalidationReason =
  | "document_changed"
  | "focus_left"
  | "page_changed"
  | "ui_hidden"
  | "superseded";

type TrackedDocumentChangeType =
  | "CREATE"
  | "DELETE"
  | "PROPERTY_CHANGE"
  | "STYLE_CREATE"
  | "STYLE_DELETE"
  | "STYLE_PROPERTY_CHANGE";

interface TrackedDocumentChange {
  id: string;
  origin: "LOCAL" | "REMOTE";
  type: TrackedDocumentChangeType;
  properties?: readonly string[];
}

interface ExpectedDocumentChangeRule {
  forwardTypes: Set<TrackedDocumentChangeType>;
  undoTypes: Set<TrackedDocumentChangeType>;
  nodeProperties: Set<string>;
  styleProperties: Set<string>;
}

interface ApplyingGuard {
  patchId: string;
  expectedDocumentChanges: Map<string, ExpectedDocumentChangeRule>;
  invalidatedReason: UndoInvalidationReason | null;
  expectedEventObserved: boolean;
  lastExpectedEventAt: number;
}

interface RollbackGuard {
  expectedDocumentChanges: Map<string, ExpectedDocumentChangeRule>;
  compromised: boolean;
  lastExpectedEventAt: number;
}

interface UndoCandidate {
  patchId: string;
  prepared: PreparedPatch;
  context: ApplyContext;
  postFingerprints: Map<string, string>;
  postStyleUsageIds: Map<string, string[]>;
  expectedDocumentChanges: Map<string, ExpectedDocumentChangeRule>;
  undoInProgress: boolean;
  undoCompromised: boolean;
  forwardEventObserved: boolean;
  lastForwardEventAt: number;
  lastUndoEventAt: number;
  expiresAt: number;
  armTimer: ReturnType<typeof setTimeout> | null;
  expiryTimer: ReturnType<typeof setTimeout> | null;
}

type PatchStatusListener = (snapshot: PatchStatusSnapshot) => void;

const DOCUMENT_EVENT_SETTLE_MS = 750;
const ROLLBACK_SETTLE_TIMEOUT_MS = 5_000;
const ROLLBACK_POLL_MS = 50;

export class PatchEngine {
  private pending: PreparedPatch | null = null;
  private latest: PatchStatusSnapshot | null = null;
  private rollbackIntegrityCompromised = false;
  private preparingPatch = false;
  private applyingGuard: ApplyingGuard | null = null;
  private rollbackGuard: RollbackGuard | null = null;
  private undoCandidate: UndoCandidate | null = null;
  private latestPreview:
    | { patchId: string; data: string }
    | null = null;

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
    this.expireUndoIfNeeded();
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

  public getStatusForBridge(
    patchId: string,
  ): (PatchStatusSnapshot & { postApplyPreviewData?: string }) | null {
    const snapshot = this.getStatus(patchId);
    if (snapshot === null) {
      return null;
    }
    if (
      snapshot.status === "applied" &&
      this.latestPreview?.patchId === snapshot.patchId
    ) {
      return {
        ...snapshot,
        postApplyPreviewData: this.latestPreview.data,
      };
    }
    return snapshot;
  }

  public invalidateUndo(
    reason: UndoInvalidationReason,
  ): PatchStatusSnapshot | null {
    if (this.rollbackGuard !== null) {
      this.rollbackGuard.compromised = true;
    }
    const candidate = this.undoCandidate;
    if (candidate === null) {
      if (
        this.applyingGuard !== null &&
        this.applyingGuard.invalidatedReason === null
      ) {
        this.applyingGuard.invalidatedReason = reason;
      }
      return this.latest;
    }
    if (candidate.undoInProgress) {
      candidate.undoCompromised = true;
      return this.latest;
    }
    if (candidate.armTimer !== null) {
      clearTimeout(candidate.armTimer);
    }
    if (candidate.expiryTimer !== null) {
      clearTimeout(candidate.expiryTimer);
    }
    this.undoCandidate = null;
    const snapshot = this.withUndoState(
      candidate.patchId,
      "unavailable",
      reason,
    );
    return snapshot;
  }

  public handleDocumentChanges(
    changes: ReadonlyArray<TrackedDocumentChange>,
  ): PatchStatusSnapshot | null {
    if (changes.length === 0) {
      return this.latest;
    }

    const applyingGuard = this.applyingGuard;
    if (applyingGuard !== null) {
      if (
        documentChangesMatch(
          changes,
          applyingGuard.expectedDocumentChanges,
          "forward",
        )
      ) {
        applyingGuard.expectedEventObserved = true;
        applyingGuard.lastExpectedEventAt = Date.now();
        return this.latest;
      }
      if (applyingGuard.invalidatedReason === null) {
        applyingGuard.invalidatedReason = "document_changed";
      }
      return this.latest;
    }

    const rollbackGuard = this.rollbackGuard;
    if (rollbackGuard !== null) {
      if (
        documentChangesMatch(
          changes,
          rollbackGuard.expectedDocumentChanges,
          "undo",
        )
      ) {
        rollbackGuard.lastExpectedEventAt = Date.now();
      } else {
        rollbackGuard.compromised = true;
      }
      return this.latest;
    }

    const candidate = this.undoCandidate;
    if (candidate === null) {
      return null;
    }

    const expectedLocalChanges =
      documentChangesMatch(
        changes,
        candidate.expectedDocumentChanges,
        candidate.undoInProgress ? "undo" : "forward",
      );
    if (
      expectedLocalChanges &&
      (candidate.undoInProgress ||
        this.latest?.result?.undo.state === "settling")
    ) {
      if (this.latest?.result?.undo.state === "settling") {
        candidate.forwardEventObserved = true;
        candidate.lastForwardEventAt = Date.now();
        this.scheduleUndoArm(candidate);
      } else {
        candidate.lastUndoEventAt = Date.now();
      }
      return this.latest;
    }

    if (candidate.undoInProgress) {
      candidate.undoCompromised = true;
      return this.latest;
    }

    return this.invalidateUndo("document_changed");
  }

  public async undoLatest(patchId: string): Promise<PatchStatusSnapshot> {
    this.expireUndoIfNeeded();
    const candidate = this.undoCandidate;
    const latest = this.latest;
    if (
      candidate === null ||
      candidate.patchId !== patchId ||
      latest === null ||
      latest.patchId !== patchId ||
      latest.result?.undo.state !== "available"
    ) {
      throw bridgeError(
        "UNDO_UNAVAILABLE",
        "El último lote ya no puede deshacerse de forma segura.",
      );
    }

    const preconditionsInvalid =
      (figma.fileKey ?? null) !== candidate.prepared.patch.fileKey ||
      !(await fingerprintsMatch(candidate.postFingerprints)) ||
      !(await styleUsagesMatch(candidate.postStyleUsageIds)) ||
      !(await createdObjectsExist(candidate.context));
    if (preconditionsInvalid) {
      const invalidated =
        this.undoCandidate === candidate
          ? this.invalidateUndo("document_changed")
          : null;
      return invalidated ?? this.getStatus(patchId) ?? latest;
    }

    this.expireUndoIfNeeded();
    const current = this.getStatus(patchId);
    if (
      this.undoCandidate !== candidate ||
      current?.patchId !== patchId ||
      current.result?.undo.state !== "available"
    ) {
      return current ?? latest;
    }

    if (candidate.armTimer !== null) {
      clearTimeout(candidate.armTimer);
    }
    if (candidate.expiryTimer !== null) {
      clearTimeout(candidate.expiryTimer);
    }

    try {
      candidate.undoInProgress = true;
      candidate.lastUndoEventAt = Date.now();
      figma.triggerUndo();
      const confirmed =
        !candidate.undoCompromised &&
        (await this.waitForRollbackSettlement(
          candidate.prepared,
          candidate.context,
          () =>
            candidate.undoCompromised ||
            this.undoCandidate !== candidate,
          () => candidate.lastUndoEventAt,
        )) &&
        !candidate.undoCompromised;
      if (!confirmed) {
        this.rollbackIntegrityCompromised = true;
        this.undoCandidate = null;
        const snapshot: PatchStatusSnapshot = {
          ...latest,
          status: "indeterminate",
          updatedAt: Date.now(),
          result: {
            ...latest.result,
            undo: {
              state: "unavailable",
              reason: "verification_failed",
            },
          },
          error: {
            code: "UNDO_VERIFICATION_FAILED",
            message:
              "Figma ejecutó Undo, pero el puente no pudo confirmar el estado anterior.",
          },
        };
        this.latest = snapshot;
        this.onStatus(snapshot);
        return snapshot;
      }

      this.undoCandidate = null;
      this.latestPreview = null;
      const snapshot: PatchStatusSnapshot = {
        ...latest,
        status: "undone",
        updatedAt: Date.now(),
        result: {
          ...latest.result,
          undo: { state: "completed" },
        },
      };
      this.latest = snapshot;
      this.onStatus(snapshot);
      return snapshot;
    } catch (error) {
      this.rollbackIntegrityCompromised = true;
      this.undoCandidate = null;
      const technicalError = toBridgeError(error, "UNDO_FAILED");
      const snapshot: PatchStatusSnapshot = {
        ...latest,
        status: "indeterminate",
        updatedAt: Date.now(),
        result: {
          ...latest.result,
          undo: {
            state: "unavailable",
            reason: "verification_failed",
          },
        },
        error: technicalError,
      };
      this.latest = snapshot;
      this.onStatus(snapshot);
      return snapshot;
    }
  }

  public async propose(rawPatch: unknown): Promise<PatchStatusSnapshot> {
    if (this.rollbackIntegrityCompromised) {
      throw bridgeError(
        "ROLLBACK_NOT_CONFIRMED",
        "Las escrituras están bloqueadas porque no se pudo confirmar una reversión. Cerrá y volvé a abrir el plugin.",
      );
    }
    this.expirePendingIfNeeded();
    this.invalidateUndo("superseded");
    this.latestPreview = null;
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
      await this.assertFileAndPage(patch);

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

    const expectedDocumentChanges = prepared.expectedDocumentChanges;
    this.applyingGuard = {
      patchId: prepared.patch.patchId,
      expectedDocumentChanges,
      invalidatedReason: null,
      expectedEventObserved: false,
      lastExpectedEventAt: 0,
    };
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
      expectedDocumentChanges,
      mutated: false,
    };

    try {
      await figma.loadAllPagesAsync();
      const dimensionsBefore = await captureDimensions(
        prepared.affectedNodeIds,
      );
      await this.assertFresh(prepared);
      await loadFontRoles(prepared.requiredFontRoles);
      await loadCurrentFonts(prepared.currentFonts.values());
      await this.assertFresh(prepared);
      this.assertApplyStillExclusive(prepared.patch.patchId, applyContext);

      figma.commitUndo();
      for (const operation of prepared.patch.operations) {
        await this.applyOperation(operation, applyContext);
        this.assertApplyStillExclusive(prepared.patch.patchId, applyContext);
      }
      const documentChangeState = await detectDocumentChange(
        prepared,
        applyContext,
      );
      if (documentChangeState === "unchanged") {
        throw bridgeError(
          "NO_DOCUMENT_CHANGE",
          "Figma no registró ningún cambio real para el lote; no se creó una acción de Undo.",
        );
      }
      if (documentChangeState === "unknown") {
        throw bridgeError(
          "DOCUMENT_CHANGE_UNCONFIRMED",
          "El puente no pudo confirmar si Figma modificó el documento.",
        );
      }
      await this.assertPostconditions(prepared.patch, applyContext);
      this.assertApplyStillExclusive(prepared.patch.patchId, applyContext);

      const dimensionsAfter = await captureDimensions(
        applyContext.affectedNodeIds,
      );
      this.assertApplyStillExclusive(prepared.patch.patchId, applyContext);
      const dimensionChanges = compareDimensions(
        dimensionsBefore,
        dimensionsAfter,
      );
      const affectedNodeIds = Array.from(applyContext.affectedNodeIds).sort();
      const affectedNodes = await describeAffectedNodes(affectedNodeIds);
      this.assertApplyStillExclusive(prepared.patch.patchId, applyContext);
      const preview = await exportPreview(
        prepared.patch.preview.nodeId,
        prepared.patch.preview.maxDimension,
      );
      this.assertApplyStillExclusive(prepared.patch.patchId, applyContext);
      const { data: postApplyPreviewData, ...postApplyPreview } = preview;
      const postFingerprintKeys = new Set(
        prepared.fingerprintsAtProposal.keys(),
      );
      for (const nodeId of applyContext.createdNodeIds) {
        postFingerprintKeys.add(nodeKey(nodeId));
      }
      for (const styleId of applyContext.createdStyleIds) {
        postFingerprintKeys.add(styleKey(styleId));
      }
      const postFingerprints = await captureCurrentFingerprints(
        postFingerprintKeys,
      );
      this.assertApplyStillExclusive(prepared.patch.patchId, applyContext);
      const postStyleUsageIds = await captureStyleUsages([
        ...prepared.styleUsageIdsAtProposal.keys(),
        ...applyContext.createdStyleIds,
      ]);
      this.assertApplyStillExclusive(prepared.patch.patchId, applyContext);
      figma.commitUndo();

      const warnings: string[] = [];
      const undoExpiresAt = Date.now() + PATCH_TTL_MS;
      const completedApplyingGuard =
        this.applyingGuard?.patchId === prepared.patch.patchId
          ? this.applyingGuard
          : null;
      const undoInvalidationReason =
        completedApplyingGuard !== null
          ? completedApplyingGuard.invalidatedReason
          : "document_changed";
      this.applyingGuard = null;
      const snapshot: PatchStatusSnapshot = {
        patchId: prepared.patch.patchId,
        approvalDigest: prepared.snapshot.approvalDigest,
        status: "applied",
        updatedAt: Date.now(),
        summary: prepared.snapshot.summary,
        result: {
          operationCount: prepared.patch.operations.length,
          affectedNodeIds,
          dimensionChanges,
          createdStyleIds: applyContext.createdStyleIds,
          createdNodeIds: applyContext.createdNodeIds,
          warnings,
          affectedNodes,
          postApplyPreview,
          undo:
            undoInvalidationReason === null
              ? {
                  state: "settling",
                  expiresAt: undoExpiresAt,
                }
              : {
                  state: "unavailable",
                  reason: undoInvalidationReason,
                },
        },
      };

      this.pending = null;
      this.latest = snapshot;
      this.latestPreview = {
        patchId: snapshot.patchId,
        data: postApplyPreviewData,
      };
      if (undoInvalidationReason === null) {
        const undoCandidate: UndoCandidate = {
          patchId: snapshot.patchId,
          prepared,
          context: applyContext,
          postFingerprints,
          postStyleUsageIds,
          expectedDocumentChanges,
          undoInProgress: false,
          undoCompromised: false,
          forwardEventObserved:
            completedApplyingGuard?.expectedEventObserved ?? false,
          lastForwardEventAt:
            completedApplyingGuard?.lastExpectedEventAt ?? 0,
          lastUndoEventAt: 0,
          expiresAt: undoExpiresAt,
          armTimer: null,
          expiryTimer: null,
        };
        undoCandidate.expiryTimer = setTimeout(() => {
          this.expireUndoIfNeeded();
        }, PATCH_TTL_MS + 10);
        this.undoCandidate = undoCandidate;
        if (undoCandidate.forwardEventObserved) {
          this.scheduleUndoArm(undoCandidate);
        }
      }
      this.onStatus(snapshot);
      return snapshot;
    } catch (error) {
      const technicalError = toBridgeError(error, "PATCH_APPLY_FAILED");
      const finishConcurrentApply = (
        reason: UndoInvalidationReason,
      ): PatchStatusSnapshot => {
        this.applyingGuard = null;
        this.rollbackIntegrityCompromised = true;
        const snapshot: PatchStatusSnapshot = {
          patchId: prepared.patch.patchId,
          approvalDigest: prepared.snapshot.approvalDigest,
          status: "indeterminate",
          updatedAt: Date.now(),
          summary: prepared.snapshot.summary,
          error: {
            code: "CONCURRENT_CHANGE_DURING_APPLY",
            message:
              "Se detectó actividad ajena durante la aplicación. El puente se detuvo sin ejecutar Undo automático para no revertir cambios del usuario; revisá el archivo y usá el Undo nativo de Figma si corresponde.",
            details: {
              reason,
              causeCode: technicalError.code,
            },
          },
        };
        this.pending = null;
        this.latest = snapshot;
        this.onStatus(snapshot);
        return snapshot;
      };

      if (
        !applyContext.mutated &&
        isStalePatchError(technicalError.code)
      ) {
        this.applyingGuard = null;
        const snapshot: PatchStatusSnapshot = {
          patchId: prepared.patch.patchId,
          approvalDigest: prepared.snapshot.approvalDigest,
          status: "stale",
          updatedAt: Date.now(),
          summary: prepared.snapshot.summary,
          error: technicalError,
        };
        this.pending = null;
        this.latest = snapshot;
        this.onStatus(snapshot);
        return snapshot;
      }

      let rollbackConfirmed = !applyContext.mutated;
      if (applyContext.mutated) {
        const applyingGuard = this.applyingGuard;
        if (
          applyingGuard === null ||
          applyingGuard.patchId !== prepared.patch.patchId
        ) {
          return finishConcurrentApply("document_changed");
        }
        if (applyingGuard.invalidatedReason !== null) {
          return finishConcurrentApply(applyingGuard.invalidatedReason);
        }

        let documentChangeState = await detectDocumentChange(
          prepared,
          applyContext,
        );
        if (applyingGuard.invalidatedReason !== null) {
          return finishConcurrentApply(applyingGuard.invalidatedReason);
        }

        if (documentChangeState === "changed") {
          const forwardSettled =
            await this.waitForApplyingGuardSettlement(applyingGuard);
          if (applyingGuard.invalidatedReason !== null) {
            return finishConcurrentApply(applyingGuard.invalidatedReason);
          }
          if (forwardSettled) {
            documentChangeState = await detectDocumentChange(
              prepared,
              applyContext,
            );
          } else {
            documentChangeState = "unknown";
          }
          if (applyingGuard.invalidatedReason !== null) {
            return finishConcurrentApply(applyingGuard.invalidatedReason);
          }
        }

        if (documentChangeState === "unchanged") {
          this.applyingGuard = null;
          rollbackConfirmed = true;
        } else if (documentChangeState === "changed") {
          const rollbackGuard: RollbackGuard = {
            expectedDocumentChanges,
            compromised: false,
            lastExpectedEventAt: Date.now(),
          };
          this.rollbackGuard = rollbackGuard;
          this.applyingGuard = null;
          try {
            figma.triggerUndo();
            rollbackConfirmed = await this.waitForRollbackSettlement(
              prepared,
              applyContext,
              () => rollbackGuard.compromised,
              () => rollbackGuard.lastExpectedEventAt,
            );
          } catch {
            rollbackConfirmed = false;
          } finally {
            if (this.rollbackGuard === rollbackGuard) {
              this.rollbackGuard = null;
            }
          }
        } else {
          this.applyingGuard = null;
          rollbackConfirmed = false;
        }
      } else {
        this.applyingGuard = null;
      }
      if (!rollbackConfirmed) {
        this.rollbackIntegrityCompromised = true;
      }

      const reportedError = rollbackConfirmed
        ? technicalError
        : toBridgeError(error, "ROLLBACK_NOT_CONFIRMED");
      const snapshot: PatchStatusSnapshot = {
        patchId: prepared.patch.patchId,
        approvalDigest: prepared.snapshot.approvalDigest,
        status: rollbackConfirmed
          ? "failed_rolled_back"
          : "failed_rollback",
        updatedAt: Date.now(),
        summary: prepared.snapshot.summary,
        error: rollbackConfirmed
          ? reportedError
          : {
              code: "ROLLBACK_NOT_CONFIRMED",
              message:
                "La aplicación falló y Figma no confirmó la reversión automática.",
              details: { causeCode: reportedError.code },
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
    const createdStyles = new Map<string, CreatedStyleDefinition>();
    const projectedExistingStyles = new Map<
      string,
      ProjectedExistingStyleDefinition
    >();
    const styleUpdateOperations = new Map<
      string,
      Extract<PatchOperation, { op: "update_text_style" }>
    >();
    const allTempIds = new Set<string>();
    const rangesByNode = new Map<
      string,
      Array<{ start: number; end: number }>
    >();
    const contentReplacementNodes = new Set<string>();
    const autoRenameContentNodes = new Set<string>();
    const fullNodeStyleOperations = new Set<string>();
    const previewNode = await getPreviewNodeById(patch.preview.nodeId);
    if (pageForNode(previewNode).id !== patch.pageId) {
      throw bridgeError(
        "PREVIEW_OUTSIDE_SCOPE",
        "La vista previa debe pertenecer a la página indicada por el lote.",
      );
    }
    if (
      patch.selectionIds.length > 0 &&
      !patch.selectionIds.includes(previewNode.id)
    ) {
      throw bridgeError(
        "PREVIEW_OUTSIDE_SCOPE",
        "La vista previa debe ser uno de los nodos seleccionados.",
      );
    }
    fingerprints.set(
      previewNodeKey(previewNode.id),
      fingerprintPreviewNode(previewNode),
    );
    const previewTarget = {
      nodeId: previewNode.id,
      name: truncateNodeName(previewNode.name).name,
      maxDimension: patch.preview.maxDimension,
    };

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
        createdStyles.set(operation.tempId, {
          operationIndex: index,
          fontRole: operation.typography.fontRole,
        });
      }
      if (operation.op === "update_text_style") {
        if (styleUpdateOperations.has(operation.styleId)) {
          throw bridgeError(
            "CONFLICTING_STYLE_OPERATIONS",
            `El estilo ${operation.styleId} solo puede actualizarse una vez por lote.`,
          );
        }
        styleUpdateOperations.set(operation.styleId, operation);
      }
    });

    for (const operation of styleUpdateOperations.values()) {
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
      const resultingName = operation.name ?? style.name;
      const explicitRole = operation.typography?.fontRole;
      const protectedVariableFields = new Set(
        variableFieldsForTypography(operation.typography),
      );
      assertNoBoundStyleVariables(
        style,
        Array.from(protectedVariableFields),
        "actualizar",
      );
      const resultingRole = explicitRole ?? assertAllowedFontName(style.fontName);
      assertSemanticStyleRole(resultingName, resultingRole);
      projectedExistingStyles.set(style.id, {
        style,
        name: resultingName,
        fontRole: resultingRole,
      });
    }

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
          assertSemanticStyleRole(
            operation.name,
            operation.typography.fontRole,
          );
          break;
        }

        case "update_text_style": {
          const projection = projectedExistingStyles.get(operation.styleId);
          if (projection === undefined) {
            throw bridgeError(
              "INVALID_STYLE_REFERENCE",
              `No se pudo proyectar el estilo ${operation.styleId}.`,
            );
          }
          const { style } = projection;
          assertFingerprint(
            styleKey(style.id),
            operation.expectedFingerprint,
            fingerprintTextStyle(style),
            fingerprints,
          );
          if (styleUpdateIsNoOp(style, operation)) {
            throw bridgeError(
              "NO_OP_OPERATION",
              `La actualización del estilo ${style.id} no produciría cambios.`,
            );
          }

          requiredFontRoles.add(projection.fontRole);

          const usages = await findTextStyleUsages(style.id);
          styleUsageIdsAtProposal.set(
            style.id,
            usages.map((node) => node.id).sort(),
          );
          for (const node of usages) {
            affectedNodeIds.add(node.id);
            globalStyleNodeIds.add(node.id);
            fingerprints.set(
              observedNodeKey(node.id),
              fingerprintTextNode(node),
            );
          }
          break;
        }

        case "bind_text_style": {
          const node = await getTextNodeById(operation.nodeId);
          this.assertNodeInScope(node, patch);
          prepareWritableTextNode(node, currentFonts, true);
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
          assertNoHyperlinksInRange(
            node,
            0,
            node.characters.length,
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
            projectedExistingStyles,
            fingerprints,
            requiredFontRoles,
          );
          const existingStyleId =
            operation.style.kind === "existing"
              ? operation.style.styleId
              : null;
          const bindNoOpStyle =
            existingStyleId !== null
              ? await getTextStyleById(existingStyleId)
              : null;
          if (
            bindNoOpStyle !== null &&
            textNodeMatchesTextStyle(node, bindNoOpStyle)
          ) {
            throw bridgeError(
              "NO_OP_OPERATION",
              `La capa ${node.id} ya está vinculada al estilo ${existingStyleId}.`,
            );
          }
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
          if (operation.style !== undefined) {
            assertNoHyperlinksInRange(
              node,
              operation.start,
              operation.end,
              "vincular un estilo al rango",
            );
          }
          assertUtf16Boundary(node.characters, operation.start, node.id);
          assertUtf16Boundary(node.characters, operation.end, node.id);
          if (
            operation.style === undefined &&
            operation.typography?.fontRole === undefined
          ) {
            assertAllowedFontsInRange(
              node,
              operation.start,
              operation.end,
            );
          }
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
            const styleRole = await this.prepareStyleReference(
              operation.style,
              operationIndex,
              createdStyles,
              projectedExistingStyles,
              fingerprints,
              requiredFontRoles,
            );
            assertStyleFontRoleCompatibility(
              styleRole,
              operation.typography?.fontRole,
              `el rango de ${node.id}`,
            );
          }
          const rangeNoOpStyle =
            operation.style?.kind === "existing"
              ? await getTextStyleById(operation.style.styleId)
              : null;
          if (rangeUpdateIsNoOp(node, operation, rangeNoOpStyle)) {
            throw bridgeError(
              "NO_OP_OPERATION",
              `El rango ${operation.start}-${operation.end} de ${node.id} no produciría cambios.`,
            );
          }
          break;
        }

        case "set_characters": {
          const node = await getTextNodeById(operation.nodeId);
          this.assertNodeInScope(node, patch);
          prepareWritableTextNode(node, currentFonts);
          assertNoHyperlinksInRange(
            node,
            0,
            node.characters.length,
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
          if (node.autoRename) {
            autoRenameContentNodes.add(node.id);
          }
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
          if (node.characters === operation.characters) {
            throw bridgeError(
              "NO_OP_OPERATION",
              `La capa ${node.id} ya contiene exactamente el texto solicitado.`,
            );
          }
          affectedNodeIds.add(node.id);
          break;
        }

        case "set_text_box_width": {
          const node = await getTextNodeById(operation.nodeId);
          this.assertNodeInScope(node, patch);
          prepareWritableTextNode(node, currentFonts);
          assertFingerprint(
            nodeKey(node.id),
            operation.expectedFingerprint,
            fingerprintTextNode(node),
            fingerprints,
          );
          if (
            Math.abs(node.width - operation.width) <= 0.01 &&
            node.textAutoResize === "HEIGHT"
          ) {
            throw bridgeError(
              "NO_OP_OPERATION",
              `La caja de texto ${node.id} ya mide ${operation.width}px de ancho y usa autoajuste vertical.`,
            );
          }
          affectedNodeIds.add(node.id);
          break;
        }

        case "create_text_node": {
          const parent = await getParentById(operation.parentId);
          this.assertNodeInScope(parent, patch);
          assertWritableContainer(parent);
          if (
            "layoutMode" in parent &&
            parent.layoutMode === "GRID"
          ) {
            throw bridgeError(
              "GRID_LAYOUT_REJECTED",
              `La capa nueva ${operation.tempId} no puede insertarse en un contenedor Grid en v0.1.`,
            );
          }
          if (
            (operation.x !== undefined || operation.y !== undefined) &&
            "layoutMode" in parent &&
            parent.layoutMode !== "NONE"
          ) {
            throw bridgeError(
              "AUTO_LAYOUT_POSITION_REJECTED",
              `La capa nueva ${operation.tempId} no puede definir x/y dentro de un contenedor Auto Layout en v0.1.`,
            );
          }
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
            const styleRole = await this.prepareStyleReference(
              operation.style,
              operationIndex,
              createdStyles,
              projectedExistingStyles,
              fingerprints,
              requiredFontRoles,
            );
            assertStyleFontRoleCompatibility(
              styleRole,
              operation.typography?.fontRole,
              `la nueva capa ${operation.tempId}`,
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

    const expectedDocumentChanges = await buildExpectedDocumentChangeRules(
      patch,
      affectedNodeIds,
      fingerprints,
    );
    const affectedNodesAtProposal = await describeAffectedNodes(
      Array.from(affectedNodeIds).sort(),
    );
    const summary = summarizePatch(
      patch,
      affectedNodeIds,
      globalStyleNodeIds,
      autoRenameContentNodes,
      affectedNodesAtProposal,
      previewTarget,
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
      preview: patch.preview,
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
      expectedDocumentChanges,
    };
  }

  private async prepareStyleReference(
    styleRef: StyleReference,
    operationIndex: number,
    createdStyles: ReadonlyMap<string, CreatedStyleDefinition>,
    projectedExistingStyles: ReadonlyMap<
      string,
      ProjectedExistingStyleDefinition
    >,
    fingerprints: Map<string, string>,
    requiredFontRoles: Set<FontRole>,
  ): Promise<FontRole> {
    if (styleRef.kind === "created") {
      const definition = createdStyles.get(styleRef.tempId);
      if (
        definition === undefined ||
        definition.operationIndex >= operationIndex
      ) {
        throw bridgeError(
          "INVALID_STYLE_REFERENCE",
          `La referencia ${styleRef.tempId} debe apuntar a un estilo creado antes en el mismo lote.`,
        );
      }
      if (definition.fontRole === undefined) {
        throw bridgeError(
          "INVALID_NEW_TEXT_STYLE",
          `El estilo nuevo ${styleRef.tempId} no define un fontRole.`,
        );
      }
      return definition.fontRole;
    }

    const style = await getTextStyleById(styleRef.styleId);
    assertLocalTextStyle(style);
    assertFingerprint(
      styleKey(style.id),
      styleRef.expectedFingerprint,
      fingerprintTextStyle(style),
      fingerprints,
    );
    const projected = projectedExistingStyles.get(style.id);
    const role = projected?.fontRole ?? assertAllowedFontName(style.fontName);
    assertSemanticStyleRole(projected?.name ?? style.name, role);
    requiredFontRoles.add(role);
    return role;
  }

  private assertApplyStillExclusive(
    patchId: string,
    context: ApplyContext,
  ): void {
    const guard = this.applyingGuard;
    const reason =
      guard === null || guard.patchId !== patchId
        ? "document_changed"
        : guard.invalidatedReason;
    if (reason === null) {
      return;
    }
    if (!context.mutated) {
      throw bridgeError(
        "STALE_FINGERPRINT",
        "El lote quedó obsoleto por actividad concurrente antes de la primera escritura.",
        { reason },
      );
    }
    throw bridgeError(
      "CONCURRENT_CHANGE_DURING_APPLY",
      "Se detectó actividad ajena mientras Figma aplicaba el lote.",
      { reason },
    );
  }

  private async assertFresh(prepared: PreparedPatch): Promise<void> {
    this.assertPatchTiming(prepared.patch);
    await this.assertFileAndPage(prepared.patch);

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
        registerCreatedStyleChangeRule(
          context.expectedDocumentChanges,
          style.id,
          operation,
        );
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

      case "set_text_box_width": {
        const node = await getTextNodeById(operation.nodeId);
        context.mutated = true;
        node.textAutoResize = "HEIGHT";
        node.resize(operation.width, node.height);
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
        registerCreatedNodeChangeRule(
          context.expectedDocumentChanges,
          node.id,
          operation,
        );
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

        case "set_text_box_width": {
          const node = await getTextNodeById(operation.nodeId);
          assertCloseValue(
            "ancho de la caja de texto",
            node.width,
            operation.width,
          );
          assertExactValue(
            "autoajuste de texto",
            node.textAutoResize,
            "HEIGHT",
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

  private async waitForApplyingGuardSettlement(
    guard: ApplyingGuard,
  ): Promise<boolean> {
    const startedAt = Date.now();
    const deadline = startedAt + ROLLBACK_SETTLE_TIMEOUT_MS;
    while (Date.now() <= deadline) {
      if (
        this.applyingGuard !== guard ||
        guard.invalidatedReason !== null
      ) {
        return false;
      }
      const quietSince = Math.max(startedAt, guard.lastExpectedEventAt);
      if (
        guard.expectedEventObserved &&
        Date.now() - quietSince >= DOCUMENT_EVENT_SETTLE_MS
      ) {
        return true;
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        return false;
      }
      await wait(Math.min(ROLLBACK_POLL_MS, remaining));
    }
    return false;
  }

  private async waitForRollbackSettlement(
    prepared: PreparedPatch,
    context: ApplyContext,
    isCompromised: () => boolean,
    lastExpectedEventAt: () => number,
  ): Promise<boolean> {
    const deadline = Date.now() + ROLLBACK_SETTLE_TIMEOUT_MS;
    while (Date.now() <= deadline) {
      if (isCompromised()) {
        return false;
      }
      const restored = await this.verifyRollback(prepared, context);
      if (isCompromised()) {
        return false;
      }
      if (
        restored &&
        Date.now() - lastExpectedEventAt() >= DOCUMENT_EVENT_SETTLE_MS
      ) {
        return (
          !isCompromised() &&
          (await this.verifyRollback(prepared, context)) &&
          !isCompromised()
        );
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        return false;
      }
      await wait(Math.min(ROLLBACK_POLL_MS, remaining));
    }
    return false;
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

  private assertNodeInScope(node: BaseNode, patch: TypographyPatch): void {
    if (pageForNode(node).id !== patch.pageId) {
      throw bridgeError(
        "NODE_OUTSIDE_SCOPE",
        `El nodo ${node.id} pertenece a otra página.`,
      );
    }
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
        "El lote no puede permanecer válido más de cinco minutos.",
      );
    }
  }

  private async assertFileAndPage(patch: TypographyPatch): Promise<void> {
    const currentFileKey = figma.fileKey ?? null;
    if (currentFileKey === null || patch.fileKey !== currentFileKey) {
      throw bridgeError(
        "FILE_MISMATCH",
        "El lote fue preparado para otro archivo de Figma.",
      );
    }
    const page = await figma.getNodeByIdAsync(patch.pageId);
    if (page?.type !== "PAGE") {
      throw bridgeError(
        "PAGE_MISMATCH",
        "No existe la página de Figma indicada por el lote.",
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

  private scheduleUndoArm(candidate: UndoCandidate): void {
    if (!candidate.forwardEventObserved) {
      return;
    }
    if (candidate.armTimer !== null) {
      clearTimeout(candidate.armTimer);
    }
    const remaining = Math.max(
      0,
      DOCUMENT_EVENT_SETTLE_MS -
        (Date.now() - candidate.lastForwardEventAt),
    );
    candidate.armTimer = setTimeout(() => {
      this.armUndo(candidate.patchId);
    }, remaining);
  }

  private armUndo(patchId: string): void {
    const candidate = this.undoCandidate;
    if (
      candidate === null ||
      candidate.patchId !== patchId ||
      this.latest?.patchId !== patchId ||
      this.latest.result?.undo.state !== "settling"
    ) {
      return;
    }
    candidate.armTimer = null;
    this.withUndoState(patchId, "available");
  }

  private expireUndoIfNeeded(): void {
    const candidate = this.undoCandidate;
    if (candidate === null || candidate.expiresAt > Date.now()) {
      return;
    }
    if (candidate.armTimer !== null) {
      clearTimeout(candidate.armTimer);
    }
    if (candidate.expiryTimer !== null) {
      clearTimeout(candidate.expiryTimer);
    }
    this.undoCandidate = null;
    this.withUndoState(candidate.patchId, "unavailable", "expired");
  }

  private withUndoState(
    patchId: string,
    state: "available" | "unavailable",
    reason?:
      | "document_changed"
      | "focus_left"
      | "page_changed"
      | "ui_hidden"
      | "superseded"
      | "expired",
  ): PatchStatusSnapshot | null {
    const latest = this.latest;
    if (
      latest === null ||
      latest.patchId !== patchId ||
      latest.result === undefined
    ) {
      return null;
    }
    const snapshot: PatchStatusSnapshot = {
      ...latest,
      updatedAt: Date.now(),
      result: {
        ...latest.result,
        undo: {
          state,
          ...(reason === undefined ? {} : { reason }),
          ...(state === "available" && this.undoCandidate !== null
            ? { expiresAt: this.undoCandidate.expiresAt }
            : {}),
        },
      },
    };
    this.latest = snapshot;
    this.onStatus(snapshot);
    return snapshot;
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
      ...(error === undefined ? {} : { error }),
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

function styleUpdateIsNoOp(
  style: TextStyle,
  operation: Extract<PatchOperation, { op: "update_text_style" }>,
): boolean {
  if (operation.name !== undefined && operation.name !== style.name) {
    return false;
  }
  if (
    operation.description !== undefined &&
    operation.description !== style.description
  ) {
    return false;
  }
  return typographyMatchesTextStyle(style, operation.typography);
}

function typographyMatchesTextStyle(
  style: TextStyle,
  typography: TypographyProperties | undefined,
): boolean {
  if (typography === undefined) {
    return true;
  }
  if (
    typography.fontRole !== undefined &&
    !exactValueMatches(style.fontName, fontNameForRole(typography.fontRole))
  ) {
    return false;
  }
  if (
    typography.fontSize !== undefined &&
    !exactValueMatches(style.fontSize, typography.fontSize)
  ) {
    return false;
  }
  if (
    typography.lineHeight !== undefined &&
    !exactValueMatches(style.lineHeight, typography.lineHeight)
  ) {
    return false;
  }
  if (
    typography.letterSpacing !== undefined &&
    !exactValueMatches(style.letterSpacing, typography.letterSpacing)
  ) {
    return false;
  }
  if (
    typography.textCase !== undefined &&
    !exactValueMatches(style.textCase, typography.textCase)
  ) {
    return false;
  }
  if (
    typography.textDecoration !== undefined &&
    !exactValueMatches(style.textDecoration, typography.textDecoration)
  ) {
    return false;
  }
  return true;
}

function textNodeMatchesTextStyle(
  node: TextNode,
  style: TextStyle | null,
): boolean {
  return (
    style !== null &&
    exactValueMatches(node.textStyleId, style.id) &&
    completeStyleNodeValuesMatch(node, style) &&
    styleSegmentsMatch(node, 0, node.characters.length, style)
  );
}

function rangeMatchesProjectedTextStyle(
  node: TextNode,
  start: number,
  end: number,
  style: TextStyle,
  typography: TypographyProperties | undefined,
): boolean {
  const projectedFontName =
    typography?.fontRole === undefined
      ? style.fontName
      : fontNameForRole(typography.fontRole);
  const projectedFontSize = typography?.fontSize ?? style.fontSize;
  const projectedLineHeight = typography?.lineHeight ?? style.lineHeight;
  const projectedLetterSpacing =
    typography?.letterSpacing ?? style.letterSpacing;
  const projectedTextCase = typography?.textCase ?? style.textCase;
  const projectedTextDecoration =
    typography?.textDecoration ?? style.textDecoration;
  return (
    exactValueMatches(node.getRangeTextStyleId(start, end), style.id) &&
    exactValueMatches(
      node.getRangeFontName(start, end),
      projectedFontName,
    ) &&
    exactValueMatches(
      node.getRangeFontSize(start, end),
      projectedFontSize,
    ) &&
    exactValueMatches(
      node.getRangeLineHeight(start, end),
      projectedLineHeight,
    ) &&
    exactValueMatches(
      node.getRangeLetterSpacing(start, end),
      projectedLetterSpacing,
    ) &&
    exactValueMatches(
      node.getRangeTextCase(start, end),
      projectedTextCase,
    ) &&
    exactValueMatches(
      node.getRangeTextDecoration(start, end),
      projectedTextDecoration,
    ) &&
    exactValueMatches(node.leadingTrim, style.leadingTrim) &&
    exactValueMatches(node.hangingPunctuation, style.hangingPunctuation) &&
    exactValueMatches(node.hangingList, style.hangingList) &&
    styleSegmentsMatchProjectedValues(
      node,
      start,
      end,
      style,
      {
        fontName: projectedFontName,
        fontSize: projectedFontSize,
        lineHeight: projectedLineHeight,
        letterSpacing: projectedLetterSpacing,
        textCase: projectedTextCase,
        textDecoration: projectedTextDecoration,
      },
      projectedTextStyleOverrideTypes(style, typography),
    )
  );
}

function completeStyleNodeValuesMatch(
  node: TextNode,
  style: TextStyle,
): boolean {
  return (
    exactValueMatches(node.fontName, style.fontName) &&
    exactValueMatches(node.fontSize, style.fontSize) &&
    exactValueMatches(node.lineHeight, style.lineHeight) &&
    exactValueMatches(node.letterSpacing, style.letterSpacing) &&
    exactValueMatches(node.textCase, style.textCase) &&
    exactValueMatches(node.textDecoration, style.textDecoration) &&
    exactValueMatches(node.leadingTrim, style.leadingTrim) &&
    exactValueMatches(node.paragraphIndent, style.paragraphIndent) &&
    exactValueMatches(node.paragraphSpacing, style.paragraphSpacing) &&
    exactValueMatches(node.listSpacing, style.listSpacing) &&
    exactValueMatches(node.hangingPunctuation, style.hangingPunctuation) &&
    exactValueMatches(node.hangingList, style.hangingList)
  );
}

function styleSegmentsMatch(
  node: TextNode,
  start: number,
  end: number,
  style: TextStyle,
): boolean {
  return styleSegmentsMatchProjectedValues(
    node,
    start,
    end,
    style,
    {
      fontName: style.fontName,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      textCase: style.textCase,
      textDecoration: style.textDecoration,
    },
    [],
  );
}

function styleSegmentsMatchProjectedValues(
  node: TextNode,
  start: number,
  end: number,
  style: TextStyle,
  projected: {
    fontName: FontName;
    fontSize: number;
    lineHeight: LineHeight;
    letterSpacing: LetterSpacing;
    textCase: TextCase;
    textDecoration: TextDecoration;
  },
  expectedOverrideTypes: ReadonlyArray<TextStyleOverrideType["type"]>,
): boolean {
  if (start === end) {
    return true;
  }
  const segments = node.getStyledTextSegments(
    [
      "fontName",
      "fontSize",
      "textStyleId",
      "lineHeight",
      "letterSpacing",
      "textCase",
      "textDecoration",
      "listSpacing",
      "paragraphIndent",
      "paragraphSpacing",
      "textStyleOverrides",
    ],
    start,
    end,
  );
  return segments.every(
    (segment) =>
      exactValueMatches(segment.textStyleId, style.id) &&
      exactValueMatches(segment.fontName, projected.fontName) &&
      exactValueMatches(segment.fontSize, projected.fontSize) &&
      exactValueMatches(segment.lineHeight, projected.lineHeight) &&
      exactValueMatches(segment.letterSpacing, projected.letterSpacing) &&
      exactValueMatches(segment.textCase, projected.textCase) &&
      exactValueMatches(
        segment.textDecoration,
        projected.textDecoration,
      ) &&
      exactValueMatches(segment.listSpacing, style.listSpacing) &&
      exactValueMatches(segment.paragraphIndent, style.paragraphIndent) &&
      exactValueMatches(segment.paragraphSpacing, style.paragraphSpacing) &&
      textStyleOverrideTypesMatch(
        segment.textStyleOverrides,
        expectedOverrideTypes,
      ),
  );
}

function projectedTextStyleOverrideTypes(
  style: TextStyle,
  typography: TypographyProperties | undefined,
): TextStyleOverrideType["type"][] {
  const types: TextStyleOverrideType["type"][] = [];
  if (
    typography?.fontRole !== undefined &&
    !exactValueMatches(fontNameForRole(typography.fontRole), style.fontName)
  ) {
    types.push("SEMANTIC_WEIGHT");
  }
  if (
    typography?.textDecoration !== undefined &&
    !exactValueMatches(typography.textDecoration, style.textDecoration)
  ) {
    types.push("TEXT_DECORATION");
  }
  return types;
}

function textStyleOverrideTypesMatch(
  actual: ReadonlyArray<TextStyleOverrideType>,
  expectedTypes: ReadonlyArray<TextStyleOverrideType["type"]>,
): boolean {
  const actualTypes = actual.map(({ type }) => type).sort();
  const sortedExpectedTypes = [...expectedTypes].sort();
  return exactValueMatches(actualTypes, sortedExpectedTypes);
}

function rangeUpdateIsNoOp(
  node: TextNode,
  operation: Extract<PatchOperation, { op: "set_text_range" }>,
  styleForNoOp: TextStyle | null,
): boolean {
  if (operation.style !== undefined) {
    if (operation.style.kind === "created") {
      return false;
    }
    if (
      styleForNoOp === null ||
      !rangeMatchesProjectedTextStyle(
        node,
        operation.start,
        operation.end,
        styleForNoOp,
        operation.typography,
      )
    ) {
      return false;
    }
  }

  const typography = operation.typography;
  if (typography === undefined) {
    return true;
  }
  if (
    typography.fontRole !== undefined &&
    !exactValueMatches(
      node.getRangeFontName(operation.start, operation.end),
      fontNameForRole(typography.fontRole),
    )
  ) {
    return false;
  }
  if (
    typography.fontSize !== undefined &&
    !exactValueMatches(
      node.getRangeFontSize(operation.start, operation.end),
      typography.fontSize,
    )
  ) {
    return false;
  }
  if (
    typography.lineHeight !== undefined &&
    !exactValueMatches(
      node.getRangeLineHeight(operation.start, operation.end),
      typography.lineHeight,
    )
  ) {
    return false;
  }
  if (
    typography.letterSpacing !== undefined &&
    !exactValueMatches(
      node.getRangeLetterSpacing(operation.start, operation.end),
      typography.letterSpacing,
    )
  ) {
    return false;
  }
  if (
    typography.textCase !== undefined &&
    !exactValueMatches(
      node.getRangeTextCase(operation.start, operation.end),
      typography.textCase,
    )
  ) {
    return false;
  }
  if (
    typography.textDecoration !== undefined &&
    !exactValueMatches(
      node.getRangeTextDecoration(operation.start, operation.end),
      typography.textDecoration,
    )
  ) {
    return false;
  }
  return true;
}

function countCreateTextOperations(operations: readonly PatchOperation[]): number {
  return operations.filter((operation) => operation.op === "create_text_node")
    .length;
}

function summarizePatch(
  patch: TypographyPatch,
  affectedNodeIds: ReadonlySet<string>,
  globalStyleNodeIds: ReadonlySet<string>,
  autoRenameContentNodes: ReadonlySet<string>,
  affectedNodes: UiPatchSummary["affectedNodes"],
  previewTarget: UiPatchSummary["previewTarget"],
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
  if (autoRenameContentNodes.size > 0) {
    warnings.push(
      `${autoRenameContentNodes.size} capas tienen Auto Rename activo; Figma actualizará sus nombres junto con el contenido.`,
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
    affectedNodes,
    previewTarget,
  };
}

function describeOperation(
  operation: PatchOperation,
  index: number,
): string {
  const prefix = `${index + 1}.`;
  switch (operation.op) {
    case "create_text_style":
      return (
        `${prefix} Crear estilo “${operation.name}”` +
        `${operation.description === undefined ? "" : `; descripción ${quotedPreview(operation.description)}`}` +
        `; ${describeTypography(operation.typography)}.`
      );
    case "update_text_style": {
      const changes = [
        operation.name === undefined ? null : `nombre → “${operation.name}”`,
        operation.description === undefined
          ? null
          : `descripción → ${quotedPreview(operation.description)}`,
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
    case "set_text_box_width":
      return `${prefix} Ajustar la caja de texto ${operation.nodeId} a ${operation.width}px de ancho con autoajuste vertical.`;
    case "create_text_node": {
      const placement = [
        operation.name === undefined ? null : `nombre → “${operation.name}”`,
        operation.x === undefined ? null : `x ${operation.x}px`,
        operation.y === undefined ? null : `y ${operation.y}px`,
        operation.width === undefined ? null : `ancho ${operation.width}px`,
      ].filter((value): value is string => value !== null);
      return (
        `${prefix} Crear capa ${operation.tempId} en ${operation.parentId}` +
        `${placement.length === 0 ? "" : ` (${placement.join(", ")})`}` +
        ` con ${quotedPreview(operation.characters)} (${operation.characters.length} unidades UTF-16)` +
        `${operation.style === undefined ? "" : ` y ${describeStyleReference(operation.style)}`}` +
        `${operation.typography === undefined ? "" : `; ${describeTypography(operation.typography)}`}.`
      );
    }
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
  return values.length === 0
    ? "sin propiedades tipográficas explícitas"
    : values.join(", ");
}

function quotedPreview(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  const truncated = normalized.length > 80;
  const whitespaceNormalized = normalized !== value;
  const preview = truncated ? `${normalized.slice(0, 77)}…` : normalized;
  return (
    `“${preview}”` +
    `${truncated ? " [vista previa truncada]" : ""}` +
    `${whitespaceNormalized ? " [espacios y saltos normalizados]" : ""}`
  );
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
  if (!exactValueMatches(actual, expected)) {
    throw bridgeError(
      "POSTCONDITION_FAILED",
      `No se confirmó ${label} después de aplicar el lote.`,
    );
  }
}

function exactValueMatches(actual: unknown, expected: unknown): boolean {
  return (
    actual !== figma.mixed &&
    hashCanonical(actual) === hashCanonical(expected)
  );
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

function observedNodeKey(id: string): string {
  return `observed_node:${id}`;
}

async function buildExpectedDocumentChangeRules(
  patch: TypographyPatch,
  affectedNodeIds: ReadonlySet<string>,
  fingerprints: Map<string, string>,
): Promise<Map<string, ExpectedDocumentChangeRule>> {
  const rules = new Map<string, ExpectedDocumentChangeRule>();
  const layoutRoots = new Set(affectedNodeIds);

  for (const operation of patch.operations) {
    switch (operation.op) {
      case "create_text_style":
      case "create_text_node":
        // Figma assigns the real IDs only during apply. Their rules are
        // registered synchronously immediately after creation.
        if (operation.op === "create_text_node") {
          layoutRoots.add(operation.parentId);
          addExpectedNodeProperties(rules, operation.parentId, [
            "width",
            "height",
          ]);
        }
        break;

      case "update_text_style":
        addExpectedStyleProperties(
          rules,
          operation.styleId,
          stylePropertiesForUpdate(operation),
        );
        break;

      case "bind_text_style":
        addExpectedNodeProperties(
          rules,
          operation.nodeId,
          TEXT_STYLE_BINDING_CHANGE_PROPERTIES,
        );
        break;

      case "set_text_range": {
        const properties = new Set<string>(["styledTextSegments", "width", "height"]);
        if (operation.style !== undefined) {
          for (const property of TEXT_STYLE_BINDING_CHANGE_PROPERTIES) {
            properties.add(property);
          }
        }
        for (const property of nodePropertiesForTypography(operation.typography)) {
          properties.add(property);
        }
        addExpectedNodeProperties(rules, operation.nodeId, properties);
        break;
      }

      case "set_characters":
        addExpectedNodeProperties(rules, operation.nodeId, [
          "characters",
          "styledTextSegments",
          "width",
          "height",
          "name",
          "autoRename",
        ]);
        break;

      case "set_text_box_width":
        addExpectedNodeProperties(rules, operation.nodeId, [
          "width",
          "height",
          "textAutoResize",
        ]);
        break;
    }
  }

  await addExpectedLayoutChangeRules(rules, layoutRoots, fingerprints);
  return rules;
}

function registerCreatedStyleChangeRule(
  rules: Map<string, ExpectedDocumentChangeRule>,
  styleId: string,
  operation: Extract<PatchOperation, { op: "create_text_style" }>,
): void {
  const rule = expectedDocumentChangeRule(rules, styleId);
  rule.forwardTypes.add("STYLE_CREATE");
  rule.undoTypes.add("STYLE_DELETE");
  addExpectedStyleProperties(rules, styleId, [
    "name",
    "description",
    ...stylePropertiesForTypography(operation.typography),
  ]);
}

function registerCreatedNodeChangeRule(
  rules: Map<string, ExpectedDocumentChangeRule>,
  nodeId: string,
  operation: Extract<PatchOperation, { op: "create_text_node" }>,
): void {
  const rule = expectedDocumentChangeRule(rules, nodeId);
  rule.forwardTypes.add("CREATE");
  rule.undoTypes.add("DELETE");
  const properties = new Set<string>([
    "name",
    "parent",
    "characters",
    "styledTextSegments",
    "x",
    "y",
    "relativeTransform",
    "width",
    "height",
    "textAutoResize",
    "autoRename",
  ]);
  if (operation.style !== undefined) {
    for (const property of TEXT_STYLE_BINDING_CHANGE_PROPERTIES) {
      properties.add(property);
    }
  }
  for (const property of nodePropertiesForTypography(operation.typography)) {
    properties.add(property);
  }
  addExpectedNodeProperties(rules, nodeId, properties);
}

function expectedDocumentChangeRule(
  rules: Map<string, ExpectedDocumentChangeRule>,
  id: string,
): ExpectedDocumentChangeRule {
  const existing = rules.get(id);
  if (existing !== undefined) {
    return existing;
  }
  const created: ExpectedDocumentChangeRule = {
    forwardTypes: new Set(),
    undoTypes: new Set(),
    nodeProperties: new Set(),
    styleProperties: new Set(),
  };
  rules.set(id, created);
  return created;
}

function addExpectedNodeProperties(
  rules: Map<string, ExpectedDocumentChangeRule>,
  nodeId: string,
  properties: Iterable<string>,
): void {
  const rule = expectedDocumentChangeRule(rules, nodeId);
  let added = false;
  for (const property of properties) {
    rule.nodeProperties.add(property);
    added = true;
  }
  if (added) {
    rule.forwardTypes.add("PROPERTY_CHANGE");
    rule.undoTypes.add("PROPERTY_CHANGE");
  }
}

function addExpectedStyleProperties(
  rules: Map<string, ExpectedDocumentChangeRule>,
  styleId: string,
  properties: Iterable<string>,
): void {
  const rule = expectedDocumentChangeRule(rules, styleId);
  let added = false;
  for (const property of properties) {
    rule.styleProperties.add(property);
    added = true;
  }
  if (added) {
    rule.forwardTypes.add("STYLE_PROPERTY_CHANGE");
    rule.undoTypes.add("STYLE_PROPERTY_CHANGE");
  }
}

async function addExpectedLayoutChangeRules(
  rules: Map<string, ExpectedDocumentChangeRule>,
  rootIds: ReadonlySet<string>,
  fingerprints: Map<string, string>,
): Promise<void> {
  const trackedLayoutNodeIds = new Set<string>();
  const trackLayoutNode = (node: BaseNode): void => {
    if (trackedLayoutNodeIds.has(node.id)) {
      return;
    }
    trackedLayoutNodeIds.add(node.id);
    if (trackedLayoutNodeIds.size > MAX_PATCH_LAYOUT_NODES) {
      throw bridgeError(
        "PATCH_SCOPE_TOO_LARGE",
        `El contexto de layout supera el límite de ${MAX_PATCH_LAYOUT_NODES} nodos.`,
      );
    }
    fingerprints.set(layoutNodeKey(node.id), fingerprintLayoutNode(node));
  };
  const trackLayoutSubtree = (root: BaseNode): void => {
    const pending: BaseNode[] = [root];
    while (pending.length > 0) {
      const node = pending.pop();
      if (node === undefined || trackedLayoutNodeIds.has(node.id)) {
        continue;
      }
      trackLayoutNode(node);
      addExpectedNodeProperties(rules, node.id, LAYOUT_CHANGE_PROPERTIES);
      if ("children" in node) {
        for (let index = node.children.length - 1; index >= 0; index -= 1) {
          pending.push(node.children[index]);
        }
      }
    }
  };

  for (const rootId of rootIds) {
    const root = await figma.getNodeByIdAsync(rootId);
    if (root === null) {
      continue;
    }
    trackLayoutSubtree(root);

    let current: BaseNode | null = root;
    while (current !== null) {
      const parent: BaseNode | null = current.parent;
      if (
        parent === null ||
        parent.type === "PAGE" ||
        parent.type === "DOCUMENT"
      ) {
        break;
      }
      // Auto Layout can propagate a text resize through siblings and through
      // descendants that use fill, hug, wrap, or grid sizing. Track the full
      // bounded subtree at every ancestor so those own layout effects are
      // fingerprinted without granting arbitrary property changes.
      trackLayoutSubtree(parent);
      current = parent;
    }
  }
}

function documentChangesMatch(
  changes: ReadonlyArray<TrackedDocumentChange>,
  rules: ReadonlyMap<string, ExpectedDocumentChangeRule>,
  phase: "forward" | "undo",
): boolean {
  return (
    changes.length > 0 &&
    changes.every((change) => {
      if (change.origin !== "LOCAL") {
        return false;
      }
      const rule = rules.get(change.id);
      if (rule === undefined) {
        return false;
      }
      const allowedTypes =
        phase === "forward" ? rule.forwardTypes : rule.undoTypes;
      if (!allowedTypes.has(change.type)) {
        return false;
      }
      if (change.type === "PROPERTY_CHANGE") {
        return (
          change.properties !== undefined &&
          change.properties.length > 0 &&
          change.properties.every((property) =>
            rule.nodeProperties.has(property),
          )
        );
      }
      if (change.type === "STYLE_PROPERTY_CHANGE") {
        return (
          change.properties !== undefined &&
          change.properties.length > 0 &&
          change.properties.every((property) =>
            rule.styleProperties.has(property),
          )
        );
      }
      return true;
    })
  );
}

const TEXT_STYLE_BINDING_CHANGE_PROPERTIES = [
  "textStyleId",
  "styledTextSegments",
  "fontName",
  "fontSize",
  "lineHeight",
  "letterSpacing",
  "textCase",
  "textDecoration",
  "leadingTrim",
  "paragraphIndent",
  "paragraphSpacing",
  "listSpacing",
  "hangingPunctuation",
  "hangingList",
  "width",
  "height",
] as const;

const LAYOUT_CHANGE_PROPERTIES = [
  "x",
  "y",
  "width",
  "height",
  "relativeTransform",
] as const;

function nodePropertiesForTypography(
  typography: TypographyProperties | undefined,
): string[] {
  if (typography === undefined) {
    return [];
  }
  const properties: string[] = ["styledTextSegments"];
  if (typography.fontRole !== undefined) properties.push("fontName");
  if (typography.fontSize !== undefined) properties.push("fontSize");
  if (typography.lineHeight !== undefined) properties.push("lineHeight");
  if (typography.letterSpacing !== undefined) properties.push("letterSpacing");
  if (typography.textCase !== undefined) properties.push("textCase");
  if (typography.textDecoration !== undefined) properties.push("textDecoration");
  if (
    typography.fontRole !== undefined ||
    typography.fontSize !== undefined ||
    typography.lineHeight !== undefined ||
    typography.letterSpacing !== undefined
  ) {
    properties.push("width", "height");
  }
  return properties;
}

function stylePropertiesForUpdate(
  operation: Extract<PatchOperation, { op: "update_text_style" }>,
): string[] {
  const properties: string[] = [];
  if (operation.name !== undefined) properties.push("name");
  if (operation.description !== undefined) properties.push("description");
  properties.push(...stylePropertiesForTypography(operation.typography));
  return properties;
}

function stylePropertiesForTypography(
  typography: TypographyProperties | undefined,
): string[] {
  if (typography === undefined) {
    return [];
  }
  const properties: string[] = [];
  // Figma's current StyleChangeProperty union omits fontName. Limit the
  // compatibility allowance for a requested font-role change to `type` and
  // the literal `fontName`; every other style field remains unexpected.
  if (typography.fontRole !== undefined) properties.push("type", "fontName");
  if (typography.fontSize !== undefined) properties.push("fontSize");
  if (typography.lineHeight !== undefined) properties.push("lineHeight");
  if (typography.letterSpacing !== undefined) properties.push("letterSpacing");
  if (typography.textCase !== undefined) properties.push("textCase");
  if (typography.textDecoration !== undefined) properties.push("textDecoration");
  return properties;
}

function previewNodeKey(id: string): string {
  return `preview_node:${id}`;
}

function layoutNodeKey(id: string): string {
  return `layout_node:${id}`;
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
  if (key.startsWith("preview_node:")) {
    const nodeId = key.slice("preview_node:".length);
    return fingerprintPreviewNode(await getPreviewNodeById(nodeId));
  }
  if (key.startsWith("observed_node:")) {
    const nodeId = key.slice("observed_node:".length);
    const node = await figma.getNodeByIdAsync(nodeId);
    if (node === null || node.type !== "TEXT") {
      throw bridgeError(
        "NODE_NOT_FOUND",
        `No se encontró la capa de impacto ${nodeId}.`,
      );
    }
    return fingerprintTextNode(node);
  }
  if (key.startsWith("layout_node:")) {
    const nodeId = key.slice("layout_node:".length);
    const node = await figma.getNodeByIdAsync(nodeId);
    if (node === null) {
      throw bridgeError(
        "NODE_NOT_FOUND",
        `No se encontró el nodo de layout ${nodeId}.`,
      );
    }
    return fingerprintLayoutNode(node);
  }
  const nodeId = key.slice("node:".length);
  const node = await figma.getNodeByIdAsync(nodeId);
  if (node === null) {
    throw bridgeError("NODE_NOT_FOUND", `No se encontró el nodo ${nodeId}.`);
  }
  assertWritableNode(node, true, true);
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

async function getPreviewNodeById(nodeId: string): Promise<SceneNode> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (
    node === null ||
    !("visible" in node) ||
    !("width" in node) ||
    !("height" in node) ||
    !("exportAsync" in node)
  ) {
    throw bridgeError(
      "PREVIEW_NODE_UNAVAILABLE",
      `El nodo ${nodeId} no puede usarse como vista previa.`,
    );
  }
  return node as SceneNode;
}

function fingerprintPreviewNode(node: SceneNode): string {
  if (node.type === "TEXT") {
    return fingerprintTextNode(node);
  }
  return hashCanonical({
    id: node.id,
    parentId: node.parent?.id ?? null,
    type: node.type,
    name: node.name,
    visible: node.visible,
    locked: node.locked,
    width: roundForFingerprint(node.width),
    height: roundForFingerprint(node.height),
  });
}

function roundForFingerprint(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function truncateNodeName(value: string): {
  name: string;
  nameTruncated: boolean;
} {
  return value.length <= 160
    ? { name: value, nameTruncated: false }
    : { name: value.slice(0, 160), nameTruncated: true };
}

function assertSemanticStyleRole(name: string, role: FontRole): void {
  const expected = fontRoleForMatTextStyleName(name);
  if (expected !== null && expected !== role) {
    throw bridgeError(
      "SEMANTIC_FONT_ROLE_MISMATCH",
      `El estilo “${name}” requiere Neue Montreal ${capitalize(expected)}, no ${capitalize(role)}.`,
    );
  }
}

function assertStyleFontRoleCompatibility(
  styleRole: FontRole,
  overrideRole: FontRole | undefined,
  target: string,
): void {
  if (overrideRole !== undefined && overrideRole !== styleRole) {
    throw bridgeError(
      "SEMANTIC_FONT_ROLE_MISMATCH",
      `No se puede aplicar Neue Montreal ${capitalize(overrideRole)} sobre ${target}: el estilo vinculado requiere ${capitalize(styleRole)}.`,
    );
  }
}

async function captureCurrentFingerprints(
  keys: Iterable<string>,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (const key of keys) {
    result.set(key, await currentFingerprintForKey(key));
  }
  return result;
}

async function fingerprintsMatch(
  expected: ReadonlyMap<string, string>,
): Promise<boolean> {
  try {
    for (const [key, fingerprint] of expected) {
      if ((await currentFingerprintForKey(key)) !== fingerprint) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

async function captureStyleUsages(
  styleIds: Iterable<string>,
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  for (const styleId of new Set(styleIds)) {
    result.set(
      styleId,
      (await findTextStyleUsages(styleId)).map((node) => node.id).sort(),
    );
  }
  return result;
}

type DocumentChangeState = "changed" | "unchanged" | "unknown";

async function detectDocumentChange(
  prepared: PreparedPatch,
  context: ApplyContext,
): Promise<DocumentChangeState> {
  try {
    for (const styleId of context.createdStyleIds) {
      if ((await figma.getStyleByIdAsync(styleId)) !== null) {
        return "changed";
      }
    }
    for (const nodeId of context.createdNodeIds) {
      if ((await figma.getNodeByIdAsync(nodeId)) !== null) {
        return "changed";
      }
    }
    for (const [key, expected] of prepared.fingerprintsAtProposal) {
      if ((await currentFingerprintForKey(key)) !== expected) {
        return "changed";
      }
    }
    for (const [styleId, expectedIds] of prepared.styleUsageIdsAtProposal) {
      const currentIds = (await findTextStyleUsages(styleId))
        .map((node) => node.id)
        .sort();
      if (
        currentIds.length !== expectedIds.length ||
        currentIds.some((id, index) => id !== expectedIds[index])
      ) {
        return "changed";
      }
    }
    return "unchanged";
  } catch {
    return "unknown";
  }
}

async function styleUsagesMatch(
  expected: ReadonlyMap<string, string[]>,
): Promise<boolean> {
  try {
    for (const [styleId, expectedIds] of expected) {
      const currentIds = (await findTextStyleUsages(styleId))
        .map((node) => node.id)
        .sort();
      if (
        currentIds.length !== expectedIds.length ||
        currentIds.some((id, index) => id !== expectedIds[index])
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

async function createdObjectsExist(context: ApplyContext): Promise<boolean> {
  try {
    for (const styleId of context.createdStyleIds) {
      if ((await figma.getStyleByIdAsync(styleId)) === null) {
        return false;
      }
    }
    for (const nodeId of context.createdNodeIds) {
      if ((await figma.getNodeByIdAsync(nodeId)) === null) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

async function describeAffectedNodes(
  nodeIds: readonly string[],
): Promise<NonNullable<PatchStatusSnapshot["result"]>["affectedNodes"]> {
  const result: NonNullable<
    PatchStatusSnapshot["result"]
  >["affectedNodes"] = [];
  for (const nodeId of nodeIds) {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (node === null) {
      throw bridgeError(
        "POSTCONDITION_FAILED",
        `No se encontró la capa afectada ${nodeId}.`,
      );
    }
    const page = pageForNode(node);
    const nodeName = truncateNodeName(node.name);
    result.push({
      id: node.id,
      name: nodeName.name,
      nameTruncated: nodeName.nameTruncated,
      type: node.type,
      pageId: page.id,
      pageName: truncateNodeName(page.name).name,
    });
  }
  return result;
}

function pageForNode(node: BaseNode): PageNode {
  let current: BaseNode | null = node;
  while (current !== null && current.type !== "PAGE") {
    current = current.parent;
  }
  if (current === null || current.type !== "PAGE") {
    throw bridgeError(
      "POSTCONDITION_FAILED",
      `No se encontró la página de la capa ${node.id}.`,
    );
  }
  return current;
}

function prepareWritableTextNode(
  node: TextNode,
  currentFonts: Map<string, FontName>,
  allowStyleBindingContext = false,
): void {
  assertWritableNode(
    node,
    allowStyleBindingContext,
    allowStyleBindingContext,
  );
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

function assertAllowedFontsInRange(
  node: TextNode,
  start: number,
  end: number,
): void {
  const segments = node.getStyledTextSegments(["fontName"], start, end);
  for (const segment of segments) {
    assertAllowedFontName(segment.fontName);
  }
}

function assertNoHyperlinksInRange(
  node: TextNode,
  start: number,
  end: number,
  action: string,
): void {
  if (start === end) {
    return;
  }
  const segments = node.getStyledTextSegments(
    ["hyperlink"],
    start,
    end,
  );
  if (segments.every((segment) => segment.hyperlink === null)) {
    return;
  }
  throw bridgeError(
    "HYPERLINK_PRESERVATION_REQUIRED",
    `No se puede ${action} en ${node.id}: el rango contiene enlaces y v0.1 no puede garantizar que Figma los preserve al reaplicar el estilo o el contenido.`,
  );
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
  if (fields.length === 0) {
    return;
  }

  const conflicts = new Set<VariableBindableTextField>();
  if (start === undefined || end === undefined) {
    for (const field of fields) {
      const bindings = node.boundVariables?.[field];
      if (
        bindings !== undefined &&
        (!Array.isArray(bindings) || bindings.length > 0)
      ) {
        conflicts.add(field);
      }
    }
  }
  if (node.characters.length > 0) {
    const segments =
      start === undefined || end === undefined
        ? node.getStyledTextSegments(["boundVariables"])
        : node.getStyledTextSegments(["boundVariables"], start, end);
    for (const segment of segments) {
      for (const field of fields) {
        if (segment.boundVariables?.[field] !== undefined) {
          conflicts.add(field);
        }
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

function assertWritableNode(
  node: BaseNode,
  allowMainComponent = false,
  allowInstance = false,
): void {
  let current: BaseNode | null = node;
  while (current !== null) {
    if ("locked" in current && current.locked) {
      throw bridgeError(
        "NODE_LOCKED",
        `El nodo ${node.id} o uno de sus ancestros está bloqueado.`,
      );
    }
    if (!allowInstance && current.type === "INSTANCE") {
      throw bridgeError(
        "INSTANCE_WRITE_REJECTED",
        `El nodo ${node.id} está dentro de una instancia y no se modificará.`,
      );
    }
    if (
      !allowMainComponent &&
      (current.type === "COMPONENT" || current.type === "COMPONENT_SET")
    ) {
      throw bridgeError(
        "COMPONENT_WRITE_REJECTED",
        `El nodo ${node.id} está dentro de un componente principal y no se modificará en esta versión.`,
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
      ...(error.details === undefined ? {} : { details: error.details }),
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

function isStalePatchError(code: string): boolean {
  return [
    "STALE_FINGERPRINT",
    "FILE_MISMATCH",
    "PAGE_MISMATCH",
    "SELECTION_CHANGED",
    "NODE_NOT_FOUND",
    "TEXT_STYLE_NOT_FOUND",
  ].includes(code);
}

function bridgeError(
  code: string,
  message: string,
  details?: unknown,
): Error & { code: string; details?: unknown } {
  return Object.assign(new Error(message), { code, details });
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
