import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  bundleEntry,
  envTypingPath,
  findTypeScript,
  typecheckProject,
} from "../src/compiler.js";

const fixtures = path.join(import.meta.dirname, "fixtures");

/** Strings that only exist in one polyfill, so a marker proves it was bundled. */
const MARKERS = {
  timers: "QChat timer limit reached",
  console: "more characters",
  clone: "could not be cloned",
  url: "URLSearchParams entries need a name and a value",
  encoding: "The encoding \"",
  abort: "AbortSignal.timeout needs the timers",
  intl: "tháng 1",
} as const;

function markersIn(appJs: string): string[] {
  return Object.entries(MARKERS)
    .filter(([, marker]) => appJs.includes(marker))
    .map(([name]) => name);
}

test("a bundle only carries the environment parts the app installs", async () => {
  const plain = await bundleEntry(path.join(fixtures, "no-env.tsx"));
  const intlOnly = await bundleEntry(path.join(fixtures, "env-intl.tsx"));
  const full = await bundleEntry(path.join(fixtures, "env-full.tsx"));

  assert.deepEqual(
    markersIn(plain.appJs),
    [],
    "an app that never imports the environment stays free of every polyfill",
  );
  assert.deepEqual(
    markersIn(intlOnly.appJs),
    ["intl"],
    "importing only installIntl must not pull in the other polyfills",
  );
  assert.deepEqual(
    markersIn(full.appJs).sort(),
    ["abort", "clone", "console", "encoding", "intl", "timers", "url"],
    "the full environment installs every part",
  );

  const plainBytes = Buffer.byteLength(plain.appJs);
  const intlBytes = Buffer.byteLength(intlOnly.appJs);
  const fullBytes = Buffer.byteLength(full.appJs);
  assert.ok(intlBytes > plainBytes, "the Intl subset has a real cost, not zero");
  assert.ok(fullBytes > intlBytes, "the rest of the environment adds the remainder");
  // A budget so the environment can never quietly grow out of proportion. The
  // measured cost of the whole environment is printed so a regression is
  // visible in the test output, and the ceiling keeps it bounded.
  console.log(
    `  environment cost: intl ${intlBytes - plainBytes} bytes, full ${fullBytes - plainBytes} bytes`,
  );
  assert.ok(
    fullBytes - plainBytes < 32 * 1024,
    `the full environment costs ${fullBytes - plainBytes} bytes, expected under 32 KB`,
  );
});

test("the compiler type-checks a qapp project against the QuickJS globals", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "qchat-env-types-"));
  try {
    mkdirSync(path.join(directory, "src"), { recursive: true });
    // `lib: ["ES2020"]` and no DOM: the only way this compiles is with the
    // globals the SDK ships in `types/qchat-env.d.ts`.
    writeFileSync(
      path.join(directory, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          lib: ["ES2020"],
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
          skipLibCheck: true,
          noEmit: true,
          jsx: "react-jsx",
          jsxImportSource: "@mna/qchat",
        },
        include: ["src/**/*.ts", "src/**/*.tsx"],
      }),
    );
    writeFileSync(
      path.join(directory, "src", "main.tsx"),
      `import "@mna/qchat/env/auto";
import { start, useState } from "@mna/qchat";
import { Text, View } from "@mna/qchat/ui";

function App() {
  const [label, setLabel] = useState("idle");
  setTimeout(() => setLabel(new Intl.NumberFormat("vi-VN").format(1234.5)), 10);
  const timer = setInterval(() => setLabel("tick"), 20);
  clearInterval(timer);
  queueMicrotask(() => setLabel(String(new URL("https://qchat.vn/a").pathname)));
  requestAnimationFrame(() => setLabel("frame"));
  console.log(new TextEncoder().encode("x").length, new Date().toISOString());
  const copy = structuredClone({ nested: { ok: true } });
  const controller = new AbortController();
  controller.abort("stop");
  return (
    <View>
      <Text>{label + String(copy.nested.ok) + String(controller.signal.aborted)}</Text>
    </View>
  );
}

start(App);
`,
    );

    const result = typecheckProject(directory);
    assert.equal(result.skipped, false, "TypeScript ran");
    assert.deepEqual(result.warnings, []);
    assert.ok(envTypingPath(), "the SDK ships the QuickJS declarations");

    // Prove the check is meaningful: the same globals without the SDK
    // declarations do not compile, because ES2020 has no console, timers or URL.
    const tsc = findTypeScript();
    assert.ok(tsc, "TypeScript is installed");
    writeFileSync(
      path.join(directory, "src", "globals-only.ts"),
      `export const value = setTimeout(() => console.log(new URL("https://qchat.vn").pathname), 10);
export const bytes = new TextEncoder().encode("x");
export const copy = structuredClone({ ok: true });
export const controller = new AbortController();
`,
    );
    writeFileSync(
      path.join(directory, "no-env-types.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          lib: ["ES2020"],
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ["src/globals-only.ts"],
      }),
    );
    let failed = false;
    let output = "";
    try {
      execFileSync(
        process.execPath,
        [tsc as string, "-p", path.join(directory, "no-env-types.json")],
        { cwd: directory, encoding: "utf8", stdio: "pipe" },
      );
    } catch (error) {
      failed = true;
      const failure = error as { stdout?: unknown; stderr?: unknown };
      output = `${failure.stdout ?? ""}${failure.stderr ?? ""}`;
    }
    assert.equal(failed, true, "the same source must not compile without the SDK globals");
    assert.match(output, /Cannot find name '(setTimeout|console|URL)'/);
    assert.match(output, /Cannot find name '(TextEncoder|structuredClone|AbortController)'/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a project that adds the DOM lib is warned instead of silently patched", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "qchat-env-dom-"));
  try {
    mkdirSync(path.join(directory, "src"), { recursive: true });
    writeFileSync(
      path.join(directory, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          lib: ["ES2020", "DOM"],
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ["src/**/*.ts"],
      }),
    );
    writeFileSync(
      path.join(directory, "src", "main.ts"),
      "export const value = setTimeout(() => document.title, 10);",
    );
    const result = typecheckProject(directory);
    assert.equal(result.skipped, false);
    assert.equal(result.warnings.length, 1, "one warning explains the DOM lib");
    assert.match(result.warnings[0], /DOM/);
    assert.match(result.warnings[0], /ES2020/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
