import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:wechat_assets_picker/wechat_assets_picker.dart';

import '../design_system/components.dart';
import '../design_system/dialogs.dart';
import '../localization/strings.dart';
import 'media_album_names.dart';
import 'media_fit.dart';
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
  MediaFit? fit,
}) async {
  if (!Platform.isAndroid && !Platform.isIOS && !Platform.isMacOS) {
    return fallback.pickDeviceMedia(
      context,
      imagesOnly: imagesOnly,
      maxAssets: maxAssets,
      confirmLabel: confirmLabel,
      fit: fit,
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
  final transition = MediaQuery.disableAnimationsOf(context)
      ? Duration.zero
      : const Duration(milliseconds: 300);
  final provider = DefaultAssetPickerProvider(
    maxAssets: maxAssets,
    requestType: type,
    initializeDelayDuration: transition,
  );
  final selected = await const AssetPickerDelegate()
      .pickAssetsWithDelegate<
        AssetEntity,
        AssetPathEntity,
        DefaultAssetPickerProvider,
        _GlassPickerDelegate
      >(
        context,
        permissionRequestOption: permission,
        delegate: _GlassPickerDelegate(
          provider: provider,
          initialPermission: state,
          gridCount: 4,
          pickerTheme: _assetPickerTheme(),
          textDelegate: _textDelegate(context, confirmLabel),
          pathNameBuilder: (path) => path.isAll
              ? tr(context, 'recentMedia')
              : mediaAlbumName(context, path.name),
          locale: Localizations.localeOf(context),
        ),
        pageRouteBuilder: (picker) => AssetPickerPageRoute(
          builder: (_) =>
              _PickerTheme(dark: dark, fontFamily: family, child: picker),
          transitionCurve: Curves.easeOutCubic,
          transitionDuration: transition,
        ),
      );
  if (selected == null || selected.isEmpty) return [];
  final files = <XFile>[];
  for (final asset in selected) {
    if (fit != null) {
      files.add(await _fittedAsset(asset, fit));
      continue;
    }
    final file = await asset.file;
    if (file == null) throw StateError('mediaUnavailable');
    files.add(XFile(file.path));
  }
  return files;
}

/// The asset as a JPEG no larger than [fit] asks for.
///
/// `photo_manager` re-encodes through the platform's own decoder, so this keeps
/// the requested [MediaFit.quality] and never loads the full-resolution picture
/// into Dart. The box handed over has the source's aspect ratio, because the
/// platform encoders fill the size they are given.
Future<XFile> _fittedAsset(AssetEntity asset, MediaFit fit) async {
  final (width, height) = fit.sizeFor(asset.width, asset.height);
  final size = ThumbnailSize(width, height);
  final quality = (fit.quality * 100).round();
  // iOS fills the size it is handed unless told to fit; Android's decoder keeps
  // the whole picture. Either way `fitImageBytes` enforces the exact bound.
  final data = await asset.thumbnailDataWithOption(
    Platform.isAndroid
        ? ThumbnailOption(size: size, quality: quality)
        : ThumbnailOption.ios(
            size: size,
            quality: quality,
            resizeContentMode: ResizeContentMode.fit,
          ),
  );
  if (data == null) throw StateError('mediaUnavailable');
  final fitted = await fitImageBytes(data, fit, 'image/jpeg');
  final png = fitted.mimeType == 'image/png';
  return XFile.fromData(
    fitted.bytes,
    mimeType: fitted.mimeType,
    name: png ? 'image.png' : 'image.jpg',
  );
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

/// The package's dark picker theme, with round icon-button feedback.
///
/// Both bars hand their leading widget a full-height slot, so an `IconButton`
/// fills that slot — 40 by 36 in the picker header, 40 by 56 in the viewer —
/// and its stadium border reads as a tall rounded rectangle on hover and press.
/// A circle border keeps the feedback round wherever the button is stretched.
/// The viewer inherits this theme through the picker's `themeData`, so its back
/// arrow follows the same rule.
ThemeData _assetPickerTheme() =>
    AssetPicker.themeData(QChatColors.green).copyWith(
      iconButtonTheme: const IconButtonThemeData(
        style: ButtonStyle(shape: WidgetStatePropertyAll(CircleBorder())),
      ),
    );

/// The picker's own builder, with one change: the frosted header.
///
/// `AssetPickerAppBar` paints its tint into the backdrop and blurs that, so the
/// blur pulls the bright grid from *below* the bar into the bar's bottom edge.
/// The result is a lit band under the header that the tint cannot cover, since
/// the tint is part of what gets blurred. The app's own glass
/// (`design_system/qchat_glass.dart`) blurs first and tints on top; this
/// delegate does the same for the picker.
class _GlassPickerDelegate
    extends DefaultAssetPickerBuilderDelegate<DefaultAssetPickerProvider> {
  _GlassPickerDelegate({
    required super.provider,
    required super.initialPermission,
    super.gridCount,
    super.pickerTheme,
    super.textDelegate,
    super.pathNameBuilder,
    super.locale,
  });

  @override
  AssetPickerAppBar appBar(BuildContext context) {
    final appBar = super.appBar(context);
    // Android draws the bar opaque and never blurs it, so it needs no fix.
    return appBar.blurRadius > 0 ? _GlassAppBar(appBar) : appBar;
  }

  /// The header's close button, with round hover and press feedback.
  ///
  /// The bar hands its leading widget a 44-high slot, so the package's
  /// `IconButton` comes out 40 wide by 36 tall and its stadium border reads as
  /// a rounded rectangle. A square box keeps the feedback a circle.
  @override
  Widget backButton(BuildContext context) {
    return SizedBox(
      width: 48,
      child: Center(
        child: SizedBox.square(
          dimension: 40,
          child: IconButton(
            onPressed: () => Navigator.maybeOf(context)?.maybePop(),
            tooltip: MaterialLocalizations.of(context).closeButtonTooltip,
            style: IconButton.styleFrom(shape: const CircleBorder()),
            icon: const Icon(Icons.close),
          ),
        ),
      ),
    );
  }
}

/// [AssetPickerAppBar] with the tint above the blur instead of below it.
class _GlassAppBar extends AssetPickerAppBar {
  _GlassAppBar(AssetPickerAppBar base)
    : sigma = base.blurRadius,
      super(
        title: base.title,
        leading: base.leading,
        actions: base.actions,
        actionsPadding: base.actionsPadding,
        bottom: base.bottom,
        centerTitle: base.centerTitle,
        automaticallyImplyLeading: base.automaticallyImplyLeading,
        automaticallyImplyActions: base.automaticallyImplyActions,
        backgroundColor: QChatColors.transparent,
        elevation: base.elevation,
        height: base.height,
        brightness: base.brightness,
        iconTheme: base.iconTheme,
        semanticsBuilder: base.semanticsBuilder,
      );

  final double sigma;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tint = theme.appBarTheme.backgroundColor ?? theme.colorScheme.surface;
    return ClipRect(
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: sigma, sigmaY: sigma),
        child: ColoredBox(
          color: tint.withValues(alpha: .9),
          child: super.build(context),
        ),
      ),
    );
  }
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
