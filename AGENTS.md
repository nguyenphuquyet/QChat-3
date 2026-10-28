# QChat — agent rules

## Mobile UI: no Google Material, ever

`apps/mobile` is a Flutter app that must not use Google's Material design language.
There is no `MaterialApp`, no Material theme, and no Material widget in the shipped
app. Every surface is drawn by the QChat design system.

Before touching anything under `apps/mobile`, read
[`apps/mobile/AGENTS.md`](apps/mobile/AGENTS.md). It lists the forbidden APIs, the
allowed replacements, and the checks to run before committing.

Summary of the hard rules:

- Never import `package:flutter/material.dart` in `apps/mobile/lib`.
- Never add `MaterialApp`, `Scaffold`, `AppBar`, `ThemeData`, `ColorScheme`,
  `Colors.*`, `Icons.*`, Material buttons/inputs/spinners/ripples/sheets/dialogs,
  or any other Material widget.
- Keep `uses-material-design: false` in `apps/mobile/pubspec.yaml`.
- Use the QChat design system (`apps/mobile/lib/core/design_system`) for UI, and
  `qchatHarness` / `qchatRouterHarness` in tests.
- If a needed control does not exist yet, add a `QChat*` widget to the design
  system instead of falling back to Material.

This is a product requirement, not a style preference. Do not add Material
"temporarily", behind a flag, or only in tests.

## Mini App frames: TDesign controls, Cupertino motion

A Mini App frame is the one scoped exception, approved by the maintainer. Its
leaf controls are drawn by `tdesign_flutter` (`Button`, `Tag`, `Badge`,
`Checkbox`, `Switch`, `Slider`, `TextField`, `ActivityIndicator`, `Icon`,
horizontal `Divider`) so a package sees TDesign's palette and interaction
states instead of QChat's.

The exception is one file wide and must stay that way:

- `apps/mobile/lib/features/miniapps/qapp/qapp_tdesign.dart` is the only file
  allowed to import `tdesign_flutter` or, transitively, Material. It exposes
  `QappTDesignScope` and thin `QappT*` wrappers; the renderer imports only
  that file.
- Nothing Material may leak into the chat UI, the app shell or any other
  screen. `uses-material-design: false` stays.
- Overlay motion stays Cupertino: `CupertinoPageRoute` transitions, and the
  iOS-style scrim fade, sheet slide and dialog scale of `Modal`,
  `BottomSheet` and `Dialog`. `TabBar`, `NavBar`, `Avatar` and the vertical
  `Divider` also stay on the QChat/Cupertino side.
- A new control means a new wrapper in `qapp_tdesign.dart`, never a direct
  `tdesign_flutter` import in `qapp_renderer.dart` or a `QChat*` fallback
  inside a Mini App frame.

`flutter test` prints a pub warning that `tdesign_flutter` asks for
`uses-material-design: true`. It is only a warning; keep `false`.
