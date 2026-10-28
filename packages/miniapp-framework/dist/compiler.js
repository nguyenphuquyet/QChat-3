import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { MAX_QAPP_APP_JS_BYTES, MAX_QAPP_BYTES, ManifestError, normalizeManifest, packagedManifest, isSafeRelativePath, } from "./manifest.js";
import { readZip, writeZip } from "./zip.js";
export const COMPILER_VERSION = "1.0.0";
export const SDK_VERSION = "1.0.0";
const allowedAssetExtensions = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".svg",
    ".ttf",
    ".otf",
    ".woff",
    ".woff2",
    ".json",
    ".txt",
    ".mp3",
    ".wav",
    ".mp4",
]);
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
function sdkModulePath(subpath) {
    const base = subpath === "" ? "index" : subpath.replace(/^\.\//, "");
    for (const extension of [".ts", ".tsx", ".js"]) {
        const candidate = path.join(moduleDir, `${base}${extension}`);
        if (existsSync(candidate))
            return candidate;
    }
    // `@mna/qchat/env` resolves to the `env/index.ts` folder entry.
    for (const extension of [".ts", ".tsx", ".js"]) {
        const candidate = path.join(moduleDir, base, `index${extension}`);
        if (existsSync(candidate))
            return candidate;
    }
    throw new Error(`QChat SDK module not found: ${subpath}`);
}
const sdkPackageRoot = path.resolve(moduleDir, "..");
/**
 * The QuickJS global declarations every qapp project type-checks against.
 *
 * In the package they sit beside the SDK (`<sdk>/types/qchat-env.d.ts`), but a
 * packaged Studio copies the CLI into `resources/qapp`, so the typings are also
 * accepted inside the CLI directory. `null` means the installation is
 * incomplete: a project would then fail on `console`, `setTimeout`, `URL`…
 */
export function envTypingPath() {
    for (const root of [sdkPackageRoot, moduleDir]) {
        const file = path.join(root, "types", "qchat-env.d.ts");
        if (existsSync(file))
            return file;
    }
    return null;
}
const sdkResolverPlugin = {
    name: "qchat-sdk-resolver",
    setup(builder) {
        builder.onResolve({ filter: /^@mna\/qchat(\/.*)?$/ }, (args) => {
            const subpath = args.path === "@mna/qchat"
                ? ""
                : args.path.slice("@mna/qchat/".length);
            return { path: sdkModulePath(subpath) };
        });
    },
};
export function sha256(bytes) {
    return createHash("sha256").update(bytes).digest("hex");
}
export async function readProjectManifest(projectDir) {
    const file = path.join(projectDir, "manifest.json");
    if (!existsSync(file)) {
        throw new ManifestError("MANIFEST_MISSING", "manifest.json not found");
    }
    let json;
    try {
        json = JSON.parse(await readFile(file, "utf8"));
    }
    catch {
        throw new ManifestError("MANIFEST_INVALID_JSON");
    }
    const raw = json;
    if (raw.schemaVersion !== 2 && raw.format !== "qapp" && raw.entry !== "app.js") {
        throw new ManifestError("MANIFEST_NOT_QAPP", "This project uses the legacy HTML manifest. Convert it to format: qapp / schemaVersion: 2.");
    }
    return { manifest: normalizeManifest(json), file, raw };
}
export function findTypeScript() {
    try {
        return createRequire(import.meta.url).resolve("typescript/bin/tsc");
    }
    catch {
        return null;
    }
}
/**
 * Reads the project libs to decide whether the QuickJS globals may be added.
 * A project that pulls in `DOM` or Node types already declares `console`,
 * `setTimeout`, `URL` and friends; adding a second declaration with different
 * signatures would only produce duplicate-identifier errors.
 */
function declaredLibs(projectDir) {
    const file = path.join(projectDir, "tsconfig.json");
    try {
        const raw = readFileSync(file, "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/^\s*\/\/.*$/gm, "");
        const parsed = JSON.parse(raw);
        const lib = parsed.compilerOptions?.lib;
        const types = parsed.compilerOptions?.types;
        const list = Array.isArray(lib) ? lib : [];
        const dom = list.some((entry) => typeof entry === "string" && entry.toLowerCase().startsWith("dom"));
        const nodeTypes = Array.isArray(types) ? types : [];
        return { dom, node: nodeTypes.some((entry) => entry === "node") };
    }
    catch {
        return { dom: false, node: false };
    }
}
export function typecheckProject(projectDir) {
    const tsconfig = path.join(projectDir, "tsconfig.json");
    if (!existsSync(tsconfig)) {
        return {
            skipped: true,
            output: "No tsconfig.json; type checking skipped.",
            warnings: [],
        };
    }
    const tsc = findTypeScript();
    if (!tsc) {
        return {
            skipped: true,
            output: "TypeScript is not installed; type checking skipped.",
            warnings: [],
        };
    }
    // Point the SDK imports at the compiler's own copy of the framework so a
    // freshly created project type-checks before `npm install`.
    const relativeSdk = path
        .relative(projectDir, moduleDir)
        .replaceAll("\\", "/");
    const rootModule = existsSync(path.join(moduleDir, "index.d.ts"))
        ? `${relativeSdk}/index.d.ts`
        : `${relativeSdk}/index.ts`;
    const configPath = path.join(projectDir, ".qchat-tsconfig.json");
    const warnings = [];
    const libs = declaredLibs(projectDir);
    const envTypings = envTypingPath();
    const include = ["src/**/*.ts", "src/**/*.tsx"];
    if (libs.dom || libs.node) {
        warnings.push("tsconfig.json declares the DOM or Node libs; a qapp runs in QuickJS with neither. " +
            "Remove them (keep lib: [\"ES2020\"]) and the SDK supplies the QuickJS globals.");
    }
    else if (envTypings) {
        // The QuickJS globals (console, timers, structuredClone, URL, TextEncoder,
        // AbortController) are declared by the SDK, not by lib.dom.
        include.push(envTypings.replaceAll("\\", "/"));
    }
    const config = {
        extends: "./tsconfig.json",
        compilerOptions: {
            noEmit: true,
            baseUrl: ".",
            paths: {
                "@mna/qchat": [rootModule],
                "@mna/qchat/*": [`${relativeSdk}/*`],
            },
        },
        include,
    };
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    try {
        const output = execFileSync(process.execPath, [tsc, "-p", configPath, "--noEmit"], {
            cwd: projectDir,
            encoding: "utf8",
            stdio: "pipe",
            timeout: 120_000,
        });
        return { skipped: false, output, warnings };
    }
    catch (error) {
        const output = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim();
        // A missing declaration file turns every QuickJS global into a bogus
        // "Cannot find name" error, so name the real cause first.
        const hint = envTypings || libs.dom || libs.node
            ? ""
            : "Build environment error: the QuickJS declarations (types/qchat-env.d.ts) are missing " +
                "from this SDK install, so console, setTimeout, setInterval, URL and friends look " +
                "undeclared. Reinstall the QChat Mini App Studio, or re-run prepare:cli.\n\n";
        throw new Error(`TYPECHECK_FAILED\n${hint}${output || error.message}`);
    }
    finally {
        rmSync(configPath, { force: true });
    }
}
function collectAssets(projectDir, warnings) {
    const root = path.join(projectDir, "assets");
    if (!existsSync(root))
        return [];
    const files = [];
    let total = 0;
    const walk = (directory, prefix) => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (!isSafeRelativePath(relative)) {
                throw new Error(`UNSAFE_ASSET_PATH: ${relative}`);
            }
            const absolute = path.join(directory, entry.name);
            if (entry.isSymbolicLink())
                throw new Error(`ASSET_SYMLINK: ${relative}`);
            if (entry.isDirectory()) {
                walk(absolute, relative);
                continue;
            }
            if (!entry.isFile())
                continue;
            const extension = path.extname(entry.name).toLowerCase();
            if (!allowedAssetExtensions.has(extension)) {
                warnings.push(`Ignored unsupported asset: ${relative}`);
                continue;
            }
            const stat = statSync(absolute);
            if (stat.size > 8 * 1024 * 1024)
                throw new Error(`ASSET_TOO_LARGE: ${relative}`);
            total += stat.size;
            if (total > 12 * 1024 * 1024)
                throw new Error("ASSETS_TOO_LARGE");
            files.push({ name: `assets/${relative}`, data: readFileSync(absolute) });
        }
    };
    walk(root, "");
    return files;
}
/**
 * Bundles one entry file exactly like the compiler does. Used by
 * `bundleProject` and by the framework tests, so the test harness runs the same
 * output a device would.
 */
export async function bundleEntry(sourcePath, options = {}) {
    if (!existsSync(sourcePath))
        throw new Error(`SOURCE_MISSING: ${sourcePath}`);
    const result = await esbuild({
        entryPoints: [sourcePath],
        bundle: true,
        write: false,
        outfile: "app.js",
        format: "iife",
        globalName: "__qchatBundle",
        platform: "neutral",
        target: ["es2020"],
        minify: options.minify !== false,
        sourcemap: false,
        legalComments: "none",
        charset: "utf8",
        jsx: "automatic",
        jsxImportSource: "@mna/qchat",
        metafile: options.metafile ?? false,
        define: {
            "process.env.NODE_ENV": '"production"',
            __DEV__: "false",
        },
        plugins: [sdkResolverPlugin],
        logLevel: "silent",
    });
    const output = result.outputFiles?.[0];
    if (!output)
        throw new Error("BUNDLE_EMPTY");
    const appJs = output.text;
    if (Buffer.byteLength(appJs, "utf8") > MAX_QAPP_APP_JS_BYTES) {
        throw new Error("APP_JS_TOO_LARGE");
    }
    return options.metafile ? { appJs, metafile: result.metafile } : { appJs };
}
export async function bundleProject(projectDir, options = {}) {
    const { manifest } = await readProjectManifest(projectDir);
    const source = manifest.source ?? "src/main.tsx";
    if (!isSafeRelativePath(source))
        throw new Error("UNSAFE_SOURCE_PATH");
    const sourcePath = path.join(projectDir, source);
    if (!existsSync(sourcePath)) {
        throw new Error(`SOURCE_MISSING: ${source}`);
    }
    const { appJs } = await bundleEntry(sourcePath, { minify: options.minify });
    return { appJs, manifest, source };
}
export async function compileProject(options) {
    const projectDir = path.resolve(options.projectDir);
    const warnings = [];
    options.onStage?.("manifest");
    const { manifest } = await readProjectManifest(projectDir);
    if (options.typecheck !== false) {
        options.onStage?.("typecheck");
        const result = typecheckProject(projectDir);
        if (result.skipped)
            warnings.push(result.output);
        warnings.push(...result.warnings);
    }
    options.onStage?.("bundle");
    const { appJs } = await bundleProject(projectDir, {
        minify: options.minify,
    });
    if (appJs.includes("require(")) {
        warnings.push("Bundle contains require(); the target runtime has no Node.js require.");
    }
    options.onStage?.("assets");
    const assets = collectAssets(projectDir, warnings);
    const now = options.now ?? new Date();
    const appSha256 = sha256(appJs);
    const packaged = packagedManifest(manifest, appSha256);
    const manifestBytes = Buffer.from(JSON.stringify(packaged, null, 2), "utf8");
    const permissionsBytes = Buffer.from(JSON.stringify({
        requestedPermissions: packaged.requestedPermissions,
    }, null, 2), "utf8");
    const fileHashes = [
        { path: "app.js", sha256: appSha256, size: Buffer.byteLength(appJs) },
        { path: "manifest.json", sha256: sha256(manifestBytes), size: manifestBytes.length },
        { path: "permissions.json", sha256: sha256(permissionsBytes), size: permissionsBytes.length },
        ...assets.map((asset) => ({
            path: asset.name,
            sha256: sha256(asset.data),
            size: asset.data.length,
        })),
    ];
    const metadata = {
        formatVersion: 1,
        compilerVersion: COMPILER_VERSION,
        sdkVersion: packaged.sdkVersion,
        version: packaged.version,
        entry: "app.js",
        builtAt: now.toISOString(),
        appSha256,
        files: fileHashes,
    };
    const metadataBytes = Buffer.from(JSON.stringify(metadata, null, 2), "utf8");
    const entries = [
        { name: "manifest.json", data: manifestBytes },
        { name: "app.js", data: Buffer.from(appJs, "utf8") },
        { name: "metadata.json", data: metadataBytes },
        { name: "permissions.json", data: permissionsBytes },
        ...assets,
    ];
    options.onStage?.("package");
    const bytes = writeZip(entries, { date: now });
    if (bytes.length > MAX_QAPP_BYTES)
        throw new Error("PACKAGE_TOO_LARGE");
    validateQapp(bytes, { version: packaged.version });
    const output = options.outfile
        ? path.resolve(projectDir, options.outfile)
        : path.join(projectDir, "dist", `${slugName(packaged.name)}-${packaged.version}.japp`);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, bytes);
    options.onStage?.("done");
    return {
        bytes,
        manifest: packaged,
        metadata,
        appJs,
        entries: readZip(bytes),
        warnings,
    };
}
/**
 * Turns a display name into a file-safe slug. Vietnamese names must keep their
 * meaning: `Cà Phê Nhà` becomes `ca-phe-nha`, not `c-ph-nh`.
 */
export function slugName(name) {
    return (name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "miniapp");
}
export function validateQapp(bytes, expected) {
    if (bytes.length === 0)
        throw new Error("PACKAGE_EMPTY");
    if (bytes.length > MAX_QAPP_BYTES)
        throw new Error("PACKAGE_TOO_LARGE");
    const entries = readZip(bytes);
    const byName = new Map(entries.map((entry) => [entry.name, entry]));
    const manifestEntry = byName.get("manifest.json");
    if (!manifestEntry)
        throw new Error("MANIFEST_MISSING");
    let manifest;
    try {
        manifest = normalizeManifest(JSON.parse(manifestEntry.bytes.toString("utf8")));
    }
    catch (error) {
        if (error instanceof ManifestError)
            throw error;
        throw new Error("MANIFEST_INVALID");
    }
    if (manifest.source)
        throw new Error("MANIFEST_SOURCE_LEAK");
    if (expected?.version && manifest.version !== expected.version)
        throw new Error("VERSION_MISMATCH");
    const appEntry = byName.get("app.js");
    if (!appEntry)
        throw new Error("ENTRY_MISSING");
    if (appEntry.bytes.length === 0)
        throw new Error("ENTRY_EMPTY");
    if (appEntry.bytes.length > MAX_QAPP_APP_JS_BYTES)
        throw new Error("ENTRY_TOO_LARGE");
    if (appEntry.bytes.includes(Buffer.from("<html")))
        throw new Error("ENTRY_INVALID");
    const metadataEntry = byName.get("metadata.json");
    if (!metadataEntry)
        throw new Error("METADATA_MISSING");
    let metadata;
    try {
        metadata = JSON.parse(metadataEntry.bytes.toString("utf8"));
    }
    catch {
        throw new Error("METADATA_INVALID");
    }
    if (metadata.formatVersion !== 1 ||
        metadata.version !== manifest.version ||
        metadata.entry !== "app.js") {
        throw new Error("METADATA_MISMATCH");
    }
    const appSha = sha256(appEntry.bytes);
    if (metadata.appSha256 !== appSha)
        throw new Error("APP_CHECKSUM_MISMATCH");
    if (manifest.appSha256 && manifest.appSha256 !== appSha) {
        throw new Error("APP_CHECKSUM_MISMATCH");
    }
    const permissionsEntry = byName.get("permissions.json");
    if (!permissionsEntry)
        throw new Error("PERMISSIONS_MISSING");
    let permissions;
    try {
        permissions = JSON.parse(permissionsEntry.bytes.toString("utf8"));
    }
    catch {
        throw new Error("PERMISSIONS_INVALID");
    }
    if (JSON.stringify(permissions.requestedPermissions ?? []) !==
        JSON.stringify(manifest.requestedPermissions)) {
        throw new Error("PERMISSIONS_MISMATCH");
    }
    for (const entry of entries) {
        if (["manifest.json", "app.js", "metadata.json", "permissions.json"].includes(entry.name)) {
            continue;
        }
        if (!entry.name.startsWith("assets/"))
            throw new Error("UNEXPECTED_FILE");
        const extension = path.extname(entry.name).toLowerCase();
        if (!allowedAssetExtensions.has(extension))
            throw new Error("UNSUPPORTED_ASSET");
    }
    const total = entries.reduce((sum, entry) => sum + entry.size, 0);
    if (total > 80 * 1024 * 1024)
        throw new Error("PACKAGE_EXPANDED_TOO_LARGE");
    const files = entries.map((entry) => ({
        name: entry.name,
        size: entry.size,
        sha256: sha256(entry.bytes),
    }));
    return {
        manifest,
        metadata,
        sha256: sha256(bytes),
        size: bytes.length,
        files,
    };
}
//# sourceMappingURL=compiler.js.map