import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";
import {
  APP_JSON_SCHEMA,
  BUILTIN_COMPONENTS,
  COMPONENT_JSON_SCHEMA,
  MANIFEST_SCHEMA,
  MINIPROGRAM_TYPES,
  PAGE_JSON_SCHEMA,
  WXML_LANGUAGE,
  WXSS_LANGUAGE,
} from "./miniapp";

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
    // 60% alpha: an opaque #add6ff washes out the thin 13px glyphs, so selected
    // code reads as one flat colour. The translucent tint keeps every token
    // colour legible. `editor.selectionForeground` stays unset on purpose -
    // setting it repaints all selected tokens with a single colour.
    "editor.selectionBackground": "#add6ff99",
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

// ---------------------------------------------------------------------------
// WXML / WXSS languages
// ---------------------------------------------------------------------------

/// Tag descriptions shown by hover and by completion detail. Only tags the
/// host actually implements are listed; unknown tags still complete as plain
/// identifiers so a custom `usingComponents` tag does not feel broken.
const TAG_DOCS: Record<string, string> = {
  view: "A block container, like a <div>.",
  text: "Inline text. Only <text> keeps whitespace and decodes entities.",
  image: "Displays an image; `mode` controls how it is fitted.",
  button: "A native button. `type`, `size`, `plain` and `form-type` match WeChat.",
  "scroll-view": "A scrollable container; set `scroll-y` or `scroll-x`.",
  input: "A single-line input. `model:value` binds the value two-way.",
  textarea: "A multi-line input.",
  switch: "A boolean toggle. Fires `change` with `{ value }`.",
  checkbox: "A checkbox used inside `checkbox-group`.",
  "checkbox-group": "Groups checkboxes and fires `change` with the checked values.",
  radio: "A radio button used inside `radio-group`.",
  "radio-group": "Groups radios and fires `change` with the selected value.",
  slider: "A numeric slider with `min`, `max`, `step` and `value`.",
  navigator: "A link that opens another page with `url` and `open-type`.",
  progress: "A progress bar with `percent` and `show-info`.",
  swiper: "A carousel. Children are `swiper-item` nodes.",
  "swiper-item": "One slide of a `swiper`.",
  picker: "A native picker: `selector`, `multiSelector`, `time`, `date` or `region`.",
  form: "Collects the `name` values of its controls on `submit`.",
  label: "Labels a control: tapping it focuses or toggles `for`.",
  "rich-text": "Renders an `nodes` array or HTML string as rich text.",
  block: "A template-only grouping tag; it does not create a DOM node.",
  template: "Declares a reusable template.",
  import: "Imports templates from another WXML file.",
  include: "Inlines another WXML file.",
  slot: "A component slot.",
  "cover-view": "Not implemented by the QChat host.",
  "movable-view": "Not implemented by the QChat host.",
};

/// Attributes shared by every tag.
const COMMON_ATTRIBUTES: Record<string, string> = {
  id: "Unique id, used by `wx.createSelectorQuery`.",
  class: "WXSS class list.",
  style: "Inline style. Prefer WXSS classes.",
  hidden: "Hides the node when the expression is truthy.",
  "wx:if": "Renders the node when the expression is truthy.",
  "wx:elif": "Else-if branch of `wx:if`.",
  "wx:else": "Else branch of `wx:if`.",
  "wx:for": "Repeats the node for every item in the expression.",
  "wx:for-item": "Name of the loop item (default `item`).",
  "wx:for-index": "Name of the loop index (default `index`).",
  "wx:key": "Stable key for each repeated node (`*this` or a property name).",
  "wx:for-items": "Legacy alias of `wx:for`.",
  slot: "Fills a named slot of the parent component.",
  "data-*": "Custom data copied onto `event.currentTarget.dataset`.",
  "bindtap": "Tap handler name in the page/component script.",
  "catchtap": "Tap handler that stops propagation.",
  "bindinput": "Input handler; `event.detail.value` holds the text.",
  "bindchange": "Change handler for form controls.",
  "bindsubmit": "Submit handler for `form`.",
  "bindscroll": "Scroll handler for `scroll-view`.",
  "bindload": "Load handler for `image`.",
  "binderror": "Error handler for `image`.",
};

const COMPONENT_ATTRIBUTES: Record<string, string[]> = {
  view: ["hover-class", "hover-stop-propagation", "hover-start-time", "hover-stay-time"],
  text: ["selectable", "user-select", "space", "decode"],
  image: ["src", "mode", "lazy-load", "show-menu-by-longpress", "binderror", "bindload"],
  button: [
    "type",
    "size",
    "plain",
    "disabled",
    "loading",
    "form-type",
    "open-type",
    "hover-class",
    "lang",
    "session-from",
    "app-parameter",
    "show-message-card",
    "send-message-title",
    "send-message-path",
    "send-message-img",
  ],
  "scroll-view": [
    "scroll-x",
    "scroll-y",
    "upper-threshold",
    "lower-threshold",
    "scroll-top",
    "scroll-left",
    "scroll-into-view",
    "scroll-with-animation",
    "enable-back-to-top",
    "enhanced",
    "show-scrollbar",
    "paging-enabled",
    "fast-deceleration",
    "bounces",
  ],
  input: [
    "value",
    "type",
    "password",
    "placeholder",
    "placeholder-style",
    "placeholder-class",
    "disabled",
    "maxlength",
    "cursor",
    "cursor-spacing",
    "focus",
    "confirm-type",
    "confirm-hold",
    "hold-keyboard",
    "adjust-position",
    "auto-blur",
    "always-embed",
    "selection-start",
    "selection-end",
    "name",
  ],
  textarea: [
    "value",
    "placeholder",
    "placeholder-style",
    "placeholder-class",
    "disabled",
    "maxlength",
    "focus",
    "auto-height",
    "fixed",
    "cursor-spacing",
    "cursor",
    "show-confirm-bar",
    "selection-start",
    "selection-end",
    "adjust-position",
    "hold-keyboard",
    "disable-default-padding",
    "confirm-type",
    "confirm-hold",
    "name",
  ],
  switch: ["checked", "disabled", "type", "color", "name"],
  checkbox: ["value", "checked", "disabled", "color", "name"],
  "checkbox-group": ["name"],
  radio: ["value", "checked", "disabled", "color", "name"],
  "radio-group": ["name"],
  slider: [
    "min",
    "max",
    "step",
    "value",
    "color",
    "selected-color",
    "active-color",
    "background-color",
    "block-size",
    "block-color",
    "show-value",
    "disabled",
    "name",
  ],
  navigator: [
    "url",
    "open-type",
    "delta",
    "app-id",
    "path",
    "extra-data",
    "version",
    "hover-class",
    "hover-stop-propagation",
    "hover-start-time",
    "hover-stay-time",
    "target",
  ],
  progress: [
    "percent",
    "show-info",
    "border-radius",
    "font-size",
    "stroke-width",
    "color",
    "active-color",
    "background-color",
    "active",
    "active-mode",
    "duration",
  ],
  swiper: [
    "indicator-dots",
    "indicator-color",
    "indicator-active-color",
    "autoplay",
    "current",
    "interval",
    "duration",
    "circular",
    "vertical",
    "previous-margin",
    "next-margin",
    "display-multiple-items",
    "skip-hidden-item-layout",
    "easing-function",
    "snap-to-edge",
    "current-item-id",
  ],
  "swiper-item": ["item-id"],
  picker: [
    "mode",
    "range",
    "range-key",
    "value",
    "start",
    "end",
    "fields",
    "disabled",
    "name",
    "header-text",
  ],
  form: ["report-submit", "report-submit-timeout"],
  label: ["for"],
  "rich-text": ["nodes", "space"],
};

const WXML_TOKENIZER: monaco.languages.IMonarchLanguage = {
  defaultToken: "",
  tokenPostfix: ".wxml",
  ignoreCase: false,
  brackets: [
    { open: "{{", close: "}}", token: "delimiter.bracket" },
    { open: "<", close: ">", token: "delimiter.angle" },
  ],
  tokenizer: {
    root: [
      [/<!--/, "comment", "@comment"],
      [/\{\{/, "delimiter.bracket", "@mustache"],
      [/<\/?[A-Za-z][\w:.-]*/, "tag"],
      [/[A-Za-z_][\w:.-]*(?=\s*=)/, "attribute.name"],
      [/"([^"]*)"/, "attribute.value"],
      [/'([^']*)'/, "attribute.value"],
      [/\/?>/, "tag"],
      [/[^<{]+/, ""],
      [/[<{]/, ""],
    ],
    comment: [
      [/-->/, "comment", "@pop"],
      [/[^-]+/, "comment"],
      [/./, "comment"],
    ],
    mustache: [
      [/\}\}/, "delimiter.bracket", "@pop"],
      [/\b(true|false|null|undefined)\b/, "keyword"],
      [/-?\d+(\.\d+)?/, "number"],
      [/[A-Za-z_$][\w$]*/, "variable"],
      [/[^}]+/, "variable"],
      [/./, "variable"],
    ],
  },
};

const WXSS_TOKENIZER: monaco.languages.IMonarchLanguage = {
  defaultToken: "",
  tokenPostfix: ".wxss",
  ignoreCase: false,
  brackets: [{ open: "{", close: "}", token: "delimiter.bracket" }],
  tokenizer: {
    root: [
      [/\/\*/, "comment", "@comment"],
      [/#[0-9a-fA-F]{3,8}\b/, "number.hex"],
      [/\.[A-Za-z_][\w-]*/, "type.identifier"],
      [/#[A-Za-z_][\w-]*/, "type.identifier"],
      [/::?[A-Za-z-]+/, "attribute.name"],
      [/[A-Za-z_-]+(?=\s*:)/, "attribute.name"],
      [/[{}]/, "delimiter.bracket"],
      [/[;:,()]/, "delimiter"],
      [/"[^"]*"|'[^']*'/, "string"],
      [/-?\d+(\.\d+)?(rpx|px|em|rem|vh|vw|vmin|vmax|%|deg|s|ms)?\b/, "number"],
      [/@[A-Za-z-]+/, "keyword"],
      [/!important\b/, "keyword"],
      [/[A-Za-z-]+/, ""],
      [/\s+/, ""],
    ],
    comment: [
      [/\*\//, "comment", "@pop"],
      [/[^*]+/, "comment"],
      [/./, "comment"],
    ],
  },
};

function registerLanguages(): void {
  if (!monaco.languages.getLanguages().some((language) => language.id === WXML_LANGUAGE)) {
    monaco.languages.register({
      id: WXML_LANGUAGE,
      aliases: ["WXML", "wxml"],
      extensions: [".wxml"],
    });
  }
  monaco.languages.setMonarchTokensProvider(WXML_LANGUAGE, WXML_TOKENIZER);
  monaco.languages.setLanguageConfiguration(WXML_LANGUAGE, {
    comments: { blockComment: ["<!--", "-->"] },
    brackets: [
      ["<", ">"],
      ["{{", "}}"],
    ],
    autoClosingPairs: [
      { open: "{{", close: "}}" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: "<", close: ">" },
    ],
    surroundingPairs: [
      { open: "{{", close: "}}" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: "<", close: ">" },
    ],
  });

  if (!monaco.languages.getLanguages().some((language) => language.id === WXSS_LANGUAGE)) {
    monaco.languages.register({
      id: WXSS_LANGUAGE,
      aliases: ["WXSS", "wxss"],
      extensions: [".wxss"],
    });
  }
  monaco.languages.setMonarchTokensProvider(WXSS_LANGUAGE, WXSS_TOKENIZER);
  monaco.languages.setLanguageConfiguration(WXSS_LANGUAGE, {
    comments: { blockComment: ["/*", "*/"] },
    brackets: [["{", "}"]],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  });
}

function registerWxmlIntelligence(): void {
  monaco.languages.registerCompletionItemProvider(WXML_LANGUAGE, {
    triggerCharacters: ["<", " ", ":", "-"],
    provideCompletionItems(model, position) {
      const line = model.getLineContent(position.lineNumber);
      const before = line.slice(0, position.column - 1);
      const open = before.lastIndexOf("<");
      const close = before.lastIndexOf(">");
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: position.column,
        endColumn: position.column,
      };
      const suggestions: monaco.languages.CompletionItem[] = [];

      // Typing a tag name right after `<` or `</`.
      if (open > close && /<\/?[\w:-]*$/.test(before.slice(open))) {
        for (const tag of BUILTIN_COMPONENTS) {
          suggestions.push({
            label: tag,
            kind: monaco.languages.CompletionItemKind.Class,
            detail: "QChat built-in component",
            documentation: TAG_DOCS[tag],
            insertText: tag,
            range,
          });
        }
        suggestions.push({
          label: "block",
          kind: monaco.languages.CompletionItemKind.Keyword,
          detail: "Template grouping (no DOM node)",
          insertText: "block",
          range,
        });
        return { suggestions };
      }

      // Inside an open tag: attributes.
      if (open > close) {
        const tagMatch = /<\/?([A-Za-z][\w:.-]*)/.exec(before.slice(open));
        const tag = tagMatch?.[1] ?? "";
        const names = new Set([
          ...Object.keys(COMMON_ATTRIBUTES),
          ...(COMPONENT_ATTRIBUTES[tag] ?? []),
        ]);
        for (const name of names) {
          const doc = COMMON_ATTRIBUTES[name];
          suggestions.push({
            label: name,
            kind: monaco.languages.CompletionItemKind.Property,
            detail: doc ? "WXML attribute" : `${tag} attribute`,
            documentation: doc,
            insertText: name.includes("*") ? name.replace("*", "custom") : `${name}=""`,
            range,
          });
        }
        // Common event bindings are not enumerable in WeChat either, so offer
        // the handful the built-ins actually emit.
        for (const event of [
          "tap",
          "longpress",
          "input",
          "confirm",
          "blur",
          "focus",
          "change",
          "submit",
          "reset",
          "scroll",
          "scrolltoupper",
          "scrolltolower",
          "load",
          "error",
          "transition",
          "animationfinish",
        ]) {
          suggestions.push({
            label: `bind${event}`,
            kind: monaco.languages.CompletionItemKind.Event,
            detail: "Event handler",
            insertText: `bind${event}=""`,
            range,
          });
        }
        return { suggestions };
      }

      return { suggestions };
    },
  });

  monaco.languages.registerHoverProvider(WXML_LANGUAGE, {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const line = model.getLineContent(position.lineNumber);
      const isAttribute = /[A-Za-z_][\w:.-]*\s*=\s*"?$/.test(
        line.slice(0, word.endColumn - 1),
      );
      const doc = isAttribute ? COMMON_ATTRIBUTES[word.word] : TAG_DOCS[word.word];
      if (!doc) return null;
      return {
        range: new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn,
        ),
        contents: [
          { value: `**${word.word}**${isAttribute ? " attribute" : " component"}` },
          { value: doc },
        ],
      };
    },
  });
}

// ---------------------------------------------------------------------------
// TypeScript / JavaScript / JSON
// ---------------------------------------------------------------------------

const COMPILER_OPTIONS: monaco.typescript.CompilerOptions = {
  target: monaco.typescript.ScriptTarget.ES2020,
  module: monaco.typescript.ModuleKind.ESNext,
  moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
  allowNonTsExtensions: true,
  allowSyntheticDefaultImports: true,
  allowJs: true,
  checkJs: false,
  esModuleInterop: true,
  strict: false,
  noEmit: true,
  skipLibCheck: true,
  // A Mini Program runs in the host WebView: ES2020, no DOM types. `wx`,
  // `Page`, `Component` and `App` come from MINIPROGRAM_TYPES below.
  lib: ["es2020"],
};

let configured = false;
export function configureMonaco(): void {
  if (configured) return;
  configured = true;

  registerLanguages();
  registerWxmlIntelligence();

  monaco.typescript.typescriptDefaults.setCompilerOptions(COMPILER_OPTIONS);
  monaco.typescript.javascriptDefaults.setCompilerOptions(COMPILER_OPTIONS);
  for (const defaults of [
    monaco.typescript.typescriptDefaults,
    monaco.typescript.javascriptDefaults,
  ]) {
    defaults.addExtraLib(
      MINIPROGRAM_TYPES,
      "file:///types/qchat-miniprogram.d.ts",
    );
  }

  monaco.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: false,
    trailingCommas: "error",
    schemas: [
      {
        uri: "https://qchat.local/component.schema.json",
        fileMatch: ["**/components/**/*.json"],
        schema: COMPONENT_JSON_SCHEMA,
      },
      {
        uri: "https://qchat.local/page.schema.json",
        fileMatch: ["**/pages/**/*.json"],
        schema: PAGE_JSON_SCHEMA,
      },
      {
        uri: "https://qchat.local/app.schema.json",
        fileMatch: ["**/app.json"],
        schema: APP_JSON_SCHEMA,
      },
      {
        uri: "https://qchat.local/manifest.schema.json",
        fileMatch: ["**/manifest.json"],
        schema: MANIFEST_SCHEMA,
      },
    ],
  });
}

export { monaco };
