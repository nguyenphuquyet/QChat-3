#!/usr/bin/env node
/**
 * Copies the QChat CLI, its esbuild binary and TypeScript into src-tauri/resources
 * so a packaged Studio can compile mini apps without a local checkout.
 *
 * Usage:
 *   node scripts/prepare-cli.mjs
 *   node scripts/prepare-cli.mjs --with-node   # also bundle the running Node binary
 *   node scripts/prepare-cli.mjs --force
 */
import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const ideDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(ideDir, "..", "..");
const frameworkDir = path.join(repoRoot, "packages", "miniapp-framework");
const distDir = path.join(frameworkDir, "dist");
const resourcesDir = path.join(ideDir, "src-tauri", "resources");
const qappDir = path.join(resourcesDir, "qapp");
const nodeDir = path.join(resourcesDir, "node");

const withNode =
  process.argv.includes("--with-node") || process.env.QAPP_BUNDLE_NODE === "1";
const force = process.argv.includes("--force");

const PLATFORM_PACKAGES = {
  "aix-ppc64": "aix-ppc64",
  "darwin-arm64": "darwin-arm64",
  "darwin-x64": "darwin-x64",
  "freebsd-arm64": "freebsd-arm64",
  "freebsd-x64": "freebsd-x64",
  "linux-arm": "linux-arm",
  "linux-arm64": "linux-arm64",
  "linux-ia32": "linux-ia32",
  "linux-loong64": "linux-loong64",
  "linux-mips64el": "linux-mips64el",
  "linux-ppc64": "linux-ppc64",
  "linux-riscv64": "linux-riscv64",
  "linux-s390x": "linux-s390x",
  "linux-x64": "linux-x64",
  "netbsd-arm64": "netbsd-arm64",
  "netbsd-x64": "netbsd-x64",
  "openbsd-arm64": "openbsd-arm64",
  "openbsd-x64": "openbsd-x64",
  "sunos-x64": "sunos-x64",
  "win32-arm64": "win32-arm64",
  "win32-ia32": "win32-ia32",
  "win32-x64": "win32-x64",
};

function fail(message) {
  console.error(`\nprepare-cli: ${message}\n`);
  process.exit(1);
}

function dirSize(directory) {
  let total = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) total += dirSize(target);
    else if (entry.isFile()) total += statSync(target).size;
  }
  return total;
}

function formatSize(bytes) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function ensureFrameworkBuild() {
  const cli = path.join(distDir, "cli.js");
  if (existsSync(cli)) return;

  console.log("prepare-cli: framework dist is missing; building @mna/qchat…");
  execSync("corepack pnpm --filter @mna/qchat build", {
    cwd: repoRoot,
    stdio: "inherit",
  });

  if (!existsSync(cli)) {
    fail("the framework build finished but dist/cli.js is still missing");
  }
}

function resolvePackageDir(request, fromDirs) {
  for (const fromDir of fromDirs) {
    try {
      const requireFrom = createRequire(path.join(fromDir, "package.json"));
      return path.dirname(requireFrom.resolve(request));
    } catch {
      // Try the next resolution root.
    }
  }
  return null;
}

function copyDirectory(from, to) {
  let count = 0;
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(target, { recursive: true });
      count += copyDirectory(source, target);
      continue;
    }
    if (entry.name.endsWith(".map")) continue;
    if (!entry.name.endsWith(".js") && !entry.name.endsWith(".d.ts")) continue;
    cpSync(source, target);
    count += 1;
  }
  return count;
}

// Subdirectories matter: `dist/env` is the QuickJS environment the SDK exposes
// as `@mna/qchat/env`, and the CLI resolves every `@mna/qchat/*` import from
// this directory. Copying only the top level silently shipped a CLI without it.
function copyFrameworkDist() {
  const count = copyDirectory(distDir, qappDir);
  if (!existsSync(path.join(qappDir, "cli.js"))) {
    fail("dist/cli.js was not copied into resources/qapp");
  }
  if (!existsSync(path.join(qappDir, "env", "auto.js"))) {
    fail("dist/env was not copied into resources/qapp");
  }
  return count;
}

// The QuickJS declarations sit in the SDK package root, which is the directory
// above the CLI, so a packaged Studio needs them at `resources/types/`.
function copyFrameworkTypes() {
  const from = path.join(frameworkDir, "types");
  if (!existsSync(from)) return 0;
  const targetDir = path.join(resourcesDir, "types");
  mkdirSync(targetDir, { recursive: true });
  let count = 0;
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".d.ts")) continue;
    cpSync(path.join(from, entry.name), path.join(targetDir, entry.name));
    count += 1;
  }
  if (!existsSync(path.join(targetDir, "qchat-env.d.ts"))) {
    fail("types/qchat-env.d.ts was not copied into resources/types");
  }
  return count;
}

function copyEsbuild(version) {
  const esbuildDir = resolvePackageDir("esbuild/package.json", [frameworkDir, repoRoot]);
  if (!esbuildDir) {
    fail("esbuild is not installed. Run `corepack pnpm install` first.");
  }

  const targetDir = path.join(qappDir, "node_modules", "esbuild");
  mkdirSync(path.dirname(targetDir), { recursive: true });
  cpSync(esbuildDir, targetDir, {
    recursive: true,
    dereference: true,
    filter: (source) => {
      const relative = path.relative(esbuildDir, source);
      return !relative.split(path.sep).includes("node_modules");
    },
  });

  const platformKey = `${process.platform}-${process.arch}`;
  const packageName = PLATFORM_PACKAGES[platformKey];
  if (!packageName) {
    fail(`unsupported esbuild platform: ${platformKey}`);
  }

  const candidates = [
    path.join(path.dirname(esbuildDir), "@esbuild", packageName),
    path.join(repoRoot, "node_modules", "@esbuild", packageName),
    path.join(frameworkDir, "node_modules", "@esbuild", packageName),
  ];

  let platformDir = candidates.find((candidate) => existsSync(candidate));
  if (!platformDir) {
    for (let current = esbuildDir; current !== path.dirname(current); current = path.dirname(current)) {
      const candidate = path.join(current, "@esbuild", packageName);
      if (existsSync(candidate)) {
        platformDir = candidate;
        break;
      }
    }
  }

  if (!platformDir) {
    fail(
      `the esbuild binary package @esbuild/${packageName} is missing. Reinstall dependencies for this platform.`,
    );
  }

  const platformTarget = path.join(qappDir, "node_modules", "@esbuild", packageName);
  cpSync(platformDir, platformTarget, { recursive: true, dereference: true });

  const binary =
    process.platform === "win32"
      ? path.join(platformTarget, "esbuild.exe")
      : path.join(platformTarget, "bin", "esbuild");
  if (!existsSync(binary)) {
    fail(`the esbuild binary was not found at ${binary}`);
  }

  return { version, platform: packageName };
}

function copyTypeScript() {
  const tsDir = resolvePackageDir("typescript/package.json", [
    repoRoot,
    frameworkDir,
    ideDir,
  ]);
  if (!tsDir) {
    fail("typescript is not installed. Run `corepack pnpm install` first.");
  }

  const targetDir = path.join(qappDir, "node_modules", "typescript");
  const version = JSON.parse(readFileSync(path.join(tsDir, "package.json"), "utf8")).version;
  cpSync(tsDir, targetDir, {
    recursive: true,
    dereference: true,
    filter: (source) => {
      const relative = path.relative(tsDir, source);
      return (
        !relative.split(path.sep).includes("node_modules") &&
        !source.endsWith(".map") &&
        !source.endsWith(".tsbuildinfo")
      );
    },
  });

  const tsc = path.join(targetDir, "bin", "tsc");
  if (!existsSync(tsc)) {
    fail(`TypeScript was copied without bin/tsc (looked in ${tsc})`);
  }

  return version;
}

function copyNodeRuntime() {
  mkdirSync(nodeDir, { recursive: true });
  if (!withNode) {
    // Drop a previously bundled runtime so the marker stays truthful.
    for (const name of ["node.exe", "node", "README.txt"]) {
      rmSync(path.join(nodeDir, name), { force: true });
    }
    writeFileSync(
      path.join(nodeDir, "README.txt"),
      "Run `corepack pnpm prepare:cli -- --with-node` to bundle a Node runtime.\n",
    );
    return null;
  }

  rmSync(path.join(nodeDir, "README.txt"), { force: true });
  const target = path.join(nodeDir, process.platform === "win32" ? "node.exe" : "node");
  cpSync(process.execPath, target);
  return { path: target, version: process.version };
}

function main() {
  ensureFrameworkBuild();

  const frameworkPackage = JSON.parse(
    readFileSync(path.join(frameworkDir, "package.json"), "utf8"),
  );
  const cliMtime = statSync(path.join(distDir, "cli.js")).mtimeMs;
  const stamp = {
    // Bumped when the resource layout changes, so an existing resources folder
    // is refreshed even though the CLI itself did not change.
    layout: 2,
    version: frameworkPackage.version,
    cliMtime,
    platform: process.platform,
    arch: process.arch,
    node: withNode,
  };

  const markerPath = path.join(qappDir, ".prepared.json");
  if (!force && existsSync(markerPath)) {
    try {
      const previous = JSON.parse(readFileSync(markerPath, "utf8"));
      if (JSON.stringify(previous) === JSON.stringify(stamp)) {
        console.log(
          `prepare-cli: resources are up to date (${formatSize(dirSize(qappDir))}).`,
        );
        return;
      }
    } catch {
      // Rebuild when the marker is unreadable.
    }
  }

  console.log("prepare-cli: refreshing CLI resources…");
  rmSync(qappDir, { recursive: true, force: true });
  mkdirSync(qappDir, { recursive: true });

  const files = copyFrameworkDist();
  writeFileSync(
    path.join(qappDir, "package.json"),
    `${JSON.stringify(
      {
        name: "@mna/qchat",
        version: frameworkPackage.version,
        private: true,
        type: "module",
      },
      null,
      2,
    )}\n`,
  );

  const types = copyFrameworkTypes();
  const esbuild = copyEsbuild("esbuild");
  const typescriptVersion = copyTypeScript();
  const node = copyNodeRuntime();

  writeFileSync(markerPath, `${JSON.stringify(stamp, null, 2)}\n`);

  console.log("");
  console.log(`  framework CLI   ${files} files · v${frameworkPackage.version}`);
  console.log(`  env typings     ${types} files`);
  console.log(`  esbuild         ${esbuild.version} · ${esbuild.platform}`);
  console.log(`  typescript      ${typescriptVersion}`);
  console.log(`  node runtime    ${node ? `${node.version} (${node.path})` : "not bundled"}`);
  console.log(`  resources       ${formatSize(dirSize(resourcesDir))} in src-tauri/resources`);
  console.log("");
}

try {
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
