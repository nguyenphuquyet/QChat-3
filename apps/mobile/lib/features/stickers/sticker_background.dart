import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart' show visibleForTesting;
// The one file that talks to the on-device segmentation model. The package
// re-exports Material for its `Color` helper, so it stays behind this boundary
// the way the photo picker stays behind `media_picker_native.dart`; no widget
// from it reaches the app.
import 'package:image_background_remover/image_background_remover.dart';

/// Pictures larger than this are measured at this size. The model itself reads
/// 320 px; keeping the mask pass near a thousand keeps the three RGBA buffers
/// it needs small enough for a phone that is already holding the full photo.
const _maxSide = 1024;

/// Below this model confidence a pixel is background.
const _modelBackground = 128;

Future<void>? _loading;

Future<BackgroundRemover> _remover() async {
  final remover = BackgroundRemover.instance;
  _loading ??= remover.initializeOrt();
  try {
    await _loading;
  } catch (_) {
    // A failed load must not poison the next try (a missing runtime can only be
    // fixed by an update, but a one-off failure should not stick).
    _loading = null;
    rethrow;
  }
  remover.maxWorkingDimension = _maxSide;
  return remover;
}

/// Takes the background out of a picture with the on-device segmentation model.
///
/// Only background **connected to the picture's border** is cleared: a white
/// shirt, an empty eye or a highlight inside the drawing is part of the subject
/// and stays, even when the model calls it background. The kept pixels come
/// from the original picture, so the cut never washes out colours.
///
/// Returns a PNG that still has its alpha, or null when the model cannot run
/// (no runtime on this device, an unreadable file): the studio then falls back
/// to its border-colour cut, so a sticker can always be made.
Future<Uint8List?> cutStickerBackground(Uint8List source) async {
  ui.Image? masked;
  ui.Image? original;
  try {
    final remover = await _remover();
    masked = await remover.removeBg(source);
    final width = masked.width, height = masked.height;
    if (width < 2 || height < 2) return null;
    original = await _decode(source, width, height);
    if (original == null) return null;
    final modelData = await masked.toByteData(format: ui.ImageByteFormat.rawRgba);
    // Straight (unpremultiplied) colour: the alpha below is rewritten, and a
    // premultiplied pixel would darken as soon as its alpha changed.
    final pixelData = await original.toByteData(
      format: ui.ImageByteFormat.rawStraightRgba,
    );
    if (modelData == null || pixelData == null) return null;
    final model = modelData.buffer.asUint8List();
    final pixels = pixelData.buffer.asUint8List();
    final alpha = Uint8List(width * height);
    for (var i = 0; i < alpha.length; i++) {
      alpha[i] = model[i * 4 + 3];
    }
    final outside = outsideMask(alpha, width, height);
    final out = Uint8List(alpha.length * 4);
    for (var i = 0; i < alpha.length; i++) {
      final at = i * 4;
      out[at] = pixels[at];
      out[at + 1] = pixels[at + 1];
      out[at + 2] = pixels[at + 2];
      // Whatever the model cut but the border cannot reach keeps the opacity it
      // had in the original picture.
      out[at + 3] = outside[i] == 1
          ? 0
          : math.max(pixels[at + 3], alpha[i]);
    }
    return await _png(out, width, height);
  } catch (_) {
    return null;
  } finally {
    masked?.dispose();
    original?.dispose();
  }
}

/// The picture at exactly [width] x [height], decoded by Flutter, or null when
/// its own codec will not take a size (which the mask pass cannot line up with).
Future<ui.Image?> _decode(Uint8List bytes, int width, int height) async {
  ui.Codec? codec;
  try {
    codec = await ui.instantiateImageCodec(
      bytes,
      targetWidth: width,
      targetHeight: height,
    );
    final frame = await codec.getNextFrame();
    final image = frame.image;
    if (image.width != width || image.height != height) {
      image.dispose();
      return null;
    }
    return image;
  } catch (_) {
    return null;
  } finally {
    codec?.dispose();
  }
}

Future<Uint8List?> _png(Uint8List rgba, int width, int height) async {
  final ready = Completer<ui.Image>();
  ui.decodeImageFromPixels(
    rgba,
    width,
    height,
    ui.PixelFormat.rgba8888,
    ready.complete,
  );
  final image = await ready.future;
  try {
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    return data?.buffer.asUint8List();
  } finally {
    image.dispose();
  }
}

/// 1 where a pixel is background the model found *and* that the picture's
/// border can reach, 0 everywhere else.
///
/// The reach is what keeps the subject whole: a transparent hole surrounded by
/// the drawing is not connected to the edge, so a white eye or a gap between an
/// arm and the body survives the cut.
@visibleForTesting
Uint8List outsideMask(Uint8List alpha, int width, int height) {
  final outside = Uint8List(width * height);
  final pending = <int>[];

  bool background(int index) => alpha[index] < _modelBackground;

  void seed(int index) {
    if (outside[index] == 0 && background(index)) {
      outside[index] = 1;
      pending.add(index);
    }
  }

  for (var x = 0; x < width; x++) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (var y = 0; y < height; y++) {
    seed(y * width);
    seed(y * width + width - 1);
  }
  while (pending.isNotEmpty) {
    final index = pending.removeLast();
    final x = index % width, y = index ~/ width;
    void visit(int next) {
      if (outside[next] == 0 && background(next)) {
        outside[next] = 1;
        pending.add(next);
      }
    }

    if (x > 0) visit(index - 1);
    if (x < width - 1) visit(index + 1);
    if (y > 0) visit(index - width);
    if (y < height - 1) visit(index + width);
  }
  return outside;
}
