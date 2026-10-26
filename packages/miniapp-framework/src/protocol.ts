/**
 * Wire protocol shared by the JavaScript runtime, the compiler and the Dart
 * host. Everything in this file must stay JSON serializable and must not use
 * Node or browser APIs: the same code is bundled into QuickJS.
 */

export const PROTOCOL_VERSION = 1 as const;
export const SDK_VERSION = "1.0.0";
export const RUNTIME_VERSION = "1.0.0";

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
  flex?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
  flexWrap?: "nowrap" | "wrap";
  alignItems?: "start" | "end" | "center" | "stretch" | "baseline";
  justifyContent?:
    | "start"
    | "end"
    | "center"
    | "spaceBetween"
    | "spaceAround"
    | "spaceEvenly";
  alignSelf?: "auto" | "start" | "end" | "center" | "stretch";
  position?: "relative" | "absolute";
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
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
  fontSize?: number;
  fontWeight?: "normal" | "bold" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
  fontStyle?: "normal" | "italic";
  fontFamily?: string;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: "left" | "right" | "center" | "justify";
  textDecoration?: "none" | "underline" | "lineThrough";
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  overflow?: "visible" | "hidden" | "clip";
  shadow?: boolean;
  elevation?: number;
  aspectRatio?: number;
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

export type EventName =
  | "press"
  | "longPress"
  | "change"
  | "input"
  | "submit"
  | "valueChange"
  | "scroll"
  | "refresh"
  | "focus"
  | "blur"
  | "select";

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

export type HostMethod =
  | "getAppInfo"
  | "getSystemInfo"
  | "getUserInfo"
  | "showToast"
  | "chooseImage"
  | "share"
  | "navigateTo"
  | "navigateBack"
  | "closeMiniApp"
  | "getStorage"
  | "setStorage"
  | "removeStorage"
  | "request"
  | "fetch";

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

export class QChatError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "QChatError";
    this.code = code;
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
