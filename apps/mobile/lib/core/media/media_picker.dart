import 'package:flutter/widgets.dart';
import 'package:image_picker/image_picker.dart';
import '../design_system/dialogs.dart';
import '../localization/strings.dart';
import 'media_fit.dart';
import 'media_picker_fallback.dart'
    if (dart.library.io) 'media_picker_native.dart'
    as device;

export 'media_fit.dart';

/// Shared by chat, moments, avatars, chat backgrounds and Mini Apps.
///
/// Pass [fit] when the caller needs a bounded picture instead of the original,
/// for example a Mini App's `chooseImage`, which returns a base64 `dataUrl`.
Future<List<XFile>> pickQChatMedia(
  BuildContext context, {
  bool imagesOnly = false,
  int maxAssets = 9,
  String? confirmLabel,
  MediaFit? fit,
}) async {
  if (maxAssets < 1) return [];
  try {
    return await device.pickDeviceMedia(
      context,
      imagesOnly: imagesOnly,
      maxAssets: maxAssets,
      confirmLabel: confirmLabel,
      fit: fit,
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

/// Picks one image for a Mini App, bounded by [fit].
///
/// Returns null when the user cancels.
Future<XFile?> pickQChatImage(BuildContext context, MediaFit fit) async {
  final files = await pickQChatMedia(
    context,
    imagesOnly: true,
    maxAssets: 1,
    fit: fit,
  );
  return files.isEmpty ? null : files.first;
}
