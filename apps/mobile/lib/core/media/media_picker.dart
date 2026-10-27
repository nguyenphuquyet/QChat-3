import 'package:flutter/widgets.dart';
import 'package:image_picker/image_picker.dart';
import '../design_system/dialogs.dart';
import '../localization/strings.dart';
import 'media_picker_fallback.dart'
    if (dart.library.io) 'media_picker_native.dart'
    as device;

/// Shared by chat, moments, avatars and chat backgrounds.
Future<List<XFile>> pickQChatMedia(
  BuildContext context, {
  bool imagesOnly = false,
  int maxAssets = 9,
  String? confirmLabel,
}) async {
  if (maxAssets < 1) return [];
  try {
    return await device.pickDeviceMedia(
      context,
      imagesOnly: imagesOnly,
      maxAssets: maxAssets,
      confirmLabel: confirmLabel,
    );
  } catch (_) {
    if (context.mounted) {
      await showQChatDialog<void>(
        context,
        message: tr(context, 'mediaUnavailable'),
        actions: [QChatDialogAction(label: tr(context, 'close'))],
      );
    }
    return [];
  }
}
