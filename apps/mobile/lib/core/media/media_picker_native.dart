import 'dart:io';
import 'package:flutter/widgets.dart';
import 'package:image_picker/image_picker.dart';
import 'media_library_io.dart';
import 'media_picker_fallback.dart' as fallback;
import 'media_picker_sheet.dart';

/// Opens QChat's own media page over the device's photo library, so a photo is
/// picked the same way from the chat, from Moments, from an avatar and from a
/// chat background. Desktop has no library to browse, so it keeps the file
/// chooser; the phone understands a directory of files no more than the web
/// does.
Future<List<XFile>> pickDeviceMedia(
  BuildContext context, {
  required bool imagesOnly,
  required int maxAssets,
  String? confirmLabel,
}) async {
  if (!Platform.isAndroid && !Platform.isIOS) {
    return fallback.pickDeviceMedia(
      context,
      imagesOnly: imagesOnly,
      maxAssets: maxAssets,
      confirmLabel: confirmLabel,
    );
  }
  return showMediaPicker(
    context,
    library: DeviceMediaLibrary(imagesOnly: imagesOnly),
    imagesOnly: imagesOnly,
    maxAssets: maxAssets,
    confirmLabel: confirmLabel,
  );
}
