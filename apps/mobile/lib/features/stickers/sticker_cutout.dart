import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart' show compute, visibleForTesting;
import 'package:image/image.dart' as img;

import 'sticker_background.dart';

/// Stands in for [cutStickerBackground] in tests, where there is no on-device
/// runtime: give it a picture that already has its transparent edge and the
/// studio's measuring, cropping and squaring run for real.
@visibleForTesting
Future<Uint8List?> Function(Uint8List source)? debugStickerCutter;

/// One sticker produced from a source picture or sheet.
class ExtractedSticker {
  const ExtractedSticker({
    required this.bytes,
    required this.animated,
    required this.width,
    required this.height,
  });

  final Uint8List bytes;
  final bool animated;
  final int width;
  final int height;

  String get mime => animated ? 'image/gif' : 'image/png';
}

/// Turns one picked picture into sticker artwork.
///
/// The work runs in a background isolate: a 700 px sheet is about half a
/// million pixels, which is far too much for the frame that opened the studio.
///
/// * [split] finds the separate drawings on a sticker sheet and crops each one.
/// * [removeBackground] is opt-in. The on-device segmentation model finds the
///   subject and clears only the background reachable from the border, so a
///   picture comes out transparent while the drawing keeps its own white
///   details. Without the model (or with a GIF) it falls back to flooding the
///   area connected to the border that matches the border colour.
///
/// Every sticker comes out as a square picture. A cut drawing is centred on a
/// transparent square, so a tall or wide drawing is never clipped; a plain
/// photo is centre-cropped to a square, the way a sticker maker crops one.
///
/// GIF frames are read as an animation. Every frame is cut with the same boxes,
/// so an animated sticker stays animated.
///
/// A picture the `image` package refuses is re-encoded by Flutter's own decoder
/// and cut again, so a sticker saved from another app (a WebP variant, a HEIC,
/// a CMYK JPEG) is artwork like any other photo. When even that finds nothing
/// to cut — a sheet with no clear background, a cut that swallows the drawing —
/// the whole picture becomes one square sticker rather than an error.
///
/// With [removeBackground] the model's cut is then measured on what is left, so
/// the sticker is cropped tightly around the subject and padded to a square. An
/// animated GIF skips the model — one frame would lose the animation — and uses
/// the plain cut on every frame, which is measured the same way.
Future<List<ExtractedSticker>> extractStickers(
  Uint8List source, {
  bool split = true,
  bool removeBackground = false,
}) async {
  if (source.isEmpty) return const [];
  Object? failure;
  Future<List<Map<String, Object>>?> attempt(
    Uint8List bytes, {
    required bool separate,
    required bool cut,
    bool trimmed = false,
  }) async {
    try {
      final rows = await _cut(
        bytes,
        split: separate,
        removeBackground: cut,
        trimmed: trimmed,
      );
      return rows.isEmpty ? null : rows;
    } catch (error) {
      failure ??= error;
      return null;
    }
  }

  // The model owns its own runtime and cannot run in the isolate `_cut` uses,
  // so it works on the frame first and the pure-Dart pass then only measures
  // and squares the result. Its PNG already has the transparent edge, so that
  // pass must not cut again — but it should still crop to what is left.
  final modelled = removeBackground && !_isGif(source)
      ? await (debugStickerCutter ?? cutStickerBackground)(source)
      : null;
  var rows = modelled != null
      ? await attempt(modelled, separate: split, cut: false, trimmed: true)
      : await attempt(source, separate: split, cut: removeBackground);
  if (rows == null) {
    // The preview was drawn by Flutter, so when `image` comes back empty or
    // throws, Flutter can still read the picture: re-encode it as a bounded
    // PNG — which also caps the memory the cut works in — and try again.
    final png = await _asPng(source);
    if (png != null) {
      rows = await attempt(png, separate: split, cut: removeBackground);
      if (rows == null && (split || removeBackground)) {
        // Neither switch found a sticker. The picture itself still is one, and
        // a square sticker beats "cannot process this picture".
        rows = await attempt(png, separate: false, cut: false);
      }
    }
  }
  if (rows == null) {
    final error = failure;
    if (error != null) throw error;
    return const [];
  }
  return [
    for (final row in rows)
      ExtractedSticker(
        bytes: row['bytes'] as Uint8List,
        animated: row['animated'] == true,
        width: row['width'] as int,
        height: row['height'] as int,
      ),
  ];
}

/// One extraction pass in the background isolate.
Future<List<Map<String, Object>>> _cut(
  Uint8List bytes, {
  required bool split,
  required bool removeBackground,
  bool trimmed = false,
}) => compute(_extract, {
  'bytes': bytes,
  'split': split,
  'removeBackground': removeBackground,
  'trimmed': trimmed,
});

/// [bytes] as a PNG no larger than [_maxSide], decoded by Flutter rather than by
/// the `image` package, or null when not even Flutter can read the picture.
///
/// The codec is asked for the bounded size up front, so a 50-megapixel photo
/// never becomes a full-size bitmap in the frame that asked for it. A codec
/// that refuses to be sized (WBMP is one) is read whole instead.
Future<Uint8List?> _asPng(Uint8List bytes) async =>
    await _boundedPng(bytes) ?? await _plainPng(bytes);

Future<Uint8List?> _boundedPng(Uint8List bytes) async {
  ui.ImageDescriptor? descriptor;
  ui.Codec? codec;
  try {
    final buffer = await ui.ImmutableBuffer.fromUint8List(bytes);
    descriptor = await ui.ImageDescriptor.encoded(buffer);
    final longest = math.max(descriptor.width, descriptor.height);
    final scale = longest > _maxSide ? _maxSide / longest : 1.0;
    codec = await descriptor.instantiateCodec(
      targetWidth: math.max(1, (descriptor.width * scale).round()),
      targetHeight: math.max(1, (descriptor.height * scale).round()),
    );
    return await _pngOf(codec);
  } catch (_) {
    return null;
  } finally {
    codec?.dispose();
    descriptor?.dispose();
  }
}

Future<Uint8List?> _plainPng(Uint8List bytes) async {
  ui.Codec? codec;
  try {
    codec = await ui.instantiateImageCodec(bytes);
    return await _pngOf(codec);
  } catch (_) {
    return null;
  } finally {
    codec?.dispose();
  }
}

Future<Uint8List?> _pngOf(ui.Codec codec) async {
  final frame = await codec.getNextFrame();
  final data = await frame.image.toByteData(format: ui.ImageByteFormat.png);
  frame.image.dispose();
  return data?.buffer.asUint8List();
}

/// Artwork beyond this edge is scaled down before it is analysed. 720 px is
/// larger than any sticker is drawn in the app, and it keeps the isolate fast.
const _maxSide = 720;
const _maxStickers = 40;
const _minStickerSide = 24;
const _minStickerArea = 260;
const _backgroundTolerance = 36;
const _backgroundAlpha = 16;

List<Map<String, Object>> _extract(Map<String, Object?> args) {
  final source = args['bytes']! as Uint8List;
  final split = args['split'] == true;
  final removeBackground = args['removeBackground'] == true;
  // The picture already lost its background elsewhere and carries a
  // transparent edge: measure what is left instead of the whole canvas.
  final trimmed = args['trimmed'] == true;
  final animated = _isGif(source);
  final decoded = animated ? img.decodeGif(source) : img.decodeImage(source);
  if (decoded == null) return const [];

  final frames = animated
      ? (decoded.frames.isEmpty ? <img.Image>[decoded] : decoded.frames)
      : <img.Image>[decoded];
  final working = [
    for (final frame in frames.take(120))
      _bounded(frame).convert(numChannels: 4),
  ];
  if (working.isEmpty) return const [];

  final first = working.first;
  // A sheet is measured before the background goes, so every drawing keeps its
  // own box; anything else is measured afterwards, on what is left.
  final sheet = split ? _regions(first) : null;
  if (sheet != null && sheet.isEmpty) return const [];
  // Removal happens on every frame, after the boxes were measured, so an
  // animated sticker keeps its animation and the same crop on each frame.
  if (removeBackground) {
    for (final frame in working) {
      _cutBackground(frame);
    }
  }

  // A picture whose background is gone — cut here or by the model — is measured
  // on what is left, so the sticker fills its square instead of keeping the
  // canvas the photo came in.
  final List<_Box> boxes;
  if (sheet != null) {
    boxes = sheet;
  } else if (removeBackground || trimmed) {
    final subject = _alphaBounds(first);
    boxes = subject == null ? const [] : [subject];
  } else {
    boxes = [_Box(0, 0, first.width, first.height, first.width * first.height)];
  }
  if (boxes.isEmpty) return const [];

  final result = <Map<String, Object>>[];
  // A sheet is cut into drawings that must keep their outline, and cut-out
  // artwork has transparent edges to preserve: both are padded to a square. A
  // plain photo is content all the way to its border, so it is centre-cropped
  // instead of gaining transparent bands.
  final square = split || removeBackground || trimmed
      ? _Square.pad
      : _Square.crop;
  for (final box in boxes) {
    final crops = <img.Image>[];
    for (final frame in working) {
      final crop = _crop(frame, box, square);
      if (crop == null) break;
      crops.add(crop);
    }
    if (crops.length != working.length) continue;
    final bytes = _encode(crops);
    final width = crops.first.width, height = crops.first.height;
    result.add({
      'bytes': bytes,
      // Only a sheet with more than one frame is encoded as a GIF. A GIF with a
      // single frame comes out as a PNG, so it must not be declared as one.
      'animated': crops.length > 1,
      'width': width,
      'height': height,
    });
  }
  return result;
}

bool _isGif(Uint8List bytes) =>
    bytes.length > 6 &&
    bytes[0] == 0x47 &&
    bytes[1] == 0x49 &&
    bytes[2] == 0x46 &&
    bytes[3] == 0x38;

img.Image _bounded(img.Image frame) {
  final longest = math.max(frame.width, frame.height);
  if (longest <= _maxSide) return frame;
  final scale = _maxSide / longest;
  return img.copyResize(
    frame,
    width: (frame.width * scale).round(),
    height: (frame.height * scale).round(),
    interpolation: img.Interpolation.average,
  );
}

/// A crop rectangle in source pixels.
class _Box {
  _Box(this.left, this.top, this.right, this.bottom, this.area)
    : assert(right > left && bottom > top);

  int left, top, right, bottom;
  final int area;

  int get width => right - left;
  int get height => bottom - top;

  bool touches(_Box other, int padding) =>
      left - padding <= other.right &&
      right + padding >= other.left &&
      top - padding <= other.bottom &&
      bottom + padding >= other.top;

  void absorb(_Box other) {
    left = math.min(left, other.left);
    top = math.min(top, other.top);
    right = math.max(right, other.right);
    bottom = math.max(bottom, other.bottom);
  }
}

/// 1 marks a pixel that belongs to a drawing; 0 is the sheet's background.
Uint8List _backgroundMask(img.Image frame) {
  final w = frame.width, h = frame.height;
  final background = _borderColor(frame);
  final mask = Uint8List(w * h);
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      final pixel = frame.getPixel(x, y);
      final isBackground = pixel.a < _backgroundAlpha ||
          (background != null && _near(pixel, background));
      mask[y * w + x] = isBackground ? 0 : 1;
    }
  }
  return mask;
}

/// Finds the separate drawings on a sheet. When the background is opaque the
/// border colour defines what is *not* part of a sticker, so a white sheet can
/// be cut without also making it transparent.
List<_Box> _regions(img.Image frame) {
  final w = frame.width, h = frame.height;
  final boxes = _components(_backgroundMask(frame), w, h);
  if (boxes.isEmpty) return boxes;
  return _merge(boxes, math.max(4, (math.min(w, h) * .05).round()));
}

void _cutBackground(img.Image frame) => _clearConnectedBackground(
  frame,
  _backgroundMask(frame),
  frame.width,
  frame.height,
);

/// The picture's background is whatever colour the corners share; a photo
/// without a uniform border returns null and splitting falls back to alpha.
img.Pixel? _borderColor(img.Image frame) {
  final points = <img.Pixel>[
    frame.getPixel(0, 0),
    frame.getPixel(frame.width - 1, 0),
    frame.getPixel(0, frame.height - 1),
    frame.getPixel(frame.width - 1, frame.height - 1),
  ];
  final opaque = points.where((pixel) => pixel.a >= _backgroundAlpha);
  if (opaque.length < 3) return null;
  final first = opaque.first;
  for (final pixel in opaque.skip(1)) {
    if (!_near(pixel, first, tolerance: 24)) return null;
  }
  return first;
}

bool _near(img.Pixel pixel, img.Pixel other, {int tolerance = _backgroundTolerance}) {
  final dr = (pixel.r - other.r).abs();
  final dg = (pixel.g - other.g).abs();
  final db = (pixel.b - other.b).abs();
  return dr <= tolerance && dg <= tolerance && db <= tolerance;
}

/// Floods the background from the frame's border inwards. Only pixels connected
/// to the edge lose their alpha, so white inside a drawing (eyes, teeth) stays.
void _clearConnectedBackground(
  img.Image frame,
  Uint8List mask,
  int w,
  int h,
) {
  final pending = <int>[];
  void consider(int index) {
    if (mask[index] == 0) pending.add(index);
  }

  for (var x = 0; x < w; x++) {
    consider(x);
    consider((h - 1) * w + x);
  }
  for (var y = 0; y < h; y++) {
    consider(y * w);
    consider(y * w + w - 1);
  }
  while (pending.isNotEmpty) {
    final index = pending.removeLast();
    final x = index % w, y = index ~/ w;
    final pixel = frame.getPixel(x, y);
    frame.setPixelRgba(x, y, pixel.r, pixel.g, pixel.b, 0);
    // A processed pixel becomes 2 so it is not queued again.
    mask[index] = 2;
    if (x > 0 && mask[index - 1] == 0) pending.add(index - 1);
    if (x < w - 1 && mask[index + 1] == 0) pending.add(index + 1);
    if (y > 0 && mask[index - w] == 0) pending.add(index - w);
    if (y < h - 1 && mask[index + w] == 0) pending.add(index + w);
  }
}

List<_Box> _components(Uint8List mask, int w, int h) {
  final seen = Uint8List(w * h);
  final boxes = <_Box>[];
  final queue = <int>[];
  for (var start = 0; start < mask.length; start++) {
    if (mask[start] != 1 || seen[start] == 1) continue;
    queue
      ..clear()
      ..add(start);
    seen[start] = 1;
    var left = w, top = h, right = 0, bottom = 0, area = 0;
    while (queue.isNotEmpty) {
      final index = queue.removeLast();
      final x = index % w, y = index ~/ w;
      area++;
      if (x < left) left = x;
      if (y < top) top = y;
      if (x + 1 > right) right = x + 1;
      if (y + 1 > bottom) bottom = y + 1;
      void visit(int next) {
        if (mask[next] == 1 && seen[next] == 0) {
          seen[next] = 1;
          queue.add(next);
        }
      }

      if (x > 0) visit(index - 1);
      if (x < w - 1) visit(index + 1);
      if (y > 0) visit(index - w);
      if (y < h - 1) visit(index + w);
    }
    if (area < _minStickerArea) continue;
    if (right - left < _minStickerSide || bottom - top < _minStickerSide) {
      continue;
    }
    boxes.add(_Box(left, top, right, bottom, area));
  }
  boxes.sort((a, b) => b.area.compareTo(a.area));
  return boxes.take(_maxStickers).toList();
}

/// Joins drawings that belong together, such as a character and a detached
/// sparkle. Bigger pieces claim smaller neighbours that fall within their
/// padded rectangle.
List<_Box> _merge(List<_Box> boxes, int padding) {
  final merged = <_Box>[];
  for (final box in boxes) {
    // Claimed boxes are collected before the list is edited: a box can bridge
    // two drawings at once, and folding them while walking `merged` would
    // change the list under its own iterator.
    final claimed = <_Box>[];
    for (final other in merged) {
      if (other.touches(box, padding)) claimed.add(other);
    }
    if (claimed.isEmpty) {
      merged.add(box);
      continue;
    }
    final first = claimed.first;
    first.absorb(box);
    for (final other in claimed.skip(1)) {
      first.absorb(other);
      merged.remove(other);
    }
  }
  return merged;
}

/// The rectangle that still holds something opaque, or null when the picture
/// is empty. Used after the model took the background out: it is what makes a
/// sticker fill its square instead of keeping the canvas the photo came in.
_Box? _alphaBounds(img.Image frame) {
  final w = frame.width, h = frame.height;
  var left = w, top = h, right = 0, bottom = 0;
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      if (frame.getPixel(x, y).a < _backgroundAlpha) continue;
      if (x < left) left = x;
      if (y < top) top = y;
      if (x + 1 > right) right = x + 1;
      if (y + 1 > bottom) bottom = y + 1;
    }
  }
  // No minimum side here: the subject of a photo can be a thin object, and a
  // sliver of it is still what the sticker should show. An empty cut is what
  // sends extraction back to the whole picture.
  if (right - left < 2 || bottom - top < 2) return null;
  return _Box(left, top, right, bottom, (right - left) * (bottom - top));
}

/// How a crop becomes square.
enum _Square {
  /// Centre-crop to the shorter side, dropping the outer pixels.
  crop,

  /// Centre the crop on a transparent square, keeping every pixel.
  pad,
}

img.Image? _crop(img.Image frame, _Box box, _Square square) {
  final padding = math.max(2, (math.max(box.width, box.height) * .05).round());
  final left = math.max(0, box.left - padding);
  final top = math.max(0, box.top - padding);
  final right = math.min(frame.width, box.right + padding);
  final bottom = math.min(frame.height, box.bottom + padding);
  if (right <= left || bottom <= top) return null;
  final crop = img.copyCrop(
    frame,
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  );
  final squared = switch (square) {
    _Square.crop => _centreSquare(crop),
    _Square.pad => _transparentSquare(crop),
  }..frameDuration = frame.frameDuration;
  final side = squared.width;
  const maxStickerSide = 512;
  if (side <= maxStickerSide) return squared;
  final scale = maxStickerSide / side;
  return img.copyResize(
    squared,
    width: math.max(1, (squared.width * scale).round()),
    height: math.max(1, (squared.height * scale).round()),
    interpolation: img.Interpolation.average,
  )..frameDuration = frame.frameDuration;
}

/// Drops the outer pixels of a picture that has no transparent edge.
img.Image _centreSquare(img.Image image) {
  final side = math.min(image.width, image.height);
  if (image.width == side && image.height == side) return image;
  return img.copyCrop(
    image,
    x: (image.width - side) ~/ 2,
    y: (image.height - side) ~/ 2,
    width: side,
    height: side,
  );
}

/// Keeps the whole drawing on a transparent square, centred.
img.Image _transparentSquare(img.Image image) {
  final side = math.max(image.width, image.height);
  if (image.width == side && image.height == side) return image;
  final canvas = img.Image(width: side, height: side, numChannels: 4);
  img.compositeImage(canvas, image, center: true);
  return canvas;
}

Uint8List _encode(List<img.Image> frames) {
  if (frames.length == 1) return img.encodePng(frames.first);
  final base = img.Image.from(frames.first, noAnimation: true);
  base.frameType = img.FrameType.animation;
  base.frameDuration = frames.first.frameDuration;
  for (final frame in frames.skip(1)) {
    base.addFrame(
      img.Image.from(frame, noAnimation: true)
        ..frameDuration = frame.frameDuration,
    );
  }
  return img.encodeGif(base, singleFrame: false);
}
