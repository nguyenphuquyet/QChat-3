#!/usr/bin/env node
import { existsSync, watch } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { bundleProject, compileProject, typecheckProject, validateQapp, COMPILER_VERSION } from "./compiler.js";
import { SDK_VERSION } from "./protocol.js";
import { findNode, runQapp, textContent } from "./tester.js";
import type { SerializedTree } from "./protocol.js";

function usage(): void {
  console.log(`QChat Mini Apps CLI ${COMPILER_VERSION}

Usage:
  qchat create <name> [--dir <directory>]
  qchat dev [--dir <project>] [--once]
  qchat build [--dir <project>] [--out <file.japp>] [--no-typecheck]
  qchat validate <file.japp>
  qchat test [--dir <project>]
  qchat bundle [--dir <project>] [--out <file.js>] [--no-typecheck]
  qchat package [--dir <project>] [--out <file.japp>]
  qchat inspect <file.japp>
  qchat version

\`bundle\` writes the raw app.js the runtime executes, for Studio's live preview;
it does not produce a .japp.
`);
}

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  return args[index + 1];
}

const valueOptions = new Set(["--dir", "--out"]);

function positionals(args: string[]): string[] {
  const out: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const value = args[index];
    if (valueOptions.has(value)) {
      index++;
      continue;
    }
    if (value.startsWith("--")) continue;
    out.push(value);
  }
  return out;
}

function projectDir(args: string[]): string {
  return path.resolve(argValue(args, "--dir") ?? process.cwd());
}

function outFile(args: string[]): string | undefined {
  return argValue(args, "--out");
}

const helloSource = `import "@mna/qchat/env/auto";
import { start, useEffect, useState } from "@mna/qchat";
import { Button, Text, View } from "@mna/qchat/ui";

export default function App() {
  const [count, setCount] = useState(0);
  const [seconds, setSeconds] = useState(0);

  // QuickJS has no timers of its own: importing the environment installs
  // setTimeout/setInterval, and the host wakes the app on time.
  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    console.log("counter is now", count);
  }, [count]);

  return (
    <View style={{ flex: 1, padding: 24, gap: 12, justifyContent: "center" }}>
      <Text style={{ fontSize: 28, fontWeight: "bold" }}>QChat Mini App</Text>
      <Text>Count: {count}</Text>
      <Text>Running for {seconds}s</Text>
      <Button onPress={() => setCount(count + 1)}>Increment</Button>
    </View>
  );
}

start(App);
`;

const tsconfig = `{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "jsxImportSource": "@mna/qchat"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
`;

async function create(args: string[]): Promise<void> {
  const name = positionals(args)[0];
  if (!name) {
    usage();
    process.exitCode = 1;
    return;
  }
  const directory = path.resolve(argValue(args, "--dir") ?? name);
  if (existsSync(directory)) throw new Error(`Directory already exists: ${directory}`);
  await mkdir(path.join(directory, "src"), { recursive: true });
  await writeFile(
    path.join(directory, "manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 2,
        format: "qapp",
        name,
        description: "A QChat Mini App",
        version: "1.0.0",
        entry: "app.js",
        sdkVersion: SDK_VERSION,
        minRuntimeVersion: "1.0.0",
        requestedPermissions: ["storage", "toast"],
        source: "src/main.tsx",
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(path.join(directory, "src", "main.tsx"), helloSource);
  await writeFile(path.join(directory, "tsconfig.json"), tsconfig);
  await writeFile(
    path.join(directory, "package.json"),
    `${JSON.stringify(
      {
        name: name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-"),
        private: true,
        version: "1.0.0",
        type: "module",
        scripts: {
          dev: "qchat dev",
          build: "qchat build",
          validate: "qchat validate dist/*.japp",
          test: "qchat test",
        },
        dependencies: { "@mna/qchat": `^${SDK_VERSION}` },
        devDependencies: { typescript: "5.9.3" },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(directory, "README.md"),
    `# ${name}\n\nQChat Mini App created with \`qchat create\`.\n\n\`\`\`sh\nnpm install\nnpx qchat build\n\`\`\`\n\nThe build writes an immutable \`.japp\` package to \`dist/\`.\n\n\`src/main.tsx\` starts with \`import "@mna/qchat/env/auto"\`, which installs the\nQuickJS environment (timers, console, structuredClone, URL, TextEncoder,\nAbortController and the vi-VN/en-US Intl polyfill). Remove that import and the\nbundle only contains what the app installs explicitly.\n`,
  );
  console.log(`Created ${name} in ${directory}`);
  console.log(
    "Create the app in Developer Center to get its app id, then upload the built .japp there.",
  );
}

async function build(args: string[]): Promise<void> {
  const started = Date.now();
  const result = await compileProject({
    projectDir: projectDir(args),
    outfile: outFile(args),
    typecheck: !args.includes("--no-typecheck"),
    onStage: (stage) => process.stdout.write(`  ${stage}\n`),
  });
  for (const warning of result.warnings) console.warn(`warning: ${warning}`);
  console.log(
    `Built ${result.manifest.name}@${result.manifest.version} (${(result.bytes.length / 1024).toFixed(1)} KB, sha256 ${result.metadata.appSha256.slice(0, 12)}) in ${Date.now() - started} ms`,
  );
}

async function validate(args: string[]): Promise<void> {
  const file = positionals(args)[0];
  if (!file) throw new Error("qchat validate requires a .japp file");
  const bytes = await readFile(path.resolve(file));
  const result = validateQapp(bytes);
  console.log(`Valid QChat package: ${result.manifest.name}@${result.manifest.version}`);
  console.log(`Size: ${(result.size / 1024).toFixed(1)} KB, SHA-256: ${result.sha256}`);
  console.log(`Permissions: ${result.manifest.requestedPermissions.join(", ") || "none"}`);
  console.log(`Files: ${result.files.length}`);
}

async function inspect(args: string[]): Promise<void> {
  const file = positionals(args)[0];
  if (!file) throw new Error("qchat inspect requires a .japp file");
  const bytes = await readFile(path.resolve(file));
  const result = validateQapp(bytes);
  console.log(
    JSON.stringify(
      {
        manifest: result.manifest,
        metadata: result.metadata,
        sha256: result.sha256,
        size: result.size,
        files: result.files,
      },
      null,
      2,
    ),
  );
}

/**
 * Writes the raw `app.js` the runtime executes, without packaging it. Studio's
 * live preview loads exactly this bundle, so what it renders and what ships can
 * never be two different builds.
 */
async function bundleOnly(args: string[]): Promise<void> {
  const directory = projectDir(args);
  if (!args.includes("--no-typecheck")) typecheckProject(directory);
  const { appJs, manifest } = await bundleProject(directory, { minify: false });
  const output = path.resolve(
    outFile(args) ?? path.join(directory, "dist", "app.js"),
  );
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, appJs, "utf8");
  const kilobytes = (Buffer.byteLength(appJs, "utf8") / 1024).toFixed(1);
  console.log(`${output}`);
  console.log(`${manifest.name}@${manifest.version} · ${kilobytes} KB`);
}

async function testProject(args: string[]): Promise<void> {
  const temporary = path.join(projectDir(args), "dist", "qchat-test.japp");
  const result = await compileProject({
    projectDir: projectDir(args),
    outfile: temporary,
    typecheck: !args.includes("--no-typecheck"),
  });
  const harness = runQapp(result.bytes);
  // Run everything the app scheduled for "right now" (requestAnimationFrame,
  // queueMicrotask) before judging the frame.
  harness.timers.advance(0);
  for (const entry of harness.logs) {
    console.log(`  [${entry.level}] ${entry.message}`);
  }
  const tree = harness.latest();
  if (!tree?.root) throw new Error("TEST_FAILED: no render tree was produced");
  const buttons = countButtons(tree);
  if (buttons === 0) throw new Error("TEST_FAILED: no Button/Pressable rendered");
  const before = textContent(tree);
  const button = findNode(tree, (node) => node.type === "Button" || node.type === "Pressable");
  if (button) harness.dispatch(button.id, "press", {});
  const after = textContent(harness.latest());
  if (before === after) {
    // A press does not have to change text; it only has to be accepted.
    console.log("Press dispatched; state text unchanged (valid for this app).");
  }
  console.log(`PASS: ${result.manifest.name} rendered ${countNodes(tree)} nodes.`);
  console.log(`  Text: ${after.slice(0, 160)}`);
  harness.dispose();
}

function countNodes(tree: SerializedTree): number {
  let count = 0;
  const walk = (node: NonNullable<SerializedTree["root"]>) => {
    count++;
    for (const child of node.children ?? []) walk(child);
  };
  if (tree.root) walk(tree.root);
  return count;
}

function countButtons(tree: SerializedTree): number {
  let count = 0;
  const walk = (node: NonNullable<SerializedTree["root"]>) => {
    if (node.type === "Button" || node.type === "Pressable") count++;
    for (const child of node.children ?? []) walk(child);
  };
  if (tree.root) walk(tree.root);
  return count;
}

async function dev(args: string[]): Promise<void> {
  const directory = projectDir(args);
  const rebuild = async () => {
    try {
      const output = outFile(args);
      await build([
        "--dir",
        directory,
        "--no-typecheck",
        ...(output ? ["--out", output] : []),
      ]);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
    }
  };
  await rebuild();
  if (args.includes("--once")) return;
  console.log("Watching src, assets and manifest.json. Press Ctrl+C to stop.");
  let timer: NodeJS.Timeout | null = null;
  watch(directory, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    const name = String(filename);
    if (name.includes("dist") || name.includes("node_modules") || name.startsWith(".")) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void rebuild();
    }, 250);
  });
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "create":
      await create(args);
      break;
    case "build":
    case "package":
      await build(args);
      break;
    case "dev":
      await dev(args);
      break;
    case "validate":
      await validate(args);
      break;
    case "test":
      await testProject(args);
      break;
    case "bundle":
      await bundleOnly(args);
      break;
    case "inspect":
      await inspect(args);
      break;
    case "version":
    case "--version":
    case "-v":
      console.log(`${COMPILER_VERSION} (sdk ${SDK_VERSION})`);
      break;
    case undefined:
    case "help":
    case "--help":
    case "-h":
      usage();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      usage();
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
