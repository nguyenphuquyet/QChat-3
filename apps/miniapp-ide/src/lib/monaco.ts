import { sdkTypes } from "./qchat-sdk.generated";
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

monaco.editor.defineTheme("qchat-studio-light", {
  base: "vs",
  inherit: true,
  rules: [
    { token: "comment", foreground: "8a94a6", fontStyle: "italic" },
    { token: "keyword", foreground: "5b4bdb" },
    { token: "keyword.control", foreground: "5b4bdb" },
    { token: "string", foreground: "0f766e" },
    { token: "number", foreground: "b45309" },
    { token: "type.identifier", foreground: "0369a1" },
    { token: "delimiter.bracket", foreground: "64748b" },
    { token: "tag", foreground: "be185d" },
    { token: "attribute.name", foreground: "5b4bdb" },
    { token: "attribute.value", foreground: "0f766e" },
    { token: "variable", foreground: "1f2937" },
    { token: "function", foreground: "1d4ed8" },
  ],
  colors: {
    "editor.background": "#ffffff",
    "editor.foreground": "#1f2937",
    "editorLineNumber.foreground": "#c3cad8",
    "editorLineNumber.activeForeground": "#64748b",
    "editorCursor.foreground": "#6553ef",
    "editor.selectionBackground": "#6553ef33",
    "editor.inactiveSelectionBackground": "#6553ef1a",
    "editor.lineHighlightBackground": "#f5f7fb",
    "editor.lineHighlightBorder": "#00000000",
    "editorIndentGuide.background1": "#e8ecf3",
    "editorIndentGuide.activeBackground1": "#c8d0de",
    "editorWhitespace.foreground": "#e5e9f1",
    "editorBracketMatch.background": "#6553ef1a",
    "editorBracketMatch.border": "#6553ef55",
    "editorGutter.background": "#ffffff",
    "editorWidget.background": "#ffffff",
    "editorWidget.border": "#dfe4ee",
    "editorSuggestWidget.background": "#ffffff",
    "editorSuggestWidget.border": "#dfe4ee",
    "editorSuggestWidget.selectedBackground": "#f1f3f9",
    "editorHoverWidget.background": "#ffffff",
    "editorHoverWidget.border": "#dfe4ee",
    "input.background": "#ffffff",
    "input.border": "#dfe4ee",
    "focusBorder": "#6553ef88",
    "list.hoverBackground": "#f5f7fb",
    "list.activeSelectionBackground": "#eceffa",
    "scrollbarSlider.background": "#0f172a1f",
    "scrollbarSlider.hoverBackground": "#0f172a30",
    "scrollbarSlider.activeBackground": "#0f172a44",
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
