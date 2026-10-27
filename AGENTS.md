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
