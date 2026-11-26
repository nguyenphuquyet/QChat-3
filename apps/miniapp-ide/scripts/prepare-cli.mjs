#!/usr/bin/env node
/**
 * Copies the QChat CLI, its built-in components, its host runtime and its
 * production dependency tree into `src-tauri/resources` so a packaged Studio can
 * build Mini Programs without a local checkout.
 *
 * The builder runs the official glass-easel Webpack pipeline, so the packaged
 * CLI needs webpack, the loaders and the glass-easel packages. The tree is
 * flattened into `resources/qapp/node_modules`; webpack's `resolve.modules`
 * already points at the package's own `node_modules`.
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
  realpathSync,
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
const tauriConfig = path.join(ideDir, "src-tauri", "tauri.conf.json");

const withNode =
  process.argv.includes("--with-node") || process.env.QAPP_BUNDLE_NODE === "1";
const force = process.argv.includes("--force");

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

/// Tauri errors on a `bundle.resources` glob that matches nothing, after the
/// whole Rust build has already run. Check the bases up front so a stale entry
/// fails here with a clear message instead.
function assertBundleResources() {
  let config;
  try {
    config = JSON.parse(readFileSync(tauriConfig, "utf8"));
  } catch (error) {
    fail(`cannot read src-tauri/tauri.conf.json: ${error.message}`);
  }
  const patterns = config?.bundle?.resources ?? [];
  const missing = [];
  for (const pattern of patterns) {
    if (typeof pattern !== "string") continue;
    const base = pattern.split("*")[0].replace(/[\\/]+$/, "");
    if (!base) continue;
    const target = path.join(ideDir, "src-tauri", base);
    if (!existsSync(target)) {
      missing.push(pattern);
      continue;
    }
    if (statSync(target).isDirectory() && readdirSync(target).length === 0) {
      missing.push(pattern);
    }
  }
  if (missing.length) {
    fail(
      `bundle.resources patterns match nothing: ${missing.join(", ")}\n` +
        "Remove them from src-tauri/tauri.conf.json or create the folders in prepare-cli.",
    );
  }
}

function ensureFrameworkBuild() {
  const cli = path.join(distDir, "cli.js");
  if (existsSync(cli)) return;

  console.log("prepare-cli: framework dist is missing; building @mna/qchat…");
  execSync("pnpm --filter @mna/qchat build", {
    cwd: repoRoot,
    stdio: "inherit",
  });

  if (!existsSync(cli)) {
    fail("the framework build finished but dist/cli.js is still missing");
  }
}

function resolvePackageDir(name, fromDirs) {
  for (const fromDir of fromDirs) {
    let realFrom;
    try {
      realFrom = realpathSync(fromDir);
    } catch {
      continue;
    }
    // pnpm links direct dependencies into the package's `node_modules`, but a
    // transitive dependency lives next to the *real* package in the virtual
    // store. Walk the ancestor `node_modules` chain from the real path so both
    // layouts resolve, exactly like Node's own resolution.
    for (
      let current = realFrom;
      current !== path.dirname(current);
      current = path.dirname(current)
    ) {
      const candidate = path.join(current, "node_modules", name);
      if (existsSync(path.join(candidate, "package.json"))) {
        return realpathSync(candidate);
      }
    }
    try {
      // Fall back to `require.resolve` for anything the ancestor walk misses
      // (for example a package reached through a symlinked workspace).
      const requireFrom = createRequire(path.join(realFrom, "package.json"));
      let current = path.dirname(requireFrom.resolve(name));
      while (current !== path.dirname(current)) {
        if (existsSync(path.join(current, "package.json"))) return current;
        current = path.dirname(current);
      }
    } catch {
      // Some packages do not expose their main entry to `require.resolve`.
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
    cpSync(source, target);
    count += 1;
  }
  return count;
}

function copyFrameworkDist() {
  const count = copyDirectory(distDir, path.join(qappDir, "dist"));
  if (!existsSync(path.join(qappDir, "dist", "cli.js"))) {
    fail("dist/cli.js was not copied into resources/qapp/dist");
  }
  if (!existsSync(path.join(qappDir, "dist", "builder.js"))) {
    fail("dist/builder.js was not copied into resources/qapp/dist");
  }
  return count;
}

/// `resources/qapp/cli.js` is the path the Studio and the Tauri host run. It is
/// a shim rather than the compiled CLI because the builder resolves `builtin/`,
/// `runtime/` and `package.json` from its own directory's parent: keeping the
/// `dist/` layout intact makes `qapp` behave exactly like the package root.
function writeCliShim() {
  writeFileSync(
    path.join(qappDir, "cli.js"),
    [
      "#!/usr/bin/env node",
      "// Generated by apps/miniapp-ide/scripts/prepare-cli.mjs.",
      "// The compiled CLI lives in dist/ so the builder still finds builtin/,",
      "// runtime/ and package.json next to the package root.",
      'import "./dist/cli.js";',
      "",
    ].join("\n"),
  );
}

/// The builder reads `builtin/` and `runtime/` from the package root, so a
/// packaged CLI must ship them next to `dist/`.
function copyFrameworkAssets() {
  let count = 0;
  for (const name of ["builtin", "runtime"]) {
    const from = path.join(frameworkDir, name);
    if (!existsSync(from)) fail(`framework ${name}/ is missing`);
    count += copyDirectory(from, path.join(qappDir, name));
  }
  cpSync(
    path.join(frameworkDir, "package.json"),
    path.join(qappDir, "package.json"),
  );
  return count;
}

/// Flattens the production dependency graph into one `node_modules` directory.
/// pnpm keeps transitive packages next to their parent, so each dependency is
/// resolved from its parent's directory and copied dereferenced.
function copyDependencies() {
  const frameworkPackage = JSON.parse(
    readFileSync(path.join(frameworkDir, "package.json"), "utf8"),
  );
  const targetModules = path.join(qappDir, "node_modules");
  mkdirSync(targetModules, { recursive: true });

  const copied = new Set();
  const queue = Object.keys(frameworkPackage.dependencies ?? {}).map((name) => ({
    name,
    fromDir: frameworkDir,
    optional: false,
  }));

  while (queue.length > 0) {
    const { name, fromDir, optional } = queue.shift();
    if (copied.has(name)) continue;
    const packageDir = resolvePackageDir(name, [
      fromDir,
      frameworkDir,
      repoRoot,
    ]);
    if (!packageDir) {
      if (optional) continue;
      fail(
        `dependency ${name} (required by ${path.basename(fromDir)}) is not installed. Run \`pnpm install\` first.`,
      );
    }

    const target = path.join(targetModules, name);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(packageDir, target, {
      recursive: true,
      dereference: true,
      filter: (source) => {
        const relative = path.relative(packageDir, source);
        return (
          !relative.split(path.sep).includes("node_modules") &&
          !source.endsWith(".map")
        );
      },
    });
    copied.add(name);

    const manifest = JSON.parse(
      readFileSync(path.join(packageDir, "package.json"), "utf8"),
    );
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      queue.push({ name: dependency, fromDir: packageDir, optional: false });
    }
    for (const dependency of Object.keys(manifest.optionalDependencies ?? {})) {
      queue.push({ name: dependency, fromDir: packageDir, optional: true });
    }
    for (const dependency of Object.keys(manifest.peerDependencies ?? {})) {
      if (!copied.has(dependency)) {
        queue.push({ name: dependency, fromDir: packageDir, optional: true });
      }
    }
  }

  if (!existsSync(path.join(targetModules, "webpack", "package.json"))) {
    fail("webpack was not copied into resources/qapp/node_modules");
  }
  if (!existsSync(path.join(targetModules, "glass-easel", "package.json"))) {
    fail("glass-easel was not copied into resources/qapp/node_modules");
  }
  return copied.size;
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
      "Run `pnpm prepare:cli -- --with-node` to bundle a Node runtime.\n",
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
    layout: 6,
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
        assertBundleResources();
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
  writeCliShim();
  const assets = copyFrameworkAssets();
  const dependencies = copyDependencies();
  const node = copyNodeRuntime();

  // Tauri errors on a `bundle.resources` glob that matches nothing, but only
  // after the Rust build. Verify the configured bases once the resources exist.
  assertBundleResources();

  writeFileSync(markerPath, `${JSON.stringify(stamp, null, 2)}\n`);

  console.log("");
  console.log(`  framework CLI   ${files} files · v${frameworkPackage.version}`);
  console.log(`  built-ins       ${assets} files`);
  console.log(`  dependencies    ${dependencies} packages · ${formatSize(dirSize(path.join(qappDir, "node_modules")))}`);
  console.log(`  node runtime    ${node ? `${node.version} (${node.path})` : "not bundled"}`);
  console.log(`  resources       ${formatSize(dirSize(resourcesDir))} in src-tauri/resources`);
  console.log("");
}

try {
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
