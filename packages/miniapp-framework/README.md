# `@mna/qchat` — QChat Mini Program toolchain

Builds a WeChat-shaped Mini Program into the verified `.japp` container that the
QChat client serves to its WebView.

```sh
npx qchat create my-app
npx qchat build my-app
npx qchat validate my-app
npx qchat inspect dist/my-app-1.0.0.japp
```

A project is an ordinary WeChat project: `app.json`, `app.js`, `app.wxss`,
`pages/<route>/{js,json,wxml,wxss}` and `components/`, plus a QChat
`manifest.json` (`name`, `version`, `requestedPermissions`).

## What this package does

QChat is a **host**, not a competing framework. It does not compile WXML or WXSS
and does not ship a component runtime. The build is the official WeChat
toolchain:

- `glass-easel-miniprogram-webpack-plugin` with its WXML/WXSS/WXS loaders;
- `glass-easel-template-compiler` and `glass-easel-stylesheet-compiler`;
- `glass-easel` and `glass-easel-miniprogram-adapter` at runtime.

This package adds the integration layer WeChat does not publish:

1. project discovery and validation (`src/wechat.ts`);
2. staging, built-in component injection and the webpack run (`src/builder.ts`);
3. the host runtime (`runtime/host.js`) that installs `App`, `getApp`, `wx`,
   `getCurrentPages`, owns the page stack and mounts `<wx-page>`;
4. the built-in components (`builtin/`), written as real `glass-easel` host
   components over native `div`/`span`/`img`/`input`/`textarea`/`button` nodes.

## Honest status

- Verified in automated jsdom tests: build pipeline, all 15 built-in components,
  page lifecycle, navigation and the sample app. See
  `docs/BUILTIN-COMPONENTS-AUDIT.md` and `docs/WXML-COMPILER-INTEGRATION.md` in
  the repository.
- **Not verified on Android or iOS devices.** No device result exists yet.
- Unsupported and reported as such, never faked: `map`, `camera`,
  `live-player`, `live-pusher`, `editor`, Skyline components, encrypted
  `wxapkg` import, and the `wx.*` APIs listed in the audit's §8.

## Commands

| Command                          | Purpose                                           |
| -------------------------------- | ------------------------------------------------- |
| `qchat create <name> [dir]`      | Scaffold a Mini Program                           |
| `qchat build [dir] [--out file]` | Build a `.japp`                                   |
| `qchat dev [dir] [--port 5273]`  | Rebuild on change and serve a preview             |
| `qchat validate [dir]`           | Validate `app.json`, pages, components and assets |
| `qchat inspect <file.japp>`      | Print the manifest of a built package             |
| `qchat version`                  | Print the toolchain version                       |

## License

MIT.
