#!/usr/bin/env node
// Generates the TypeScript SDK typings, the Flutter host whitelists and the
// Studio Monaco typings from the single source of truth
// `packages/contracts/miniapp-ui.contract.json`.
//
// Usage:
//   node packages/contracts/generate-miniapp-ui.mjs          # write artifacts
//   node packages/contracts/generate-miniapp-ui.mjs --check  # fail on drift
//
// The framework test imports `renderArtifacts` and compares its output with the
// committed files, so hand-editing a generated file or adding a component on one
// side only makes the test fail.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "../..");
export const contractPath = path.join(here, "miniapp-ui.contract.json");

const HARNESS_HEADER = [
  "// AUTO-GENERATED FILE - DO NOT EDIT BY HAND.",
  "// Source of truth: packages/contracts/miniapp-ui.contract.json",
  "// Regenerate: corepack pnpm contract:generate",
  "/* eslint-disable */",
  "",
];

export function loadContract(file = contractPath) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function json(value, indent = 2) {
  return JSON.stringify(value, null, indent);
}

function pascal(name) {
  return name.replace(/[^A-Za-z0-9]+/g, " ").trim().split(/\s+/).map((part) => part[0].toUpperCase() + part.slice(1)).join("");
}

const INTERFACE_OVERRIDES = {
  Row: "ViewProps",
  Column: "ViewProps",
};

function interfaceFor(contract, name) {
  return INTERFACE_OVERRIDES[name] ?? `${name}Props`;
}

function permissionIds(contract) {
  return contract.permissions.map((entry) => entry.id);
}

/* -------------------------------------------------------------------------- */
/* 1. Framework runtime contract (bundled into QuickJS)                       */
/* -------------------------------------------------------------------------- */

function renderFrameworkContract(contract) {
  const componentNames = Object.keys(contract.components);
  const lines = [...HARNESS_HEADER];
  lines.push(`export const CONTRACT_VERSION = ${contract.version};`);
  lines.push(`export const PROTOCOL_VERSION = ${contract.protocolVersion} as const;`);
  lines.push(`export const TEXT_NODE_TYPE = ${JSON.stringify(contract.textNodeType)};`);
  lines.push(`export const FRAGMENT_TYPE = ${JSON.stringify(contract.fragmentType)};`);
  lines.push(`export const SDK_VERSION = ${JSON.stringify(contract.sdkVersion)} as const;`);
  lines.push(`export const RUNTIME_VERSION = ${JSON.stringify(contract.runtimeVersion)} as const;`);
  lines.push("");
  lines.push(
    `export const HOST_NODE_TYPES: ReadonlySet<string> = new Set<string>([${[
      ...componentNames,
      contract.textNodeType,
    ]
      .map((name) => JSON.stringify(name))
      .join(", ")}]);`,
  );
  lines.push("");
  lines.push("export const COMPONENT_EVENTS: Readonly<Record<string, readonly string[]>> = Object.freeze({");
  for (const name of componentNames) {
    lines.push(`  ${JSON.stringify(name)}: [${(contract.components[name].events ?? []).map((e) => JSON.stringify(e)).join(", ")}],`);
  }
  lines.push("});");
  lines.push("");
  lines.push(
    `export const EVENT_NAMES = [${contract.events.map((e) => JSON.stringify(e)).join(", ")}] as const;`,
  );
  lines.push("export type GeneratedEventName = (typeof EVENT_NAMES)[number];");
  lines.push("");
  lines.push("export const PROP_EVENT_MAP: Readonly<Record<string, string>> = Object.freeze({");
  for (const [prop, event] of Object.entries(contract.propEvents)) {
    lines.push(`  ${JSON.stringify(prop)}: ${JSON.stringify(event)},`);
  }
  lines.push("});");
  lines.push("");
  lines.push(
    `export const STYLE_KEYS = [${Object.keys(contract.styleKeys).map((k) => JSON.stringify(k)).join(", ")}] as const;`,
  );
  lines.push("export type GeneratedStyleKey = (typeof STYLE_KEYS)[number];");
  lines.push("");
  lines.push("export const STYLE_ENUM_VALUES: Readonly<Record<string, readonly string[]>> = Object.freeze({");
  for (const [name, spec] of Object.entries(contract.enums)) {
    lines.push(`  ${JSON.stringify(name)}: [${spec.values.map((v) => JSON.stringify(v)).join(", ")}],`);
  }
  lines.push("});");
  lines.push("");
  lines.push("export const STYLE_ENUM_ALIASES: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({");
  for (const [name, spec] of Object.entries(contract.enums)) {
    const aliases = Object.entries(spec.aliases ?? {});
    lines.push(`  ${JSON.stringify(name)}: Object.freeze({${aliases.map(([a, c]) => `${JSON.stringify(a)}: ${JSON.stringify(c)}`).join(", ")}}),`);
  }
  lines.push("});");
  lines.push("");
  lines.push("export const STYLE_ENUM_KEYS: Readonly<Record<string, string>> = Object.freeze({");
  for (const [key, enumName] of Object.entries(contract.styleEnumKeys)) {
    lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(enumName)},`);
  }
  lines.push("});");
  lines.push("");
  lines.push(
    `export const PERMISSION_IDS = [${permissionIds(contract).map((id) => JSON.stringify(id)).join(", ")}] as const;`,
  );
  lines.push("export type GeneratedPermission = (typeof PERMISSION_IDS)[number];");
  lines.push("");
  lines.push("export const HOST_METHOD_PERMISSIONS: Readonly<Record<string, string | null>> = Object.freeze({");
  for (const method of contract.hostMethods) {
    lines.push(`  ${JSON.stringify(method.name)}: ${method.permission == null ? "null" : JSON.stringify(method.permission)},`);
  }
  lines.push("});");
  lines.push("");
  return lines.join("\n");
}

/* -------------------------------------------------------------------------- */
/* 2. Type-level conformance: fails `tsc` when a hand-written TS type drifts  */
/* -------------------------------------------------------------------------- */

function renderTypingConformance(contract) {
  const lines = [...HARNESS_HEADER];
  lines.push('import type { Style } from "./protocol.js";');
  const interfaces = [
    ...new Set(Object.keys(contract.components).map((name) => interfaceFor(contract, name))),
  ];
  lines.push(`import type { ${interfaces.sort().join(", ")} } from "./ui.js";`);
  lines.push("");
  lines.push("// Both directions: a key missing from `Style` or an extra key on `Style`");
  lines.push("// fails to compile.");
  lines.push("const STYLE_KEYS_CONFORMANCE: Record<keyof Required<Style>, true> = {");
  for (const key of Object.keys(contract.styleKeys)) {
    lines.push(`  ${key}: true,`);
  }
  lines.push("};");
  lines.push("");
  lines.push("const STYLE_KEYS_SEEN: readonly (keyof Required<Style>)[] = Object.keys(");
  lines.push("  STYLE_KEYS_CONFORMANCE,");
  lines.push(") as (keyof Required<Style>)[];");
  lines.push("void STYLE_KEYS_SEEN;");
  lines.push("void STYLE_KEYS_CONFORMANCE;");
  lines.push("");
  const baseKeys = Object.keys(contract.baseProps);
  const seenInterfaces = new Set();
  for (const name of Object.keys(contract.components)) {
    const interfaceName = interfaceFor(contract, name);
    if (seenInterfaces.has(interfaceName)) continue;
    seenInterfaces.add(interfaceName);
    lines.push(`// ${name}`);
    lines.push(`const ${interfaceName}_CONFORMANCE: Record<keyof ${interfaceName}, true> = {`);
    for (const key of baseKeys) lines.push(`  ${key}: true,`);
    for (const key of Object.keys(contract.components[name].props ?? {})) {
      if (baseKeys.includes(key)) continue;
      lines.push(`  ${key}: true,`);
    }
    for (const key of Object.keys(contract.components[name].localProps ?? {})) {
      lines.push(`  ${key}: true,`);
    }
    lines.push("};");
    lines.push(`void ${interfaceName}_CONFORMANCE;`);
    lines.push("");
  }
  lines.push("export {};");
  lines.push("");
  return lines.join("\n");
}

/* -------------------------------------------------------------------------- */
/* 3. Flutter host whitelists                                                 */
/* -------------------------------------------------------------------------- */

function dartString(value) {
  return `'${String(value).replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}

function renderDartContract(contract) {
  const lines = [
    "// AUTO-GENERATED FILE - DO NOT EDIT BY HAND.",
    "// Source of truth: packages/contracts/miniapp-ui.contract.json",
    "// Regenerate: corepack pnpm contract:generate",
    "",
    `const int qappContractVersion = ${contract.version};`,
    `const int qappProtocolVersion = ${contract.protocolVersion};`,
    `const String qappTextNodeType = ${dartString(contract.textNodeType)};`,
    `const String qappRuntimeVersion = ${dartString(contract.runtimeVersion)};`,
    "",
    "/// Component (and text) node types the host accepts.",
    "const Set<String> qappNodeTypes = <String>{",
  ];
  for (const name of [...Object.keys(contract.components), contract.textNodeType]) {
    lines.push(`  ${dartString(name)},`);
  }
  lines.push("};");
  lines.push("");
  lines.push("/// Event names the host accepts on a node.");
  lines.push("const Set<String> qappEventNames = <String>{");
  for (const event of contract.events) lines.push(`  ${dartString(event)},`);
  lines.push("};");
  lines.push("");
  lines.push("/// Events each component may declare (diagnostics only).");
  lines.push("const Map<String, List<String>> qappComponentEvents = <String, List<String>>{");
  for (const [name, spec] of Object.entries(contract.components)) {
    lines.push(`  ${dartString(name)}: <String>[${(spec.events ?? []).map(dartString).join(", ")}],`);
  }
  lines.push("};");
  lines.push("");
  lines.push("/// Style keys the host parses.");
  lines.push("const Set<String> qappStyleKeys = <String>{");
  for (const key of Object.keys(contract.styleKeys)) lines.push(`  ${dartString(key)},`);
  lines.push("};");
  lines.push("");
  lines.push("/// Canonical values for every style enum.");
  lines.push("const Map<String, List<String>> qappStyleEnumValues = <String, List<String>>{");
  for (const [name, spec] of Object.entries(contract.enums)) {
    lines.push(`  ${dartString(name)}: <String>[${spec.values.map(dartString).join(", ")}],`);
  }
  lines.push("};");
  lines.push("");
  lines.push("/// CSS-like aliases normalised to the canonical camelCase value.");
  lines.push("const Map<String, Map<String, String>> qappStyleEnumAliases = <String, Map<String, String>>{");
  for (const [name, spec] of Object.entries(contract.enums)) {
    const aliases = Object.entries(spec.aliases ?? {});
    lines.push(`  ${dartString(name)}: <String, String>{${aliases.map(([a, c]) => `${dartString(a)}: ${dartString(c)}`).join(", ")}},`);
  }
  lines.push("};");
  lines.push("");
  lines.push("/// Style key -> enum name, used to normalise aliases.");
  lines.push("const Map<String, String> qappStyleEnumKeys = <String, String>{");
  for (const [key, enumName] of Object.entries(contract.styleEnumKeys)) {
    lines.push(`  ${dartString(key)}: ${dartString(enumName)},`);
  }
  lines.push("};");
  lines.push("");
  lines.push("/// Permission ids a package may request.");
  lines.push("const Set<String> qappPermissions = <String>{");
  for (const id of permissionIds(contract)) lines.push(`  ${dartString(id)},`);
  lines.push("};");
  lines.push("");
  return lines.join("\n");
}

/* -------------------------------------------------------------------------- */
/* 4. Studio (Monaco) typings                                                 */
/* -------------------------------------------------------------------------- */

function tsTypeFor(contract, type) {
  if (!type) return "unknown";
  return type
    .replace(/ButtonVariant\b/g, '"primary" | "secondary" | "text" | "danger"')
    .replace(/ImageFit\b/g, '"cover" | "contain" | "fill" | "fitWidth" | "fitHeight"')
    .replace(/KeyboardType\b/g, '"text" | "number" | "email" | "phone" | "url"')
    .replace(/StackAlignment\b/g, contract.enums.stackAlignment.values.map((v) => JSON.stringify(v)).join(" | "))
    .replace(/AnimateKind\b/g, '"fadeIn" | "slideUp" | "scaleIn"')
    .replace(/ModalAnimation\b/g, '"none" | "fade" | "slide"')
    .replace(/SafeAreaEdge\b/g, '"top" | "right" | "bottom" | "left"')
    .replace(/FlexDirection\b/g, contract.enums.flexDirection.values.map((v) => JSON.stringify(v)).join(" | "))
    .replace(/FlexWrap\b/g, contract.enums.flexWrap.values.map((v) => JSON.stringify(v)).join(" | "))
    .replace(/AlignItems\b/g, contract.enums.alignItems.values.map((v) => JSON.stringify(v)).join(" | "))
    .replace(/JustifyContent\b/g, contract.enums.justifyContent.values.map((v) => JSON.stringify(v)).join(" | "))
    .replace(/AlignSelf\b/g, contract.enums.alignSelf.values.map((v) => JSON.stringify(v)).join(" | "))
    .replace(/Position\b/g, '"relative" | "absolute"')
    .replace(/Overflow\b/g, '"visible" | "hidden" | "clip"')
    .replace(/FontWeight\b/g, contract.enums.fontWeight.values.map((v) => JSON.stringify(v)).join(" | "))
    .replace(/FontStyle\b/g, '"normal" | "italic"')
    .replace(/TextAlign\b/g, contract.enums.textAlign.values.map((v) => JSON.stringify(v)).join(" | "))
    .replace(/TextDecoration\b/g, contract.enums.textDecoration.values.map((v) => JSON.stringify(v)).join(" | "))
    .replace(/TextTransform\b/g, contract.enums.textTransform.values.map((v) => JSON.stringify(v)).join(" | "));
}

function renderIdeTypes(contract) {
  const styleLines = Object.entries(contract.styleKeys).map(
    ([key, type]) => `    ${key}?: ${tsTypeFor(contract, type)};`,
  );
  const helperLines = Object.entries(contract.helperTypes).map(
    ([name, type]) =>
      `  export type ${name} = ${type
        .replace(/\b(VNode|VNodeChild)\b/g, "unknown")
        .replace(/\b(BoxShadow|GradientStop|LinearGradient|RadialGradient|QappGradient|TabItem|TabChangePayload|ScrollOffset|EventPayload)\b/g, (m) => m)};`,
  );
  const componentLines = Object.entries(contract.components).map(([name, spec]) => {
    const props = {
      ...Object.fromEntries(Object.entries(contract.baseProps).map(([k, v]) => [k, tsTypeFor(contract, v)])),
      ...Object.fromEntries(Object.entries(spec.props ?? {}).map(([k, v]) => [k, tsTypeFor(contract, v)])),
      ...Object.fromEntries(Object.entries(spec.localProps ?? {}).map(([k, v]) => [k, tsTypeFor(contract, v)])),
    };
    const shape = Object.entries(props)
      .map(([k, v]) => `${k}?: ${v}`)
      .join("; ");
    return `  export const ${name}: Component<{ ${shape} }>;`;
  });
  const body = `
type QChatStyle = Style;

declare module "@mna/qchat" {
  export interface Style {
${styleLines.join("\n")}
  }
${helperLines.join("\n")}
  export interface BaseProps {
${Object.entries(contract.baseProps)
  .map(([k, v]) => `    ${k}?: ${tsTypeFor(contract, v)};`)
  .join("\n")}
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
${componentLines.join("\n")}
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
  return [...HARNESS_HEADER, "export const sdkTypes = `" + body.replaceAll("`", "\\`").replaceAll("${", "\\${") + "`;", ""].join("\n");
}

/* -------------------------------------------------------------------------- */
/* 5. Documentation reference                                                 */
/* -------------------------------------------------------------------------- */

function renderDocs(contract) {
  const lines = [
    "# Mini App UI reference (generated)",
    "",
    "Generated from `packages/contracts/miniapp-ui.contract.json` by",
    "`corepack pnpm contract:generate`. Do not edit by hand; edit the contract and",
    "regenerate so the TypeScript SDK, the Flutter host and the Studio typings stay",
    "in sync.",
    "",
    "## Components",
    "",
    "| Component | Props | Events |",
    "| --- | --- | --- |",
  ];
  for (const [name, spec] of Object.entries(contract.components)) {
    const props = [
      ...Object.keys(contract.baseProps),
      ...Object.keys(spec.props ?? {}),
      ...Object.keys(spec.localProps ?? {}),
    ];
    lines.push(`| \`${name}\` | ${props.map((p) => `\`${p}\``).join(", ")} | ${(spec.events ?? []).map((e) => `\`${e}\``).join(", ") || "—"} |`);
  }
  lines.push("");
  lines.push("## Events");
  lines.push("");
  lines.push(contract.events.map((e) => `\`${e}\``).join(", "));
  lines.push("");
  lines.push("| Prop | Event |");
  lines.push("| --- | --- |");
  for (const [prop, event] of Object.entries(contract.propEvents)) {
    lines.push(`| \`${prop}\` | \`${event}\` |`);
  }
  lines.push("");
  lines.push("## Style keys");
  lines.push("");
  lines.push("| Key | Type |");
  lines.push("| --- | --- |");
  for (const [key, type] of Object.entries(contract.styleKeys)) {
    lines.push(`| \`${key}\` | \`${type}\` |`);
  }
  lines.push("");
  lines.push("## Style enums");
  lines.push("");
  for (const [name, spec] of Object.entries(contract.enums)) {
    const aliases = Object.entries(spec.aliases ?? {});
    lines.push(
      `- \`${name}\`: ${spec.values.map((v) => `\`${v}\``).join(", ")}${
        aliases.length ? ` (aliases: ${aliases.map(([a, c]) => `\`${a}\`→\`${c}\``).join(", ")})` : ""
      }`,
    );
  }
  lines.push("");
  lines.push("## Permissions");
  lines.push("");
  lines.push("| Permission | APIs |");
  lines.push("| --- | --- |");
  for (const entry of contract.permissions) {
    lines.push(`| \`${entry.id}\` | ${entry.apis.map((a) => `\`${a}\``).join(", ")} |`);
  }
  lines.push("");
  lines.push("## Host methods");
  lines.push("");
  lines.push("| Method | Permission |");
  lines.push("| --- | --- |");
  for (const method of contract.hostMethods) {
    lines.push(`| \`${method.name}\` | ${method.permission ? `\`${method.permission}\`` : "—"} |`);
  }
  lines.push("");
  return lines.join("\n");
}

/* -------------------------------------------------------------------------- */

export function renderArtifacts(contract = loadContract()) {
  return {
    "packages/miniapp-framework/src/ui-contract.generated.ts": renderFrameworkContract(contract),
    "packages/miniapp-framework/src/ui-contract.typing.ts": renderTypingConformance(contract),
    "apps/mobile/lib/features/miniapps/qapp/qapp_contract.generated.dart": renderDartContract(contract),
    "apps/miniapp-ide/src/lib/qchat-sdk.generated.ts": renderIdeTypes(contract),
    "docs/miniapp-ui-reference.md": renderDocs(contract),
  };
}

export function writeArtifacts(artifacts = renderArtifacts()) {
  const written = [];
  for (const [relative, content] of Object.entries(artifacts)) {
    const absolute = path.join(repoRoot, relative);
    mkdirSync(path.dirname(absolute), { recursive: true });
    const next = content.endsWith("\n") ? content : `${content}\n`;
    const previous = existsSync(absolute) ? readFileSync(absolute, "utf8") : null;
    if (previous === next) continue;
    writeFileSync(absolute, next, "utf8");
    written.push(relative);
  }
  return written;
}

export function checkArtifacts(artifacts = renderArtifacts()) {
  const drift = [];
  for (const [relative, content] of Object.entries(artifacts)) {
    const absolute = path.join(repoRoot, relative);
    const next = content.endsWith("\n") ? content : `${content}\n`;
    if (!existsSync(absolute)) {
      drift.push(`${relative} (missing)`);
      continue;
    }
    if (readFileSync(absolute, "utf8") !== next) drift.push(`${relative} (stale)`);
  }
  return drift;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  if (process.argv.includes("--check")) {
    const drift = checkArtifacts();
    if (drift.length) {
      console.error("Generated Mini App contract artifacts are out of date:");
      for (const entry of drift) console.error(`  - ${entry}`);
      console.error("Run: corepack pnpm contract:generate");
      process.exitCode = 1;
    } else {
      console.log("Mini App contract artifacts are up to date.");
    }
  } else {
    const written = writeArtifacts();
    console.log(
      written.length
        ? `Wrote ${written.length} artifact(s):\n${written.map((f) => `  - ${f}`).join("\n")}`
        : "All Mini App contract artifacts are already up to date.",
    );
  }
}
