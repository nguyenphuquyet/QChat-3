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

/// [bytes] when they already fit [fit], otherwise the same picture scaled down
/// to fit and re-encoded as PNG.
///
/// The platform encoders honour [MediaFit.quality] but not always the exact
/// size: Android samples in powers of two and can return up to twice the box it
/// was asked for. This is the safety net that keeps the caller's maximum true.
/// `dart:ui` has no JPEG encoder, so a picture that had to be refitted comes
/// back as PNG, and the returned `mimeType` says so.
Future<({Uint8List bytes, String mimeType})> fitImageBytes(
  Uint8List bytes,
  MediaFit fit,
  String mimeType,
) async {
  final probe = await ui.instantiateImageCodec(bytes);
  final frame = await probe.getNextFrame();
  final (width, height) = fit.sizeFor(frame.image.width, frame.image.height);
  final unchanged = width == frame.image.width && height == frame.image.height;
  frame.image.dispose();
  probe.dispose();
  if (unchanged) return (bytes: bytes, mimeType: mimeType);
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
Future<XFile> fitImageFile(XFile file, MediaFit fit) async {
  try {
    final bytes = await file.readAsBytes();
    final fitted = await fitImageBytes(
      bytes,
      fit,
      file.mimeType ?? 'image/jpeg',
    );
    if (identical(fitted.bytes, bytes)) return file;
    final name = file.name;
    final dot = name.lastIndexOf('.');
    return XFile.fromData(
      fitted.bytes,
      mimeType: fitted.mimeType,
      name: '${dot > 0 ? name.substring(0, dot) : name}.png',
    );
  } catch (_) {
    return file;
  }
}
