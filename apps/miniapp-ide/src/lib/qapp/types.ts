// Types for the live preview renderer.
//
// They mirror `packages/miniapp-framework/src/protocol.ts` but stay hand-written:
// the Studio bundles the wire shape it consumes, and a mismatch should show up
// as a missing style key rather than as a broken import of the SDK's Node build.

export interface QappStyle {
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
  flexDirection?: string;
  flexWrap?: string;
  alignItems?: string;
  justifyContent?: string;
  alignSelf?: string;
  alignContent?: string;
  position?: string;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  zIndex?: number;
  overflow?: string;
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
  fontWeight?: string | number;
  fontStyle?: string;
  fontFamily?: string;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: string;
  textDecoration?: string;
  textTransform?: string;
  numberOfLines?: number;
  shadow?: boolean;
  boxShadow?: QappShadow | QappShadow[];
  elevation?: number;
  gradient?: QappGradient;
  rotate?: number;
  scale?: number;
  translateX?: number;
  translateY?: number;
}

export interface QappShadow {
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

export interface QappGradient {
  type?: "linear" | "radial";
  angle?: number;
  stops: QappGradientStop[];
}

export interface QappNode {
  id: string;
  type: string;
  props: Record<string, unknown> & { style?: QappStyle };
  events?: string[];
  children?: QappNode[];
}

export interface QappFrame {
  v: number;
  appId: string;
  screen: string;
  root: QappNode | null;
  revision: number;
}

export type QappEventPayload =
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>;

export interface QappHostError {
  code: string;
  message: string;
}

export interface QappHostResponse {
  ok: boolean;
  result?: unknown;
  error?: QappHostError;
}

export type QappLogLevel = "log" | "info" | "warn" | "error" | "debug";

export interface QappPreviewLog {
  level: QappLogLevel | string;
  message: string;
  stack?: string;
}

/** Everything the renderer needs to know about the simulated device. */
export interface QappDevice {
  width: number;
  height: number;
  pixelRatio: number;
  safeAreaTop: number;
  safeAreaBottom: number;
  theme: "light" | "dark";
}
