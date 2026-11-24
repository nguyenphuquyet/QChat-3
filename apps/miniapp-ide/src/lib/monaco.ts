import { envTypes, sdkTypes } from "./qchat-sdk.generated";
import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";

// Monaco 0.57 wires its own language workers with `new URL(..., import.meta.url)`,
// which Vite bundles automatically. No MonacoEnvironment override is required.
loader.config({ monaco });

// Monaco mirrors VS Code's own Dark+ / Light+ palettes so the editor reads the
// same as the surrounding chrome.
monaco.editor.defineTheme("qchat-studio", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "6a9955", fontStyle: "italic" },
    { token: "keyword", foreground: "569cd6" },
    { token: "keyword.control", foreground: "c586c0" },
    { token: "string", foreground: "ce9178" },
    { token: "number", foreground: "b5cea8" },
    { token: "type.identifier", foreground: "4ec9b0" },
    { token: "delimiter.bracket", foreground: "d4d4d4" },
    { token: "tag", foreground: "569cd6" },
    { token: "attribute.name", foreground: "9cdcfe" },
    { token: "attribute.value", foreground: "ce9178" },
    { token: "variable", foreground: "9cdcfe" },
    { token: "function", foreground: "dcdcaa" },
  ],
  colors: {
    "editor.background": "#1e1e1e",
    "editor.foreground": "#d4d4d4",
    "editorLineNumber.foreground": "#858585",
    "editorLineNumber.activeForeground": "#c6c6c6",
    "editorCursor.foreground": "#aeafad",
    "editor.selectionBackground": "#264f78",
    "editor.inactiveSelectionBackground": "#3a3d41",
    "editor.lineHighlightBackground": "#282828",
    "editor.lineHighlightBorder": "#00000000",
    "editorIndentGuide.background1": "#404040",
    "editorIndentGuide.activeBackground1": "#707070",
    "editorWhitespace.foreground": "#3b3b3b",
    "editorBracketMatch.background": "#0064001a",
    "editorBracketMatch.border": "#888888",
    "editorGutter.background": "#1e1e1e",
    "editorWidget.background": "#252526",
    "editorWidget.border": "#454545",
    "editorSuggestWidget.background": "#252526",
    "editorSuggestWidget.border": "#454545",
    "editorSuggestWidget.selectedBackground": "#04395e",
    "editorHoverWidget.background": "#252526",
    "editorHoverWidget.border": "#454545",
    "input.background": "#313131",
    "input.border": "#3c3c3c",
    "focusBorder": "#0078d4",
    "list.hoverBackground": "#2a2d2e",
    "list.activeSelectionBackground": "#04395e",
    "scrollbarSlider.background": "#79797966",
    "scrollbarSlider.hoverBackground": "#646464b3",
    "scrollbarSlider.activeBackground": "#bfbfbf66",
  },
});

monaco.editor.defineTheme("qchat-studio-light", {
  base: "vs",
  inherit: true,
  rules: [
    { token: "comment", foreground: "008000", fontStyle: "italic" },
    { token: "keyword", foreground: "0000ff" },
    { token: "keyword.control", foreground: "af00db" },
    { token: "string", foreground: "a31515" },
    { token: "number", foreground: "098658" },
    { token: "type.identifier", foreground: "267f99" },
    { token: "delimiter.bracket", foreground: "000000" },
    { token: "tag", foreground: "800000" },
    { token: "attribute.name", foreground: "0451a5" },
    { token: "attribute.value", foreground: "a31515" },
    { token: "variable", foreground: "001080" },
    { token: "function", foreground: "795e26" },
  ],
  colors: {
    "editor.background": "#ffffff",
    "editor.foreground": "#000000",
    "editorLineNumber.foreground": "#237893",
    "editorLineNumber.activeForeground": "#0b216f",
    "editorCursor.foreground": "#000000",
    "editor.selectionBackground": "#add6ff",
    "editor.inactiveSelectionBackground": "#e5ebf1",
    "editor.lineHighlightBackground": "#f3f3f3",
    "editor.lineHighlightBorder": "#00000000",
    "editorIndentGuide.background1": "#d3d3d3",
    "editorIndentGuide.activeBackground1": "#939393",
    "editorWhitespace.foreground": "#d3d3d3",
    "editorBracketMatch.background": "#0064001a",
    "editorBracketMatch.border": "#006400",
    "editorGutter.background": "#ffffff",
    "editorWidget.background": "#f3f3f3",
    "editorWidget.border": "#c8c8c8",
    "editorSuggestWidget.background": "#f3f3f3",
    "editorSuggestWidget.border": "#c8c8c8",
    "editorSuggestWidget.selectedBackground": "#0060c0",
    "editorSuggestWidget.selectedForeground": "#ffffff",
    "editorHoverWidget.background": "#f3f3f3",
    "editorHoverWidget.border": "#c8c8c8",
    "input.background": "#ffffff",
    "input.border": "#cecece",
    "focusBorder": "#0090f1",
    "list.hoverBackground": "#f2f2f2",
    "list.activeSelectionBackground": "#0060c0",
    "list.activeSelectionForeground": "#ffffff",
    "scrollbarSlider.background": "#64646466",
    "scrollbarSlider.hoverBackground": "#646464b3",
    "scrollbarSlider.activeBackground": "#00000099",
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
  // A qapp runs in QuickJS: no DOM. The QuickJS globals come from the SDK's
  // `types/qchat-env.d.ts`, injected below as a second extra lib.
  lib: ["es2020"],
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
  monaco.typescript.typescriptDefaults.addExtraLib(
    envTypes,
    "file:///node_modules/@mna/qchat/types/qchat-env.d.ts",
  );
  monaco.typescript.javascriptDefaults.addExtraLib(
    envTypes,
    "file:///node_modules/@mna/qchat/types/qchat-env.d.ts",
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
            source: { type: "string" },
          },
        },
      },
    ],
  });
}

export { monaco };
