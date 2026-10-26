import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";

// Monaco 0.57 wires its own language workers with `new URL(..., import.meta.url)`,
// which Vite bundles automatically. No MonacoEnvironment override is required.
loader.config({ monaco });

monaco.editor.defineTheme("qchat-studio", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "5d6880", fontStyle: "italic" },
    { token: "keyword", foreground: "b9b2ff" },
    { token: "keyword.control", foreground: "b9b2ff" },
    { token: "string", foreground: "8be7c4" },
    { token: "number", foreground: "f7c97e" },
    { token: "type.identifier", foreground: "7dd3fc" },
    { token: "delimiter.bracket", foreground: "93a0b8" },
    { token: "tag", foreground: "f0a6ca" },
    { token: "attribute.name", foreground: "b9b2ff" },
    { token: "attribute.value", foreground: "8be7c4" },
    { token: "variable", foreground: "e6e9f2" },
    { token: "function", foreground: "93c5fd" },
  ],
  colors: {
    "editor.background": "#0b0e14",
    "editor.foreground": "#e6e9f2",
    "editorLineNumber.foreground": "#3b455a",
    "editorLineNumber.activeForeground": "#8b93a7",
    "editorCursor.foreground": "#9a8dff",
    "editor.selectionBackground": "#6553ef44",
    "editor.inactiveSelectionBackground": "#6553ef22",
    "editor.lineHighlightBackground": "#121722",
    "editor.lineHighlightBorder": "#00000000",
    "editorIndentGuide.background1": "#1b2231",
    "editorIndentGuide.activeBackground1": "#354058",
    "editorWhitespace.foreground": "#252e40",
    "editorBracketMatch.background": "#7c6cff22",
    "editorBracketMatch.border": "#7c6cff66",
    "editorGutter.background": "#0b0e14",
    "editorWidget.background": "#11151e",
    "editorWidget.border": "#252e40",
    "editorSuggestWidget.background": "#11151e",
    "editorSuggestWidget.border": "#252e40",
    "editorSuggestWidget.selectedBackground": "#1b2231",
    "editorHoverWidget.background": "#11151e",
    "editorHoverWidget.border": "#252e40",
    "input.background": "#07090d",
    "input.border": "#252e40",
    "focusBorder": "#6553ef88",
    "list.hoverBackground": "#161c29",
    "list.activeSelectionBackground": "#252e40",
    "scrollbarSlider.background": "#8b93a733",
    "scrollbarSlider.hoverBackground": "#8b93a755",
    "scrollbarSlider.activeBackground": "#8b93a777",
  },
});

monaco.typescript.typescriptDefaults.setCompilerOptions({
  target: monaco.typescript.ScriptTarget.ES2020,
  module: monaco.typescript.ModuleKind.ESNext,
  moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
  jsx: monaco.typescript.JsxEmit.ReactJSX,
  jsxImportSource: "@mna/qchat",
  allowNonTsExtensions: true,
  allowSyntheticDefaultImports: true,
  esModuleInterop: true,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  lib: ["es2020", "dom"],
});

const sdkTypes = `
type QChatStyle = Record<string, string | number | undefined>;

declare module "@mna/qchat" {
  export type Style = QChatStyle;
  export interface BaseProps {
    key?: string | number;
    style?: Style;
    children?: unknown;
    testID?: string;
    accessibleLabel?: string;
    pointerEvents?: "auto" | "none";
  }
  export interface AppInfo {
    appId: string;
    name: string;
    version: string;
    entry: string;
    runtimeVersion: string;
    permissions: string[];
  }
  export interface SystemInfo {
    platform: string;
    language: string;
    theme: "light" | "dark";
    safeAreaTop: number;
    safeAreaBottom: number;
    screenWidth: number;
    screenHeight: number;
  }
  export interface UserInfo {
    id: string;
    name: string;
    username?: string;
    avatar?: string;
  }
  export function start(component: (props: Record<string, unknown>) => unknown): void;
  export function render(component: (props: Record<string, unknown>) => unknown): void;
  export function useState<T>(initial: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void];
  export function useReducer<S, A>(reducer: (state: S, action: A) => S, initial: S): [S, (action: A) => void];
  export function useRef<T>(initial: T): { current: T };
  export function useMemo<T>(factory: () => T, deps?: unknown[]): T;
  export function useCallback<T extends (...args: never[]) => unknown>(callback: T, deps?: unknown[]): T;
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useLifecycle(handler: (event: "resume" | "pause" | "destroy" | "navigate" | "back", payload?: unknown) => void): void;
  export function getAppInfo(): Promise<AppInfo>;
  export function getSystemInfo(): Promise<SystemInfo>;
  export function getUserInfo(): Promise<UserInfo>;
  export function chooseImage(options?: { count?: number; sizeType?: string[]; sourceType?: string[] }): Promise<{ path: string; dataUrl?: string }[]>;
  export function share(options: { title?: string; text?: string; url?: string }): Promise<void>;
}

declare module "@mna/qchat/ui" {
  import type { BaseProps } from "@mna/qchat";
  export type Component<P = Record<string, unknown>> = (props: P & BaseProps) => unknown;
  export const View: Component<{ style?: QChatStyle }>;
  export const Row: Component;
  export const Column: Component;
  export const Text: Component<{ style?: QChatStyle; numberOfLines?: number; selectable?: boolean }>;
  export const Button: Component<{ variant?: "primary" | "secondary" | "text"; disabled?: boolean; onPress?: () => void }>;
  export const Pressable: Component<{ onPress?: () => void; onLongPress?: () => void; style?: QChatStyle }>;
  export const Image: Component<{ source: string | { uri: string }; resizeMode?: string }>;
  export const Icon: Component<{ name: string; size?: number; color?: string }>;
  export const TextField: Component<{ value?: string; placeholder?: string; onChange?: (value: string) => void; onSubmit?: (value: string) => void }>;
  export const Checkbox: Component<{ checked?: boolean; onChange?: (value: boolean) => void }>;
  export const Switch: Component<{ value?: boolean; onChange?: (value: boolean) => void }>;
  export const Slider: Component<{ value?: number; min?: number; max?: number; onChange?: (value: number) => void }>;
  export const ScrollView: Component;
  export const ListView: Component;
  export const GridView: Component;
  export const Stack: Component;
  export const Positioned: Component<{ top?: number; right?: number; bottom?: number; left?: number }>;
  export const Spacer: Component;
  export const Divider: Component;
  export const ActivityIndicator: Component<{ color?: string; size?: number }>;
  export const SafeArea: Component;
  export const AnimatedView: Component<{ animation?: string; duration?: number; delay?: number }>;
  export const CustomPaint: Component<{ paths?: unknown[]; style?: QChatStyle }>;
}

declare module "@mna/qchat/navigation" {
  export function navigateTo(path: string): Promise<void>;
  export function navigateBack(): Promise<void>;
  export function closeMiniApp(): Promise<void>;
  export function showToast(message: string, icon?: string): Promise<void>;
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
  export function request<T = unknown>(path: string, options?: { method?: string; body?: unknown }): Promise<T>;
  export function fetch(input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{ status: number; ok: boolean; headers: Record<string, string>; text: string; json<T = unknown>(): Promise<T> }>;
  export function fetchJson<T = unknown>(input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<T>;
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
}
`;

let configured = false;
export function configureMonaco(): void {
  if (configured) return;
  configured = true;
  monaco.typescript.typescriptDefaults.addExtraLib(
    sdkTypes,
    "file:///node_modules/@mna/qchat/index.d.ts",
  );
  monaco.typescript.javascriptDefaults.addExtraLib(
    sdkTypes,
    "file:///node_modules/@mna/qchat/index.d.ts",
  );
  monaco.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: false,
    trailingCommas: "error",
    schemas: [
      {
        uri: "https://qchat.local/manifest.schema.json",
        fileMatch: ["manifest.json"],
        schema: {
          type: "object",
          required: ["schemaVersion", "format", "name", "version", "entry"],
          properties: {
            schemaVersion: { const: 2 },
            format: { const: "qapp" },
            name: { type: "string", minLength: 1, maxLength: 80 },
            description: { type: "string", maxLength: 500 },
            version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+" },
            entry: { const: "app.js" },
            sdkVersion: { type: "string" },
            minRuntimeVersion: { type: "string" },
            requestedPermissions: {
              type: "array",
              items: {
                enum: [
                  "toast",
                  "storage",
                  "user.profile",
                  "media.choose",
                  "share",
                  "qchat.api",
                  "network",
                ],
              },
              uniqueItems: true,
            },
            networkDomains: {
              type: "array",
              maxItems: 10,
              items: { type: "string" },
            },
            source: { type: "string" },
          },
        },
      },
    ],
  });
}

export { monaco };
