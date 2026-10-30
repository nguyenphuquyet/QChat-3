import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:wechat_assets_picker/wechat_assets_picker.dart';

import '../design_system/components.dart';
import '../design_system/dialogs.dart';
import '../localization/strings.dart';
import 'media_album_names.dart';
import 'media_picker_fallback.dart' as fallback;

/// Opens the WeChat-style picker over the device's photo library.
///
/// This file is the app's one Material island (see `apps/mobile/AGENTS.md`,
/// §8). `wechat_assets_picker` draws its page with Material widgets, so the
/// page is wrapped in the [Theme] those widgets expect and the app ships the
/// Material icon font for them. Nothing else in the app may import Material,
/// and the rest of the app still draws itself with the QChat design system.
///
/// Desktop has no photo library to browse, so it keeps the file chooser: a
/// phone's library has no desktop equivalent.
Future<List<XFile>> pickDeviceMedia(
  BuildContext context, {
  required bool imagesOnly,
  required int maxAssets,
  String? confirmLabel,
}) async {
  if (!Platform.isAndroid && !Platform.isIOS && !Platform.isMacOS) {
    return fallback.pickDeviceMedia(
      context,
      imagesOnly: imagesOnly,
      maxAssets: maxAssets,
      confirmLabel: confirmLabel,
    );
  }
  final type = imagesOnly ? RequestType.image : RequestType.common;
  final permission = PermissionRequestOption(
    androidPermission: AndroidPermission(type: type, mediaLocation: false),
  );
  final state = await PhotoManager.requestPermissionExtend(
    requestOption: permission,
  );
  if (!context.mounted) return [];
  if (state != PermissionState.authorized && state != PermissionState.limited) {
    final settings = await showQChatDialog<bool>(
      context,
      title: tr(context, 'photoLibrary'),
      message: tr(context, 'photoPermission'),
      actions: [
        QChatDialogAction(label: tr(context, 'cancel'), result: false),
        QChatDialogAction(
          label: tr(context, 'settings'),
          result: true,
          primary: true,
        ),
      ],
    );
    if (settings == true) await PhotoManager.openSetting();
    return [];
  }
  final dark = qchatDark(context);
  final family = DefaultTextStyle.of(context).style.fontFamily;
  final selected = await AssetPicker.pickAssets(
    context,
    permissionRequestOption: permission,
    pickerConfig: AssetPickerConfig(
      requestType: type,
      maxAssets: maxAssets,
      gridCount: 4,
      themeColor: QChatColors.green,
      textDelegate: _textDelegate(context, confirmLabel),
      pathNameBuilder: (path) => path.isAll
          ? tr(context, 'recentMedia')
          : mediaAlbumName(context, path.name),
    ),
    pageRouteBuilder: (picker) => AssetPickerPageRoute(
      builder: (_) => _PickerTheme(
        dark: dark,
        fontFamily: family,
        child: picker,
      ),
      transitionCurve: Curves.easeOutCubic,
      transitionDuration: MediaQuery.disableAnimationsOf(context)
          ? Duration.zero
          : const Duration(milliseconds: 300),
    ),
  );
  if (selected == null || selected.isEmpty) return [];
  final files = <XFile>[];
  for (final asset in selected) {
    final file = await asset.file;
    if (file == null) throw StateError('mediaUnavailable');
    files.add(XFile(file.path));
  }
  return files;
}

/// The app's palette, handed to the one page that expects a Material theme.
/// The typeface stays the host's, so Vietnamese marks keep their letters.
class _PickerTheme extends StatelessWidget {
  const _PickerTheme({
    required this.dark,
    required this.fontFamily,
    required this.child,
  });

  final bool dark;
  final String? fontFamily;
  final Widget child;

  @override
  Widget build(BuildContext context) => Theme(
    data: ThemeData(
      brightness: dark ? Brightness.dark : Brightness.light,
      scaffoldBackgroundColor: dark
          ? QChatColors.darkBackground
          : QChatColors.background,
      colorSchemeSeed: QChatColors.green,
      splashFactory: NoSplash.splashFactory,
      highlightColor: QChatColors.transparent,
      fontFamily: fontFamily,
    ),
    child: child,
  );
}

/// The package ships a text delegate per language; these subclasses only put
/// the caller's confirm label on top of the one it already picked.
AssetPickerTextDelegate _textDelegate(
  BuildContext context,
  String? confirmLabel,
) {
  final base = assetPickerTextDelegateFromLocale(
    Localizations.localeOf(context),
  );
  if (confirmLabel == null) return base;
  return switch (base) {
    EnglishAssetPickerTextDelegate() => _EnglishConfirm(confirmLabel),
    VietnameseAssetPickerTextDelegate() => _VietnameseConfirm(confirmLabel),
    TraditionalChineseAssetPickerTextDelegate() => _TraditionalConfirm(
      confirmLabel,
    ),
    _ => _ChineseConfirm(confirmLabel),
  };
}

class _EnglishConfirm extends EnglishAssetPickerTextDelegate {
  const _EnglishConfirm(this.label);
  final String label;
  @override
  String get confirm => label;
}

class _VietnameseConfirm extends VietnameseAssetPickerTextDelegate {
  const _VietnameseConfirm(this.label);
  final String label;
  @override
  String get confirm => label;
}

class _ChineseConfirm extends AssetPickerTextDelegate {
  const _ChineseConfirm(this.label);
  final String label;
  @override
  String get confirm => label;
}

class _TraditionalConfirm extends TraditionalChineseAssetPickerTextDelegate {
  const _TraditionalConfirm(this.label);
  final String label;
  @override
  String get confirm => label;
}
