# QChat Mini App Studio

Desktop IDE for WeChat Mini Programs running in QChat. It authors the real
WeChat project layout — `app.js/json/wxss`, `pages/**/{js,json,wxml,wxss}` and
`components/**/{js,json,wxml,wxss}` — and builds it with the official
`glass-easel` Webpack pipeline through the `@mna/qchat` CLI. The result is an
immutable `.japp` package that QChat opens in its WebView host.

The editor never compiles WXML/WXSS itself and never invents a project format:
it calls `qchat build`, `qchat dev` and `qchat validate`, and the simulator is
an iframe pointed at the real dev server. See
[`docs/WXML-COMPILER-INTEGRATION.md`](../../docs/WXML-COMPILER-INTEGRATION.md).

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

`prepare:cli` copies the compiled CLI into `src-tauri/resources/qapp` together
with `builtin/`, `runtime/`, `package.json` and a flattened production
`node_modules` tree (webpack, the official glass-easel loaders and their
transitive dependencies). `resources/qapp/cli.js` is a small shim that imports
`dist/cli.js`; the `dist/` layout is preserved because the builder resolves
`builtin/`, `runtime/` and `package.json` from its own directory's parent.
Without that resource set the packaged app cannot build projects at all,
although the IDE still detects a CLI from the repo checkout.

The editor UI no longer authors the retired TSX format. Templates, diagnostics and
Monaco all work on the WeChat layout. See
[`docs/WXML-COMPILER-INTEGRATION.md`](../../docs/WXML-COMPILER-INTEGRATION.md).

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
- Auto-save is on by default (`Settings → Editor`): a dirty tab is written after
  a short idle, when the window loses focus and before every build, validate or
  dev run, so the CLI always reads what is on screen.
- External-edit sync: a 1.5 s stat-based watcher (`file_stamps` +
  `tree_signature` in Rust) keeps tabs, the explorer and `manifest.json`/`app.json`
  in step with edits made by other editors, the CLI or git. Clean tabs reload in
  place with a notice, dirty tabs are flagged as conflicting and can be reloaded
  from disk or kept, and deleted files are marked as missing.
- Per-file languages: WXML and WXSS get dedicated Monarch tokenizers, brackets,
  comments and hover/completion for built-in tags and attributes; `app.json`,
  page JSON and component JSON use four JSON schemas with `fileMatch`; page and
  component scripts get WeChat Mini Program typings (`Page`, `Component`,
  `Behavior`, `wx`).
- Import-aware navigation: `usingComponents` entries, `Page()` owners and the
  matching `js`/`json`/`wxml`/`wxss` siblings resolve from the project model.
- Project diagnostics: `app.json` pages, missing page or component files,
  unbalanced WXML tags, unclosed WXSS blocks, `usingComponents` targets, missing
  `wx:key`, event handlers without a matching method, and manifest permissions
  outside the capability registry. Results merge with CLI output in the Problems
  panel, and each row opens the file at the reported line.
- Project creation through `qchat create` with starter, counter and blank
  templates, then template overrides written as real WeChat files.
- Build (`Ctrl+B`), validate (`Ctrl+T`), dev server (`F5`), inspect and package
  artifacts, with streamed CLI output.
- Dev server (`F5`) bridged over Tauri events, with stop, logs and exit code; the
  simulator iframe reloads when a rebuild finishes.
- Device panel with three tabs: live simulator, console and network inspector.
  Console and network events are forwarded from the host runtime in the iframe,
  filtered by origin and the `qchat-miniapp` source marker.
- Command palette (`Ctrl+K`), resizable panes, output/terminal/problems tabs,
  settings and project settings dialogs.
- Frameless window with a studio-themed title bar, custom window controls and
  edge resizing, so the desktop chrome matches the dark UI.
- Vietnamese (default), Chinese and English interfaces, a dark/light theme
  switch, and bundled Be Vietnam Pro fonts for offline Vietnamese typography.
- In-app developer documentation (**Help → Developer docs**, the book icon in
  the activity bar, or `Ctrl+K → docs`): a built-in guide to the studio plus the
  repository documents (`docs/WXML-COMPILER-INTEGRATION.md`,
  `docs/BUILTIN-COMPONENTS-AUDIT.md`, `docs/ARCHITECTURE.md`,
  `docs/DEPLOYMENT.md`) compiled straight from the repo, searchable and offline.
- The browser/WebView right-click menu is suppressed; Monaco and opted-in
  surfaces keep their own menus.
- New projects default to `<Documents>/QChat Mini App Studio Project` and always
  create a single folder named after the app (`.../game1`, never nested twice).

Builds call the real CLI, so the artifact is exactly
`dist/<slug>-<version>.japp`; the IDE also inspects it and surfaces checksum and
file details.

## Localization and themes

- **Vietnamese is the default language.** Chinese and English are also
  available. Switch from **Settings → Appearance** or the language menu in the
  title bar; it is persisted in `localStorage` (`qchat-miniapp-studio`) and
  applied before the first paint.
- Be Vietnam Pro (400/500/600/700, Vietnamese and Latin subsets) is bundled in
  `src/assets/fonts` and declared with local `@font-face` rules, so Vietnamese
  typography works offline. `html[lang="vi"]` maps `--font-sans` to it, while
  Chinese and English keep Inter.
- The IDE has dark (default) and light themes. The light theme inverts the
  studio greyscale plus the `white` alpha utilities, so existing `text-white`,
  `bg-white/*` and `border-white/*` classes adapt automatically. Brand
  gradients, controls and the phone preview opt out with `data-keep-white` or
  `data-keep-dark`. Monaco uses `qchat-studio-light` in light mode.
- The native browser/WebView context menu is blocked globally. Monaco keeps its
  own editor menu and any element can opt in with
  `data-native-context-menu`.

## Icons and the Windows installer

Every icon — the app icon, the title-bar/taskbar icon and the NSIS setup icon —
is generated from one square PNG by `scripts/generate-icons.py`:

```sh
python scripts/generate-icons.py "C:/path/to/qchat-icon.png"
```

It writes `src-tauri/icons/icon.ico` (16/24/32/48/64/128/256, used by Explorer
and NSIS), `icon.icns`, `icon.png`, the `32x32`/`64x64`/`128x128`/`128x128@2x`
PNGs, the Windows Store `Square*Logo.png`/`StoreLogo.png` set, and keeps the
1024 px artwork at `src-tauri/icons/source/qchat-app-icon.png`. Pillow is the
only requirement.

`src-tauri/tauri.conf.json` points NSIS at that icon and localises the setup
wizard:

```json
"windows": {
  "nsis": {
    "installMode": "currentUser",
    "languages": ["Vietnamese", "English"],
    "displayLanguageSelector": true,
    "installerIcon": "icons/icon.ico",
    "uninstallerIcon": "icons/icon.ico"
  }
}
```

Paths are relative to `src-tauri/` (the CLI sets its working directory there).
NSIS ships `Vietnamese.nlf` and Tauri ships its own Vietnamese strings, so the
wizard, the maintenance page and the WebView2 prompts are all in Vietnamese;
the selector appears because two languages are listed. Set
`"languages": ["Vietnamese"]` and drop `displayLanguageSelector` to force
Vietnamese everywhere. `headerImage` (150x57) and `sidebarImage` (164x314) BMPs
can be added the same way if a branded header is wanted.

## Resource preparation

```sh
corepack pnpm prepare:cli              # CLI + built-ins + runtime + node_modules
corepack pnpm prepare:cli -- --force   # rebuild even when the marker matches
corepack pnpm prepare:cli -- --with-node
```

`--with-node` (or `QAPP_BUNDLE_NODE=1`) also copies the running Node binary into
`src-tauri/resources/node`, so the installed IDE does not depend on a system
Node. Expect roughly 80–110 MB of extra resources on Windows.

The resource folders are gitignored; `prepare:cli` runs automatically before
`tauri dev` and `tauri build` through `beforeDevCommand` / `beforeBuildCommand`.

## Commands

| Command | Purpose |
| --- | --- |
| `corepack pnpm dev` | Vite frontend in a browser |
| `corepack pnpm tauri dev` | Full desktop app with hot reload |
| `corepack pnpm typecheck` | TypeScript checks |
| `corepack pnpm test` | Project model, templates and diagnostics tests |
| `corepack pnpm build` | Typecheck and build the web bundle |
| `corepack pnpm tauri build` | Native installers in `src-tauri/target/release/bundle` |
| `corepack pnpm bundle:windows` | NSIS `.exe` + MSI installers (Windows only) |
| `corepack pnpm prepare:cli` | Refresh bundled CLI resources |
| `python scripts/generate-icons.py <png>` | Regenerate every app/installer icon from one PNG |

Windows builds produce both an NSIS `setup.exe` and an MSI package; use
`corepack pnpm tauri build --bundles nsis,msi` (or `bundle:windows`) to request
them explicitly. macOS builds a `.dmg` and Linux builds `.deb`/AppImage. macOS
builds need Xcode command-line tools.

## CI

`.github/workflows/miniapp-ide.yml` typechecks the framework and the IDE, runs
the IDE project-model tests, builds the frontend and verifies the bundled CLI
resources, then builds installers on Windows, macOS and Ubuntu. It bundles Node,
so the CI runners do not need a preinstalled Node for the packaged app. Artifacts
are named `qchat-miniapp-studio-<os>-<sha>` and kept for 14 days. The Windows
artifact contains both the NSIS installer and the MSI package. Unsigned macOS and
Windows builds trigger the usual Gatekeeper/SmartScreen warnings; signing is not
configured.

## Layout

```
apps/miniapp-ide/
  src/                 React UI, store, CLI bridge, i18n and Monaco setup
  src/lib/miniapp.ts   WeChat project model, diagnostics and JSON schemas
  src/lib/store.ts     Build/validate/dev orchestration and reveal requests
  test/                Project model, template and diagnostics tests
  src/assets/fonts/    Bundled Be Vietnam Pro woff2 subsets
  src-tauri/           Rust commands, capabilities, icons and config
  src-tauri/icons/source/qchat-app-icon.png  Source image for the icon pipeline
  scripts/prepare-cli.mjs
  scripts/generate-icons.py
```

`src-tauri/src/lib.rs` exposes `detect_cli`, `run_cli`, `start_dev`, `stop_dev`,
tree/file CRUD, artifact listing, `file_stamps` / `tree_signature` for the disk
watcher and the `qapp-dev-log` / `qapp-dev-exit` events. Only the dialog, opener,
core path and core window permissions are granted.

## Verification status

- `corepack pnpm typecheck`, `corepack pnpm test` and `corepack pnpm build` run
  for the frontend in the workflow above.
- The bundled resource set builds a real `.japp` through
  `resources/qapp/cli.js build` with the official glass-easel Webpack pipeline.
- The editor authors the WeChat layout end to end: templates, diagnostics,
  Monaco languages and the dev-server simulator all use `app.json`, WXML, WXSS
  and page/component files.
- `cargo check`, `tauri dev` and installer builds are **unverified on this
  machine** because no Rust toolchain is installed; they run only in the
  workflow above or on a Rust-equipped host.
- Android and iOS device/simulator runs are **not** executed here; compatibility
  is not claimed without them.
- A live backend upload/review/release run remains unverified from the platform
  work.
