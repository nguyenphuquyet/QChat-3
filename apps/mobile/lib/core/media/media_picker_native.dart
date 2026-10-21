import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:wechat_assets_picker/wechat_assets_picker.dart';
import '../design_system/dialogs.dart';
import '../localization/strings.dart';
import 'media_picker_fallback.dart' as fallback;

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
  final selected = await AssetPicker.pickAssets(
    context,
    permissionRequestOption: permission,
    pickerConfig: AssetPickerConfig(
      requestType: type,
      maxAssets: maxAssets,
      gridCount: 4,
      themeColor: const Color(0xff07c160),
      textDelegate: Localizations.localeOf(context).languageCode == 'vi'
          ? _VietnamesePickerText(confirmLabel)
          : null,
      pathNameBuilder: (path) =>
          path.isAll ? tr(context, 'recentMedia') : path.name,
    ),
    pageRouteBuilder: (picker) => AssetPickerPageRoute(
      builder: (_) => picker,
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

class _VietnamesePickerText extends VietnameseAssetPickerTextDelegate {
  _VietnamesePickerText(this.label);
  final String? label;
  @override
  String get confirm => label ?? 'Chọn';
}
