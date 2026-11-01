import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:image_picker/image_picker.dart';

/// A caller's bound on a picked image.
///
/// Chat, moments and avatars upload the original file; a Mini App asks for a
/// bounded one because `chooseImage` hands the picture back as a base64
/// `dataUrl`. [width] and [height] are maxima, [quality] is the JPEG quality
/// the platform encoder should use, from 0.1 to 1.
class MediaFit {
  const MediaFit({
    required this.width,
    required this.height,
    required this.quality,
  });

  final int width;
  final int height;
  final double quality;

  /// The largest box inside this fit that keeps a [width] × [height] image's
  /// aspect ratio.
  ///
  /// The platform thumbnail encoders fill the size they are handed, so giving
  /// them a box with the source's own ratio is what stops them cropping.
  (int, int) sizeFor(int width, int height) {
    if (width <= 0 || height <= 0) return (this.width, this.height);
    final scale = math.min(
      1.0,
      math.min(this.width / width, this.height / height),
    );
    return (
      math.max(1, (width * scale).round()),
      math.max(1, (height * scale).round()),
    );
  }
}

/// The picture format [bytes] really are, or null when QChat does not store it.
///
/// A file's name and its `mimeType` do not always describe what is inside it: a
/// gallery picture reaches the app with no mime at all, a screenshot is called
/// `.jpg`, an iPhone photo is HEIC. The server compares an upload's first bytes
/// with the mime it was handed and refuses a mismatch, so every declaration is
/// made from the signature instead of from the file.
String? imageMimeFromBytes(Uint8List bytes) {
  bool starts(List<int> magic, [int at = 0]) {
    if (bytes.length < at + magic.length) return false;
    for (var i = 0; i < magic.length; i++) {
      if (bytes[at + i] != magic[i]) return false;
    }
    return true;
  }

  if (starts(const [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  if (starts(const [0xff, 0xd8, 0xff])) return 'image/jpeg';
  // 'GIF87a' or 'GIF89a'.
  if (starts(const [0x47, 0x49, 0x46, 0x38]) &&
      bytes.length > 5 &&
      (bytes[4] == 0x37 || bytes[4] == 0x39) &&
      bytes[5] == 0x61) {
    return 'image/gif';
  }
  if (starts(const [0x52, 0x49, 0x46, 0x46]) &&
      starts(const [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'image/webp';
  }
  return null;
}

/// The file extension that goes with [mime], for the name an upload is stored
/// under. Anything unknown is a JPEG, which is what the platform encoders make.
String imageExtension(String mime) => switch (mime) {
  'image/png' => 'png',
  'image/gif' => 'gif',
  'image/webp' => 'webp',
  _ => 'jpg',
};

/// [bytes] when they already fit [fit], otherwise the same picture scaled down
/// to fit and re-encoded as PNG.
///
/// The platform encoders honour [MediaFit.quality] but not always the exact
/// size: Android samples in powers of two and can return up to twice the box it
/// was asked for. This is the safety net that keeps the caller's maximum true.
/// `dart:ui` has no JPEG encoder, so a picture that had to be refitted comes
/// back as PNG, and the returned `mimeType` says so.
///
/// The returned mime is always read from the bytes, never guessed: a picture
/// whose format QChat cannot store (HEIC, for one) is re-encoded as PNG even
/// when it already fits, because the server refuses a mime that disagrees with
/// the upload's first bytes.
Future<({Uint8List bytes, String mimeType})> fitImageBytes(
  Uint8List bytes,
  MediaFit fit,
) async {
  final known = imageMimeFromBytes(bytes);
  final probe = await ui.instantiateImageCodec(bytes);
  final frame = await probe.getNextFrame();
  final (width, height) = fit.sizeFor(frame.image.width, frame.image.height);
  final unchanged = width == frame.image.width && height == frame.image.height;
  frame.image.dispose();
  probe.dispose();
  if (unchanged && known != null) return (bytes: bytes, mimeType: known);
  final resized = await ui.instantiateImageCodec(
    bytes,
    targetWidth: width,
    targetHeight: height,
  );
  final resizedFrame = await resized.getNextFrame();
  final data = await resizedFrame.image.toByteData(
    format: ui.ImageByteFormat.png,
  );
  resizedFrame.image.dispose();
  resized.dispose();
  if (data == null) throw StateError('mediaUnavailable');
  return (bytes: data.buffer.asUint8List(), mimeType: 'image/png');
}

/// [file] itself when it already fits [fit], otherwise a PNG of the same
/// picture scaled down to fit.
///
/// Desktop has no platform encoder, so this is the whole resize there. A
/// format Flutter cannot decode (HEIC, for one) is handed back untouched
/// instead of failing the pick.
/// [file] itself when it already fits [fit] and already says what it is,
/// otherwise a file whose bytes fit and whose `mimeType` matches them.
///
/// Desktop has no platform encoder, so this is the whole resize there. A
/// format Flutter cannot decode (HEIC, for one) is handed back untouched
/// instead of failing the pick.
Future<XFile> fitImageFile(XFile file, MediaFit fit) async {
  try {
    final bytes = await file.readAsBytes();
    final fitted = await fitImageBytes(bytes, fit);
    if (identical(fitted.bytes, bytes) && file.mimeType == fitted.mimeType) {
      return file;
    }
    final name = file.name;
    final dot = name.lastIndexOf('.');
    return XFile.fromData(
      fitted.bytes,
      mimeType: fitted.mimeType,
      name:
          '${dot > 0 ? name.substring(0, dot) : name}.'
          '${imageExtension(fitted.mimeType)}',
    );
  } catch (_) {
    return file;
  }
}
