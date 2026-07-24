import { fingerprint } from "../../shared/fingerprint.js";

type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };

interface TextSegmentFingerprint {
  start: number;
  end: number;
  fontName: CanonicalValue;
  fontSize: CanonicalValue;
  fontWeight: CanonicalValue;
  fontStyle: CanonicalValue;
  textStyleId: CanonicalValue;
  fillStyleId: CanonicalValue;
  lineHeight: CanonicalValue;
  letterSpacing: CanonicalValue;
  textCase: CanonicalValue;
  textDecoration: CanonicalValue;
  textDecorationStyle: CanonicalValue;
  textDecorationOffset: CanonicalValue;
  textDecorationThickness: CanonicalValue;
  textDecorationColor: CanonicalValue;
  textDecorationSkipInk: CanonicalValue;
  fills: CanonicalValue;
  listOptions: CanonicalValue;
  listSpacing: CanonicalValue;
  indentation: CanonicalValue;
  paragraphIndent: CanonicalValue;
  paragraphSpacing: CanonicalValue;
  hyperlink: CanonicalValue;
  boundVariables: CanonicalValue;
  textStyleOverrides: CanonicalValue;
  openTypeFeatures: CanonicalValue;
}

export function fingerprintTextNode(node: TextNode): string {
  return hashCanonical(textNodeFingerprintInput(node));
}

export function fingerprintTextStyle(style: TextStyle): string {
  return hashCanonical({
    id: style.id,
    key: style.key,
    name: style.name,
    description: style.description,
    remote: style.remote,
    fontName: serializeValue(style.fontName),
    fontSize: style.fontSize,
    lineHeight: serializeValue(style.lineHeight),
    letterSpacing: serializeValue(style.letterSpacing),
    textCase: serializeValue(style.textCase),
    textDecoration: serializeValue(style.textDecoration),
    leadingTrim: serializeValue(style.leadingTrim),
    paragraphIndent: style.paragraphIndent,
    paragraphSpacing: style.paragraphSpacing,
    listSpacing: style.listSpacing,
    hangingPunctuation: style.hangingPunctuation,
    hangingList: style.hangingList,
    boundVariables: serializeValue(style.boundVariables),
  });
}

export function fingerprintParent(node: BaseNode & ChildrenMixin): string {
  return fingerprintLayoutNode(node);
}

export function fingerprintLayoutNode(node: BaseNode): string {
  return hashCanonical({
    id: node.id,
    parentId: node.parent?.id ?? null,
    name: node.name,
    type: node.type,
    visible: nodeProperty(node, "visible"),
    locked: nodeProperty(node, "locked"),
    x: nodeProperty(node, "x"),
    y: nodeProperty(node, "y"),
    width: roundedNodeProperty(node, "width"),
    height: roundedNodeProperty(node, "height"),
    minWidth: roundedNodeProperty(node, "minWidth"),
    maxWidth: roundedNodeProperty(node, "maxWidth"),
    minHeight: roundedNodeProperty(node, "minHeight"),
    maxHeight: roundedNodeProperty(node, "maxHeight"),
    relativeTransform: nodeProperty(node, "relativeTransform"),
    layoutMode: nodeProperty(node, "layoutMode"),
    layoutWrap: nodeProperty(node, "layoutWrap"),
    layoutPositioning: nodeProperty(node, "layoutPositioning"),
    layoutSizingHorizontal: nodeProperty(node, "layoutSizingHorizontal"),
    layoutSizingVertical: nodeProperty(node, "layoutSizingVertical"),
    layoutAlign: nodeProperty(node, "layoutAlign"),
    layoutGrow: nodeProperty(node, "layoutGrow"),
    primaryAxisSizingMode: nodeProperty(node, "primaryAxisSizingMode"),
    counterAxisSizingMode: nodeProperty(node, "counterAxisSizingMode"),
    primaryAxisAlignItems: nodeProperty(node, "primaryAxisAlignItems"),
    counterAxisAlignItems: nodeProperty(node, "counterAxisAlignItems"),
    counterAxisAlignContent: nodeProperty(node, "counterAxisAlignContent"),
    paddingTop: nodeProperty(node, "paddingTop"),
    paddingRight: nodeProperty(node, "paddingRight"),
    paddingBottom: nodeProperty(node, "paddingBottom"),
    paddingLeft: nodeProperty(node, "paddingLeft"),
    itemSpacing: nodeProperty(node, "itemSpacing"),
    counterAxisSpacing: nodeProperty(node, "counterAxisSpacing"),
    gridRowCount: nodeProperty(node, "gridRowCount"),
    gridColumnCount: nodeProperty(node, "gridColumnCount"),
    gridRowGap: nodeProperty(node, "gridRowGap"),
    gridColumnGap: nodeProperty(node, "gridColumnGap"),
    gridRowSizes: nodeProperty(node, "gridRowSizes"),
    gridColumnSizes: nodeProperty(node, "gridColumnSizes"),
    gridAutoTracks: nodeProperty(node, "gridAutoTracks"),
    gridItemsPositioning: nodeProperty(node, "gridItemsPositioning"),
    gridRowAnchorIndex: nodeProperty(node, "gridRowAnchorIndex"),
    gridColumnAnchorIndex: nodeProperty(node, "gridColumnAnchorIndex"),
    gridRowSpan: nodeProperty(node, "gridRowSpan"),
    gridColumnSpan: nodeProperty(node, "gridColumnSpan"),
    gridChildHorizontalAlign: nodeProperty(
      node,
      "gridChildHorizontalAlign",
    ),
    gridChildVerticalAlign: nodeProperty(node, "gridChildVerticalAlign"),
    strokesIncludedInLayout: nodeProperty(node, "strokesIncludedInLayout"),
    itemReverseZIndex: nodeProperty(node, "itemReverseZIndex"),
    clipsContent: nodeProperty(node, "clipsContent"),
    childIds:
      "children" in node
        ? node.children.map((child) => child.id)
        : null,
  });
}

export function textNodeFingerprintInput(node: TextNode): CanonicalValue {
  return {
    id: node.id,
    parentId: node.parent?.id ?? null,
    name: node.name,
    autoRename: node.autoRename,
    characters: node.characters,
    textStyleId: serializeMixed(node.textStyleId),
    segments: serializeValue(getTextSegmentsForFingerprint(node)),
    fontName: serializeMixed(node.fontName),
    fontSize: serializeMixed(node.fontSize),
    lineHeight: serializeMixed(node.lineHeight),
    letterSpacing: serializeMixed(node.letterSpacing),
    textCase: serializeMixed(node.textCase),
    textDecoration: serializeMixed(node.textDecoration),
    leadingTrim: serializeMixed(node.leadingTrim),
    paragraphIndent: serializeMixed(node.paragraphIndent),
    paragraphSpacing: serializeMixed(node.paragraphSpacing),
    listSpacing: serializeMixed(node.listSpacing),
    hangingPunctuation: serializeValue(node.hangingPunctuation),
    hangingList: serializeValue(node.hangingList),
    x: roundDimension(node.x),
    y: roundDimension(node.y),
    relativeTransform: serializeValue(node.relativeTransform),
    width: roundDimension(node.width),
    height: roundDimension(node.height),
    textAutoResize: node.textAutoResize,
    boundVariables: serializeValue(node.boundVariables),
  };
}

export function getTextSegmentsForFingerprint(
  node: TextNode,
): TextSegmentFingerprint[] {
  const segments = node.getStyledTextSegments([
    "fontName",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "textStyleId",
    "fillStyleId",
    "lineHeight",
    "letterSpacing",
    "textCase",
    "textDecoration",
    "textDecorationStyle",
    "textDecorationOffset",
    "textDecorationThickness",
    "textDecorationColor",
    "textDecorationSkipInk",
    "fills",
    "listOptions",
    "listSpacing",
    "indentation",
    "paragraphIndent",
    "paragraphSpacing",
    "hyperlink",
    "boundVariables",
    "textStyleOverrides",
    "openTypeFeatures",
  ]);

  return segments.map((segment) => ({
    start: segment.start,
    end: segment.end,
    fontName: serializeValue(segment.fontName),
    fontSize: serializeValue(segment.fontSize),
    fontWeight: serializeValue(segment.fontWeight),
    fontStyle: serializeValue(segment.fontStyle),
    textStyleId: serializeValue(segment.textStyleId),
    fillStyleId: serializeValue(segment.fillStyleId),
    lineHeight: serializeValue(segment.lineHeight),
    letterSpacing: serializeValue(segment.letterSpacing),
    textCase: serializeValue(segment.textCase),
    textDecoration: serializeValue(segment.textDecoration),
    textDecorationStyle: serializeValue(segment.textDecorationStyle),
    textDecorationOffset: serializeValue(segment.textDecorationOffset),
    textDecorationThickness: serializeValue(segment.textDecorationThickness),
    textDecorationColor: serializeValue(segment.textDecorationColor),
    textDecorationSkipInk: serializeValue(segment.textDecorationSkipInk),
    fills: serializeValue(segment.fills),
    listOptions: serializeValue(segment.listOptions),
    listSpacing: serializeValue(segment.listSpacing),
    indentation: serializeValue(segment.indentation),
    paragraphIndent: serializeValue(segment.paragraphIndent),
    paragraphSpacing: serializeValue(segment.paragraphSpacing),
    hyperlink: serializeValue(segment.hyperlink),
    boundVariables: serializeValue(segment.boundVariables),
    textStyleOverrides: serializeValue(segment.textStyleOverrides),
    openTypeFeatures: serializeValue(segment.openTypeFeatures),
  }));
}

export function hashCanonical(value: unknown): string {
  return fingerprint(toCanonicalValue(value));
}

export function serializeMixed(value: unknown): CanonicalValue {
  return value === figma.mixed ? "MIXED" : serializeValue(value);
}

export function serializeValue(value: unknown): CanonicalValue {
  return toCanonicalValue(value);
}

function toCanonicalValue(value: unknown): CanonicalValue {
  if (value === null) {
    return null;
  }
  if (value === undefined) {
    return "__undefined__";
  }
  if (value === figma.mixed) {
    return "MIXED";
  }
  if (
    typeof value === "boolean" ||
    typeof value === "string" ||
    typeof value === "number"
  ) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      return String(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(toCanonicalValue);
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, toCanonicalValue(child)]),
    );
  }
  return String(value);
}

function roundDimension(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function nodeProperty(node: BaseNode, property: string): CanonicalValue {
  const value = (node as unknown as Record<string, unknown>)[property];
  return serializeValue(value);
}

function roundedNodeProperty(
  node: BaseNode,
  property: string,
): CanonicalValue {
  const value = (node as unknown as Record<string, unknown>)[property];
  return typeof value === "number"
    ? roundDimension(value)
    : serializeValue(value);
}
