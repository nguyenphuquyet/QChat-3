#!/usr/bin/env node
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { watch } from "node:fs";
import path from "node:path";
import { BuildError, buildMiniProgram, readPackageManifest, } from "./builder.js";
import { loadMiniProgram, MiniProgramError } from "./wechat.js";
import { readZip } from "./zip.js";
const help = `qchat — QChat Mini Program toolchain

Usage:
  qchat create <name> [dir]        Create a Mini Program scaffold
  qchat build [dir] [--out file]   Build the project into a .japp package
  qchat dev [dir] [--port 5273]    Build and serve a local preview
  qchat validate [dir]             Check app.json, pages, components and assets
  qchat inspect <file.japp>        Print the manifest of a built package
  qchat migrate <dir>              Scaffold a WXML project from a legacy app
  qchat version                    Print the toolchain version

The authoring format is the WeChat Mini Program one: app.json, app.js, app.wxss,
pages/<route>/{wxml,wxss,js,json} and components. QChat does not compile WXML or
WXSS; it orchestrates the official glass-easel Webpack pipeline and emits the
.japp container the Flutter host serves. App() and wx.* arrive with the QChat
host runtime and are not part of the official build pipeline yet.
`;
function fail(message) {
    console.error(`qchat: ${message}`);
    process.exit(1);
}
function reportBuildError(error) {
    if (error instanceof BuildError) {
        console.error(`qchat: ${error.code}: ${error.message}`);
        for (const diagnostic of error.diagnostics) {
            const where = diagnostic.file
                ? `${diagnostic.file}${diagnostic.line ? `:${diagnostic.line}:${diagnostic.column ?? 1}` : ""}`
                : "build";
            console.error(`  ${where}: ${diagnostic.message}`);
        }
        return true;
    }
    if (error instanceof MiniProgramError) {
        console.error(`qchat: ${error.code}: ${error.message}`);
        return true;
    }
    return false;
}
function parseArgs(argv) {
    const positionals = [];
    const flags = {};
    for (let index = 0; index < argv.length; index++) {
        const value = argv[index];
        if (!value.startsWith("--")) {
            positionals.push(value);
            continue;
        }
        const next = argv[index + 1];
        if (next && !next.startsWith("--")) {
            flags[value] = next;
            index++;
        }
        else {
            flags[value] = "";
        }
    }
    return { positionals, flags };
}
function scaffoldFiles(name) {
    return {
        "app.json": `${JSON.stringify({
            pages: ["pages/index/index", "pages/about/about"],
            window: {
                navigationBarTitleText: name,
                navigationBarBackgroundColor: "#ffffff",
                navigationBarTextStyle: "black",
                backgroundColor: "#f7f7f7",
                backgroundTextStyle: "dark",
            },
            tabBar: {
                color: "#7a7e83",
                selectedColor: "#07c160",
                backgroundColor: "#ffffff",
                borderStyle: "black",
                list: [
                    { pagePath: "pages/index/index", text: "Home" },
                    { pagePath: "pages/about/about", text: "About" },
                ],
            },
            usingComponents: { "demo-card": "/components/demo-card/demo-card" },
        }, null, 2)}\n`,
        // App() is provided by the QChat host runtime in a later phase, so the
        // scaffold keeps this file free of runtime calls.
        "app.js": `// QChat starts the page selected in app.json; global state can be shared
// through module imports. The App() lifecycle arrives with the host runtime.
`,
        "app.wxss": `page {
  background: #f7f7f7;
}
.container {
  padding: 24rpx;
}
.title {
  font-size: 40rpx;
  font-weight: 600;
  margin-bottom: 16rpx;
}
.muted {
  color: #8a8a8a;
  font-size: 26rpx;
}
`,
        "manifest.json": `${JSON.stringify({ name, version: "1.0.0", description: "A QChat Mini Program", requestedPermissions: [] }, null, 2)}\n`,
        "project.config.json": `${JSON.stringify({ projectname: name, compileType: "miniprogram", version: "1.0.0" }, null, 2)}\n`,
        "pages/index/index.json": `${JSON.stringify({ navigationBarTitleText: "Home" }, null, 2)}\n`,
        "pages/index/index.js": `Page({
  data: {
    count: 0,
    items: ["WXML", "WXSS", "glass-easel", "Components"],
  },
  tapIncrement() {
    this.setData({ count: this.data.count + 1 });
  },
  reset() {
    this.setData({ count: 0 });
  },
});
`,
        "pages/index/index.wxml": `<view class="container">
  <view class="hero">
    <text class="title">{{count}} taps</text>
    <text class="muted">Rendered by the official glass-easel pipeline</text>
  </view>
  <button type="primary" bindtap="tapIncrement">Tap me</button>
  <button bindtap="reset">Reset</button>
  <demo-card title="Built with WXML" body="Every view here is compiled by the official template compiler." />
  <view class="list">
    <view wx:for="{{items}}" wx:key="*this" class="list__row">
      <text>{{index + 1}}. {{item}}</text>
    </view>
  </view>
</view>
`,
        "pages/index/index.wxss": `.hero {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  border-radius: 20rpx;
  background: #ffffff;
}
.list {
  margin-top: 32rpx;
  border-radius: 16rpx;
  background: #ffffff;
  overflow: hidden;
}
.list__row {
  padding: 24rpx;
  border-bottom: 1px solid #f0f0f0;
}
button {
  margin-bottom: 20rpx;
}
`,
        "pages/about/about.json": `${JSON.stringify({ navigationBarTitleText: "About" }, null, 2)}\n`,
        "pages/about/about.js": `Page({
  data: {
    year: new Date().getFullYear(),
  },
});
`,
        "pages/about/about.wxml": `<view class="container">
  <view class="title">About {{year}}</view>
  <demo-card title="About" body="QChat serves the compiled package from a verified local archive." />
  <text class="muted">The native navigation bar and tab bar are drawn by the QChat host.</text>
</view>
`,
        "pages/about/about.wxss": `.muted {
  margin-top: 24rpx;
}
`,
        "components/demo-card/demo-card.json": `${JSON.stringify({ component: true, usingComponents: {} }, null, 2)}\n`,
        "components/demo-card/demo-card.js": `Component({
  properties: {
    title: { type: String, value: "" },
    body: { type: String, value: "" },
  },
  methods: {
    tapCard() {
      this.triggerEvent("cardtap", { title: this.properties.title });
    },
  },
});
`,
        "components/demo-card/demo-card.wxml": `<view class="card" bindtap="tapCard">
  <text class="card__title">{{title}}</text>
  <text class="card__body">{{body}}</text>
  <slot />
</view>
`,
        "components/demo-card/demo-card.wxss": `.card {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  border-radius: 16rpx;
  background: #ffffff;
}
.card__title {
  font-size: 30rpx;
  font-weight: 600;
}
.card__body {
  color: #6b6b6b;
  font-size: 26rpx;
}
`,
        "README.md": `# ${name}

A QChat Mini Program written as a WeChat-shaped project.

\`\`\`sh
npx qchat build
\`\`\`

The build writes an immutable \`.japp\` to \`dist/\`. Upload it from the QChat
Mini App studio; the Flutter host supplies the native navigation bar, tab bar,
capsule and the WebView container.
`,
    };
}
async function createProject(name, directory) {
    const target = path.resolve(directory);
    if (existsSync(path.join(target, "app.json"))) {
        fail(`${target} already contains an app.json`);
    }
    for (const [relative, contents] of Object.entries(scaffoldFiles(name))) {
        const file = path.join(target, ...relative.split("/"));
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, contents, "utf8");
    }
    console.log(`Created ${name} in ${target}`);
    console.log("Next: qchat build");
}
async function buildCommand(directory, flags) {
    const outFile = flags["--out"];
    try {
        const built = await buildMiniProgram({
            projectDir: directory,
            outFile: outFile ? path.resolve(outFile) : undefined,
        });
        console.log(`Built ${built.manifest.name} ${built.manifest.version}`);
        console.log(`  ${built.outFile} (${(built.bytes.length / 1024).toFixed(1)} KiB)`);
        console.log(`  ${built.files.length} files, permissions: ${built.manifest.requestedPermissions.join(", ") || "none"}`);
        for (const warning of built.warnings)
            console.warn(`  warning: ${warning}`);
    }
    catch (error) {
        if (reportBuildError(error))
            process.exit(1);
        throw error;
    }
}
const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
};
async function devCommand(directory, flags) {
    const port = Number(flags["--port"] ?? 5273);
    let files = new Map();
    let building = false;
    let pending = false;
    const rebuild = async () => {
        if (building) {
            pending = true;
            return;
        }
        building = true;
        try {
            const built = await buildMiniProgram({
                projectDir: directory,
                outFile: path.join(directory, ".qchat-dev", "preview.japp"),
                outDir: path.join(directory, ".qchat-dev", "preview"),
            });
            const entries = readZip(built.bytes);
            files = new Map(entries.map((entry) => [entry.name, entry.bytes]));
            console.log(`rebuilt ${built.manifest.version} (${built.files.length} files)`);
            for (const warning of built.warnings)
                console.warn(`  warning: ${warning}`);
        }
        catch (error) {
            if (reportBuildError(error)) {
                // keep the previous build served
            }
            else {
                console.error(error);
            }
        }
        finally {
            building = false;
            if (pending) {
                pending = false;
                void rebuild();
            }
        }
    };
    await rebuild();
    const server = createServer((request, response) => {
        const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
        let file = decodeURIComponent(url.pathname);
        if (file === "/")
            file = "/index.html";
        const bytes = files.get(file.replace(/^\//, ""));
        if (!bytes) {
            response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
            response.end("not found");
            return;
        }
        response.writeHead(200, {
            "content-type": contentTypes[path.extname(file).toLowerCase()] ?? "application/octet-stream",
            "cache-control": "no-store",
            "content-security-policy": "default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'",
        });
        response.end(bytes);
    });
    server.listen(port, "127.0.0.1", () => {
        console.log(`preview: http://127.0.0.1:${port}/`);
        console.log("Only the page content is shown; native chrome belongs to the app.");
    });
    let timer = null;
    watch(directory, { recursive: true }, (_event, file) => {
        if (!file)
            return;
        const name = String(file);
        if (name.startsWith(".qchat-dev") || name.startsWith("dist"))
            return;
        if (timer)
            clearTimeout(timer);
        timer = setTimeout(() => void rebuild(), 120);
    });
}
async function validateCommand(directory) {
    try {
        const project = await loadMiniProgram({ projectDir: directory });
        console.log(`ok: ${project.pages.length} pages, ${project.components.length} components, ${project.assets.length} assets`);
        if (project.permissions.length) {
            console.log(`inferred permissions: ${project.permissions.join(", ")}`);
        }
        for (const warning of project.warnings)
            console.warn(`warning: ${warning}`);
    }
    catch (error) {
        if (reportBuildError(error))
            process.exit(1);
        throw error;
    }
}
async function inspectCommand(file) {
    const manifest = await readPackageManifest(path.resolve(file));
    console.log(JSON.stringify(manifest, null, 2));
}
async function migrateCommand(source) {
    const target = path.resolve(source);
    if (!existsSync(target))
        fail(`not found: ${target}`);
    if (target.endsWith(".japp") || target.endsWith(".zip")) {
        const manifest = await readPackageManifest(target);
        console.log(`This is a packaged Mini App: ${manifest.name} ${manifest.version}`);
        console.log("Extract its assets and author a new project around them:");
        console.log("  npx qchat create <name> <dir>");
        console.log("  copy the archive's assets/ into <dir>/assets/");
        return;
    }
    const legacy = existsSync(path.join(target, "qapp.json")) ||
        existsSync(path.join(target, "src", "main.tsx")) ||
        existsSync(path.join(target, "src", "main.ts"));
    if (!legacy) {
        fail(`${target} does not look like a legacy qapp project (no qapp.json or src/main.tsx)`);
    }
    if (existsSync(path.join(target, "app.json"))) {
        fail(`${target} already has an app.json; it looks migrated`);
    }
    const name = path.basename(target);
    await createProject(name, path.join(target, "migrated"));
    if (existsSync(path.join(target, "assets"))) {
        await cp(path.join(target, "assets"), path.join(target, "migrated", "assets"), { recursive: true });
    }
    const report = `# Migration report

Generated by \`qchat migrate\` for ${name}.

The legacy qapp runtime (QuickJS + TSX) is retired. A Mini Program is WXML/WXSS
plus Page/Component scripts, so screen markup and event handlers must be ported
by hand; only static assets carry over automatically.

## Mapping

| Legacy qapp | Mini Program |
| --- | --- |
| \`View\`, \`Text\`, \`Button\` TSX | \`<view>\`, \`<text>\`, \`<button>\` WXML |
| \`useState\` | \`this.data\` + \`this.setData\` |
| \`useLifecycle\` | \`onLoad\`/\`onShow\`/\`onHide\`/\`onUnload\` |
| inline \`style\` prop | WXSS class using \`rpx\` |

The scaffold is in \`migrated/\`. Native navigation, \`wx.*\` and \`App()\` arrive
with the QChat host runtime; they are not available from the official build
pipeline alone.
`;
    await writeFile(path.join(target, "MIGRATION.md"), report, "utf8");
    console.log(`Scaffolded ${path.join(target, "migrated")}`);
    console.log(`Wrote ${path.join(target, "MIGRATION.md")}`);
}
async function main(argv) {
    const [command, ...rest] = argv;
    const { positionals: args, flags } = parseArgs(rest);
    switch (command) {
        case undefined:
        case "-h":
        case "--help":
        case "help":
            console.log(help);
            return;
        case "create": {
            const name = args[0];
            if (!name)
                fail("create needs a name");
            await createProject(name, args[1] ?? name);
            return;
        }
        case "build":
            await buildCommand(args[0] ?? ".", flags);
            return;
        case "dev":
            await devCommand(args[0] ?? ".", flags);
            return;
        case "validate":
            await validateCommand(args[0] ?? ".");
            return;
        case "inspect":
            if (!args[0])
                fail("inspect needs a .japp file");
            await inspectCommand(args[0]);
            return;
        case "migrate":
            if (!args[0])
                fail("migrate needs a project directory or .japp file");
            await migrateCommand(args[0]);
            return;
        case "version": {
            const packageFile = new URL("../package.json", import.meta.url);
            const packageJson = JSON.parse(await readFile(packageFile, "utf8"));
            console.log(packageJson.version ?? "0.0.0");
            return;
        }
        default:
            fail(`unknown command: ${command}\n\n${help}`);
    }
}
void main(process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map