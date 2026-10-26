/**
 * Wire protocol shared by the JavaScript runtime, the compiler and the Dart
 * host. Everything in this file must stay JSON serializable and must not use
 * Node or browser APIs: the same code is bundled into QuickJS.
 *
 * The component, event, style and permission lists themselves live in
 * `packages/contracts/miniapp-ui.contract.json`. `ui-contract.generated.ts` is
 * produced from that file, so this module is the only place that turns the
 * generated data into the public protocol types.
 */
import { EVENT_NAMES, PERMISSION_IDS, STYLE_ENUM_ALIASES, STYLE_ENUM_KEYS, STYLE_ENUM_VALUES, STYLE_KEYS, TEXT_NODE_TYPE } from "./ui-contract.generated.js";
export declare const PROTOCOL_VERSION = 1;
export declare const SDK_VERSION = "1.0.0";
export declare const RUNTIME_VERSION = "1.0.0";
export { EVENT_NAMES, PERMISSION_IDS, STYLE_ENUM_ALIASES, STYLE_ENUM_KEYS, STYLE_ENUM_VALUES, STYLE_KEYS, TEXT_NODE_TYPE, };
/** Shapes reused by more than one style key. */
export interface QappBoxShadow {
    color?: string;
    offsetX?: number;
    offsetY?: number;
    blurRadius?: number;
    spreadRadius?: number;
}
export interface QappGradientStop {
    offset: number;
    color: string;
}
export interface QappLinearGradient {
    type?: "linear";
    angle?: number;
    stops: QappGradientStop[];
}
export interface QappRadialGradient {
    type: "radial";
    stops: QappGradientStop[];
}
export type QappGradient = QappLinearGradient | QappRadialGradient;
export type QappGradientType = "linear" | "radial";
/** A style object is intentionally a small, Flutter-oriented subset. */
export interface Style {
    width?: number | string;
    height?: number | string;
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    padding?: number;
    paddingHorizontal?: number;
    paddingVertical?: number;
    paddingTop?: number;
    paddingRight?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    margin?: number;
    marginHorizontal?: number;
    marginVertical?: number;
    marginTop?: number;
    marginRight?: number;
    marginBottom?: number;
    marginLeft?: number;
    gap?: number;
    rowGap?: number;
    columnGap?: number;
    flex?: number;
    flexGrow?: number;
    flexShrink?: number;
    flexBasis?: number | string;
    flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
    flexWrap?: "nowrap" | "wrap";
    alignItems?: "start" | "end" | "center" | "stretch" | "baseline";
    justifyContent?: "start" | "end" | "center" | "spaceBetween" | "spaceAround" | "spaceEvenly";
    alignSelf?: "auto" | "start" | "end" | "center" | "stretch" | "baseline";
    alignContent?: "start" | "end" | "center" | "spaceBetween" | "spaceAround" | "spaceEvenly";
    position?: "relative" | "absolute";
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
    zIndex?: number;
    overflow?: "visible" | "hidden" | "clip";
    aspectRatio?: number;
    backgroundColor?: string;
    color?: string;
    opacity?: number;
    borderRadius?: number;
    borderTopLeftRadius?: number;
    borderTopRightRadius?: number;
    borderBottomLeftRadius?: number;
    borderBottomRightRadius?: number;
    borderWidth?: number;
    borderColor?: string;
    borderTopWidth?: number;
    borderTopColor?: string;
    borderRightWidth?: number;
    borderRightColor?: string;
    borderBottomWidth?: number;
    borderBottomColor?: string;
    borderLeftWidth?: number;
    borderLeftColor?: string;
    fontSize?: number;
    fontWeight?: "normal" | "bold" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
    fontStyle?: "normal" | "italic";
    fontFamily?: string;
    lineHeight?: number;
    letterSpacing?: number;
    textAlign?: "left" | "right" | "center" | "justify";
    textDecoration?: "none" | "underline" | "lineThrough";
    textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
    numberOfLines?: number;
    shadow?: boolean;
    boxShadow?: QappBoxShadow | QappBoxShadow[];
    elevation?: number;
    gradient?: QappGradient;
    rotate?: number;
    scale?: number;
    translateX?: number;
    translateY?: number;
}
export interface BaseProps {
    key?: string | number;
    style?: Style;
    children?: unknown;
    testID?: string;
    accessibleLabel?: string;
    pointerEvents?: "auto" | "none";
}
export type EventName = (typeof EVENT_NAMES)[number];
export type EventPayload = string | number | boolean | null | Record<string, unknown>;
/** A serialized node. Only plain JSON values are allowed. */
export interface RenderNode {
    id: string;
    type: string;
    props: Record<string, unknown>;
    events?: EventName[];
    children?: RenderNode[];
}
export interface RenderTree {
    v: typeof PROTOCOL_VERSION;
    appId: string;
    root: RenderNode | null;
    revision: number;
}
export type HostMethod = "getAppInfo" | "getSystemInfo" | "getUserInfo" | "showToast" | "chooseImage" | "share" | "navigateTo" | "navigateBack" | "closeMiniApp" | "getStorage" | "setStorage" | "removeStorage" | "request" | "fetch";
export interface HostError {
    code: string;
    message: string;
}
export interface HostResponse<T = unknown> {
    ok: boolean;
    result?: T;
    error?: HostError;
}
export interface HostBridge {
    /** Fire-and-forget UI/lifecycle message. */
    send(kind: "render" | "ready" | "log" | "lifecycle", payload: unknown): void;
    /** Request/response call to a privileged host method. */
    call(method: HostMethod, params: Record<string, unknown>): Promise<HostResponse>;
}
export interface SerializedTree {
    v: number;
    appId: string;
    root: RenderNode | null;
    revision: number;
}
export declare class QChatError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare function isPlainObject(value: unknown): value is Record<string, unknown>;
export declare function jsonClone<T>(value: T): T;
/**
 * Normalise a style enum value to its canonical camelCase form. CSS-like
 * aliases such as `"space-between"` are accepted and mapped in one place, so
 * every consumer (TS runtime, Dart host, tests) agrees on the same spelling.
 */
export declare function normalizeStyleEnum(enumName: string, value: unknown): string | undefined;
//# sourceMappingURL=protocol.d.ts.map