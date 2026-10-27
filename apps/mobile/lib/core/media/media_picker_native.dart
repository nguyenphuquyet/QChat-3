import 'dart:io';
import 'package:flutter/widgets.dart';
import 'package:image_picker/image_picker.dart';
import 'media_picker_fallback.dart' as fallback;

/// Opens the operating system's own media chooser. There is no custom gallery
/// UI here, so the picker never inherits a third-party design language.
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
  final picker = ImagePicker();
  final List<XFile> files;
  if (maxAssets == 1) {
    final file = imagesOnly
        ? await picker.pickImage(source: ImageSource.gallery)
        : await picker.pickMedia();
    files = file == null ? const [] : [file];
  } else {
    files = imagesOnly
        ? await picker.pickMultiImage(limit: maxAssets)
        : await picker.pickMultipleMedia(limit: maxAssets);
  }
  return files.take(maxAssets).toList();
}
