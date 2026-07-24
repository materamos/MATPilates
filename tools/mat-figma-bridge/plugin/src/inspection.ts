import {
  MAX_AUDIT_TEXT_NODES,
  MAX_PREVIEW_BYTES,
  MAX_WS_PAYLOAD_BYTES,
  type AuditInput,
  type PreviewResult,
} from "./contracts";
import {
  fingerprintTextNode,
  fingerprintTextStyle,
  getTextSegmentsForFingerprint,
  hashCanonical,
  serializeMixed,
  serializeValue,
} from "./fingerprints";
import {
  inspectFontAvailability,
  roleForFontName,
} from "./font-policy";

export interface PluginStatus {
  protocolVersion: 1;
  plugin: {
    name: "MAT — Codex Bridge";
    version: "0.1.0";
  };
  file: {
    key: string | null;
    name: string;
    page: { id: string; name: string };
  };
  selection: {
    nodeIds: string[];
    count: number;
    textCount: number;
  };
  fonts: Array<{
    role: "regular" | "medium" | "bold";
    family: string;
    style: string;
    available: boolean;
  }>;
}

export async function getPluginStatus(): Promise<PluginStatus> {
  const selection = figma.currentPage.selection;
  const textNodes = collectTextNodes(selection, MAX_AUDIT_TEXT_NODES);
  const fonts = await inspectFontAvailability();

  return {
    protocolVersion: 1,
    plugin: {
      name: "MAT — Codex Bridge",
      version: "0.1.0",
    },
    file: {
      key: figma.fileKey ?? null,
      name: figma.root.name,
      page: {
        id: figma.currentPage.id,
        name: figma.currentPage.name,
      },
    },
    selection: {
      nodeIds: selection.map((node) => node.id),
      count: selection.length,
      textCount: textNodes.length,
    },
    fonts: fonts.map(({ role, fontName, available }) => ({
      role,
      family: fontName.family,
      style: fontName.style,
      available,
    })),
  };
}

export async function getSelectionSnapshot(
  includeCharacters = false,
): Promise<{
  fileKey: string | null;
  page: { id: string; name: string };
  selectedNodeIds: string[];
  nodes: unknown[];
  textNodes: unknown[];
  textNodeCount: number;
  detailsTruncated: boolean;
  selectionDetailsTruncated: boolean;
}> {
  const selected = figma.currentPage.selection;
  const textNodes = collectTextNodes(selected, MAX_AUDIT_TEXT_NODES);

  return {
    fileKey: figma.fileKey ?? null,
    page: { id: figma.currentPage.id, name: figma.currentPage.name },
    selectedNodeIds: selected.map((node) => node.id),
    nodes: selected.slice(0, 200).map(selectionNodeSnapshot),
    textNodes: textNodes
      .slice(0, 200)
      .map((node) => textNodeSnapshot(node, includeCharacters)),
    textNodeCount: textNodes.length,
    detailsTruncated: textNodes.length > 200,
    selectionDetailsTruncated: selected.length > 200,
  };
}

export async function getNodeSnapshot(
  nodeId: string,
  includeCharacters: boolean,
): Promise<unknown> {
  const node = await getNodeById(nodeId);
  if (node === null) {
    throw bridgeError("NODE_NOT_FOUND", `No se encontró el nodo ${nodeId}.`);
  }

  if (node.type === "TEXT") {
    return textNodeSnapshot(node, includeCharacters);
  }

  if (!isSceneNode(node)) {
    return {
      id: node.id,
      parentId: node.parent?.id ?? null,
      type: node.type,
      name: node.name,
    };
  }

  const descendants = collectTextNodes([node], MAX_AUDIT_TEXT_NODES);
  return sceneNodeSnapshot(node, new Set(descendants.map((child) => child.id)));
}

export async function listLocalTextStyles(): Promise<unknown[]> {
  const styles = await figma.getLocalTextStylesAsync();
  return styles.map((style) => ({
    id: style.id,
    key: style.key,
    name: style.name,
    description: style.description,
    remote: style.remote,
    fontName: serializeValue(style.fontName),
    fontRole: roleForFontName(style.fontName),
    fontSize: style.fontSize,
    lineHeight: serializeValue(style.lineHeight),
    letterSpacing: serializeValue(style.letterSpacing),
    textCase: style.textCase,
    textDecoration: style.textDecoration,
    fingerprint: fingerprintTextStyle(style),
  }));
}

export async function auditTypography(input: AuditInput): Promise<unknown> {
  const textNodes = await resolveAuditTextNodes(input);
  if (textNodes.length > MAX_AUDIT_TEXT_NODES) {
    throw bridgeError(
      "AUDIT_SCOPE_TOO_LARGE",
      `La auditoría supera el límite de ${MAX_AUDIT_TEXT_NODES} capas de texto.`,
    );
  }

  const styles = await figma.getLocalTextStylesAsync();
  const styleById = new Map(styles.map((style) => [style.id, style]));
  const fontRunCounts = new Map<string, { runs: number; characters: number }>();
  const linkedStyleIds = new Set<string>();
  const anomalies: Array<{
    nodeId: string;
    kind: string;
    detail: string;
  }> = [];

  let unboundNodes = 0;
  let fullyBoundNodes = 0;
  let mixedStyleNodes = 0;
  let mixedFontNodes = 0;

  for (const node of textNodes) {
    if (node.hasMissingFont) {
      anomalies.push({
        nodeId: node.id,
        kind: "missing_font",
        detail: "Figma informa una fuente faltante en esta capa.",
      });
    }

    if (node.fontName === figma.mixed) {
      mixedFontNodes += 1;
    }

    const styleId = node.textStyleId;
    if (styleId === figma.mixed) {
      mixedStyleNodes += 1;
    } else if (styleId === "") {
      unboundNodes += 1;
    } else {
      fullyBoundNodes += 1;
      linkedStyleIds.add(styleId);
      if (!styleById.has(styleId)) {
        anomalies.push({
          nodeId: node.id,
          kind: "unknown_text_style",
          detail: `La capa referencia un estilo no local: ${styleId}.`,
        });
      }
    }

    for (const segment of getTextSegmentsForFingerprint(node)) {
      const serializedFont = segment.fontName;
      if (
        typeof serializedFont !== "object" ||
        serializedFont === null ||
        Array.isArray(serializedFont)
      ) {
        anomalies.push({
          nodeId: node.id,
          kind: "invalid_font_segment",
          detail: `No se pudo leer la fuente del rango ${segment.start}-${segment.end}.`,
        });
        continue;
      }

      const family = String(serializedFont.family ?? "");
      const style = String(serializedFont.style ?? "");
      const key = `${family}\u0000${style}`;
      const current = fontRunCounts.get(key) ?? { runs: 0, characters: 0 };
      current.runs += 1;
      current.characters += segment.end - segment.start;
      fontRunCounts.set(key, current);

      if (
        roleForFontName({ family, style }) === null
      ) {
        anomalies.push({
          nodeId: node.id,
          kind: "font_outside_policy",
          detail: `${family} / ${style} no pertenece a Regular, Medium o Bold de Neue Montreal.`,
        });
      }

      const segmentStyleId =
        typeof segment.textStyleId === "string" ? segment.textStyleId : "";
      if (segmentStyleId !== "") {
        linkedStyleIds.add(segmentStyleId);
      }
    }
  }

  const detailLimit = 200;
  const anomalyLimit = 200;
  return {
    fileKey: figma.fileKey ?? null,
    page: { id: figma.currentPage.id, name: figma.currentPage.name },
    scope: input,
    totals: {
      textNodes: textNodes.length,
      localTextStyles: styles.length,
      fullyBoundNodes,
      unboundNodes,
      mixedStyleNodes,
      mixedFontNodes,
      linkedLocalStyles: Array.from(linkedStyleIds).filter((id) => styleById.has(id))
        .length,
    },
    fonts: Array.from(fontRunCounts.entries())
      .map(([key, counts]) => {
        const [family, style] = key.split("\u0000");
        return {
          family,
          style,
          role: roleForFontName({ family, style }),
          ...counts,
        };
      })
      .sort((left, right) =>
        `${left.family}/${left.style}`.localeCompare(
          `${right.family}/${right.style}`,
        ),
      ),
    anomalies: anomalies.slice(0, anomalyLimit),
    anomaliesTruncated: anomalies.length > anomalyLimit,
    anomalyCount: anomalies.length,
    nodes: textNodes
      .slice(0, detailLimit)
      .map((node) => compactAuditNodeSnapshot(node)),
    detailsTruncated: textNodes.length > detailLimit,
    detailCount: Math.min(textNodes.length, detailLimit),
    omittedDetailCount: Math.max(0, textNodes.length - detailLimit),
  };
}

export async function findTextStyleUsages(styleId: string): Promise<TextNode[]> {
  const style = await getTextStyleById(styleId);
  const consumers = await style.getStyleConsumersAsync();
  const unsupported = consumers.filter(
    (consumer) =>
      consumer.fields.includes("textStyleId") &&
      consumer.node.type !== "TEXT",
  );
  if (unsupported.length > 0) {
    throw bridgeError(
      "UNSUPPORTED_STYLE_CONSUMER",
      `El estilo ${styleId} tiene ${unsupported.length} consumidores de texto no compatibles.`,
    );
  }

  const matches = new Map<string, TextNode>();
  for (const consumer of consumers) {
    if (
      consumer.fields.includes("textStyleId") &&
      consumer.node.type === "TEXT"
    ) {
      matches.set(consumer.node.id, consumer.node);
    }
  }

  return Array.from(matches.values());
}

export async function exportPreview(
  nodeId: string,
  maxDimension: number,
): Promise<PreviewResult> {
  const node = await getNodeById(nodeId);
  if (node === null || !isSceneNode(node)) {
    throw bridgeError(
      "PREVIEW_NODE_UNAVAILABLE",
      `El nodo ${nodeId} no puede exportarse.`,
    );
  }

  const constraint = previewConstraint(node, maxDimension);
  const bytes = await node.exportAsync({
    format: "PNG",
    constraint,
    contentsOnly: true,
    useAbsoluteBounds: true,
  });
  const maximumWireSafeBytes = Math.floor(
    (MAX_WS_PAYLOAD_BYTES - 32 * 1_024) * 0.75,
  );
  if (
    bytes.byteLength > MAX_PREVIEW_BYTES ||
    bytes.byteLength > maximumWireSafeBytes
  ) {
    throw bridgeError(
      "PREVIEW_TOO_LARGE",
      "La vista previa supera el límite seguro del puente local.",
    );
  }
  const dimensions = readPngDimensions(bytes);
  if (
    dimensions.width > maxDimension ||
    dimensions.height > maxDimension
  ) {
    throw bridgeError(
      "PREVIEW_TOO_LARGE",
      "Los límites visuales exportados superan la dimensión solicitada.",
    );
  }

  return {
    data: bytesToBase64(bytes),
    mimeType: "image/png",
    width: dimensions.width,
    height: dimensions.height,
    byteLength: bytes.byteLength,
    nodeId: node.id,
    fingerprint:
      node.type === "TEXT"
        ? fingerprintTextNode(node)
        : hashCanonical({
            id: node.id,
            parentId: node.parent?.id ?? null,
            type: node.type,
            name: node.name,
            width: node.width,
            height: node.height,
          }),
  };
}

function readPngDimensions(bytes: Uint8Array): {
  width: number;
  height: number;
} {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  const validSignature =
    bytes.byteLength >= 24 &&
    signature.every((value, index) => bytes[index] === value) &&
    bytes[12] === 73 &&
    bytes[13] === 72 &&
    bytes[14] === 68 &&
    bytes[15] === 82;
  if (!validSignature) {
    throw bridgeError(
      "INVALID_PREVIEW",
      "Figma no devolvió una imagen PNG válida.",
    );
  }

  const width = readUint32BigEndian(bytes, 16);
  const height = readUint32BigEndian(bytes, 20);
  if (width < 1 || height < 1) {
    throw bridgeError(
      "INVALID_PREVIEW",
      "La vista previa no tiene dimensiones válidas.",
    );
  }
  return { width, height };
}

function readUint32BigEndian(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    bytes[offset + 1] * 0x10000 +
    bytes[offset + 2] * 0x100 +
    bytes[offset + 3]
  );
}

export function collectTextNodes(
  roots: readonly SceneNode[],
  limit: number,
): TextNode[] {
  const result: TextNode[] = [];
  const seen = new Set<string>();

  for (const root of roots) {
    if (root.type === "TEXT" && !seen.has(root.id)) {
      result.push(root);
      seen.add(root.id);
      if (result.length > limit) {
        return result;
      }
    }

    if ("findAllWithCriteria" in root) {
      for (const node of root.findAllWithCriteria({ types: ["TEXT"] })) {
        if (!seen.has(node.id)) {
          result.push(node);
          seen.add(node.id);
        }
        if (result.length > limit) {
          return result;
        }
      }
    }
  }

  return result;
}

export async function getTextNodeById(nodeId: string): Promise<TextNode> {
  const node = await getNodeById(nodeId);
  if (node === null || node.type !== "TEXT") {
    throw bridgeError(
      "TEXT_NODE_NOT_FOUND",
      `No se encontró la capa de texto ${nodeId}.`,
    );
  }
  return node;
}

export async function getTextStyleById(styleId: string): Promise<TextStyle> {
  const style = await figma.getStyleByIdAsync(styleId);
  if (style === null || style.type !== "TEXT") {
    throw bridgeError(
      "TEXT_STYLE_NOT_FOUND",
      `No se encontró el estilo de texto ${styleId}.`,
    );
  }
  return style;
}

export async function getParentById(
  parentId: string,
): Promise<BaseNode & ChildrenMixin> {
  const parent = await getNodeById(parentId);
  if (parent === null || !isChildrenContainer(parent)) {
    throw bridgeError(
      "PARENT_NOT_FOUND",
      `No se encontró un contenedor válido con ID ${parentId}.`,
    );
  }
  return parent;
}

function textNodeSnapshot(node: TextNode, includeCharacters: boolean): unknown {
  const segments = getTextSegmentsForFingerprint(node);
  return {
    id: node.id,
    parentId: node.parent?.id ?? null,
    type: node.type,
    name: node.name,
    visible: node.visible,
    locked: node.locked,
    characters: includeCharacters ? node.characters : undefined,
    characterCount: node.characters.length,
    characterPreview: includeCharacters
      ? node.characters.slice(0, 120)
      : undefined,
    truncatedPreview: includeCharacters
      ? node.characters.length > 120
      : undefined,
    textStyleId: serializeMixed(node.textStyleId),
    fontName: serializeMixed(node.fontName),
    fontSize: serializeMixed(node.fontSize),
    lineHeight: serializeMixed(node.lineHeight),
    letterSpacing: serializeMixed(node.letterSpacing),
    textAutoResize: node.textAutoResize,
    width: node.width,
    height: node.height,
    hasMissingFont: node.hasMissingFont,
    segments,
    fingerprint: fingerprintTextNode(node),
  };
}

function compactAuditNodeSnapshot(node: TextNode): unknown {
  const segments = node.getStyledTextSegments(["fontName", "textStyleId"]);
  const fontRoles = new Set<string>();
  const fontPairs = new Set<string>();
  for (const segment of segments) {
    const role = roleForFontName(segment.fontName);
    fontRoles.add(role ?? "outside_policy");
    fontPairs.add(`${segment.fontName.family} / ${segment.fontName.style}`);
  }

  return {
    id: node.id,
    parentId: node.parent?.id ?? null,
    name: node.name.slice(0, 160),
    fingerprint: fingerprintTextNode(node),
    textStyleId: serializeMixed(node.textStyleId),
    fontRoles: Array.from(fontRoles),
    fontPairs: Array.from(fontPairs),
    mixedFont: node.fontName === figma.mixed,
    mixedStyle: node.textStyleId === figma.mixed,
    missingFont: node.hasMissingFont,
  };
}

function sceneNodeSnapshot(
  node: SceneNode,
  descendantTextNodeIds: ReadonlySet<string>,
): unknown {
  return {
    id: node.id,
    parentId: node.parent?.id ?? null,
    type: node.type,
    name: node.name,
    visible: node.visible,
    locked: node.locked,
    width: node.width,
    height: node.height,
    descendantTextNodeIds: Array.from(descendantTextNodeIds),
  };
}

function selectionNodeSnapshot(node: SceneNode): unknown {
  return {
    id: node.id,
    parentId: node.parent?.id ?? null,
    type: node.type,
    name: node.name.slice(0, 160),
    visible: node.visible,
    locked: node.locked,
    width: node.width,
    height: node.height,
  };
}

async function resolveAuditTextNodes(input: AuditInput): Promise<TextNode[]> {
  switch (input.scope) {
    case "selection":
      return collectTextNodes(figma.currentPage.selection, MAX_AUDIT_TEXT_NODES);
    case "current_page":
      return figma.currentPage.findAllWithCriteria({ types: ["TEXT"] });
    case "node": {
      if (input.nodeId === undefined) {
        throw bridgeError(
          "NODE_NOT_FOUND",
          "La auditoría de nodo requiere un ID exacto.",
        );
      }
      const node = await getNodeById(input.nodeId);
      if (node === null || !isSceneNode(node)) {
        throw bridgeError(
          "NODE_NOT_FOUND",
          `No se encontró el nodo ${input.nodeId}.`,
        );
      }
      return collectTextNodes([node], MAX_AUDIT_TEXT_NODES);
    }
  }
}

async function getNodeById(nodeId: string): Promise<BaseNode | null> {
  return figma.getNodeByIdAsync(nodeId);
}

function isSceneNode(node: BaseNode): node is SceneNode {
  return "visible" in node && "width" in node && "height" in node;
}

function isChildrenContainer(
  node: BaseNode,
): node is BaseNode & ChildrenMixin {
  return (
    node.type !== "DOCUMENT" &&
    "children" in node &&
    "appendChild" in node
  );
}

function previewConstraint(
  node: SceneNode,
  maxDimension: number,
): NonNullable<ExportSettingsImage["constraint"]> {
  const currentMax = Math.max(node.width, node.height);
  if (currentMax <= maxDimension) {
    return { type: "SCALE", value: 1 };
  }
  return node.width >= node.height
    ? { type: "WIDTH", value: maxDimension }
    : { type: "HEIGHT", value: maxDimension };
}

function bytesToBase64(bytes: Uint8Array): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const byte1 = bytes[index] ?? 0;
    const byte2 = bytes[index + 1] ?? 0;
    const byte3 = bytes[index + 2] ?? 0;
    const combined = (byte1 << 16) | (byte2 << 8) | byte3;
    output += alphabet[(combined >> 18) & 63];
    output += alphabet[(combined >> 12) & 63];
    output += index + 1 < bytes.length ? alphabet[(combined >> 6) & 63] : "=";
    output += index + 2 < bytes.length ? alphabet[combined & 63] : "=";
  }

  return output;
}

function bridgeError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}
