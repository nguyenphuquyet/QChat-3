# QChat mobile

Flutter client for QChat.

## UI rules — no Google Material

This app does **not** use Google's Material design language. There is no
`MaterialApp`, no Material theme, and no Material widget. Every screen is drawn by
the QChat design system.

Read [`AGENTS.md`](AGENTS.md) before changing any UI code. It lists the forbidden
APIs, the QChat replacements, and the checks to run before committing.

Quick rules:

- Never import `package:flutter/material.dart`.
- Never use `MaterialApp`, `Scaffold`, `AppBar`, `ThemeData`, `ColorScheme`,
  `Colors.*`, `Icons.*`, Material buttons/inputs/spinners/ripples/sheets/dialogs.
- Keep `uses-material-design: false` in `pubspec.yaml`.
- Reuse `lib/core/design_system/components.dart`; add a new `QChat*` widget if
  something is missing.
- Tests use `qchatHarness` / `qchatRouterHarness` from `test/test_app.dart`.

## Run

```sh
flutter pub get
flutter run
```

## Verify

```sh
flutter analyze --no-pub
flutter test --no-pub
```
