// AUTO-GENERATED FILE - DO NOT EDIT BY HAND.
// Source of truth: packages/contracts/miniapp-ui.contract.json
// Regenerate: corepack pnpm contract:generate
/* eslint-disable */

export const sdkTypes = `
type QChatStyle = Style;

declare module "@mna/qchat" {
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
    boxShadow?: BoxShadow | BoxShadow[];
    elevation?: number;
    gradient?: QappGradient;
    rotate?: number;
    scale?: number;
    translateX?: number;
    translateY?: number;
  }
  export type VNodeChild = unknown | string | number | boolean | null | undefined | unknown[];
  export type QappRef = { current: unknown | null } | ((value: unknown | null) => void);
  export type BoxShadow = { color?: string; offsetX?: number; offsetY?: number; blurRadius?: number; spreadRadius?: number };
  export type GradientStop = { offset: number; color: string };
  export type LinearGradient = { type?: "linear"; angle?: number; stops: GradientStop[] };
  export type RadialGradient = { type: "radial"; stops: GradientStop[] };
  export type QappGradient = LinearGradient | RadialGradient;
  export type TabItem = { key: string; label: string; icon?: string; badge?: string };
  export type TabChangePayload = { index: number; key: string; value: string };
  export type ScrollOffset = { x: number; y: number };
  export type EventPayload = string | number | boolean | null | Record<string, unknown>;
  export type QappEvent = { type: string; value: unknown };
  export type QappTextEvent = { type: string; value: string; text: string };
  export type QappToggleEvent = { type: string; value: boolean };
  export type QappNumberEvent = { type: string; value: number };
  export type QappScrollEvent = { type: string; x: number; y: number; value: { x: number; y: number } };
  export type QappTabEvent = { type: string; index: number; key: string; value: TabChangePayload };
  export type QappLinkEvent = { type: string; href: string; external: boolean };
  export interface BaseProps {
    key?: string | number;
    ref?: QappRef;
    style?: Style;
    children?: VNodeChild;
    testID?: string;
    accessibleLabel?: string;
    pointerEvents?: "auto" | "none";
  }
  export interface AppInfo {
    appId: string;
    name: string;
    version: string;
    runtimeVersion: string;
    minRuntimeVersion: string;
    permissions?: string[];
  }
  export interface SystemInfo {
    platform: string;
    locale?: string;
    theme?: "light" | "dark";
    screenWidth: number;
    screenHeight: number;
    pixelRatio?: number;
    safeAreaTop?: number;
    safeAreaBottom?: number;
  }
  export interface UserInfo {
    id: string;
    qchatId: string;
    nickname: string;
    avatarUrl?: string | null;
  }
  export function start(component: (props: { children?: unknown }) => unknown, options?: { appId?: string }): void;
  export function useState<T>(initial: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void];
  export function useReducer<S, A>(reducer: (state: S, action: A) => S, initial: S): [S, (action: A) => void];
  export function useRef<T>(initial: T): { current: T };
  export function useMemo<T>(factory: () => T, deps?: unknown[]): T;
  export function useCallback<T extends (...args: never[]) => unknown>(callback: T, deps?: unknown[]): T;
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useLayoutEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useId(): string;
  export function createContext<T>(defaultValue: T): { Provider: (props: { value: T; children?: unknown }) => unknown; };
  export function useContext<T>(context: unknown): T;
  export function useLifecycle(handler: (event: string, payload?: unknown) => void): void;
  export function getAppInfo(): Promise<AppInfo>;
  export function getSystemInfo(): Promise<SystemInfo>;
  export function getUserInfo(): Promise<UserInfo>;
  export function chooseImage(options?: { maxWidth?: number; maxHeight?: number; quality?: number }): Promise<{ dataUrl: string; mimeType: string; width: number; height: number; size: number }>;
  export function share(options: { title?: string; text?: string; url?: string }): Promise<boolean>;
  export const Fragment: unknown;
  export function h(type: unknown, props: Record<string, unknown> | null, children?: unknown): unknown;
}

declare module "@mna/qchat/ui" {
  import type { BaseProps } from "@mna/qchat";
  export type Component<P = Record<string, unknown>> = (props: P & BaseProps) => unknown;
  export const View: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none" }>;
  export const Row: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none" }>;
  export const Column: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none" }>;
  export const Text: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; numberOfLines?: number; selectable?: boolean }>;
  export const RichText: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; numberOfLines?: number; selectable?: boolean }>;
  export const Link: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; href?: string; external?: boolean; onPress?: () => void; disabled?: boolean }>;
  export const Badge: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; count?: number; max?: number; dot?: boolean; visible?: boolean; tone?: "neutral" | "success" | "warning" | "danger" | "info" }>;
  export const Tag: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; tone?: "neutral" | "success" | "warning" | "danger" | "info"; size?: "sm" | "md" | "lg" }>;
  export const Avatar: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; src?: string; name?: string; size?: number; shape?: "circle" | "rounded" }>;
  export const Button: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; onPress?: () => void; onLongPress?: () => void; disabled?: boolean; variant?: "primary" | "secondary" | "outline" | "text" | "danger"; size?: "sm" | "md" | "lg"; loading?: boolean; icon?: string }>;
  export const Pressable: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; onPress?: () => void; onLongPress?: () => void; disabled?: boolean }>;
  export const Image: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; src?: string; width?: number; height?: number; fit?: "cover" | "contain" | "fill" | "fitWidth" | "fitHeight"; borderRadius?: number; onPress?: () => void }>;
  export const Icon: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; name?: string; size?: number; color?: string }>;
  export const TextField: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; value?: string; placeholder?: string; onInput?: (value: string) => void; onChange?: (event: QappTextEvent) => void; onSubmit?: (event: QappTextEvent) => void; onFocus?: () => void; onBlur?: () => void; secureTextEntry?: boolean; multiline?: boolean; maxLength?: number; keyboardType?: "text" | "number" | "email" | "phone" | "url"; editable?: boolean; autoFocus?: boolean }>;
  export const Checkbox: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; checked?: boolean; onChange?: (event: QappToggleEvent) => void; onCheckedChange?: (event: QappToggleEvent) => void; label?: string; disabled?: boolean }>;
  export const Switch: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; value?: boolean; onChange?: (event: QappToggleEvent) => void; onValueChange?: (event: QappToggleEvent) => void; disabled?: boolean }>;
  export const Slider: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; value?: number; min?: number; max?: number; step?: number; onChange?: (event: QappNumberEvent) => void; onValueChange?: (event: QappNumberEvent) => void; disabled?: boolean }>;
  export const ScrollView: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; horizontal?: boolean; vertical?: boolean; showsScrollIndicator?: boolean; onScroll?: (event: QappScrollEvent) => void; grid?: boolean; numColumns?: number }>;
  export const ListView: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; data?: readonly unknown[]; horizontal?: boolean; empty?: VNodeChild; initialCount?: number; onEndReached?: () => void; renderItem?: (item: any, index: number) => VNodeChild; keyExtractor?: (item: any, index: number) => string }>;
  export const GridView: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; data?: readonly unknown[]; numColumns?: number; empty?: VNodeChild; initialCount?: number; onEndReached?: () => void; renderItem?: (item: any, index: number) => VNodeChild }>;
  export const Stack: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; alignment?: "topLeft" | "topCenter" | "topRight" | "centerLeft" | "center" | "centerRight" | "bottomLeft" | "bottomCenter" | "bottomRight" }>;
  export const Positioned: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; top?: number; right?: number; bottom?: number; left?: number }>;
  export const Spacer: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; size?: number }>;
  export const Divider: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; color?: string; thickness?: number; vertical?: boolean; inset?: number }>;
  export const ActivityIndicator: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; size?: number; color?: string }>;
  export const SafeArea: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; edges?: ("top" | "right" | "bottom" | "left")[] }>;
  export const AnimatedView: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; animate?: "fadeIn" | "slideUp" | "scaleIn"; duration?: number }>;
  export const CustomPaint: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; draw?: string; width?: number; height?: number }>;
  export const Modal: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; visible?: boolean; onClose?: () => void; transparent?: boolean; animationType?: "none" | "fade" | "slide" }>;
  export const BottomSheet: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; visible?: boolean; onClose?: () => void; height?: number }>;
  export const Dialog: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; visible?: boolean; title?: string; onClose?: () => void; onConfirm?: () => void; confirmText?: string; cancelText?: string }>;
  export const NavBar: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; title?: string; subtitle?: string; onBack?: () => void; showBack?: boolean; safeArea?: boolean; reserveRight?: number; transparent?: boolean; blur?: boolean; border?: boolean }>;
  export const TabBar: Component<{ key?: string | number; ref?: QappRef; style?: Style; children?: VNodeChild; testID?: string; accessibleLabel?: string; pointerEvents?: "auto" | "none"; tabs?: TabItem[]; activeKey?: string; activeIndex?: number; onChange?: (event: QappTabEvent) => void; safeArea?: boolean; hideOnKeyboard?: boolean }>;
}

declare module "@mna/qchat/navigation" {
  export function navigateTo(path: string, params?: Record<string, unknown>): Promise<void>;
  export function navigateBack(): Promise<void>;
  export function closeMiniApp(): Promise<void>;
  export function showToast(message: string, options?: { icon?: "success" | "error" | "none"; duration?: number }): Promise<void>;
  export function openExternal(url: string): Promise<void>;
}

declare module "@mna/qchat/storage" {
  export function getStorage<T>(key: string): Promise<T | null>;
  export function setStorage(key: string, value: unknown): Promise<void>;
  export function removeStorage(key: string): Promise<void>;
  export function createStorage(prefix: string): {
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown): Promise<void>;
    remove(key: string): Promise<void>;
  };
}

declare module "@mna/qchat/network" {
  export function request<T = unknown>(path: string, options?: { method?: string; query?: Record<string, string | number | boolean>; body?: unknown; headers?: Record<string, string> }): Promise<T>;
  export function fetch<T = unknown>(input: string, options?: { method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number }): Promise<{ status: number; headers: Record<string, string>; data: T }>;
  export function fetchJson<T = unknown>(input: string, options?: { method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number }): Promise<T>;
}

declare module "@mna/qchat/jsx-runtime" {
  export namespace JSX {
    interface Element {}
    interface ElementChildrenAttribute { children: {} }
    interface IntrinsicElements { [element: string]: unknown }
  }
  export function jsx(type: unknown, props: unknown, key?: unknown): unknown;
  export const jsxs: typeof jsx;
  export const Fragment: unknown;
}

declare module "@mna/qchat/jsx-dev-runtime" {
  export * from "@mna/qchat/jsx-runtime";
  export const jsxDEV: unknown;
}
`;

export const envTypes = `/**
 * Globals the QChat JavaScript environment installs in QuickJS.
 *
 * The runtime is ECMAScript only: no timers, no \`console\`, no \`Intl\`, no \`URL\`,
 * no \`TextEncoder\`, no \`AbortController\` and no \`structuredClone\`. They exist
 * after \`import "@mna/qchat/env/auto";\` (or the individual \`install*\` calls).
 *
 * qapp projects keep \`"lib": ["ES2020"]\` and must not add \`"DOM"\`: the package
 * has no WebView, so this file — not lib.dom — is the contract. The compiler
 * injects it into the generated type-check config when the project does not add
 * the DOM lib itself.
 */

type QappLogLevel = "debug" | "info" | "warn" | "error";

interface QappConsole {
  log(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
  trace(...args: unknown[]): void;
}

declare var console: QappConsole;
declare function print(...args: unknown[]): void;

/* Timers: the host wakes the runtime and runs everything that is due. */
declare function setTimeout(
  handler: (...args: any[]) => void,
  delayMs?: number,
  ...args: any[]
): number;
declare function clearTimeout(id?: number): void;
declare function setInterval(
  handler: (...args: any[]) => void,
  delayMs?: number,
  ...args: any[]
): number;
declare function clearInterval(id?: number): void;
declare function requestAnimationFrame(handler: (time: number) => void): number;
declare function cancelAnimationFrame(id?: number): void;
declare function queueMicrotask(handler: () => void): void;

declare function structuredClone<T>(value: T, options?: unknown): T;

declare class URLSearchParams {
  constructor(init?: string | URLSearchParams | Iterable<[unknown, unknown]> | Record<string, unknown>);
  append(name: unknown, value: unknown): void;
  delete(name: unknown, value?: unknown): void;
  get(name: unknown): string | null;
  getAll(name: unknown): string[];
  has(name: unknown, value?: unknown): boolean;
  set(name: unknown, value: unknown): void;
  sort(): void;
  toString(): string;
  entries(): Array<[string, string]>;
  keys(): string[];
  values(): string[];
  forEach(callback: (value: string, key: string) => void): void;
  readonly size: number;
}

declare class URL {
  constructor(input: unknown, base?: unknown);
  href: string;
  protocol: string;
  username: string;
  password: string;
  host: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  readonly origin: string;
  readonly searchParams: URLSearchParams;
  toString(): string;
  toJSON(): string;
}

declare class TextEncoder {
  readonly encoding: "utf-8";
  encode(input?: string): Uint8Array;
}

declare class TextDecoder {
  constructor(
    label?: string,
    options?: { fatal?: boolean; ignoreBOM?: boolean },
  );
  readonly encoding: "utf-8";
  readonly fatal: boolean;
  readonly ignoreBOM: boolean;
  decode(input?: ArrayLike<number> | null, options?: { stream?: boolean }): string;
}

interface QappAbortEvent {
  type: "abort";
  target: AbortSignal;
}

declare class AbortSignal {
  readonly aborted: boolean;
  readonly reason: unknown;
  onabort: ((event: QappAbortEvent) => void) | null;
  addEventListener(type: "abort", listener: (event: QappAbortEvent) => void): void;
  removeEventListener(type: "abort", listener: (event: QappAbortEvent) => void): void;
  throwIfAborted(): void;
  static abort(reason?: unknown): AbortSignal;
  static timeout(milliseconds: number): AbortSignal;
}

declare class AbortController {
  constructor();
  readonly signal: AbortSignal;
  abort(reason?: unknown): void;
}

/*
 * \`Intl\` itself is not declared here: the ES library already types it, and
 * \`Intl\` is a global namespace whose members cannot be redeclared. The QChat
 * polyfill implements the documented subset for \`vi-VN\` and \`en-US\` and raises
 * a \`RangeError\` for any other locale, so the types are wider than the runtime
 * on purpose. See docs/MINIAPPS.md for the supported options.
 */
`;
