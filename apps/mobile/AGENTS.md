# QChat mobile — agent rules

> **Tuyệt đối không dùng ngôn ngữ thiết kế Google Material trong app này.**
> Never use Google's Material design language in this app. There are exactly two
> scoped exceptions: a Mini App frame, which draws its own controls with TDesign
> ([§7](#7-mini-app-frames-tdesign-exception)), and the photo picker page, which
> is `wechat_assets_picker` ([§8](#8-the-photo-picker-is-the-material-island)).
> Nothing else may use Material, not even temporarily, behind a flag, or only in
> tests.

This file applies to everything under `apps/mobile/`. Read it before adding or
changing any UI code. If you are about to import `package:flutter/material.dart`,
stop and use the QChat design system instead — unless you are in the picker file
named in §8.

## 1. Hard rules

1. `apps/mobile/lib` must never import `package:flutter/material.dart`, except
   `lib/core/media/media_picker_native.dart` (§8).
2. The app entry point is `WidgetsApp.router` in `lib/main.dart`. Never reintroduce
   `MaterialApp` (or `MaterialApp.router`).
3. `uses-material-design: true` ships only for the picker's icon font (§8). Never
   bundle Roboto, Google Fonts, or a Material widget package beyond
   `wechat_assets_picker`.
4. Do not use Material widgets, tokens, icons, ripples, elevations or interaction
   patterns anywhere in `lib` or `test` (see the list below), outside §7 and §8.
5. Do not add a dependency that brings Material UI, for example `tdesign_flutter`,
   `google_fonts`, `material_design_icons_flutter`, `flex_color_scheme`, or any
   package whose widgets are Material-based. `tdesign_flutter` is allowed only
   for Mini App frames: it is imported by exactly one file,
   `lib/features/miniapps/qapp/qapp_tdesign.dart` (see §7). `wechat_assets_picker`
   is allowed only for the photo picker: it is imported by exactly one file,
   `lib/core/media/media_picker_native.dart` (see §8).
   A plugin that only talks to the platform is fine: `photo_manager` lists the
   photo library, and the desktop fallback picker is drawn with the QChat design
   system.
6. If a control you need does not exist, **add a `QChat*` widget to
   `lib/core/design_system/`** and draw it with primitives
   (`Container`, `DecoratedBox`, `CustomPaint`, `GestureDetector`,
   `AnimatedContainer`, `Text`, …). Do not fall back to Material.
7. If a Material widget looks unavoidable, stop and ask the maintainer. Do not add
   it silently.

## 2. Forbidden APIs (non-exhaustive)

Any symbol exported by `package:flutter/material.dart` is forbidden, except in
the picker file named in §8. The most common traps:

| Area | Forbidden | Use instead |
| --- | --- | --- |
| App shell | `MaterialApp`, `Material`, `Scaffold`, `AppBar`, `SliverAppBar`, `Drawer`, `BottomAppBar` | `WidgetsApp`, `QChatPage`, `QChatAppBar`, `ColoredBox` |
| Navigation | `BottomNavigationBar`, `NavigationBar`, `NavigationRail`, `TabBar`, `TabBarView`, `TabPageSelector` | `QChatBottomNavigation`, `QChatTabBar`, custom `Row`/`PageView` |
| Surfaces | `Card`, `ListTile`, `Divider`, `VerticalDivider`, `Chip`, `Badge`, `CircleAvatar`, `Stepper`, `ExpansionTile`, `DataTable`, `Tooltip` | `QChatCell`, `QChatListTile`, `QChatAvatar`, `QChatUnreadBadge`, `Container` + `Border` |
| Buttons | `IconButton`, `TextButton`, `ElevatedButton`, `OutlinedButton`, `FilledButton`, `FloatingActionButton`, `SegmentedButton`, `ToggleButtons`, `DropdownButton`, `PopupMenuButton` | `QChatIconButton`, `QChatButton`, `qchatSheet`, custom `GestureDetector` |
| Inputs | `TextField`, `TextFormField`, `InputDecorator`, `Checkbox`, `Radio`, `Switch`, `SwitchListTile`, `Slider`, `RangeSlider`, `SearchBar`, `SearchAnchor`, `Autocomplete` | `QChatTextInput`, `CupertinoTextField`, `QChatSwitch`, `QChatSlider`, `QChatSearchBar`, `QChatSearchField` |
| Feedback | `CircularProgressIndicator`, `LinearProgressIndicator`, `RefreshIndicator`, `SnackBar`, `ScaffoldMessenger`, `Banner`, `MaterialBanner` | `QChatLoading`, `QChatDots`, `QChatRefresh`, `showQChatToast` |
| Overlays | `showDialog`, `AlertDialog`, `SimpleDialog`, `showModalBottomSheet`, `BottomSheet`, `showDatePicker`, `showTimePicker` | `showQChatDialog`, `confirmAction`, `editText`, `showQChatSheet`, `qchatSheet` |
| Theme | `Theme`, `ThemeData`, `ColorScheme`, `MaterialStateProperty`, `WidgetStateProperty`, `TextTheme`, `IconTheme`, `MaterialTapTargetSize` | `QChatTheme`, `QChatColors`, `qchat*` helpers, `CupertinoTheme.of` |
| Icons | `Icons.*`, `AnimatedIcon` | `QChatIcon('name')` |
| Ink / ripple | `InkWell`, `InkResponse`, `Ink`, `Material` (as ink surface) | `GestureDetector(behavior: HitTestBehavior.opaque)` |
| Colors | `Colors.*`, Material palette literals (`#6200EE`, `#3700B3`, `#03DAC6`, `#BB86FC`, `#018786`, …) | `QChatColors.*`, `qchatInk/Surface/Fill/Muted/Line/Background` |
| Localization | `GlobalMaterialLocalizations`, `MaterialLocalizations` | `GlobalWidgetsLocalizations`, `GlobalCupertinoLocalizations` (the picker's `GlobalMaterialLocalizations.delegate` in `main.dart` is part of §8) |

`Hero`, `Navigator`, `PageRouteBuilder`, `CupertinoPageRoute`, `SafeArea`,
`MediaQuery`, `LayoutBuilder`, `ListView`, `GridView`, `PageView`, `AnimatedOpacity`,
`AnimatedContainer`, `TweenAnimationBuilder`, `CustomPaint`, `SelectionArea` and
other pure `widgets`/`painting` APIs are allowed.

Cupertino is allowed: `CupertinoTextField` for inputs, `CupertinoPageRoute` /
`PageRouteBuilder` for navigation. Cupertino is Apple's language, not Google's.

`tdesign_flutter_icons` is tolerated **only** as a glyph source inside
`lib/core/design_system/qchat_icons.dart`, plus the Mini App control file
`lib/features/miniapps/qapp/qapp_tdesign.dart` (§7). Do not import it anywhere
else, and do not use TDesign widgets outside a Mini App frame.

`wechat_assets_picker` is tolerated **only** inside
`lib/core/media/media_picker_native.dart` (§8). Do not import it anywhere else,
and do not copy its Material widgets into the rest of the app.

## 3. Design system reference

Import one file:

```dart
import '../../core/design_system/components.dart';
```

It exports the palette, the theme helpers and the widget library.

### Layout and chrome

- `QChatPage(title:, leading:, trailing:, bottom:, background:, edgeToEdge:, glassHeader:, child:)`
- `QChatAppBar`
- `QChatBottomNavigation`
- `QChatEmptyState`, `QChatError`

### Content

- `QChatCell(title:, subtitle:, note:, image:, trailing:, arrow:, onTap:)`
- `QChatListTile`, `QChatConversationTile`
- `QChatAvatar`, `QChatUnreadBadge`
- `QChatChatBubble`, `QChatQuote`, `QChatDots`

### Controls

- `QChatButton(text, onTap:, secondary:, loading:, padding:)`
- `QChatIconButton(icon, label:, onTap:, color:, size:)`
- `QChatTextInput(controller:, hint:, secret:, lines:, maxLength:, …)`
- `QChatSearchBar`, `QChatSearchField`
- `QChatSwitch(value:, onChanged:)`
- `QChatSlider(value:, min:, max:, onChanged:, onChangeEnd:)`
- `QChatTabBar`
- `QChatSwipeCell` + `QChatSwipeAction`

### Feedback and overlays

- `QChatLoading(label:, size:, color:)`
- `QChatRefresh`
- `showQChatToast(context, message)`
- `showQChatSheet(context, builder)`, `qchatSheet(context, [(label, onTap), …])`
- `showQChatDialog(context, message:, actions:)`, `confirmAction`, `editText`

### Colors and theme

- `QChatColors.*` for brand colors (green, danger, ink, muted, line, surfaces…).
- `qchatBackground(context)`, `qchatSurface(context)`, `qchatFill(context)`,
  `qchatInk(context)`, `qchatMuted(context)`, `qchatLine(context)`,
  `qchatNavigationSurface(context)`, `qchatDark(context)`.
- Dark mode resolves through `QChatTheme`; never read `MediaQuery.platformBrightness`
  directly for app surfaces.

### Icons

```dart
QChatIcon('arrowLeft', size: 22, color: qchatInk(context))
```

If the name is missing, add a case in `qchat_icons.dart` (Lucide/TIcons glyph or a
`CustomPainter` path). Never use `Icons.*`.

### Text

- Wrap user-facing strings with `tr(context, 'key')` and add the key to
  `lib/core/localization/strings.dart` (en / vi / zh).
- Typography comes from `QChatTheme`'s `DefaultTextStyle`. Do not bundle fonts; the
  system font (SF Pro / Roboto) is an intentional product decision.
- Do not use `GoogleFonts`.

## 4. Adding a new screen or component

1. Reuse an existing `QChat*` widget when possible.
2. Build the screen from `QChatPage` + `QChatCell`/`QChatButton`/`QChatTextInput`.
3. If you need a new control, create it in `lib/core/design_system/` as `QChatX`:
   - accept colors via parameters with `QChatColors` defaults,
   - read dark mode through `qchat*` helpers,
   - use `GestureDetector`/`AnimatedContainer` instead of ink or ripples,
   - expose `Semantics` for accessibility,
   - never import Material.
4. Use `CupertinoPageRoute` or `PageRouteBuilder` for navigation.

## 5. Tests

- Import `test_app.dart` and use `qchatHarness(child)` or
  `qchatRouterHarness(routerConfig: router)`.
- Never use `MaterialApp`, `Scaffold`, `Material`, `Colors.*` or `Icons.*` in tests
  either. The test tree must match the shipped tree. The only tests that may
  name TDesign types are `qapp_tdesign_smoke_test.dart` and the Mini App
  renderer tests, and only to prove the scoped exception of §7. No test opens
  the photo picker: `wechat_assets_picker` needs a real photo library and
  platform channels, so §8 is exercised on a device.
- Prefer finders by `QChat*`/`QappT*` type, visible text, or `Key`.
- If a golden image changes because the UI changed, regenerate it and commit the
  new PNG:
  `flutter test --update-goldens test/reference_ui_test.dart`.

## 6. Definition of done

Before you commit:

```powershell
cd apps/mobile
E:\flutter\bin\flutter.bat analyze --no-pub
E:\flutter\bin\flutter.bat test --no-pub
```

And confirm the Material scan is empty for app code:

```powershell
Get-ChildItem apps\mobile\lib -Recurse -Filter *.dart |
  Select-String -Pattern 'package:flutter/material\.dart|MaterialApp|\bScaffold\(|\bColors\.|\bIcons\.|CircularProgressIndicator|InkWell|ThemeData|ColorScheme'
```

The only acceptable matches are comments, documentation,
`lib/features/miniapps/qapp/qapp_tdesign.dart` (§7) and
`lib/core/media/media_picker_native.dart` (§8). If you find a real match
anywhere else, fix it before committing.

## 7. Mini App frames: TDesign exception

A Mini App frame is the one place where a different design language is allowed,
because the UI on screen belongs to the Mini App author, not to QChat. Its leaf
controls — `Button`, `Tag`, `Badge`, `Checkbox`, `Switch`, `Slider`, `TextField`,
`ActivityIndicator`, `Icon` and the horizontal `Divider` — are rendered with
`tdesign_flutter` 1.1.0.

The exception is deliberately one file wide:

- `lib/features/miniapps/qapp/qapp_tdesign.dart` is the **only** file allowed to
  import `tdesign_flutter` (which re-exports Material). It owns
  `QappTDesignScope` — the TDesign theme, the Material localizations and a
  transparent `Material` ink surface — plus a thin `QappT*` wrapper per control.
- `qapp_renderer.dart` imports that file and nothing else from TDesign. It keeps
  importing `flutter/cupertino.dart` and the QChat design system.
- **Motion stays Cupertino.** `CupertinoPageRoute` pushes, plus the iOS scrim
  fade, sheet slide and dialog scale of `Modal`, `BottomSheet` and `Dialog`.
  `TabBar` (a `CupertinoTabBar`), `NavBar`, `Avatar` and the vertical `Divider`
  stay on the QChat/Cupertino side: TDesign has no faithful equivalent.
- **Typography is the host's, not TDesign's.** `QappTDesignScope` re-points
  TDesign's `fontFamily` / `fontFamilyMedium` tokens at the family Flutter's
  `Typography` resolved for the platform (SF, Roboto, Segoe UI), because QChat
  ships no fonts and TDesign's stock `PingFang SC` → `Microsoft YaHei` chain
  detaches Vietnamese marks from their letters (`Đặt lại` renders as `Đaṭ lại`).
  Never bundle a font, and never restore TDesign's stock family.
- `uses-material-design: true` ships the Material icon font for the photo
  picker (§8) as well as for TDesign. `flutter test` no longer prints the pub
  warning. Roboto and Google Fonts are still never bundled: the typeface stays
  the host's.
- To add a control, add a `QappT*` wrapper in `qapp_tdesign.dart`. Never import
  `tdesign_flutter` in another file, and never fall back to a `QChat*` widget
  inside a Mini App frame.
- Pin the exception with `test/qapp_tdesign_smoke_test.dart` (controls build in
  the Material-free `WidgetsApp` host) and the renderer tests (the contract
  components map to the wrappers).

## 8. The photo picker is the Material island

The photo picker is the one full page in the app whose widgets are not QChat's.
It is `wechat_assets_picker` 10.1.3, kept because it is the WeChat-style picker
the app has always shown: a four-column grid, the album switcher in the header,
numbered selection badges and a viewer. Re-drawing it with the QChat design
system lost that behaviour, so the package stays — behind one file.

- `lib/core/media/media_picker_native.dart` is the **only** file allowed to
  import `wechat_assets_picker` (which pulls in Material). It asks for the photo
  permission, opens `AssetPicker`, maps the album names through `tr`, and
  converts the picked assets to `XFile`s.
- The page is wrapped in a `Theme` built from `QChatColors` (dark background,
  green seed, no splash) and the host's font family, so it follows QChat's
  palette and light/dark switch instead of Material's defaults.
- `pubspec.yaml` keeps `uses-material-design: true` for the package's icon font.
  Roboto and Google Fonts are still never bundled, and the rest of the app still
  draws itself with the QChat design system.
- `main.dart` registers `GlobalMaterialLocalizations.delegate` next to the
  widgets and Cupertino delegates, because the picker's Material widgets look
  their labels up through `MaterialLocalizations`.
- Desktop keeps the file chooser (`media_picker_fallback.dart`), which is drawn
  with the QChat design system: a phone's photo library has no desktop
  equivalent.
- Nothing else may import the package or copy its widgets. A new picker
  behaviour means a `QChat*` widget or a config flag on `AssetPicker`, never a
  Material widget in the chat, the shell or another screen.

> Note for this machine: the repository owner may ask you not to run the full test
> suite locally. Ask before running long builds or tests; `flutter analyze` is cheap.
