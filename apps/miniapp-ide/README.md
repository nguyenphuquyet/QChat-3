# QChat Mini App Studio

Desktop IDE for native QChat mini apps. It edits TSX projects, runs the real
`@mna/qchat` CLI, typechecks with the bundled SDK typings and produces
`.japp` packages for the Flutter QuickJS runtime. It is **not** a WebView app
host: the preview panel summarises the package (manifest, permissions, size,
checksum) instead of rendering HTML.

Stack: Tauri v2, React 19, Vite 8, Tailwind CSS 4, Monaco Editor 0.57, Zustand
and a small Rust backend that wraps the Node CLI.

## Requirements

- Node.js 20 or newer (24 recommended)
- pnpm 10.11.0 through Corepack
- Rust stable and the [Tauri v2 system dependencies](https://v2.tauri.app/start/prerequisites/)
  for desktop builds (`tauri dev` / `tauri build`)
- WebView2 on Windows, WKWebView on macOS, WebKitGTK 4.1 on Linux

The web frontend can be developed without Rust; anything that touches the
filesystem, the CLI or the dev watcher requires the Tauri shell.

## Quick start

```sh
cd apps/miniapp-ide
corepack pnpm install
corepack pnpm --filter @mna/qchat build   # from the repository root
corepack pnpm prepare:cli
corepack pnpm tauri dev
```

`prepare:cli` copies the compiled CLI, esbuild (with the platform binary) and
TypeScript into `src-tauri/resources/qapp`. Without it the packaged app cannot
build projects, although the IDE still detects a CLI from the repo checkout.

Browser-only UI work:

```sh
corepack pnpm dev
```

It opens the full interface at <http://localhost:1420>, but filesystem, CLI and
dev-watcher actions are disabled with a "desktop runtime required" message.

## CLI detection

Every command runs through Node and the framework `dist/cli.js`. The backend
resolves them in this order:

1. Paths saved in **Settings → CLI & Studio** (`nodePath`, `cliPath`).
2. `QCHAT_NODE` and `QCHAT_CLI` environment variables.
3. Bundled resources next to the app: `resources/qapp/cli.js` and
   `resources/node/node[.exe]`.
4. The repository checkout, walking up from the executable and the working
   directory to `packages/miniapp-framework/dist/cli.js`.
5. `node` from `PATH` with the checkout CLI.

Node 20+ is required. If the framework has not been built, run
`corepack pnpm --filter @mna/qchat build` first. The status bar shows the
detected Node, CLI and platform versions; **Tools → Re-detect CLI** retries
after changing settings.

## Features

- Explorer with create, rename and delete, plus Monaco tabs, unsaved-change
  tracking, auto-save and per-project cursor state.
- TSX SDK typings and a `manifest.json` JSON schema injected into Monaco, so
  `@mna/qchat` imports and permissions complete as you type.
- Project creation through `qapp create`, with starter, counter and blank
  templates, permission and network-domain selection.
- Build (`Ctrl+B`), build without typecheck (`Ctrl+Shift+B`), runtime test
  (`Ctrl+T`), validate and inspect, with streamed CLI output and artifacts.
- Dev watcher (`F5`) bridged over Tauri events, with stop, logs and exit code.
- Device panel with manifest summary, permission badges, package size/checksum
  and quick actions for the newest `.japp`.
- Command palette (`Ctrl+K`), resizable panes, output/terminal/problems tabs,
  settings and project settings dialogs.

Builds call the real CLI, so the artifact is exactly
`dist/<slug>-<version>.japp`; the IDE also inspects it and surfaces checksum and
file details.

## Resource preparation

```sh
corepack pnpm prepare:cli              # CLI + esbuild + TypeScript
corepack pnpm prepare:cli -- --force   # rebuild even when the marker matches
corepack pnpm prepare:cli -- --with-node
```

`--with-node` (or `QAPP_BUNDLE_NODE=1`) also copies the running Node binary into
`src-tauri/resources/node`, so the installed IDE does not depend on a system
Node. Expect roughly 80–110 MB of extra resources on Windows.

Both resource folders are gitignored; `prepare:cli` runs automatically before
`tauri dev` and `tauri build` through `beforeDevCommand` / `beforeBuildCommand`.

## Commands

| Command | Purpose |
| --- | --- |
| `corepack pnpm dev` | Vite frontend in a browser |
| `corepack pnpm tauri dev` | Full desktop app with hot reload |
| `corepack pnpm typecheck` | TypeScript checks |
| `corepack pnpm build` | Typecheck and build the web bundle |
| `corepack pnpm tauri build` | Native installers in `src-tauri/target/release/bundle` |
| `corepack pnpm prepare:cli` | Refresh bundled CLI resources |

Bundle targets follow the host: NSIS `.exe` on Windows, `.dmg` on macOS,
`.deb`/AppImage on Linux. macOS builds need Xcode command-line tools.

## CI

`.github/workflows/miniapp-ide.yml` typechecks and builds the frontend, then
builds installers on Windows, macOS and Ubuntu. It bundles Node, so the CI
runners do not need a preinstalled Node for the packaged app. Artifacts are
named `qchat-miniapp-studio-<os>-<sha>` and kept for 14 days. Unsigned macOS and
Windows builds trigger the usual Gatekeeper/SmartScreen warnings; signing is not
configured.

## Layout

```
apps/miniapp-ide/
  src/                 React UI, store, CLI bridge and Monaco setup
  src-tauri/           Rust commands, capabilities, icons and config
  assets/icon.svg      Source for `tauri icon`
  scripts/prepare-cli.mjs
```

`src-tauri/src/lib.rs` exposes `detect_cli`, `run_cli`, `start_dev`, `stop_dev`,
tree/file CRUD, artifact listing and the `qapp-dev-log` / `qapp-dev-exit`
events. Only the dialog, opener and core window permissions are granted.

## Verification status

- `corepack pnpm typecheck` and `corepack pnpm build` pass for the frontend.
- The bundled resource set builds a real `.japp` through
  `resources/qapp/cli.js build`, including typechecking and esbuild.
- `cargo check`, `tauri dev` and installer builds are **unverified on this
  machine** because no Rust toolchain is installed; they run only in the
  workflow above or on a Rust-equipped host.
- A live backend upload/review/release run and mobile device execution of a
  packaged app remain unverified from the platform work.
