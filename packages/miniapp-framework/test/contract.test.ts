import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  checkArtifacts,
  loadContract,
  renderArtifacts,
  repoRoot,
  type MiniappUiContract,
} from "../../contracts/generate-miniapp-ui.mjs";
import { QAPP_PERMISSIONS } from "../src/manifest.js";
import {
  EVENT_NAMES,
  PERMISSION_IDS,
  STYLE_KEYS,
  STYLE_ENUM_ALIASES,
} from "../src/protocol.js";
import { hostNodeTypes } from "../src/runtime.js";

const contract = loadContract();

function readRepo(relative: string): string {
  return readFileSync(path.join(repoRoot, relative), "utf8");
}

function dartStringSet(source: string, name: string): string[] {
  const start = source.indexOf(`const Set<String> ${name} = <String>{`);
  assert.ok(start >= 0, `${name} is present in the generated Dart file`);
  const end = source.indexOf("};", start);
  const body = source.slice(start, end);
  return [...body.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((match) =>
    match[1].replaceAll("\\'", "'").replaceAll("\\\\", "\\"),
  );
}

test("generated artifacts on disk match the contract", () => {
  const drift = checkArtifacts();
  assert.deepEqual(drift, [], `stale artifacts: ${drift.join(", ")}`);
});

test("adding a component on one side fails the drift check", () => {
  const tampered: MiniappUiContract = structuredClone(contract);
  tampered.components.Hacked = { props: { children: "VNodeChild" }, events: [] };
  const artifacts = renderArtifacts(tampered);
  const framework = artifacts["packages/miniapp-framework/src/ui-contract.generated.ts"];
  assert.ok(framework.includes('"Hacked"'), "framework contract picks up the new component");
  const drift = checkArtifacts(artifacts);
  assert.ok(
    drift.some((entry) => entry.startsWith("packages/miniapp-framework/src/ui-contract.generated.ts")),
    "framework artifact is reported stale",
  );
  assert.ok(
    drift.some((entry) => entry.startsWith("apps/mobile/lib/features/miniapps/qapp/qapp_contract.generated.dart")),
    "Dart artifact is reported stale",
  );
  assert.ok(
    drift.some((entry) => entry.startsWith("apps/miniapp-ide/src/lib/qchat-sdk.generated.ts")),
    "Studio artifact is reported stale",
  );
  // The committed files were generated from the unmodified contract.
  assert.equal(
    readRepo("packages/miniapp-framework/src/ui-contract.generated.ts").includes('"Hacked"'),
    false,
  );
});

test("adding a style key on one side fails the drift check", () => {
  const tampered: MiniappUiContract = structuredClone(contract);
  tampered.styleKeys.totallyNewKey = "number";
  const drift = checkArtifacts(renderArtifacts(tampered));
  assert.ok(drift.length >= 3, "every generated artifact notices the new style key");
});

test("TypeScript runtime and Dart host share one component and event list", () => {
  const expected = new Set([
    ...Object.keys(contract.components),
    contract.textNodeType,
  ]);
  assert.deepEqual([...hostNodeTypes].sort(), [...expected].sort());

  const dart = readRepo(
    "apps/mobile/lib/features/miniapps/qapp/qapp_contract.generated.dart",
  );
  assert.deepEqual(dartStringSet(dart, "qappNodeTypes").sort(), [...expected].sort());
  assert.deepEqual(dartStringSet(dart, "qappEventNames").sort(), [...EVENT_NAMES].sort());
  assert.deepEqual(dartStringSet(dart, "qappStyleKeys").sort(), [...STYLE_KEYS].sort());
});

test("Studio typings expose every component", () => {
  const sdk = readRepo("apps/miniapp-ide/src/lib/qchat-sdk.generated.ts");
  assert.ok(sdk.includes("export const sdkTypes"));
  for (const name of Object.keys(contract.components)) {
    assert.ok(
      sdk.includes(`export const ${name}: Component<`),
      `Studio typings declare ${name}`,
    );
  }
  for (const key of Object.keys(contract.styleKeys)) {
    assert.ok(sdk.includes(`${key}?:`), `Studio Style declares ${key}`);
  }
});

test("permissions are declared once and shared", () => {
  const expected = contract.permissions.map((entry) => entry.id);
  assert.deepEqual([...PERMISSION_IDS], expected);
  assert.deepEqual([...QAPP_PERMISSIONS], expected);
  // Read the contracts module as text so the check never depends on how the
  // other package is resolved at runtime.
  const source = readRepo("packages/contracts/miniapps.ts");
  const ids = [...source.matchAll(/id:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, expected);
});

test("CSS-style enum aliases normalize to canonical camelCase", () => {
  assert.deepEqual(STYLE_ENUM_ALIASES.justifyContent["space-between"], "spaceBetween");
  assert.deepEqual(STYLE_ENUM_ALIASES.alignItems["flex-start"], "start");
  assert.deepEqual(STYLE_ENUM_ALIASES.textAlign.start, "left");
  assert.equal(
    Object.keys(contract.enums.justifyContent.aliases).length > 0,
    true,
  );
});
