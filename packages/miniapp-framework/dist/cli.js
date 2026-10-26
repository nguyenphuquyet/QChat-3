#!/usr/bin/env node
import { existsSync, watch } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { compileProject, validateQapp, COMPILER_VERSION } from "./compiler.js";
import { SDK_VERSION } from "./protocol.js";
import { findNode, runQapp, textContent } from "./tester.js";
function usage() {
    console.log(`QChat Mini Apps CLI ${COMPILER_VERSION}

Usage:
  qchat create <name> [--dir <directory>]
  qchat dev [--dir <project>] [--once]
  qchat build [--dir <project>] [--out <file.japp>] [--no-typecheck]
  qchat validate <file.japp>
  qchat test [--dir <project>]
  qchat package [--dir <project>] [--out <file.japp>]
  qchat inspect <file.japp>
  qchat version
`);
}
function argValue(args, name) {
    const index = args.indexOf(name);
    if (index < 0)
        return undefined;
    return args[index + 1];
}
const valueOptions = new Set(["--dir", "--out"]);
function positionals(args) {
    const out = [];
    for (let index = 0; index < args.length; index++) {
        const value = args[index];
        if (valueOptions.has(value)) {
            index++;
            continue;
        }
        if (value.startsWith("--"))
            continue;
        out.push(value);
    }
    return out;
}
function projectDir(args) {
    return path.resolve(argValue(args, "--dir") ?? process.cwd());
}
function outFile(args) {
    return argValue(args, "--out");
}
const helloSource = `import { useState } from "@mna/qchat";
import { Button, Text, View } from "@mna/qchat/ui";
import { start } from "@mna/qchat";

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <View style={{ flex: 1, padding: 24, gap: 12, justifyContent: "center" }}>
      <Text style={{ fontSize: 28, fontWeight: "bold" }}>QChat Mini App</Text>
      <Text>Count: {count}</Text>
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
async function create(args) {
    const name = positionals(args)[0];
    if (!name) {
        usage();
        process.exitCode = 1;
        return;
    }
    const directory = path.resolve(argValue(args, "--dir") ?? name);
    if (existsSync(directory))
        throw new Error(`Directory already exists: ${directory}`);
    await mkdir(path.join(directory, "src"), { recursive: true });
    await writeFile(path.join(directory, "manifest.json"), `${JSON.stringify({
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
    }, null, 2)}\n`);
    await writeFile(path.join(directory, "src", "main.tsx"), helloSource);
    await writeFile(path.join(directory, "tsconfig.json"), tsconfig);
    await writeFile(path.join(directory, "package.json"), `${JSON.stringify({
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
    }, null, 2)}\n`);
    await writeFile(path.join(directory, "README.md"), `# ${name}\n\nQChat Mini App created with \`qchat create\`.\n\n\`\`\`sh\nnpm install\nnpx qchat build\n\`\`\`\n\nThe build writes an immutable \`.japp\` package to \`dist/\`.\n`);
    console.log(`Created ${name} in ${directory}`);
    console.log("Create the app in Developer Center to get its app id, then upload the built .japp there.");
}
async function build(args) {
    const started = Date.now();
    const result = await compileProject({
        projectDir: projectDir(args),
        outfile: outFile(args),
        typecheck: !args.includes("--no-typecheck"),
        onStage: (stage) => process.stdout.write(`  ${stage}\n`),
    });
    for (const warning of result.warnings)
        console.warn(`warning: ${warning}`);
    console.log(`Built ${result.manifest.name}@${result.manifest.version} (${(result.bytes.length / 1024).toFixed(1)} KB, sha256 ${result.metadata.appSha256.slice(0, 12)}) in ${Date.now() - started} ms`);
}
async function validate(args) {
    const file = positionals(args)[0];
    if (!file)
        throw new Error("qchat validate requires a .japp file");
    const bytes = await readFile(path.resolve(file));
    const result = validateQapp(bytes);
    console.log(`Valid QChat package: ${result.manifest.name}@${result.manifest.version}`);
    console.log(`Size: ${(result.size / 1024).toFixed(1)} KB, SHA-256: ${result.sha256}`);
    console.log(`Permissions: ${result.manifest.requestedPermissions.join(", ") || "none"}`);
    console.log(`Files: ${result.files.length}`);
}
async function inspect(args) {
    const file = positionals(args)[0];
    if (!file)
        throw new Error("qchat inspect requires a .japp file");
    const bytes = await readFile(path.resolve(file));
    const result = validateQapp(bytes);
    console.log(JSON.stringify({
        manifest: result.manifest,
        metadata: result.metadata,
        sha256: result.sha256,
        size: result.size,
        files: result.files,
    }, null, 2));
}
async function testProject(args) {
    const temporary = path.join(projectDir(args), "dist", "qchat-test.japp");
    const result = await compileProject({
        projectDir: projectDir(args),
        outfile: temporary,
        typecheck: !args.includes("--no-typecheck"),
    });
    const harness = runQapp(result.bytes);
    const tree = harness.latest();
    if (!tree?.root)
        throw new Error("TEST_FAILED: no render tree was produced");
    const buttons = countButtons(tree);
    if (buttons === 0)
        throw new Error("TEST_FAILED: no Button/Pressable rendered");
    const before = textContent(tree);
    const button = findNode(tree, (node) => node.type === "Button" || node.type === "Pressable");
    if (button)
        harness.dispatch(button.id, "press", {});
    const after = textContent(harness.latest());
    if (before === after) {
        // A press does not have to change text; it only has to be accepted.
        console.log("Press dispatched; state text unchanged (valid for this app).");
    }
    console.log(`PASS: ${result.manifest.name} rendered ${countNodes(tree)} nodes.`);
    console.log(`  Text: ${after.slice(0, 160)}`);
    harness.dispose();
}
function countNodes(tree) {
    let count = 0;
    const walk = (node) => {
        count++;
        for (const child of node.children ?? [])
            walk(child);
    };
    if (tree.root)
        walk(tree.root);
    return count;
}
function countButtons(tree) {
    let count = 0;
    const walk = (node) => {
        if (node.type === "Button" || node.type === "Pressable")
            count++;
        for (const child of node.children ?? [])
            walk(child);
    };
    if (tree.root)
        walk(tree.root);
    return count;
}
async function dev(args) {
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
        }
        catch (error) {
            console.error(error instanceof Error ? error.message : error);
        }
    };
    await rebuild();
    if (args.includes("--once"))
        return;
    console.log("Watching src, assets and manifest.json. Press Ctrl+C to stop.");
    let timer = null;
    watch(directory, { recursive: true }, (_event, filename) => {
        if (!filename)
            return;
        const name = String(filename);
        if (name.includes("dist") || name.includes("node_modules") || name.startsWith("."))
            return;
        if (timer)
            clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            void rebuild();
        }, 250);
    });
}
async function main() {
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
//# sourceMappingURL=cli.js.map